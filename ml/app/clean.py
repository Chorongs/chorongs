"""
    상품 정제 1~2단계 (EXT-01, EXT-02)
    규칙 기준: docs 상품 데이터 정제, 필터 기준 / 데이터 처리 기획서

    수집 원본 행 목록 (collect.py와 같은 모양: {CSV 이름: 행 목록}) → 상품 목록
    상품 1개 = loan_product 칸 (snake_case) + rates (product_rate 줄 목록)

    1단계 칸: source, source_code, loan_type, company_name, product_name,
             rate_min, rate_max, note (서민 금리 원문), raw_json,
             base_date, disclose_start, disclose_end, rates
    2단계 칸: limit_amount, term_max, credit_min, credit_max, age_min, age_max,
             income_min, income_max, income_basis, income_note, prepay_fee_max, no_prepay_fee_yn

    - 0, '-', 빈 칸은 빈 값(None) (중도상환수수료 0은 '수수료 없음'이라 예외)
    - 글자 칸은 HTML 문자(&#40; 등)를 되돌리고 앞뒤 공백 제거 (raw_json은 원본 그대로)
    - 신협(권역 032000)은 상품명으로 묶고 금리는 조합들의 최저~최고
    - 공시 종료일이 지난 상품은 빼고 적재 (drop_closed)

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
NUM_TOKEN = r"(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)"    # 1,000 / 3500 / 2.5

COMPANY_WORDS = ("주식회사", "㈜")   # 회사명에서 지우는 말

# 신용 구간 rate_key → NICE 점수 범위 (900 초과 = 901~1000, 300 이하 = 0~300)
CREDIT_SCORES = {"1": (901, 1000), "4": (801, 900), "5": (701, 800), "6": (601, 700),
                 "10": (501, 600), "11": (401, 500), "12": (301, 400), "13": (0, 300)}
# 신용점수 '하위 n%' → NICE 점수 상한. 매년 4월 1일 바뀌는 설정값 (4단계에서 단어표 파일로 옮김)
CREDIT_LOWER = {20: 749, 50: 889}

# 금감원 사업자 한도 구간 → 아래쪽 값(만원). '1천만원 미만', '기타'는 세부 칸 글에서
BIZ_LIMIT_RANGES = {"1천만원~5천만원": 1000, "5천만원~1억원": 5000,
                    "1억원~5억원": 10000, "5억원 초과": 50000}

PREPAY_MAX = 5      # 중도상환수수료로 보는 % 상한 (넘으면 '대출금의 10%까지 면제' 같은 다른 숫자)
TERM_BARE_MONTHS = 24   # 단위 없는 대출기간: 회사의 가장 큰 값이 이 이상이면 개월, 아니면 년

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
    """그달 마지막 날 / 12를 넘는 월은 다음 해로 넘김 (2025년 16월 → 2026년 4월) / 0월 이하는 None"""
    if month < 1:
        return None
    year, month = year + (month - 1) // 12, (month - 1) % 12 + 1
    return date(year, month, calendar.monthrange(year, month)[1])


def to_company(value):
    """회사명: to_text + '주식회사', '㈜' 삭제"""
    text = to_text(value)
    if text is None:
        return None

    for word in COMPANY_WORDS:
        text = text.replace(word, "")
    return re.sub(r"\s+", " ", text).strip() or None


def parse_irt(value):
    """
        서민 금리 글(irt) → (rate_min, rate_max, 숫자로 못 바꾼 원문)

        - 'n' → n ~ n / 'n~m' → n ~ m / '~m' → 없음 ~ m / 'n% 이내' → 없음 ~ n
        - '무이자' → 0 ~ 0 ('0'은 'n'과 같이 0 ~ 0. 서민 금리에는 '0 = 빈 값'을 쓰지 않음)
        - 글 앞이 금리 숫자면 그 값 ('2.1 *전북...에서 1% 이자지원' → 2.1, 뒤는 부가 설명)
        - 그 밖에 글 속 % 숫자가 있으면 그 최저 ~ 최고
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

    m = re.match(r"연?" + NUM + r"%?(?:\*|$)", flat)
    if m:
        rate = round(float(m[1]), 2)
        return rate, rate, None

    rates = [round(float(p), 2) for p in re.findall(NUM + "%", flat)]
    if rates:
        return min(rates), max(rates), None

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


# ---------- 2단계: 숫자 칸 ----------

def _num(text):
    """'1,000' → 1000.0"""
    return float(text.replace(",", ""))


def parse_amounts(text, bare_unit=None):
    """
        글 속 금액 → [(만원, 시작 위치, 끝 위치)]

        - '1억 5천', '4억 44백만원', '1.3억원' / '8천5백만원' / '7.5천만원', '35백만원', '3,500만원'
        - bare_unit이 있으면 단위 없는 숫자도 그 단위 (서민 한도는 만원). % 숫자는 뺌
        - 찾은 곳은 같은 길이 공백으로 지워 위치를 유지
    """
    found = []
    units = {"천만": 1000, "천": 1000, "백만": 100, "만": 1}
    patterns = [
        (NUM_TOKEN + r"\s*억\s*원?(?:\s*" + NUM_TOKEN + r"\s*(천만|천|백만|만)\s*원?)?",
         lambda m: _num(m[1]) * 10000 + (_num(m[2]) * units[m[3]] if m[2] else 0)),
        (NUM_TOKEN + r"\s*천\s*" + NUM_TOKEN + r"\s*백\s*만\s*원?",
         lambda m: _num(m[1]) * 1000 + _num(m[2]) * 100),
        (NUM_TOKEN + r"\s*(천만|백만|만)\s*원?",
         lambda m: _num(m[1]) * units[m[2]]),
    ]
    if bare_unit:
        patterns.append((NUM_TOKEN + r"(?![\d.,]*\s*%)", lambda m: _num(m[1]) * bare_unit))

    rest = text
    for pattern, calc in patterns:
        for m in re.finditer(pattern, rest):
            found.append((calc(m), m.start(), m.end()))
        rest = re.sub(pattern, lambda m: " " * len(m[0]), rest)

    return sorted(found, key=lambda f: f[1])


def parse_limit(value, bare_unit=None):
    """
        한도 글 → 만원 (정제 기준 3-4)

        - 여러 금액이면 가장 큰 값
        - '같은 기업 당', '동일기업당' 총 한도는 빼고 본건 한도 (본건 금액이 없으면 총 한도)
        - 금액이 없으면 None (LTV 같은 비율만 있는 글, 단위 없는 금감원 '1' 등)
    """
    text = to_text(value)
    if text is None:
        return None

    own = re.sub(r"(같은|동일)\s*기업\s*당?[^,)\]]*", " ", text)
    amounts = parse_amounts(own, bare_unit) or parse_amounts(text, bare_unit)
    if not amounts:
        return None
    return int(round(max(a for a, _, _ in amounts)))


def biz_limit(limit_range, detail):
    """금감원 사업자 한도: 구간 칸이 금액 구간이면 아래쪽 값, '1천만원 미만', '기타'면 세부 칸 글에서"""
    lower = BIZ_LIMIT_RANGES.get(to_text(limit_range))
    if lower is not None:
        return lower
    return parse_limit(detail)


def parse_kinfa_term(value):
    """
        서민 최대 대출기간(년 기준 글) → 개월

        - 숫자는 년 x 12, 'N개월'은 그대로, 'N일'은 30일을 1개월로
        - 여러 값('10, 15, 20, 30', '1~5', '2(최장 8년)')이면 가장 큰 값
        - 금액이 섞인 글('소득발생(… 2,679만원)시 상환')과 숫자 없는 글은 None
    """
    text = to_text(value)
    if text is None or "만원" in text:
        return None

    months = []
    for m in re.finditer(NUM + r"\s*(개월|년|일)?", text):
        n, unit = float(m[1]), m[2]
        if unit == "개월":
            months.append(n)
        elif unit == "일":
            months.append(n // 30)
        elif n <= 50:
            months.append(n * 12)

    return int(round(max(months))) if months else None


def parse_fss_term(value, bare_months=None):
    """
        금감원 사업자 대출기간 글 → 개월

        - 'N년', 'N개월', 'N일' 중 가장 큰 값 (연장 포함: '1년(최장 5년)' → 60)
        - 단위가 하나도 없는 글('84', '6~12')은 bare_months (회사별 단위, bare_term_units)
    """
    text = to_text(value)
    if text is None:
        return None

    months = [int(y) * 12 + int(mo) for y, mo in re.findall(r"(\d+)\s*년\s*(\d+)\s*개월", text)]   # 2년6개월
    for m in re.finditer(NUM + r"\s*(개월|년|일)", text):
        n, unit = float(m[1]), m[2]
        if unit == "개월" and n <= 600:
            months.append(n)
        elif unit == "년" and n <= 50:
            months.append(n * 12)
        elif unit == "일":
            months.append(n // 30)

    if months:
        return int(round(max(months)))

    if bare_months and re.fullmatch(r"[\d.\s,~]+", text):
        return int(round(max(float(n) for n in re.findall(NUM, text)) * bare_months))
    return None


def bare_term_units(base):
    """
        회사별 단위 없는 대출기간의 단위 {회사명: 1(개월) 또는 12(년)}
        그 회사의 단위 없는 숫자 중 가장 큰 값이 TERM_BARE_MONTHS 이상이면 개월, 아니면 년
    """
    largest = {}
    for company, term in zip(base["kor_co_nm"], base["loan_term"]):
        text = to_text(term)
        if text and re.fullmatch(r"[\d.\s,~]+", text):
            n = max(float(x) for x in re.findall(NUM, text))
            largest[company] = max(largest.get(company, 0), n)
    return {company: 1 if n >= TERM_BARE_MONTHS else 12 for company, n in largest.items()}


def parse_credit(value):
    """
        서민 신용점수 조건 글 → (credit_min, credit_max) NICE 0~1000

        - '595점 이상' → 595~1000 / '839점 이하' → 0~839 / '595~879' / '595점 이상 839점 이하'
        - '하위 20%', '하위 100분의 20' → 0~749 (CREDIT_LOWER)
        - 조건이 여러 개면 합친 범위 (Track1 880~1000 + Track2 595~879 → 595~1000)
        - 점수 없는 조건('없음', 'B등급 이상' 등)은 (None, None)
    """
    text = to_text(value)
    if text is None:
        return None, None

    score = r"(1,000|\d{3,4})"
    ranges = []

    for m in re.finditer(r"하위\s*(?:100분의\s*)?(\d+)", text):
        if int(m[1]) in CREDIT_LOWER:
            ranges.append((0, CREDIT_LOWER[int(m[1])]))

    both = score + r"\s*점\s*이상\s*" + score + r"\s*점\s*이하"
    for m in re.finditer(both, text):
        ranges.append((_num(m[1]), _num(m[2])))
    rest = re.sub(both, " ", text)

    span = r"(\d{3})\s*점?\s*~\s*" + score
    for m in re.finditer(span, rest):
        ranges.append((_num(m[1]), _num(m[2])))
    rest = re.sub(span, " ", rest)     # '595~839점 이하'의 839를 다시 세지 않음

    for m in re.finditer(score + r"\s*점\s*(이상|초과|이하|미만)", rest):
        n = _num(m[1])
        ranges.append({"이상": (n, 1000), "초과": (n + 1, 1000),
                       "이하": (0, n), "미만": (0, n - 1)}[m[2]])

    ranges = [(lo, hi) for lo, hi in ranges if 0 <= lo <= hi <= 1000]
    if not ranges:
        return None, None
    return int(min(lo for lo, _ in ranges)), int(max(hi for _, hi in ranges))


def credit_from_rates(rates):
    """금감원 신용 구간 금리가 공시된 구간을 합친 점수 범위 (be_recommend 걸러내기 5)"""
    keys = [r["rate_key"] for r in rates if r["rate_kind"] == "CREDIT" and r["rate_source"] == "DISCLOSED"]
    if not keys:
        return None, None
    return min(CREDIT_SCORES[k][0] for k in keys), max(CREDIT_SCORES[k][1] for k in keys)


def parse_age(value):
    """
        서민 나이 조건 글 → (age_min, age_max) 만 나이 (기획서 3-3)

        - 'N세 이상' → min / 'N세 이하' → max / '미만' → N-1 / '초과' → N+1 / 'N~M세' → N~M
        - '미성년자 제외', '민법상 성년' → 19세 이상
        - 최대 나이가 여러 개면 가장 큰 값 ('(학부생) 35세 이하 (대학원생) 40세 이하' → 40)
        - '없음'으로 시작하면 (None, None)
    """
    text = to_text(value)
    if text is None or text.startswith("없음"):
        return None, None

    flat = re.sub(r"만(?=\d)", "", text.replace(" ", ""))    # '만 19세' → '19세' ('미만'은 그대로)
    mins, maxs = [], []

    if "미성년자제외" in flat or "민법상성년" in flat:
        mins.append(19)

    m = re.search(r"(\d+)세?(?:이상)?~(\d+)세", flat)
    if m:
        mins.append(int(m[1]))
        maxs.append(int(m[2]))
    else:
        for m in re.finditer(r"(\d+)세(이상|초과|이하|미만)", flat):
            n = int(m[1])
            if m[2] in ("이상", "초과"):
                mins.append(n + (m[2] == "초과"))
            else:
                maxs.append(n - (m[2] == "미만"))

    return (min(mins) if mins else None), (max(maxs) if maxs else None)


def parse_income(value):
    """
        서민 소득 조건 글 → (income_min, income_max, income_basis, income_note) 연 만원 (기획서 3-3, 3-4)

        - 금액 뒤가 '이상', '초과'면 하한, 나머지는 상한. 여러 개면 가장 넓게 (하한 최저, 상한 최고)
        - 앞에 '월평균', '월 소득'이 있으면 x 12 ('월평균 소득 315만원 이하' → 3,780)
        - '부부', '배우자'가 있으면 COUPLE, 아니면 SELF
        - 금액이 없거나 매출 조건이면 OTHER (중위소득, 수급자, 학자금 구간 등)
        - '없음'으로 시작하거나 빈 값이면 모두 None. 조건이 있으면 원문은 income_note
    """
    text = to_text(value)
    if text is None or text.startswith("없음"):
        return None, None, None, None

    if "매출" in text:
        return None, None, "OTHER", text

    mins, maxs = [], []
    for amount, start, end in parse_amounts(text):
        if re.search(r"월\s*평균|월\s*소득", text[max(0, start - 12):start]):
            amount *= 12
        if re.match(r"\s*(이상|초과)", text[end:]):
            mins.append(amount)
        else:
            maxs.append(amount)

    if not mins and not maxs:
        return None, None, "OTHER", text

    basis = "COUPLE" if re.search("부부|배우자", text) else "SELF"
    return (int(min(mins)) if mins else None), (int(max(maxs)) if maxs else None), basis, text


def parse_prepay(value):
    """
        중도상환수수료 글 → (prepay_fee_max, no_prepay_fee_yn) (기획서 3-4)

        - 글 속 % 중 가장 큰 값 + N (PREPAY_MAX 넘는 %는 다른 숫자라 뺌, 단위 없는 '1.5'는 None)
        - % 없이 '없음', '면제', '폐지' → 0 + Y ('0 = 빈 값' 규칙을 쓰지 않음)
        - 그 밖의 글, 빈 값 → (None, None) ('모름'을 Y로 두지 않음)
    """
    text = to_text(value)
    if text is None:
        return None, None

    found = re.findall(NUM + r"\s*%", text)
    for group in re.findall(r"\(([^()]*)\)\s*%", text):     # '(고정금리:0.57, 변동금리:0.47)%'
        found += re.findall(NUM, group)
    fees = [float(p) for p in found if float(p) <= PREPAY_MAX]
    if fees:
        fee = round(max(fees), 2)
        return fee, ("Y" if fee == 0 else "N")

    if re.search("없음|면제|폐지", text):
        return 0.0, "Y"
    return None, None


def _no_numbers():
    """2단계 칸 빈 값 묶음 (출처에 칸이 없으면 이 값 그대로)"""
    return {"limit_amount": None, "term_max": None, "credit_min": None, "credit_max": None,
            "age_min": None, "age_max": None, "income_min": None, "income_max": None,
            "income_basis": None, "income_note": None, "prepay_fee_max": None, "no_prepay_fee_yn": None}


def kinfa_numbers(row):
    """서민 행 1개 → 2단계 칸"""
    numbers = _no_numbers()
    numbers["limit_amount"] = parse_limit(row.get("lnlmt"), bare_unit=1)
    numbers["term_max"] = parse_kinfa_term(row.get("maxtotlntrm"))
    numbers["credit_min"], numbers["credit_max"] = parse_credit(row.get("crdtsc"))
    numbers["age_min"], numbers["age_max"] = parse_age(row.get("age"))
    (numbers["income_min"], numbers["income_max"],
     numbers["income_basis"], numbers["income_note"]) = parse_income(row.get("incm"))
    numbers["prepay_fee_max"], numbers["no_prepay_fee_yn"] = parse_prepay(row.get("rpymdcfe"))
    return numbers


def fss_numbers(row, loan_type, rates, bare_months=None):
    """
        금감원 기본 행 1개 → 2단계 칸 (나이, 소득은 출처에 칸 없음)

        - CREDIT: 신용 범위만 (한도, 기간, 중도상환수수료 칸 없음)
        - RENT, MORTGAGE: 한도(loan_lmt), 중도상환수수료
        - BIZ: 한도(구간 → 세부), 기간, 신용 범위, 중도상환수수료
    """
    numbers = _no_numbers()

    if loan_type in ("CREDIT", "BIZ"):
        numbers["credit_min"], numbers["credit_max"] = credit_from_rates(rates)
    if loan_type in ("RENT", "MORTGAGE"):
        numbers["limit_amount"] = parse_limit(row["loan_lmt"])
    if loan_type == "BIZ":
        numbers["limit_amount"] = biz_limit(row["loan_limit"], row["loan_limit_detl"])
        numbers["term_max"] = parse_fss_term(row["loan_term"], bare_months)
    if loan_type != "CREDIT":
        numbers["prepay_fee_max"], numbers["no_prepay_fee_yn"] = parse_prepay(row["erly_rpay_fee"])

    return numbers


def drop_closed(products, today):
    """공시 종료일이 오늘 이전인 상품은 적재하지 않음 (정제 기준 3-3)"""
    return [p for p in products if p["disclose_end"] is None or p["disclose_end"] >= today]


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
            "company_name": to_company(row.get("ofrinstnm")),
            "product_name": to_text(row.get("finprdnm")),
            "rate_min": rate_min,
            "rate_max": rate_max,
            "note": rate_note,
            "raw_json": to_raw_json(row),
            "base_date": collected_on,
            "disclose_start": None,
            "disclose_end": parse_kinfa_end(row.get("prdoprprid")),
            "rates": [],
            **kinfa_numbers(row),
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


def _fss_product(row, loan_type, keys, groups, bare_months=None):
    """금감원 기본 행 1개 + 그 상품의 금리 옵션 → 상품 1개"""
    key = tuple(row[k] for k in keys)
    options = groups.get(key)
    rate_min, rate_max, rates = fss_rates(loan_type, options)

    return {
        "source": "FSS",
        "source_code": "_".join(to_text(k) for k in key),
        "loan_type": loan_type,
        "company_name": to_company(row["kor_co_nm"]),
        "product_name": to_text(row["fin_prdt_nm"]),
        "rate_min": rate_min,
        "rate_max": rate_max,
        "note": None,
        "raw_json": to_raw_json({"base": row.to_dict(), "options": _records(options)}),
        "base_date": to_date(row["fin_co_subm_day"]),
        "disclose_start": to_date(row["dcls_strt_day"]),
        "disclose_end": to_date(row["dcls_end_day"]),
        "rates": rates,
        **fss_numbers(row, loan_type, rates, bare_months),
    }


def clean_credit_union(base, groups):
    """
        신협 묶기: 권역 032000 상품을 정제한 상품명으로 1개씩 (EXT-02, 정제 기준 3-2)

        - source_code = '032000_' + 상품명, company_name '신협'
        - 금리 = 조합들 lend_rate_min 최저 ~ lend_rate_max 최고 (0은 빈 값이라 뺌)
        - 구간 금리(rates), 신용 범위는 만들지 않음 (조합마다 달라 추정 제외, 기획서 3-11)
        - 상품 조건은 조합마다 같아서 첫 조합의 행으로 한도, 기간, 수수료, raw_json
        - base_date = 조합들 중 가장 늦은 제출일
    """
    products = []
    names = base["fin_prdt_nm"].map(to_text)

    for name, group in base.groupby(names, sort=False):
        first = group.iloc[0]
        options = groups.get((first["fin_co_no"], first["fin_prdt_cd"]))
        dates = [d for d in group["fin_co_subm_day"].map(to_date) if d is not None]

        mins, maxs = [], []
        for co_no, prdt_cd in zip(group["fin_co_no"], group["fin_prdt_cd"]):
            place = groups.get((co_no, prdt_cd))
            if place is not None:
                mins.extend(place["lend_rate_min"].map(to_rate))
                maxs.extend(place["lend_rate_max"].map(to_rate))
        rate_min, rate_max = _min_max(mins, maxs)

        products.append({
            "source": "FSS",
            "source_code": f"{CU_GROUP}_{name}",
            "loan_type": "BIZ",
            "company_name": CU_COMPANY,
            "product_name": name,
            "rate_min": rate_min,
            "rate_max": rate_max,
            "note": None,
            "raw_json": to_raw_json({"base": first.to_dict(), "options": _records(options)}),
            "base_date": max(dates) if dates else None,
            "disclose_start": to_date(first["dcls_strt_day"]),
            "disclose_end": to_date(first["dcls_end_day"]),
            "rates": [],
            **fss_numbers(first, "BIZ", []),
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

        units = {}
        if loan_type == "BIZ":
            is_cu = base["top_fin_grp_no"] == CU_GROUP
            products.extend(clean_credit_union(base[is_cu], groups))
            base = base[~is_cu]
            units = bare_term_units(base)

        for _, row in base.iterrows():
            products.append(_fss_product(row, loan_type, keys, groups, units.get(row["kor_co_nm"])))

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
    closed = len(products)
    products = drop_closed(products, date.today())
    logger.info("판매 종료 제외 %d개", closed - len(products))

    logger.info("정제 상품 %d개: %s", len(products), dict(Counter(p["loan_type"] for p in products)))
    logger.info("금리 빈 상품 %d개", sum(p["rate_min"] is None and p["rate_max"] is None for p in products))
    logger.info("서민 금리 원문(note) %d개", sum(p["note"] is not None for p in products))
    logger.info("공시 종료일 있는 상품 %d개", sum(p["disclose_end"] is not None for p in products))
    logger.info("구간 금리 %d줄: %s", sum(len(p["rates"]) for p in products),
                dict(Counter((r["rate_kind"], r["rate_source"]) for p in products for r in p["rates"])))
    for col in ("limit_amount", "term_max", "credit_min", "credit_max", "age_min", "age_max",
                "income_min", "income_max", "income_basis", "prepay_fee_max"):
        logger.info("  %s 값 있음: %s", col,
                    dict(Counter(p["source"] for p in products if p[col] is not None)))


if __name__ == "__main__":
    main()
