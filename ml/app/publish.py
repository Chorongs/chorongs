"""
    반영 (PUBLISH), 되돌리기 (ROLLBACK): FastAPI가 상품 표에 한 트랜잭션으로 씀 (ADMIN-04, 05, EXT-05, B16)

    반영 publish(): 작업이 DONE이고 24시간 안 → 기준 버전 같음 → 확인 필요 없음
      → 이력 1건 (PUBLISH, admin_id, 건수) + 바뀌는 상품마다 변경 기록 (product_snapshot, 바뀌기 전 값)
      → loan_product (NEW는 INSERT, 나머지는 같은 행 UPDATE라 product_id 그대로. REMOVE는 CLOSED, REOPEN은 ON, 숨긴 상품은 HIDDEN 유지)
      → tag (새 값만), product_tag·product_rate 교체, product_rate_month 공시월 추가 (같은 달이면 교체) → 작업 PUBLISHED
    되돌리기 rollback(): 기준 버전 같음 → 대상 이력 이후의 변경 기록을 최신부터 거꾸로 적용 (before_data에 있는 칸만)
      → 이력 1건 (ROLLBACK, target_history_id) + 되돌린 상품마다 변경 기록 (되돌리기도 다시 되돌릴 수 있게)

    before_data JSON: 상품 칸 (PRODUCT_COLS + product_status) + "tags" [{tag_type, tag_value}] + "rates" [product_rate 줄]
      날짜 글은 응답 규칙과 같은 'yyyy-MM-dd HH:mm' (읽을 때는 'yyyy-MM-dd', ISO 'T' 형식도 받음)
      Spring이 쓰는 상태만 바꾼 기록은 {"product_status": 값} (+ disclose_end)만 있음 → 그 칸만 되돌림
      ADD (신규 반영)는 before_data 없음 → 되돌리면 CLOSED
    되돌릴 변경 기록이 0개(지금 마지막 이력을 고름)면 409 NOTHING_TO_ROLLBACK (빈 이력으로 버전만 올리지 않음)
    넣기 함수는 첫 적재 load.py와 같은 것 (ensure_tags, link_rows, insert_links)
"""
import json
import logging
from collections import Counter
from datetime import date, datetime

from sqlalchemy import CLOB, bindparam, text

from app.imports import (KEEP_HOURS, LAST_VERSION, JobConflict, NotFound, NotPublishable, after_data, read_products,
                         to_json)
from app.load import (DATE_COLS, INSERT_PRODUCT, PRODUCT_COLS, SELECT_PRODUCT_IDS, catalog_summary, ensure_tags,
                      id_map, insert_links, link_rows, product_key)

logger = logging.getLogger(__name__)

STATUS_COL = "product_status"
RESTORE_COLS = set(PRODUCT_COLS) | {STATUS_COL}      # before_data에서 되돌릴 수 있는 상품 칸 (B1: 칸 이름은 이 목록만)
SNAPSHOT_TYPE = {"CHANGE": "CHANGE", "REOPEN": "CHANGE", "REMOVE": "REMOVE"}   # diff_type → product_snapshot.change_type

# ---------- SQL ----------

LOCK_HISTORY = text("LOCK TABLE product_update_history IN EXCLUSIVE MODE")
EXPIRE_JOB = text("UPDATE import_job SET job_status = 'EXPIRED' "
                  "WHERE job_id = :job_id AND job_status = 'DONE' AND finished_at < SYSDATE - :hours / 24")
SELECT_JOB_FOR_UPDATE = text("SELECT job_status, sources FROM import_job WHERE job_id = :job_id FOR UPDATE")
SELECT_JOB_ITEMS = text("SELECT item_id, diff_type, product_id, after_data FROM import_item WHERE job_id = :job_id")
PUBLISH_JOB = text("UPDATE import_job SET job_status = 'PUBLISHED' WHERE job_id = :job_id")

INSERT_PUBLISH_HISTORY = text(
    "INSERT INTO product_update_history (admin_id, action_type, source, added_count, changed_count, removed_count, memo) "
    "VALUES (:admin_id, 'PUBLISH', :source, :added, :changed, :removed, :memo)")
UPDATE_COUNT_JSON = text("UPDATE product_update_history SET count_json = :count_json WHERE history_id = :history_id"
                         ).bindparams(bindparam("count_json", type_=CLOB))
INSERT_ROLLBACK_HISTORY = text(
    "INSERT INTO product_update_history (admin_id, action_type, target_history_id, changed_count, memo) "
    "VALUES (:admin_id, 'ROLLBACK', :target_history_id, :changed, :memo)")
EXISTS_HISTORY = text("SELECT COUNT(*) FROM product_update_history WHERE history_id = :history_id")
SELECT_SNAPSHOTS_AFTER = text("SELECT history_id, product_id, change_type, before_data FROM product_snapshot "
                              "WHERE history_id > :history_id ORDER BY history_id DESC, snapshot_id DESC")
INSERT_SNAPSHOT = text("INSERT INTO product_snapshot (history_id, product_id, change_type, before_data) "
                       "VALUES (:history_id, :product_id, :change_type, :before_data)"
                       ).bindparams(bindparam("before_data", type_=CLOB))

DELETE_PRODUCT_TAGS = text("DELETE FROM product_tag WHERE product_id = :product_id")
DELETE_RATES = text("DELETE FROM product_rate WHERE product_id = :product_id")
DELETE_RATE_MONTH = text("DELETE FROM product_rate_month WHERE product_id = :product_id AND dcls_month = :dcls_month")

# 상품 칸 전부 + 상태를 한 번에 (반영 CHANGE·REOPEN, 되돌리기 전체 기록). 칸 묶음이 다른 UPDATE는 update_sql로 만듦
UPDATE_PRODUCT_ALL = text(
    f"UPDATE loan_product SET {', '.join(f'{c} = :{c}' for c in PRODUCT_COLS)}, {STATUS_COL} = :{STATUS_COL} "
    "WHERE product_id = :product_id"
).bindparams(bindparam("raw_json", type_=CLOB))
UPDATE_STATUS = text(f"UPDATE loan_product SET {STATUS_COL} = :{STATUS_COL} WHERE product_id = :product_id")


# ---------- DB 없이 쓰는 함수 ----------

def before_data(product):
    """변경 기록에 남길 바뀌기 전 값 (read_products 행 1개) = after_data 모양 + product_status. 상품 번호, 조회수는 안 넣음"""
    return {**after_data(product), STATUS_COL: product[STATUS_COL]}


def to_dt(value):
    """JSON의 날짜 글 ('yyyy-MM-dd HH:mm', 'yyyy-MM-dd', ISO 'T' 형식) → datetime (DATE 칸에 넣을 값)"""
    if value is None or isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    return datetime.fromisoformat(value)


def product_values(data):
    """after_data, before_data의 상품 칸 → UPDATE에 넣을 값 (날짜 글은 datetime으로)"""
    values = {k: v for k, v in data.items() if k in RESTORE_COLS}
    for col in DATE_COLS:
        if col in values:
            values[col] = to_dt(values[col])
    return values


def publish_status(diff_type, current_status):
    """반영 뒤 상태: REMOVE → CLOSED / REOPEN → ON / CHANGE → 그대로 (숨긴 상품은 HIDDEN 유지)"""
    if diff_type == "REMOVE":
        return "CLOSED"
    if diff_type == "REOPEN":
        return "ON"
    return current_status


def restore_plan(change_type, before_json):
    """
        변경 기록 1개를 되돌릴 때 바꿀 것 → {"product": 상품 칸 값, "tags": 목록 또는 None, "rates": 목록 또는 None}
        ADD는 before_data가 없어 CLOSED로만. 그 밖은 before_data에 있는 칸만 (상태만 있으면 상태만)
    """
    if change_type == "ADD" or not before_json:
        return {"product": {STATUS_COL: "CLOSED"}, "tags": None, "rates": None}
    before = json.loads(before_json)
    return {"product": product_values(before), "tags": before.get("tags"), "rates": before.get("rates")}


def merge_plans(snapshots):
    """
        되돌릴 변경 기록들(최신 → 오래된 순)을 상품마다 하나로 합침 → {product_id: {"product", "tags", "rates"}}
        최신부터 거꾸로 적용하면 마지막에 적용되는 오래된 기록이 남으므로, 같은 칸은 오래된 기록 값이 이김
        snapshots: (product_id, change_type, before_data JSON) 튜플 목록 (history_id DESC, snapshot_id DESC)
    """
    merged = {}
    for product_id, change_type, before_json in snapshots:
        plan = restore_plan(change_type, before_json)
        final = merged.setdefault(product_id, {"product": {}, "tags": None, "rates": None})
        final["product"].update(plan["product"])
        if plan["tags"] is not None:
            final["tags"] = plan["tags"]
        if plan["rates"] is not None:
            final["rates"] = plan["rates"]
    return merged


def publish_counts(diff_types):
    """이력 건수 (added, changed, removed). 변경 = CHANGE + REOPEN"""
    types = Counter(diff_types)
    return types["NEW"], types["CHANGE"] + types["REOPEN"], types["REMOVE"]


def publish_count_json(diff_types, catalog):
    """
        반영 이력 count_json: 이번 반영 구분별 건수 + 반영 뒤 상품 전체(판매 종료 제외) 집계
        (출처별, 종류별, 칩별, 결측. 첫 적재 count_summary와 같은 모양이라 지난 반영과 비교 가능)
    """
    return to_json({"diff_type": dict(Counter(diff_types)), **catalog_summary(catalog)})


# ---------- DB 쓰기 ----------

def update_sql(cols):
    """칸 묶음(cols)만 바꾸는 UPDATE문. 칸 이름은 RESTORE_COLS에서만 (B1), 값은 바인딩"""
    cols = sorted(set(cols) & RESTORE_COLS)
    sql = text(f"UPDATE loan_product SET {', '.join(f'{c} = :{c}' for c in cols)} WHERE product_id = :product_id")
    return sql.bindparams(bindparam("raw_json", type_=CLOB)) if "raw_json" in cols else sql


def update_products(conn, rows):
    """
        loan_product 여러 행 바꾸기. rows = [{칸: 값, ..., "product_id": 번호}]
        칸 묶음이 같은 행끼리 모아 UPDATE 1번씩 (전부 있는 묶음은 UPDATE_PRODUCT_ALL, 상태만은 UPDATE_STATUS)
    """
    groups = {}
    for row in rows:
        cols = frozenset(c for c in row if c in RESTORE_COLS)
        if cols:
            groups.setdefault(cols, []).append({**{c: row[c] for c in cols}, "product_id": row["product_id"]})
    for cols, params in groups.items():
        if cols == RESTORE_COLS:
            sql = UPDATE_PRODUCT_ALL
        elif cols == {STATUS_COL}:
            sql = UPDATE_STATUS
        else:
            sql = update_sql(cols)
        conn.execute(sql, params)


def replace_links(conn, products_by_id, tag_ids):
    """
        반영: 여러 상품의 칩, 구간 금리를 지우고 다시 넣기 + 그 공시월의 월별 금리 교체 (같은 달이면 덮어씀)
        products_by_id = {product_id: after_data}. 상품 수와 상관없이 DELETE 3번, INSERT 3번
    """
    if not products_by_id:
        return
    product_tags, rates, rate_months, months = [], [], [], []
    for product_id, product in products_by_id.items():
        pt, r, rm = link_rows(product, product_id, tag_ids)
        product_tags += pt
        rates += r
        rate_months += rm
        if rm:
            months.append({"product_id": product_id, "dcls_month": rm[0]["dcls_month"]})

    ids = [{"product_id": product_id} for product_id in products_by_id]
    conn.execute(DELETE_PRODUCT_TAGS, ids)
    conn.execute(DELETE_RATES, ids)
    if months:
        conn.execute(DELETE_RATE_MONTH, months)
    insert_links(conn, product_tags, rates, rate_months)


def restore_links(conn, merged):
    """
        되돌리기: 합친 기록(merge_plans)에 칩이 있는 상품은 칩을, 구간 금리가 있는 상품은 금리를 그 값으로
        (월별 금리는 쌓기만 하므로 안 건드림). 지워진 칩 값은 다시 만듦. 태그 번호 조회는 1번
    """
    with_tags = {pid: plan["tags"] for pid, plan in merged.items() if plan["tags"] is not None}
    with_rates = {pid: plan["rates"] for pid, plan in merged.items() if plan["rates"] is not None}
    if with_tags:
        tag_ids, _ = ensure_tags(conn, [{"tags": tags} for tags in with_tags.values()])
        conn.execute(DELETE_PRODUCT_TAGS, [{"product_id": pid} for pid in with_tags])
        insert_links(conn, [{"tag_id": tag_ids[(t["tag_type"], t["tag_value"])], "product_id": pid}
                            for pid, tags in with_tags.items() for t in tags], [], [])
    if with_rates:
        conn.execute(DELETE_RATES, [{"product_id": pid} for pid in with_rates])
        insert_links(conn, [], [{**r, "product_id": pid} for pid, rates in with_rates.items() for r in rates], [])


def new_history_id(conn):
    """방금 넣은 이력 번호 (product_update_history 표를 잠근 뒤라 MAX가 방금 넣은 행)"""
    return conn.execute(LAST_VERSION).scalar()


def publish(engine, job_id, item_ids, base_version, admin_id):
    """고른 항목 반영 → 새 버전(이력 번호). 오류: NotFound, JobConflict(IMPORT_EXPIRED, VERSION_CONFLICT), NotPublishable"""
    with engine.begin() as conn:    # 24시간 지난 DONE은 먼저 EXPIRED로 바꿔 두고 (커밋) 아래에서 409
        conn.execute(EXPIRE_JOB, {"job_id": job_id, "hours": KEEP_HOURS})

    with engine.begin() as conn:    # 여기부터 끝까지 한 트랜잭션: 중간에 실패하면 전부 되돌림 (B16)
        conn.execute(LOCK_HISTORY)  # 기준 버전 확인부터 이력 넣기까지 다른 반영, 되돌리기가 끼어들지 않게
        job = conn.execute(SELECT_JOB_FOR_UPDATE, {"job_id": job_id}).first()
        if job is None:
            raise NotFound("JOB_NOT_FOUND")
        if job.job_status != "DONE":
            raise JobConflict("IMPORT_EXPIRED")
        if conn.execute(LAST_VERSION).scalar() != base_version:
            raise JobConflict("VERSION_CONFLICT")

        all_items = {row.item_id: row for row in conn.execute(SELECT_JOB_ITEMS, {"job_id": job_id})}
        wanted = list(dict.fromkeys(item_ids))
        items = [all_items[i] for i in wanted if i in all_items]
        if len(items) != len(wanted) or any(item.diff_type == "CHECK" for item in items):
            raise NotPublishable()

        items_with_data = [(item.diff_type, json.loads(item.after_data) if item.after_data else None)
                           for item in items]
        diff_types = [diff_type for diff_type, _ in items_with_data]
        added, changed, removed = publish_counts(diff_types)
        conn.execute(INSERT_PUBLISH_HISTORY, {"admin_id": admin_id, "source": job.sources, "added": added,
                                              "changed": changed, "removed": removed,
                                              "memo": f"불러오기 {job_id}번 반영"})
        history_id = new_history_id(conn)

        current = {p["product_id"]: p for p in read_products(conn)}
        tag_ids, _ = ensure_tags(conn, [data for _, data in items_with_data if data is not None])

        # 상품별로 돌지 않고 모아서 한 번에 (상품 1,600개도 SQL 수십 번): 변경 기록, 상품 UPDATE, 칩·금리 교체
        snapshots, updates, changed_products, new_products = [], [], {}, []
        for item, (diff_type, data) in zip(items, items_with_data):
            if diff_type == "NEW":
                new_products.append(data)
                continue
            before = current[item.product_id]
            snapshots.append({"history_id": history_id, "product_id": item.product_id,
                              "change_type": SNAPSHOT_TYPE[diff_type], "before_data": to_json(before_data(before))})
            values = {STATUS_COL: publish_status(diff_type, before[STATUS_COL]), "product_id": item.product_id}
            if data is not None:    # CHANGE, REOPEN: 새 값 전부 (base_date, raw_json 포함)
                values.update(product_values(data))
                changed_products[item.product_id] = data
            updates.append(values)
        if snapshots:
            conn.execute(INSERT_SNAPSHOT, snapshots)
        update_products(conn, updates)
        replace_links(conn, changed_products, tag_ids)

        if new_products:
            conn.execute(INSERT_PRODUCT, [product_values({c: p[c] for c in PRODUCT_COLS}) for p in new_products])
            product_ids = id_map(conn, SELECT_PRODUCT_IDS)
            added_ids = {product_ids[product_key(p)]: p for p in new_products}
            conn.execute(INSERT_SNAPSHOT, [{"history_id": history_id, "product_id": product_id,
                                            "change_type": "ADD", "before_data": None} for product_id in added_ids])
            product_tags, rates, rate_months = [], [], []
            for product_id, p in added_ids.items():
                pt, r, rm = link_rows(p, product_id, tag_ids)
                product_tags += pt
                rates += r
                rate_months += rm
            insert_links(conn, product_tags, rates, rate_months)

        catalog = [p for p in read_products(conn) if p[STATUS_COL] != "CLOSED"]     # 반영 뒤 상품 전체 집계
        conn.execute(UPDATE_COUNT_JSON, {"history_id": history_id, "count_json": publish_count_json(diff_types, catalog)})
        conn.execute(PUBLISH_JOB, {"job_id": job_id})
        logger.info("반영 끝: 작업 %d, 이력 %d, 신규 %d 변경 %d 판매 중단 %d", job_id, history_id, added, changed, removed)
        return history_id


def rollback(engine, history_id, base_version, admin_id):
    """history_id 시점으로 되돌리기 → 새 버전(이력 번호). 오류: NotFound, JobConflict(VERSION_CONFLICT, NOTHING_TO_ROLLBACK)"""
    with engine.begin() as conn:    # 한 트랜잭션 (B16)
        conn.execute(LOCK_HISTORY)
        if conn.execute(LAST_VERSION).scalar() != base_version:
            raise JobConflict("VERSION_CONFLICT")
        if not conn.execute(EXISTS_HISTORY, {"history_id": history_id}).scalar():
            raise NotFound("HISTORY_NOT_FOUND")

        snapshots = conn.execute(SELECT_SNAPSHOTS_AFTER, {"history_id": history_id}).all()
        if not snapshots:               # 지금 마지막 이력을 고른 경우: 바뀌는 게 없는데 버전만 올라가지 않게 거절
            raise JobConflict("NOTHING_TO_ROLLBACK")
        product_ids = list(dict.fromkeys(s.product_id for s in snapshots))
        conn.execute(INSERT_ROLLBACK_HISTORY, {"admin_id": admin_id, "target_history_id": history_id,
                                               "changed": len(product_ids), "memo": f"{history_id}번 시점으로 되돌리기"})
        new_id = new_history_id(conn)

        current = {p["product_id"]: p for p in read_products(conn)}
        conn.execute(INSERT_SNAPSHOT, [{"history_id": new_id, "product_id": product_id, "change_type": "CHANGE",
                                        "before_data": to_json(before_data(current[product_id]))}
                                       for product_id in product_ids])    # 되돌리기 전 값을 1번씩 (이 되돌리기도 되돌릴 수 있게)

        # 최신부터 거꾸로 적용한 결과를 상품마다 하나로 합친 뒤 모아서 UPDATE (오래된 기록 값이 남음)
        merged = merge_plans([(s.product_id, s.change_type, s.before_data) for s in snapshots])
        update_products(conn, [{**plan["product"], "product_id": pid} for pid, plan in merged.items()])
        restore_links(conn, merged)

        logger.info("되돌리기 끝: 대상 이력 %d, 새 이력 %d, 상품 %d개", history_id, new_id, len(product_ids))
        return new_id
