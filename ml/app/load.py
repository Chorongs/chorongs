"""
    첫 적재 (INIT): 정제한 상품을 빈 DB에 넣음 (기획서 3-8 검수 통과 뒤 1번)

    - ml 폴더에서: python -m app.load --check (접속, 빈 표 확인, 넣을 건수만 보여 줌. DB 안 바꿈)
                   python -m app.load          (실제로 넣음)
    - 입력: ml/data/csv/ 의 수집 CSV (python -m app.collect로 받은 것). 수집일 = 서민 CSV 파일 날짜
    - 넣는 표: loan_product, tag(없는 값만), product_tag, product_rate, product_rate_month, product_update_history(INIT 1건)
    - 넣기 함수(ensure_tags, link_rows, insert_links)는 반영(publish.py)도 같이 씀
    - 확인 필요 상품(check_reasons)은 넣지 않음 (be_admin ADMIN-04: 확인 필요는 반영 불가)
    - 한 트랜잭션: 중간에 실패하면 전부 되돌림 / 상품 표가 비어 있지 않으면 멈춤 (첫 적재는 1번만)
    - DB 접속: Spring과 같은 환경변수 DB_URL(jdbc:oracle:thin:@...), DB_USERNAME, DB_PASSWORD (B12)
"""
import json
import logging
import os
import sys
from collections import Counter
from datetime import date

import oracledb
from sqlalchemy import CLOB, bindparam, create_engine, text

from app.clean import CSV_DIR, clean_products, load_tables

log = logging.getLogger(__name__)

PRODUCT_COLS = ["source", "source_code", "company_name", "product_name", "loan_type", "rate_min", "rate_max",
                "limit_amount", "term_max", "credit_min", "credit_max", "age_min", "age_max", "income_min",
                "income_max", "income_basis", "income_note", "prepay_fee_max", "no_prepay_fee_yn", "online_yn",
                "policy_yn", "rate_type", "extra_cond", "target_detail", "note", "raw_json", "base_date",
                "disclose_start", "disclose_end"]
DATE_COLS = ("base_date", "disclose_start", "disclose_end")     # DATE 칸 (JSON 글 ↔ datetime 변환 대상)
SELECT_PRODUCT_IDS = "SELECT source, loan_type, source_code, product_id FROM loan_product"   # id_map용

INSERT_PRODUCT = text(
    f"INSERT INTO loan_product ({', '.join(PRODUCT_COLS)}) VALUES ({', '.join(':' + c for c in PRODUCT_COLS)})"
).bindparams(bindparam("raw_json", type_=CLOB))
INSERT_TAG = text("INSERT INTO tag (tag_type, tag_value) VALUES (:tag_type, :tag_value)")
INSERT_PRODUCT_TAG = text("INSERT INTO product_tag (tag_id, product_id) VALUES (:tag_id, :product_id)")
INSERT_RATE = text("INSERT INTO product_rate (product_id, rate_kind, rate_key, rate_min, rate_max, rate_source) "
                   "VALUES (:product_id, :rate_kind, :rate_key, :rate_min, :rate_max, :rate_source)")
INSERT_RATE_MONTH = text("INSERT INTO product_rate_month "
                         "(dcls_month, product_id, rate_kind, rate_key, rate_min, rate_max, rate_source) "
                         "VALUES (:dcls_month, :product_id, :rate_kind, :rate_key, :rate_min, :rate_max, :rate_source)")
INSERT_HISTORY = text(
    "INSERT INTO product_update_history (action_type, source, added_count, memo, count_json) "
    "VALUES ('INIT', 'KINFA,FSS', :added_count, :memo, :count_json)"
).bindparams(bindparam("count_json", type_=CLOB))


def make_engine():
    """
        환경변수로 Oracle 접속 (값은 출력하지 않음)
        DB_URL은 JDBC 형식: jdbc:oracle:thin:@호스트:포트:SID 또는 jdbc:oracle:thin:@//호스트:포트/서비스명
    """
    target = os.environ["DB_URL"].removeprefix("jdbc:oracle:thin:@").removeprefix("//")
    if "/" not in target:   # 호스트:포트:SID
        host, port, sid = target.split(":")
        target = oracledb.makedsn(host, int(port), sid=sid)
    return create_engine("oracle+oracledb://", connect_args={
        "user": os.environ["DB_USERNAME"], "password": os.environ["DB_PASSWORD"], "dsn": target})


def chip_counts(products):
    """칩별 건수 {'TARGET:직장인': n, ...} (이력 count_json용, 반영 publish.py도 씀)"""
    chips = Counter(f"{t['tag_type']}:{t['tag_value']}" for p in products for t in p["tags"])
    return dict(sorted(chips.items()))


def count_summary(products, skipped):
    """반영 이력 count_json: 상품 종류별 건수, 칩별 건수, 넣지 않은 확인 필요 건수"""
    return json.dumps({"loan_type": Counter(p["loan_type"] for p in products),
                       "chips": chip_counts(products),
                       "check_skipped": len(skipped)}, ensure_ascii=False)


def id_map(conn, sql):
    """SELECT 결과 (열쇠 칸들..., 번호) → {열쇠: 번호}"""
    return {tuple(row[:-1]): row[-1] for row in conn.execute(text(sql))}


# ---------- 반영(publish.py)과 같이 쓰는 넣기 함수 ----------

def product_key(product):
    """같은 상품인지 가르는 열쇠 (unique(source, loan_type, source_code))"""
    return (product["source"], product["loan_type"], product["source_code"])


def dcls_month(product):
    """금감원 상품의 공시월 YYYYMM (raw_json의 기본 행 dcls_month). 서민, 없으면 None"""
    if product["source"] != "FSS" or not product.get("raw_json"):
        return None
    return json.loads(product["raw_json"]).get("base", {}).get("dcls_month")


def ensure_tags(conn, products):
    """상품들의 칩 중 tag 표에 없는 값만 넣고 {(tag_type, tag_value): tag_id}와 새로 넣은 수를 돌려줌"""
    tag_ids = id_map(conn, "SELECT tag_type, tag_value, tag_id FROM tag")
    new_tags = sorted({(t["tag_type"], t["tag_value"]) for p in products for t in p["tags"]} - set(tag_ids))
    if new_tags:
        conn.execute(INSERT_TAG, [{"tag_type": k, "tag_value": v} for k, v in new_tags])
        tag_ids = id_map(conn, "SELECT tag_type, tag_value, tag_id FROM tag")
    return tag_ids, len(new_tags)


def link_rows(product, product_id, tag_ids):
    """상품 1개의 product_tag, product_rate, product_rate_month 행 (공시월이 없으면 월별 금리 없음)"""
    product_tags = [{"tag_id": tag_ids[(t["tag_type"], t["tag_value"])], "product_id": product_id}
                    for t in product["tags"]]
    rates = [{**r, "product_id": product_id} for r in product["rates"]]
    month = dcls_month(product) if rates else None     # 금감원만 금리 줄이 있음
    rate_months = [{**r, "dcls_month": month} for r in rates] if month else []
    return product_tags, rates, rate_months


def insert_links(conn, product_tags, rates, rate_months):
    """product_tag, product_rate, product_rate_month 행 넣기 (빈 목록은 건너뜀)"""
    if product_tags:
        conn.execute(INSERT_PRODUCT_TAG, product_tags)
    if rates:
        conn.execute(INSERT_RATE, rates)
    if rate_months:
        conn.execute(INSERT_RATE_MONTH, rate_months)


def load(conn, products, skipped):
    """빈 상품 표에 넣기 (conn은 트랜잭션 안)"""
    conn.execute(INSERT_PRODUCT, [{c: p[c] for c in PRODUCT_COLS} for p in products])
    product_ids = id_map(conn, SELECT_PRODUCT_IDS)
    tag_ids, new_tag_count = ensure_tags(conn, products)

    product_tags, rates, rate_months = [], [], []
    for p in products:
        pt, r, rm = link_rows(p, product_ids[product_key(p)], tag_ids)
        product_tags += pt
        rates += r
        rate_months += rm

    insert_links(conn, product_tags, rates, rate_months)
    conn.execute(INSERT_HISTORY, {"added_count": len(products), "memo": "첫 적재 (ml/app/load.py)",
                                  "count_json": count_summary(products, skipped)})
    return {"상품": len(products), "새 태그": new_tag_count, "상품 태그": len(product_tags),
            "구간 금리": len(rates), "월별 금리": len(rate_months)}


def main():
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    check_only = "--check" in sys.argv[1:]

    collected_on = date.fromtimestamp((CSV_DIR / "kinfa_loan_products.csv").stat().st_mtime)
    cleaned = clean_products(load_tables(), ("KINFA", "FSS"), collected_on, date.today())
    products = [p for p in cleaned if not p["check_reasons"]]
    skipped = [p for p in cleaned if p["check_reasons"]]
    log.info("수집일 %s / 정제 %d개 / 넣을 상품 %d개 / 확인 필요라 뺀 상품 %d개",
             collected_on, len(cleaned), len(products), len(skipped))
    for p in skipped:
        log.info("  뺌: %s %s %s (%s)", p["source_code"], p["company_name"], p["product_name"],
                 ", ".join(p["check_reasons"]))

    with make_engine().begin() as conn:   # 블록을 끝까지 마치면 커밋, 오류가 나면 전부 되돌림
        existing = conn.execute(text("SELECT COUNT(*) FROM loan_product")).scalar()
        if existing:
            log.info("상품 표에 이미 %d개가 있어 멈춤 (첫 적재는 빈 DB에서 1번만)", existing)
            return
        if check_only:
            log.info("--check: 접속, 빈 상품 표 확인 끝. DB는 바꾸지 않음")
            return
        result = load(conn, products, skipped)
    log.info("첫 적재 끝: %s", result)


if __name__ == "__main__":
    main()
