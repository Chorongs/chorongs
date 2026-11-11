"""
    상품 정제 1단계 (EXT-01, EXT-02)

    수집 원본 행 목록 (collect.py와 같은 모양: {CSV 이름: 행 목록}) → 상품 목록
    상품 1개 = loan_product 칸 (snake_case) + rates (product_rate 줄 목록)

    1단계에서 만드는 칸:
        source, source_code, loan_type, company_name, product_name,
        rate_min, rate_max, note (서민 금리 원문), raw_json,
        base_date, disclose_start, disclose_end, rates

    - 0, '-', 빈 칸은 빈 값(None)
    - 글자 칸은 HTML 문자(&#40; 등)를 되돌리고 앞뒤 공백 제거 (raw_json은 원본 그대로)
    - 신협(권역 032000)은 상품명으로 묶고 금리는 비움

    확인 실행: ml 폴더에서  python -m app.clean
"""
import calendar
import html
import json
import logging
import re
from collections import Counter
from datetime import date, datetime
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

CSV_DIR = Path(__file__).resolve().parent.parent / "data" / "csv"

# 금감원 CSV 종류 이름 → loan_type
FSS_LOAN_TYPES = {
    "개인신용대출": "CREDIT",
    "전세자금대출": "RENT",
    "주택담보대출": "MORTGAGE",
    "개인사업자대출": "BIZ",
}

CU_GROUP = "032000"     # 신협 권역 코드
CU_COMPANY = "신협"     # 신협 묶음의 company_name

# 신용 구간 rate_key: 금감원 신용 등급 코드 (신용 높은 쪽 → 낮은 쪽)
CREDIT_KEYS = ["1", "4", "5", "6", "10", "11", "12", "13"]
# 개인사업자 val1_grad_1~8 → CREDIT_KEYS 같은 순서
BIZ_GRADE_COLS = [f"val1_grad_{i}" for i in range(1, 9)]
FILL_MAX = 2    # 빈 구간을 이웃 값으로 채우는 최대 연속 칸 수

NUM = r"(\d+(?:\.\d+)?)"    # 숫자 1개 (소수 포함)

# 운영 기간 글의 날짜
YMD = re.compile(r"(\d{4})\s*[.\-년]\s*(\d{1,2})\s*[.\-월]\s*(\d{1,2})")  # 2024. 12. 31 / 2024년 12월 31
YEAR = re.compile(r"(\d{4})\s*[.년]")                                   # 2025년 / 2025.
MONTH_ONLY = re.compile(r"^\s*(\d{1,2})\s*월")                          # 12월


# ---------- 값 하나 정제 ----------

def to_text(value):
    """글자 칸: None, NaN, '', '-' → None / HTML 문자 되돌리기 / 앞뒤 공백 제거"""
    if value is None or pd.isna(value):
        return None

    text = html.unescape(str(value)).strip()
    if text in ("", "-"):
        return None
    return text


def to_rate(value):
    """금감원 금리 칸: 숫자로 바꿈 / 0, 빈 칸, 숫자 아님 → None / 소수 2자리"""
    text = to_text(value)
    if text is None:
        return None

    try:
        rate = float(text)
    except ValueError:
        return None

    if rate == 0:
        return None
    return round(rate, 2)


def to_date(value):
    """'YYYYMMDD' 또는 'YYYYMMDDhhmm' → date / 빈 칸, '99991231', 틀린 날짜 → None"""
    text = to_text(value)
    if text is None or len(text) < 8 or text[:8] == "99991231":
        return None

    try:
        return datetime.strptime(text[:8], "%Y%m%d").date()
    except ValueError:
        return None


def _make_date(year, month, day):
    """틀린 날짜(13월, 32일 등)는 None"""
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _month_end(year, month):
    """그달 마지막 날 / 틀린 월은 None"""
    if not 1 <= month <= 12:
        return None
    return date(year, month, calendar.monthrange(year, month)[1])


def parse_irt(value):
    """
        서민 금리 글(irt) → (rate_min, rate_max, 숫자로 못 바꾼 원문)

        - 'n' → n ~ n / 'n~m' → n ~ m / '~m' → 없음 ~ m / 'n% 이내' → 없음 ~ n
        - '무이자' → 0 ~ 0 ('0'은 'n'과 같이 0 ~ 0. 서민 금리에는 '0 = 빈 값'을 쓰지 않음)
        - 그 밖의 글 → 금리는 빈 값, 원문은 note로
    """
    text = to_text(value)
    if text is None:
        return None, None, None

    flat = text.replace(" ", "")

    if flat == "무이자":
        return 0.0, 0.0, None

    m = re.fullmatch(NUM, flat)
    if m:
        rate = round(float(m[1]), 2)
        return rate, rate, None

    m = re.fullmatch(NUM + "~" + NUM, flat)
    if m:
        return round(float(m[1]), 2), round(float(m[2]), 2), None

    m = re.fullmatch("~" + NUM, flat)
    if m:
        return None, round(float(m[1]), 2), None

    m = re.fullmatch(NUM + "%이내", flat)
    if m:
        return None, round(float(m[1]), 2), None

    return None, None, text


def parse_kinfa_end(value):
    """
        서민 운영 기간 글(prdoprprid) → 공시 종료일 (EXT-01 5단계)

        - '~' 뒤에 날짜가 있으면 그 날        ('~ 2024. 12. 31.' → 2024-12-31)
        - '~' 뒤에 월만 있으면 그달 마지막 날, 연도는 '~' 앞에서 ('2025년 1월~12월' → 2025-12-31)
        - '~' 뒤에 연도만 있으면 그해 12월 31일
        - 상시, 자금 소진 시까지, 시작일만 있는 글 등 → None
    """
    text = to_text(value)
    if text is None or "~" not in text:
        return None

    head, tail = text.split("~", 1)

    m = YMD.search(tail)
    if m:
        return _make_date(int(m[1]), int(m[2]), int(m[3]))

    month = MONTH_ONLY.search(tail)
    year = YEAR.search(head)
    if month and year:
        return _month_end(int(year[1]), int(month[1]))

    m = re.search(r"(\d{4})\s*년", tail)
    if m:
        return date(int(m[1]), 12, 31)

    return None


def to_raw_json(data):
    """원본 값을 JSON 글로 (raw_json 칸, 한글 그대로)"""
    return json.dumps(data, ensure_ascii=False, default=str)


# ---------- 금리 ----------

def _rate(kind, key, rate_min, rate_max, rate_source):
    """product_rate 줄 1개"""
    return {"rate_kind": kind, "rate_key": key,
            "rate_min": rate_min, "rate_max": rate_max, "rate_source": rate_source}


def _min_max(mins, maxs):
    """None을 뺀 최저, 최고 (값이 없으면 None)"""
    mins = [r for r in mins if r is not None]
    maxs = [r for r in maxs if r is not None]
    return (min(mins) if mins else None), (max(maxs) if maxs else None)


def fill_credit_rates(values):
    """
        신용 구간 금리 8칸 (CREDIT_KEYS 순서) → product_rate 줄 목록 (EXT-02 4단계)

        - 공시 값은 DISCLOSED
        - 공시 범위 안 (처음 공시 칸 ~ 마지막 공시 칸) 빈 칸이 연속 FILL_MAX칸 이하면
          신용 낮은 쪽 (오른쪽) 이웃 공시 값으로 채우고 ESTIMATED
        - 범위 밖 빈 칸, 연속 FILL_MAX칸 넘는 빈 칸은 줄을 만들지 않음
    """
    known = [i for i, v in enumerate(values) if v is not None]
    rates = []
    if not known:
        return rates

    for i in range(known[0], known[-1] + 1):
        key = CREDIT_KEYS[i]

        if values[i] is not None:
            rates.append(_rate("CREDIT", key, values[i], values[i], "DISCLOSED"))
            continue

        left = max(j for j in known if j < i)
        right = min(j for j in known if j > i)
        if right - left - 1 <= FILL_MAX:
            rates.append(_rate("CREDIT", key, values[right], values[right], "ESTIMATED"))

    return rates


def range_rates(options, kind, col):
    """전세, 주담대 금리 옵션 → 방식(col)별 최저 ~ 최고 줄 (REPAY: D, S / RATE_TYPE: F, C)"""
    rates = []

    for key, group in options.groupby(col):
        rate_min, rate_max = _min_max(group["lend_rate_min"].map(to_rate),
                                      group["lend_rate_max"].map(to_rate))
        if rate_min is not None or rate_max is not None:
            rates.append(_rate(kind, key, rate_min, rate_max, "DISCLOSED"))

    return rates


def fss_rates(loan_type, options):
    """
        금감원 상품 1개의 금리 옵션 행 → (rate_min, rate_max, rates)

        - CREDIT: 대출금리(A) 행의 crdt_grad_* → 신용 구간, 상품 최저·최고는 구간 공시 값에서
        - BIZ: val1_grad_1~8 → 신용 구간, 상품 최저·최고는 lend_rate_min, lend_rate_max
        - RENT, MORTGAGE: 상환 방식, 금리 방식별 (주담대 아파트·아파트 외는 합침)
        - 금리 행이 없으면 금리 칸 비움 (화면 '금리는 기관 문의')
    """
    if options is None or options.empty:
        return None, None, []

    if loan_type == "CREDIT":
        lend = options[options["crdt_lend_rate_type"] == "A"]
        if lend.empty:
            return None, None, []
        values = [to_rate(lend.iloc[0][f"crdt_grad_{key}"]) for key in CREDIT_KEYS]
        rate_min, rate_max = _min_max(values, values)
        return rate_min, rate_max, fill_credit_rates(values)

    if loan_type == "BIZ":
        row = options.iloc[0]
        values = [to_rate(row[col]) for col in BIZ_GRADE_COLS]
        return to_rate(row["lend_rate_min"]), to_rate(row["lend_rate_max"]), fill_credit_rates(values)

    rates = range_rates(options, "REPAY", "rpay_type") + range_rates(options, "RATE_TYPE", "lend_rate_type")
    rate_min, rate_max = _min_max(options["lend_rate_min"].map(to_rate),
                                  options["lend_rate_max"].map(to_rate))
    return rate_min, rate_max, rates


# ---------- 출처별 정제 ----------

def clean_kinfa(rows, collected_on):
    """
        서민금융진흥원 행 목록 → 상품 목록 (EXT-01)

        - source_code = seq, loan_type KINFA
        - base_date = 수집한 날 (원본에 기준일 칸이 없음)
        - 공시 시작일은 기준이 없어 비움, 종료일은 운영 기간 글에서
    """
    products = []

    for row in rows:
        rate_min, rate_max, rate_note = parse_irt(row.get("irt"))

        products.append({
            "source": "KINFA",
            "source_code": to_text(row.get("seq")),
            "loan_type": "KINFA",
            "company_name": to_text(row.get("ofrinstnm")),
            "product_name": to_text(row.get("finprdnm")),
            "rate_min": rate_min,
            "rate_max": rate_max,
            "note": rate_note,
            "raw_json": to_raw_json(row),
            "base_date": collected_on,
            "disclose_start": None,
            "disclose_end": parse_kinfa_end(row.get("prdoprprid")),
            "rates": [],
        })

    return products


def _option_groups(options, keys):
    """금리 옵션 행을 상품 키로 묶음 {키 튜플: 행 묶음}"""
    if options.empty:
        return {}
    return {key: group for key, group in options.groupby(keys)}


def _records(df):
    """DataFrame → 행 목록 (raw_json용)"""
    return [] if df is None else df.to_dict("records")


def _fss_product(row, loan_type, keys, groups):
    """금감원 기본 행 1개 + 그 상품의 금리 옵션 → 상품 1개"""
    key = tuple(row[k] for k in keys)
    options = groups.get(key)
    rate_min, rate_max, rates = fss_rates(loan_type, options)

    return {
        "source": "FSS",
        "source_code": "_".join(to_text(k) for k in key),
        "loan_type": loan_type,
        "company_name": to_text(row["kor_co_nm"]),
        "product_name": to_text(row["fin_prdt_nm"]),
        "rate_min": rate_min,
        "rate_max": rate_max,
        "note": None,
        "raw_json": to_raw_json({"base": row.to_dict(), "options": _records(options)}),
        "base_date": to_date(row["fin_co_subm_day"]),
        "disclose_start": to_date(row["dcls_strt_day"]),
        "disclose_end": to_date(row["dcls_end_day"]),
        "rates": rates,
    }


def clean_credit_union(base, groups):
    """
        신협 묶기: 권역 032000 상품을 정제한 상품명으로 1개씩 (EXT-02)

        - source_code = '032000_' + 상품명, company_name '신협'
        - 금리는 비움 (조합마다 공시 값의 뜻이 불확실, 화면 '금리는 기관 문의')
        - 상품 조건은 조합마다 같아서 첫 조합의 행을 raw_json으로
        - base_date = 조합들 중 가장 늦은 제출일
    """
    products = []
    names = base["fin_prdt_nm"].map(to_text)

    for name, group in base.groupby(names, sort=False):
        first = group.iloc[0]
        options = groups.get((first["fin_co_no"], first["fin_prdt_cd"]))
        dates = [d for d in group["fin_co_subm_day"].map(to_date) if d is not None]

        products.append({
            "source": "FSS",
            "source_code": f"{CU_GROUP}_{name}",
            "loan_type": "BIZ",
            "company_name": CU_COMPANY,
            "product_name": name,
            "rate_min": None,
            "rate_max": None,
            "note": None,
            "raw_json": to_raw_json({"base": first.to_dict(), "options": _records(options)}),
            "base_date": max(dates) if dates else None,
            "disclose_start": to_date(first["dcls_strt_day"]),
            "disclose_end": to_date(first["dcls_end_day"]),
            "rates": [],
        })

    return products


def clean_fss(tables):
    """
        금융감독원 4종 → 상품 목록 (EXT-02)

        - source_code = fin_co_no + '_' + fin_prdt_cd (개인신용은 + '_' + crdt_prdt_type)
        - base_date = 금융회사 제출일 (fin_co_subm_day 날짜)
        - 공시 시작일, 종료일 (빈칸, '99991231'은 None)
    """
    products = []

    for kind, loan_type in FSS_LOAN_TYPES.items():
        base = pd.DataFrame(tables[f"finlife_{kind}_base"])
        options = pd.DataFrame(tables[f"finlife_{kind}_option"])
        if base.empty:
            continue

        keys = ["fin_co_no", "fin_prdt_cd"]
        if loan_type == "CREDIT":
            keys.append("crdt_prdt_type")
        groups = _option_groups(options, keys)

        if loan_type == "BIZ":
            is_cu = base["top_fin_grp_no"] == CU_GROUP
            products.extend(clean_credit_union(base[is_cu], groups))
            base = base[~is_cu]

        for _, row in base.iterrows():
            products.append(_fss_product(row, loan_type, keys, groups))

    return products


# ---------- 확인 실행 ----------

def load_tables():
    """ml/data/csv/의 원본 CSV → {CSV 이름: 행 목록} (빈 칸은 '')"""
    tables = {}
    for path in sorted(CSV_DIR.glob("*.csv")):
        df = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
        tables[path.stem] = df.to_dict("records")
    return tables


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    tables = load_tables()
    # 수집한 날 = 서민 CSV를 저장한 날
    collected_on = date.fromtimestamp((CSV_DIR / "kinfa_loan_products.csv").stat().st_mtime)

    products = clean_kinfa(tables["kinfa_loan_products"], collected_on) + clean_fss(tables)

    logger.info("정제 상품 %d개: %s", len(products), dict(Counter(p["loan_type"] for p in products)))
    logger.info("금리 빈 상품 %d개", sum(p["rate_min"] is None and p["rate_max"] is None for p in products))
    logger.info("서민 금리 원문(note) %d개", sum(p["note"] is not None for p in products))
    logger.info("공시 종료일 있는 상품 %d개", sum(p["disclose_end"] is not None for p in products))
    logger.info("구간 금리 %d줄: %s", sum(len(p["rates"]) for p in products),
                dict(Counter((r["rate_kind"], r["rate_source"]) for p in products for r in p["rates"])))


if __name__ == "__main__":
    main()
