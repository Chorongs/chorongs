"""
    상품 불러오기 작업 (ADMIN-04, EXT-01·02의 6번 비교 저장, EXT-05)

    - 시작 (main.py POST /imports): import_job 1행 (RUNNING) → 작업 번호 바로 응답
      base_version(기준 버전)은 시작 때 일단 넣고, 비교하려고 지금 상품을 읽는 시점의 마지막 이력 번호로 DONE 때 다시 씀 (ADMIN-04 '비교할 때의')
      동시에 1개 (B9): import_job 표를 잠그고 RUNNING이 있으면 IMPORT_RUNNING. 시작한 지 30분 넘은 RUNNING은 FAILED로 바꾸고 진행
    - 응답 뒤 (BackgroundTasks → run_import): 수집 → 지금 상품 읽기 → 정제 (첫 적재와 같은 clean_products) → 비교
      → 이전 작업의 import_item 삭제 → 바뀐 상품을 import_item에 저장 → DONE (출처 모두 실패, 정제 중 오류면 FAILED + 사유)
      (지금 상품을 정제보다 먼저 읽는 이유: 금감원 수집이 빠졌을 때 DB 은행 이름을 정제에 넘기기 위해)
      이 단계에서 loan_product는 바꾸지 않음. 반영은 publish.py
    - 진행 확인 (main.py GET /imports/{job_id}, GET /imports/latest): read_job, read_latest_job (가장 최근 작업, 화면을 다시 열었을 때)
    - 비교 구분: NEW 신규 / CHANGE 변경 / REMOVE 판매 중단 / REOPEN 다시 게시 (판매 종료 상품이 다시 옴) / CHECK 확인 필요 (반영 불가)
    - 비교하는 칸: 상품 내용 칸 (COMPARE_COLS) + 칩 (tags) + 구간 금리 (rates) + 금감원 공시월 (dcls_month)
      base_date (서민은 수집한 날이라 매번 바뀜), raw_json (제출일이 들어 있음)은 비교하지 않고 반영할 때만 새 값으로 씀
    - 같은 상품 맞추기: (source, loan_type, source_code). 서민 seq가 바뀌면 상품명 + 제공기관명으로 맞춤
    - 실패한 출처의 상품은 판매 중단으로 보지 않음 (B13). 숨긴 상품은 바뀌면 CHANGE + hidden_yn Y (반영해도 숨김 유지)
"""
import json
import logging
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime
from decimal import Decimal

import requests
from sqlalchemy import CLOB, bindparam, text

from app.clean import WORDS, clean_products
from app.collect import collect_fss, collect_kinfa
from app.load import PRODUCT_COLS, dcls_month, product_key

logger = logging.getLogger(__name__)

COLLECTORS = {"KINFA": collect_kinfa, "FSS": collect_fss}
SOURCE_ORDER = ("KINFA", "FSS")             # import_job.sources, product_update_history.source 값 순서 ('KINFA,FSS')
COMPARE_COLS = [c for c in PRODUCT_COLS if c not in ("base_date", "raw_json")]
STALE_MINUTES = 30      # 이 시간 넘게 RUNNING이면 멈춘 작업으로 보고 FAILED
KEEP_HOURS = 24         # DONE 뒤 이 시간이 지나면 EXPIRED (반영 불가)


# ---------- 오류 (main.py가 상태 코드로 바꿈) ----------

class JobConflict(Exception):
    """
        409. detail: IMPORT_RUNNING 진행 중 / IMPORT_EXPIRED 24시간 지남 또는 DONE 아님 / VERSION_CONFLICT 기준 버전 다름
        / NOTHING_TO_ROLLBACK 되돌릴 변경 기록 없음
    """

    def __init__(self, detail):
        super().__init__(detail)
        self.detail = detail


class NotPublishable(Exception):
    """422 NOT_PUBLISHABLE: 확인 필요 항목이 섞임, 이 작업에 없는 항목 번호"""


class NotFound(Exception):
    """404: 없는 작업 번호, 없는 이력 번호"""


# ---------- SQL ----------

LOCK_JOBS = text("LOCK TABLE import_job IN EXCLUSIVE MODE")
FAIL_STALE_JOBS = text("UPDATE import_job SET job_status = 'FAILED', error_msg = :msg, finished_at = SYSDATE "
                       "WHERE job_status = 'RUNNING' AND created_at < SYSDATE - :minutes / 1440")
COUNT_RUNNING = text("SELECT COUNT(*) FROM import_job WHERE job_status = 'RUNNING'")
LAST_VERSION = text("SELECT MAX(history_id) FROM product_update_history")
INSERT_JOB = text("INSERT INTO import_job (job_status, sources, base_version, requested_by) "
                  "VALUES ('RUNNING', :sources, :base_version, :admin_id)")
NEW_JOB_ID = text("SELECT MAX(job_id) FROM import_job WHERE job_status = 'RUNNING'")   # 표를 잠근 뒤라 방금 넣은 행

# RUNNING일 때만 끝냄: 30분 넘어 FAILED로 바뀐 옛 작업이 늦게 끝나도 DONE으로 되살아나지 않게 (바뀐 행 0이면 결과 버림)
FINISH_JOB = text("UPDATE import_job SET job_status = :status, source_result = :source_result, error_msg = :error, "
                  "finished_at = SYSDATE WHERE job_id = :job_id AND job_status = 'RUNNING'"
                  ).bindparams(bindparam("source_result", type_=CLOB))
SET_BASE_VERSION = text("UPDATE import_job SET base_version = :base_version WHERE job_id = :job_id")   # 비교할 때의 버전
DELETE_OLD_ITEMS = text("DELETE FROM import_item WHERE job_id <> :job_id")
INSERT_ITEM = text(
    "INSERT INTO import_item (job_id, diff_type, product_id, source, product_name, company_name, "
    "changed_fields, check_reasons, hidden_yn, after_data) "
    "VALUES (:job_id, :diff_type, :product_id, :source, :product_name, :company_name, "
    ":changed_fields, :check_reasons, :hidden_yn, :after_data)"
).bindparams(bindparam("after_data", type_=CLOB))

# 24시간 판단은 DB 시각(SYSDATE) 기준 (FastAPI PC와 DB 서버의 시간이 다를 수 있음)
SELECT_JOB = text("SELECT job_id, job_status, base_version, source_result, "
                  "CASE WHEN finished_at < SYSDATE - :hours / 24 THEN 1 ELSE 0 END AS expired "
                  "FROM import_job WHERE job_id = :job_id")
LATEST_JOB_ID = text("SELECT MAX(job_id) FROM import_job")    # 가장 최근 작업 (화면을 다시 열었을 때 이어서 보기)
SELECT_ITEMS = text("SELECT item_id, diff_type, product_id, product_name, company_name, source, "
                    "changed_fields, check_reasons, hidden_yn FROM import_item WHERE job_id = :job_id ORDER BY item_id")

SELECT_PRODUCTS = text(f"SELECT product_id, product_status, {', '.join(PRODUCT_COLS)} FROM loan_product")
SELECT_PRODUCT_TAGS = text("SELECT pt.product_id, t.tag_type, t.tag_value "
                           "FROM product_tag pt JOIN tag t ON t.tag_id = pt.tag_id")
SELECT_RATES = text("SELECT product_id, rate_kind, rate_key, rate_min, rate_max, rate_source FROM product_rate")


# ---------- 값 비교 (DB 없이 쓰는 함수) ----------

def norm(value):
    """비교용 값 통일: DB Decimal과 정제 float, DB datetime과 정제 date를 같게 봄"""
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    if isinstance(value, datetime):
        return value.date()
    return value


def tag_set(tags):
    return {(t["tag_type"], t["tag_value"]) for t in tags}


def rate_set(rates):
    return {(r["rate_kind"], r["rate_key"], norm(r["rate_min"]), norm(r["rate_max"]), r["rate_source"]) for r in rates}


def changed_fields(current, new):
    """지금 상품(current)과 정제 상품(new)에서 다른 칸 이름. 칩은 'tags', 구간 금리는 'rates', 공시월은 'dcls_month'"""
    fields = [c for c in COMPARE_COLS if norm(current[c]) != norm(new[c])]
    if tag_set(current["tags"]) != tag_set(new["tags"]):
        fields.append("tags")
    if rate_set(current["rates"]) != rate_set(new["rates"]):
        fields.append("rates")
    if new["source"] == "FSS" and dcls_month(current) != dcls_month(new):
        fields.append("dcls_month")
    return fields


def match_products(existing, cleaned):
    """
        정제 상품마다 지금 상품 찾기 → ([(정제 상품, 지금 상품 또는 None)], 맞춘 지금 상품 번호 집합)

        1차: 열쇠 (source, loan_type, source_code)
        2차: 서민은 seq가 바뀔 수 있어 열쇠로 못 찾으면 상품명 + 제공기관명으로 아직 안 맞은 지금 상품과 맞춤
    """
    by_key = {product_key(e): e for e in existing}
    pairs, matched = [], set()
    for p in cleaned:
        current = by_key.get(product_key(p))
        if current is not None:
            matched.add(current["product_id"])
        pairs.append([p, current])

    by_name = {}
    for e in existing:
        if e["source"] == "KINFA" and e["product_id"] not in matched:
            by_name.setdefault((e["product_name"], e["company_name"]), []).append(e)
    for pair in pairs:
        p, current = pair
        if current is None and p["source"] == "KINFA":
            candidates = by_name.get((p["product_name"], p["company_name"]))
            if candidates:
                pair[1] = candidates.pop(0)
                matched.add(pair[1]["product_id"])
    return [tuple(pair) for pair in pairs], matched


def after_data(product):
    """반영할 정제 결과 (import_item.after_data): 상품 칸 + 칩 + 구간 금리"""
    return {**{c: product[c] for c in PRODUCT_COLS}, "tags": product["tags"], "rates": product["rates"]}


def _item(diff_type, current, new, fields=(), reasons=()):
    shown = new if new is not None else current
    return {
        "diff_type": diff_type,
        "product_id": current["product_id"] if current is not None else None,
        "source": shown["source"],
        "product_name": shown["product_name"],
        "company_name": shown["company_name"],
        "changed_fields": list(fields),
        "check_reasons": list(reasons),
        "hidden_yn": "Y" if current is not None and current["product_status"] == "HIDDEN" else "N",
        "after_data": after_data(new) if new is not None else None,
    }


def compare(existing, cleaned, sources):
    """
        지금 상품(existing: DB 행 + tags + rates)과 정제 상품(cleaned)을 비교해 import_item에 넣을 항목 목록

        - sources: 수집에 성공한 출처. 실패한 출처의 상품은 REMOVE로 보지 않음
        - 확인 필요(check_reasons)가 있으면 지금 상품이 있어도 CHECK
        - CLOSED 상품이 다시 오면 REOPEN, 바뀐 칸이 없으면 항목 없음
    """
    pairs, matched = match_products(existing, cleaned)
    items = []
    for new, current in pairs:
        fields = changed_fields(current, new) if current is not None else []
        if new["check_reasons"]:
            items.append(_item("CHECK", current, new, fields, new["check_reasons"]))
        elif current is None:
            items.append(_item("NEW", None, new))
        elif current["product_status"] == "CLOSED":
            items.append(_item("REOPEN", current, new, fields))
        elif fields:
            items.append(_item("CHANGE", current, new, fields))

    for current in existing:
        if (current["source"] in sources and current["product_id"] not in matched
                and current["product_status"] != "CLOSED"):
            items.append(_item("REMOVE", current, None))
    return items


DATE_FORMAT = "%Y-%m-%d %H:%M"      # 저장 JSON의 날짜 글. Spring 응답 규칙 'yyyy-MM-dd HH:mm'과 같게 (be_common '날짜 응답')


def json_default(value):
    """JSON으로 못 바꾸는 값: 날짜는 'yyyy-MM-dd HH:mm', Decimal은 숫자"""
    if isinstance(value, datetime):
        return value.strftime(DATE_FORMAT)
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day).strftime(DATE_FORMAT)
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return str(value)


def to_json(data):
    return json.dumps(data, ensure_ascii=False, default=json_default)


def item_row(job_id, item):
    """비교 항목 1개 → import_item 행 (목록은 쉼표로 이어 붙임, 빈 목록은 NULL)"""
    return {
        "job_id": job_id,
        "diff_type": item["diff_type"],
        "product_id": item["product_id"],
        "source": item["source"],
        "product_name": item["product_name"],
        "company_name": item["company_name"],
        "changed_fields": ",".join(item["changed_fields"]) or None,
        "check_reasons": ",".join(item["check_reasons"]) or None,
        "hidden_yn": item["hidden_yn"],
        "after_data": to_json(item["after_data"]) if item["after_data"] is not None else None,
    }


def split_list(value):
    """쉼표로 이어 붙인 칸 → 목록 (NULL은 빈 목록)"""
    return value.split(",") if value else []


def db_bank_names(existing):
    """
        금감원 수집이 빠진 불러오기에서 서민 취급기관 대조에 쓸 은행 이름: DB 금감원 상품의 원본 권역 코드로
        (clean.fss_bank_names와 같은 기준. 빈 목록으로 정제하면 은행 상품이 '기타'가 되어 서민 상품이 대량 CHANGE로 뜸)
    """
    group = WORDS["COMPANY"]["kinfa_bank"]["group"]
    return {p["company_name"] for p in existing
            if p["source"] == "FSS" and json.loads(p["raw_json"]).get("base", {}).get("top_fin_grp_no") == group}


def source_results(sources, collected, errors, products):
    """출처별 결과 (import_job.source_result, 응답 source_results)"""
    return [{"source": source,
             "success": source in collected,
             "count": sum(p["source"] == source for p in products),
             "error": errors.get(source)}
            for source in sources]


# ---------- 수집 ----------

def collect_sources(sources):
    """
        출처마다 수집. 한 출처가 실패해도 나머지는 계속 (B13)
        → (원본 표 {CSV 이름: 행 목록}, 성공한 출처 목록, {실패한 출처: 사유})
    """
    tables, collected, errors = {}, [], {}
    with requests.Session() as session:
        for source in sources:
            start = time.time()
            try:
                tables.update(COLLECTORS[source](session))
                collected.append(source)
                logger.info("%s 수집 끝: %.1f초", source, time.time() - start)
            except requests.RequestException as e:
                # 예외 메시지에 키가 든 주소가 있어서 예외 이름만 남김
                errors[source] = type(e).__name__
                logger.error("%s 수집 실패, 건너뜀: %s", source, errors[source])
            except (RuntimeError, ValueError, ET.ParseError) as e:
                errors[source] = str(e)
                logger.error("%s 수집 실패, 건너뜀: %s", source, errors[source])
    return tables, collected, errors


# ---------- DB ----------

def read_products(conn):
    """지금 상품 전부: loan_product 행 + tags + rates (비교, 변경 기록용)"""
    products = {}
    for row in conn.execute(SELECT_PRODUCTS):
        products[row.product_id] = {**row._mapping, "tags": [], "rates": []}
    for row in conn.execute(SELECT_PRODUCT_TAGS):
        products[row.product_id]["tags"].append({"tag_type": row.tag_type, "tag_value": row.tag_value})
    for row in conn.execute(SELECT_RATES):
        products[row.product_id]["rates"].append({"rate_kind": row.rate_kind, "rate_key": row.rate_key,
                                                  "rate_min": row.rate_min, "rate_max": row.rate_max,
                                                  "rate_source": row.rate_source})
    return list(products.values())


def start_job(conn, sources, admin_id):
    """작업 1행 만들고 번호 돌려줌 (conn은 트랜잭션 안). 진행 중 작업이 있으면 JobConflict(IMPORT_RUNNING)"""
    conn.execute(LOCK_JOBS)     # 동시에 두 작업이 시작되지 않게 (커밋하면 풀림)
    conn.execute(FAIL_STALE_JOBS, {"msg": f"{STALE_MINUTES}분 넘게 끝나지 않아 실패 처리", "minutes": STALE_MINUTES})
    if conn.execute(COUNT_RUNNING).scalar():
        raise JobConflict("IMPORT_RUNNING")

    conn.execute(INSERT_JOB, {"sources": ",".join(sources),
                              "base_version": conn.execute(LAST_VERSION).scalar(),
                              "admin_id": admin_id})
    return conn.execute(NEW_JOB_ID).scalar()


def run_import(engine, job_id, sources):
    """응답 뒤 이어서 하는 일 (BackgroundTasks): 수집 → 정제 → 비교 → import_item 저장 → DONE / FAILED"""
    results = None
    try:
        tables, collected, errors = collect_sources(sources)
        if not collected:
            results = source_results(sources, collected, errors, [])
            raise RuntimeError("출처 모두 실패: " + ", ".join(f"{s} {e}" for s, e in errors.items()))

        with engine.connect() as conn:      # 지금 상품과 그 시점의 마지막 이력 번호(기준 버전)를 같이 읽음
            existing = read_products(conn)
            base_version = conn.execute(LAST_VERSION).scalar()
        today = date.today()
        bank_names = None if "FSS" in collected else db_bank_names(existing)   # 금감원이 빠지면 DB 은행 이름으로
        products = clean_products(tables, collected, today, today, bank_names)
        results = source_results(sources, collected, errors, products)
        items = compare(existing, products, collected)

        with engine.begin() as conn:
            done = conn.execute(FINISH_JOB, {"job_id": job_id, "status": "DONE", "source_result": to_json(results),
                                             "error": None})
            if done.rowcount == 0:      # 30분 넘어 FAILED로 바뀐 뒤 늦게 끝난 작업 → 결과 버림
                logger.warning("불러오기 작업 %d는 이미 RUNNING이 아니라 결과를 저장하지 않음", job_id)
                return
            conn.execute(SET_BASE_VERSION, {"job_id": job_id, "base_version": base_version})
            conn.execute(DELETE_OLD_ITEMS, {"job_id": job_id})
            if items:
                conn.execute(INSERT_ITEM, [item_row(job_id, item) for item in items])
        logger.info("불러오기 작업 %d 끝: 정제 %d개, 바뀐 상품 %d개", job_id, len(products), len(items))
    except Exception as e:     # 어떤 오류든 작업을 FAILED로 남겨야 다음 불러오기가 막히지 않음
        logger.exception("불러오기 작업 %d 실패", job_id)
        try:
            with engine.begin() as conn:
                conn.execute(FINISH_JOB, {"job_id": job_id, "status": "FAILED",
                                          "source_result": to_json(results) if results else None,
                                          "error": f"{type(e).__name__}: {e}"[:500]})
        except Exception:      # DB까지 안 되면 로그만 (30분 뒤 다음 불러오기가 FAILED로 바꿈)
            logger.exception("불러오기 작업 %d FAILED 기록 실패", job_id)


def read_latest_job(conn):
    """가장 최근 작업의 진행 상태 (GET /imports/latest). 작업이 하나도 없으면 None. 응답 모양, EXPIRED 처리는 read_job과 같음"""
    job_id = conn.execute(LATEST_JOB_ID).scalar()
    return None if job_id is None else read_job(conn, job_id)


def read_job(conn, job_id):
    """진행 상태 응답 (GET /imports/{job_id}). 없는 작업은 None. DONE 뒤 24시간 지났으면 EXPIRED로 보여 줌"""
    job = conn.execute(SELECT_JOB, {"job_id": job_id, "hours": KEEP_HOURS}).first()
    if job is None:
        return None

    status = "EXPIRED" if job.job_status == "DONE" and job.expired else job.job_status
    items = [{"item_id": row.item_id, "diff_type": row.diff_type, "product_id": row.product_id,
              "product_name": row.product_name, "company_name": row.company_name, "source": row.source,
              "changed_fields": split_list(row.changed_fields), "check_reasons": split_list(row.check_reasons),
              "hidden_yn": row.hidden_yn}
             for row in conn.execute(SELECT_ITEMS, {"job_id": job_id})]
    return {"job_id": job.job_id, "job_status": status, "base_version": job.base_version,
            "source_results": json.loads(job.source_result) if job.source_result else [], "items": items}
