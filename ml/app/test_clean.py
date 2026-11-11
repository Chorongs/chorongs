from datetime import date

from app.clean import (clean_fss, fill_credit_rates, parse_irt, parse_kinfa_end,
                       to_date, to_rate, to_text)


def _fss_tables(credit_base=(), credit_option=(), biz_base=(), biz_option=()):
    """clean_fss 입력: 금감원 4종 base, option 행 목록 (주지 않은 종류는 빈 목록)"""
    tables = {}
    for kind in ("개인신용대출", "전세자금대출", "주택담보대출", "개인사업자대출"):
        tables[f"finlife_{kind}_base"] = []
        tables[f"finlife_{kind}_option"] = []
    tables["finlife_개인신용대출_base"] = list(credit_base)
    tables["finlife_개인신용대출_option"] = list(credit_option)
    tables["finlife_개인사업자대출_base"] = list(biz_base)
    tables["finlife_개인사업자대출_option"] = list(biz_option)
    return tables


def _base_row(fin_co_no, fin_prdt_cd, kor_co_nm, fin_prdt_nm, subm_day="202610161557", **extra):
    """금감원 기본 정보 행 1개"""
    return dict(fin_co_no=fin_co_no, fin_prdt_cd=fin_prdt_cd, kor_co_nm=kor_co_nm,
                fin_prdt_nm=fin_prdt_nm, fin_co_subm_day=subm_day,
                dcls_strt_day="20261020", dcls_end_day="", **extra)


# ---------- 값 하나 정제 ----------

def test_to_text_HTML_문자를_되돌린다():
    # Given
    value = "햇살론&#40;특례&#41; "
    # When
    result = to_text(value)
    # Then
    assert result == "햇살론(특례)"


def test_to_text_하이픈은_빈_값():
    # Given
    value = "-"
    # When
    result = to_text(value)
    # Then
    assert result is None


def test_to_rate_0은_빈_값():
    # Given
    value = "0.0"
    # When
    result = to_rate(value)
    # Then
    assert result is None


def test_to_date_제출일시는_날짜만_쓴다():
    # Given
    value = "202610161557"
    # When
    result = to_date(value)
    # Then
    assert result == date(2026, 10, 16)


def test_to_date_99991231은_빈_값():
    # Given
    value = "99991231"
    # When
    result = to_date(value)
    # Then
    assert result is None


# ---------- 서민 금리 글 ----------

def test_parse_irt_범위는_최저_최고():
    # Given
    value = "2~3.5"
    # When
    result = parse_irt(value)
    # Then
    assert result == (2.0, 3.5, None)


def test_parse_irt_물결_앞이_비면_최고만():
    # Given
    value = "~ 2.48"
    # When
    result = parse_irt(value)
    # Then
    assert result == (None, 2.48, None)


def test_parse_irt_이내는_최고만():
    # Given
    value = "9% 이내"
    # When
    result = parse_irt(value)
    # Then
    assert result == (None, 9.0, None)


def test_parse_irt_무이자는_0():
    # Given
    value = "무이자"
    # When
    result = parse_irt(value)
    # Then
    assert result == (0.0, 0.0, None)


def test_parse_irt_숫자가_아닌_글은_원문으로():
    # Given
    value = "은행별 상이"
    # When
    result = parse_irt(value)
    # Then
    assert result == (None, None, "은행별 상이")


# ---------- 서민 운영 기간 글 ----------

def test_parse_kinfa_end_끝_날짜가_있으면_그_날():
    # Given
    value = "~ 2024. 12. 31. (또는 자금 소진시 까지)"
    # When
    result = parse_kinfa_end(value)
    # Then
    assert result == date(2024, 12, 31)


def test_parse_kinfa_end_끝이_월만_있으면_그달_마지막_날():
    # Given
    value = "2025년 1월~12월 예산소진시까지"
    # When
    result = parse_kinfa_end(value)
    # Then
    assert result == date(2025, 12, 31)


def test_parse_kinfa_end_시작일만_있으면_빈_값():
    # Given
    value = "2025.02.17~"
    # When
    result = parse_kinfa_end(value)
    # Then
    assert result is None


def test_parse_kinfa_end_상시는_빈_값():
    # Given
    value = "상시"
    # When
    result = parse_kinfa_end(value)
    # Then
    assert result is None


# ---------- 신용 구간 금리 ----------

def test_fill_credit_rates_범위_안_빈_칸은_신용_낮은_쪽_값으로_추정():
    # Given: 구간 5 (세 번째 칸)만 빔
    values = [4.6, 4.79, None, 5.25, None, None, None, None]
    # When
    rates = fill_credit_rates(values)
    # Then
    assert rates[2] == {"rate_kind": "CREDIT", "rate_key": "5",
                        "rate_min": 5.25, "rate_max": 5.25, "rate_source": "ESTIMATED"}


def test_fill_credit_rates_범위_밖_빈_칸은_줄을_만들지_않음():
    # Given: 앞 1칸, 뒤 4칸이 공시 범위 밖
    values = [None, 5.02, 5.21, 5.42, None, None, None, None]
    # When
    rates = fill_credit_rates(values)
    # Then
    assert [r["rate_key"] for r in rates] == ["4", "5", "6"]


def test_fill_credit_rates_연속_3칸_빈_칸은_채우지_않음():
    # Given
    values = [4.0, None, None, None, 6.0, None, None, None]
    # When
    rates = fill_credit_rates(values)
    # Then
    assert [r["rate_key"] for r in rates] == ["1", "10"]


# ---------- 금감원 상품 ----------

def test_clean_fss_개인신용_source_code에_상품_유형을_붙인다():
    # Given
    base = [_base_row("0010001", "P01", "가은행", "직장인대출", crdt_prdt_type="1")]
    tables = _fss_tables(credit_base=base)
    # When
    products = clean_fss(tables)
    # Then
    assert products[0]["source_code"] == "0010001_P01_1"


def test_clean_fss_신협은_상품명으로_묶어_1개():
    # Given: 신협 2곳이 같은 상품을 공시
    base = [_base_row("0010601", "1306", "정락", "기업자유예탁금", top_fin_grp_no="032000"),
            _base_row("0010602", "1306", "금성", "기업자유예탁금", top_fin_grp_no="032000")]
    tables = _fss_tables(biz_base=base)
    # When
    products = clean_fss(tables)
    # Then
    assert [(p["source_code"], p["company_name"]) for p in products] == [("032000_기업자유예탁금", "신협")]


def test_clean_fss_신협_금리는_비운다():
    # Given
    base = [_base_row("0010601", "1306", "정락", "기업자유예탁금", top_fin_grp_no="032000")]
    option = [{"fin_co_no": "0010601", "fin_prdt_cd": "1306",
               "lend_rate_min": "1.1", "lend_rate_max": "20.0"}]
    tables = _fss_tables(biz_base=base, biz_option=option)
    # When
    product = clean_fss(tables)[0]
    # Then
    assert (product["rate_min"], product["rate_max"], product["rates"]) == (None, None, [])


def test_clean_fss_신협_base_date는_가장_늦은_제출일():
    # Given
    base = [_base_row("0010601", "1306", "정락", "기업자유예탁금", "202610061119", top_fin_grp_no="032000"),
            _base_row("0010602", "1306", "금성", "기업자유예탁금", "202610201600", top_fin_grp_no="032000")]
    tables = _fss_tables(biz_base=base)
    # When
    product = clean_fss(tables)[0]
    # Then
    assert product["base_date"] == date(2026, 10, 20)
