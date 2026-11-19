"""
    반영 (PUBLISH), 되돌리기 (ROLLBACK): FastAPI가 상품 표에 한 트랜잭션으로 씀 (ADMIN-04, 05, EXT-05, B16)

    반영 publish(): 작업이 DONE이고 24시간 안 → 기준 버전 같음 → 확인 필요 없음
      → 이력 1건 (PUBLISH, admin_id, 건수) + 바뀌는 상품마다 변경 기록 (product_snapshot, 바뀌기 전 값)
      → loan_product (NEW는 INSERT, 나머지는 같은 행 UPDATE라 product_id 그대로. REMOVE는 CLOSED, REOPEN은 ON, 숨긴 상품은 HIDDEN 유지)
      → tag (새 값만), product_tag·product_rate 교체, product_rate_month 공시월 추가 (같은 달이면 교체) → 작업 PUBLISHED
    되돌리기 rollback(): 기준 버전 같음 → 대상 이력 이후의 변경 기록을 최신부터 거꾸로 적용 (before_data에 있는 칸만)
      → 이력 1건 (ROLLBACK, target_history_id) + 되돌린 상품마다 변경 기록 (되돌리기도 다시 되돌릴 수 있게)

    before_data JSON: 상품 칸 (PRODUCT_COLS + product_status) + "tags" [{tag_type, tag_value}] + "rates" [product_rate 줄]
      Spring이 쓰는 상태만 바꾼 기록은 {"product_status": 값} (+ disclose_end)만 있음 → 그 칸만 되돌림
      ADD (신규 반영)는 before_data 없음 → 되돌리면 CLOSED
    넣기 함수는 첫 적재 load.py와 같은 것 (ensure_tags, link_rows, insert_links)
"""
import json
import logging
from collections import Counter
from datetime import date, datetime

from sqlalchemy import CLOB, bindparam, text

from app.imports import (KEEP_HOURS, LAST_VERSION, JobConflict, NotFound, NotPublishable, after_data, read_products,
                         to_json)
from app.load import (DATE_COLS, INSERT_PRODUCT, PRODUCT_COLS, SELECT_PRODUCT_IDS, chip_counts, ensure_tags, id_map,
                      insert_links, link_rows, product_key)

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
    "INSERT INTO product_update_history (admin_id, action_type, source, added_count, changed_count, removed_count, "
    "memo, count_json) VALUES (:admin_id, 'PUBLISH', :source, :added, :changed, :removed, :memo, :count_json)"
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


# ---------- DB 없이 쓰는 함수 ----------

def before_data(product):
    """변경 기록에 남길 바뀌기 전 값 (read_products 행 1개) = after_data 모양 + product_status. 상품 번호, 조회수는 안 넣음"""
    return {**after_data(product), STATUS_COL: product[STATUS_COL]}


def to_dt(value):
    """JSON의 날짜 글 ('YYYY-MM-DD', 'YYYY-MM-DD HH:MM:SS') → datetime (DATE 칸에 넣을 값)"""
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


def publish_counts(items_with_data):
    """이력 건수: (added, changed, removed, count_json). 변경 = CHANGE + REOPEN"""
    types = Counter(diff_type for diff_type, _ in items_with_data)
    published = [data for _, data in items_with_data if data is not None]
    count_json = to_json({"diff_type": dict(types), "source": dict(Counter(d["source"] for d in published)),
                          "chips": chip_counts(published)})
    return types["NEW"], types["CHANGE"] + types["REOPEN"], types["REMOVE"], count_json


# ---------- DB 쓰기 ----------

def update_product(conn, product_id, values):
    """loan_product 1행의 칸 바꾸기 (칸 이름은 RESTORE_COLS만, 값은 바인딩)"""
    cols = [c for c in values if c in RESTORE_COLS]
    if not cols:
        return
    sql = text(f"UPDATE loan_product SET {', '.join(f'{c} = :{c}' for c in cols)} WHERE product_id = :product_id")
    if "raw_json" in cols:
        sql = sql.bindparams(bindparam("raw_json", type_=CLOB))
    conn.execute(sql, {**{c: values[c] for c in cols}, "product_id": product_id})


def replace_links(conn, product_id, product, tag_ids):
    """반영: 상품 1개의 칩, 구간 금리를 지우고 다시 넣기 + 그 공시월의 월별 금리 교체 (같은 달이면 덮어씀)"""
    product_tags, rates, rate_months = link_rows(product, product_id, tag_ids)
    conn.execute(DELETE_PRODUCT_TAGS, {"product_id": product_id})
    conn.execute(DELETE_RATES, {"product_id": product_id})
    if rate_months:
        conn.execute(DELETE_RATE_MONTH, {"product_id": product_id, "dcls_month": rate_months[0]["dcls_month"]})
    insert_links(conn, product_tags, rates, rate_months)


def restore_links(conn, product_id, plan):
    """되돌리기: before_data에 칩이 있으면 칩만, 구간 금리가 있으면 금리만 그 값으로 (월별 금리는 쌓기만 하므로 안 건드림)"""
    if plan["tags"] is not None:
        tag_ids, _ = ensure_tags(conn, [{"tags": plan["tags"]}])    # 지워진 칩 값은 다시 만듦
        conn.execute(DELETE_PRODUCT_TAGS, {"product_id": product_id})
        insert_links(conn, [{"tag_id": tag_ids[(t["tag_type"], t["tag_value"])], "product_id": product_id}
                            for t in plan["tags"]], [], [])
    if plan["rates"] is not None:
        conn.execute(DELETE_RATES, {"product_id": product_id})
        insert_links(conn, [], [{**r, "product_id": product_id} for r in plan["rates"]], [])


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
        added, changed, removed, count_json = publish_counts(items_with_data)
        conn.execute(INSERT_PUBLISH_HISTORY, {"admin_id": admin_id, "source": job.sources, "added": added,
                                              "changed": changed, "removed": removed,
                                              "memo": f"불러오기 {job_id}번 반영", "count_json": count_json})
        history_id = new_history_id(conn)

        current = {p["product_id"]: p for p in read_products(conn)}
        tag_ids, _ = ensure_tags(conn, [data for _, data in items_with_data if data is not None])

        new_products = []
        for item, (diff_type, data) in zip(items, items_with_data):
            if diff_type == "NEW":
                new_products.append(data)
                continue
            before = current[item.product_id]
            conn.execute(INSERT_SNAPSHOT, {"history_id": history_id, "product_id": item.product_id,
                                           "change_type": SNAPSHOT_TYPE[diff_type],
                                           "before_data": to_json(before_data(before))})
            values = {STATUS_COL: publish_status(diff_type, before[STATUS_COL])}
            if data is not None:    # CHANGE, REOPEN: 새 값 전부 (base_date, raw_json 포함)
                values.update(product_values(data))
            update_product(conn, item.product_id, values)
            if data is not None:
                replace_links(conn, item.product_id, data, tag_ids)

        if new_products:
            conn.execute(INSERT_PRODUCT, [product_values({c: p[c] for c in PRODUCT_COLS}) for p in new_products])
            product_ids = id_map(conn, SELECT_PRODUCT_IDS)
            for p in new_products:
                product_id = product_ids[product_key(p)]
                conn.execute(INSERT_SNAPSHOT, {"history_id": history_id, "product_id": product_id,
                                               "change_type": "ADD", "before_data": None})
                insert_links(conn, *link_rows(p, product_id, tag_ids))

        conn.execute(PUBLISH_JOB, {"job_id": job_id})
        logger.info("반영 끝: 작업 %d, 이력 %d, 신규 %d 변경 %d 판매 중단 %d", job_id, history_id, added, changed, removed)
        return history_id


def rollback(engine, history_id, base_version, admin_id):
    """history_id 시점으로 되돌리기 → 새 버전(이력 번호). 오류: NotFound, JobConflict(VERSION_CONFLICT)"""
    with engine.begin() as conn:    # 한 트랜잭션 (B16)
        conn.execute(LOCK_HISTORY)
        if conn.execute(LAST_VERSION).scalar() != base_version:
            raise JobConflict("VERSION_CONFLICT")
        if not conn.execute(EXISTS_HISTORY, {"history_id": history_id}).scalar():
            raise NotFound("HISTORY_NOT_FOUND")

        snapshots = conn.execute(SELECT_SNAPSHOTS_AFTER, {"history_id": history_id}).all()
        product_ids = list(dict.fromkeys(s.product_id for s in snapshots))
        conn.execute(INSERT_ROLLBACK_HISTORY, {"admin_id": admin_id, "target_history_id": history_id,
                                               "changed": len(product_ids), "memo": f"{history_id}번 시점으로 되돌리기"})
        new_id = new_history_id(conn)

        current = {p["product_id"]: p for p in read_products(conn)}
        for product_id in product_ids:     # 되돌리기 전 값을 1번씩 남김 (이 되돌리기도 되돌릴 수 있게)
            conn.execute(INSERT_SNAPSHOT, {"history_id": new_id, "product_id": product_id, "change_type": "CHANGE",
                                           "before_data": to_json(before_data(current[product_id]))})

        for snap in snapshots:             # 최신부터 거꾸로 → 마지막에 적용되는 값이 대상 시점의 값
            plan = restore_plan(snap.change_type, snap.before_data)
            update_product(conn, snap.product_id, plan["product"])
            restore_links(conn, snap.product_id, plan)

        logger.info("되돌리기 끝: 대상 이력 %d, 새 이력 %d, 상품 %d개", history_id, new_id, len(product_ids))
        return new_id
