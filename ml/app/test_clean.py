from datetime import date

import pandas as pd

from app.clean import (WORDS, amount_chips, bare_term_units, biz_limit, check_product, clean_fss,
                       clean_kinfa, clean_products,
                       credit_bands, credit_from_rates, drop_closed, fill_credit_rates, fss_amount,
                       fss_bank_names, fss_credit, fss_group_chip, fss_online, fss_policy,
                       fss_purpose, fss_rate_type, fss_repay, fss_target, kinfa_company,
                       kinfa_credit, kinfa_online, kinfa_purpose, kinfa_region, kinfa_sector,
                       kinfa_target,
                       merge_yn, parse_age, parse_credit, parse_extra_cond, parse_fss_term,
                       parse_income, parse_irt, parse_kinfa_end, parse_kinfa_term, parse_limit,
                       parse_prepay, rate_type_from_texts, repay_chips, to_company, to_date, to_rate,
                       to_text)


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
    row = dict(fin_co_no=fin_co_no, fin_prdt_cd=fin_prdt_cd, kor_co_nm=kor_co_nm,
               fin_prdt_nm=fin_prdt_nm, fin_co_subm_day=subm_day,
               dcls_strt_day="20261020", dcls_end_day="",
               loan_limit="", loan_limit_detl="", loan_term="", erly_rpay_fee="",
               join_way="", fin_prdt_type_nm="", lend_rate_type="", join_deny="", use_way="",
               loan_type="", rpay_type="", top_fin_grp_no="020000")
    row.update(extra)
    return row


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


def test_clean_fss_신협_금리는_조합들의_0을_뺀_최저_최고():
    # Given: 두 번째 조합 최저 금리는 0 (빈 값)
    base = [_base_row("0010601", "1306", "정락", "기업자유예탁금", top_fin_grp_no="032000"),
            _base_row("0010602", "1306", "금성", "기업자유예탁금", top_fin_grp_no="032000")]
    option = [{"fin_co_no": "0010601", "fin_prdt_cd": "1306", "lend_rate_min": "1.1", "lend_rate_max": "19.5"},
              {"fin_co_no": "0010602", "fin_prdt_cd": "1306", "lend_rate_min": "0", "lend_rate_max": "20.0"}]
    tables = _fss_tables(biz_base=base, biz_option=option)
    # When
    product = clean_fss(tables)[0]
    # Then
    assert (product["rate_min"], product["rate_max"], product["rates"]) == (1.1, 20.0, [])


def test_clean_fss_신협_base_date는_가장_늦은_제출일():
    # Given
    base = [_base_row("0010601", "1306", "정락", "기업자유예탁금", "202610061119", top_fin_grp_no="032000"),
            _base_row("0010602", "1306", "금성", "기업자유예탁금", "202610201600", top_fin_grp_no="032000")]
    tables = _fss_tables(biz_base=base)
    # When
    product = clean_fss(tables)[0]
    # Then
    assert product["base_date"] == date(2026, 10, 20)


# ---------- 1단계 보완 (정제 기준 문서) ----------

def test_to_company_주식회사를_지운다():
    # Given
    value = "주식회사 카카오뱅크"
    # When
    result = to_company(value)
    # Then
    assert result == "카카오뱅크"


def test_parse_irt_글_앞_금리_숫자를_쓴다():
    # Given
    value = "2.1 *전북특별자치도에서 3년간 1%, 부안군에서 3년간 2% 이자지원"
    # When
    result = parse_irt(value)
    # Then
    assert result == (2.1, 2.1, None)


def test_parse_irt_글_속_퍼센트는_최저_최고():
    # Given
    value = "(보증금)연1.3%, (월세금,20만원 한도)연0%"
    # When
    result = parse_irt(value)
    # Then
    assert result == (0.0, 1.3, None)


def test_parse_kinfa_end_12를_넘는_월은_다음_해로():
    # Given
    value = "2025년 1월~16월 예산소진시까지"
    # When
    result = parse_kinfa_end(value)
    # Then
    assert result == date(2026, 4, 30)


def test_drop_closed_종료일이_오늘_이전이면_뺀다():
    # Given
    products = [{"disclose_end": date(2026, 11, 10)}, {"disclose_end": date(2026, 11, 11)},
                {"disclose_end": None}]
    # When
    result = drop_closed(products, date(2026, 11, 11))
    # Then
    assert result == products[1:]


# ---------- 2단계: 한도 ----------

def test_parse_limit_억과_천을_만원으로():
    # Given
    value = "최대 1억 5천"
    # When
    result = parse_limit(value)
    # Then
    assert result == 15000


def test_parse_limit_같은_기업_당_총_한도는_뺀다():
    # Given
    value = "본건 7000(같은기업당 재단보증금액 1억5천만원 이내)"
    # When
    result = parse_limit(value, bare_unit=1)
    # Then
    assert result == 7000


def test_parse_limit_붙은_금액은_나눠_가장_큰_값():
    # Given
    value = "5,00010,000 (코로나 19 피해 소기업, 소상공인)"
    # When
    result = parse_limit(value, bare_unit=1)
    # Then
    assert result == 10000


def test_parse_limit_비율만_있으면_빈_값():
    # Given
    value = "LTV 70%"
    # When
    result = parse_limit(value)
    # Then
    assert result is None


def test_parse_limit_금감원_단위_없는_숫자는_빈_값():
    # Given
    value = "1"
    # When
    result = parse_limit(value)
    # Then
    assert result is None


def test_biz_limit_구간은_아래쪽_값():
    # Given
    limit_range, detail = "1억원~5억원", "최대 1억 5천"
    # When
    result = biz_limit(limit_range, detail)
    # Then
    assert result == 10000


def test_biz_limit_구간이_기타면_세부_글에서():
    # Given
    limit_range, detail = "기타", "최대 15억원"
    # When
    result = biz_limit(limit_range, detail)
    # Then
    assert result == 150000


# ---------- 2단계: 기간 ----------

def test_parse_kinfa_term_여러_년이면_가장_큰_값_개월():
    # Given
    value = "10, 15, 20, 30"
    # When
    result = parse_kinfa_term(value)
    # Then
    assert result == 360


def test_parse_kinfa_term_괄호_속_최장_기간도_본다():
    # Given
    value = "2(최장 8년)"
    # When
    result = parse_kinfa_term(value)
    # Then
    assert result == 96


def test_parse_fss_term_연장_포함_가장_큰_값():
    # Given
    value = "1년 (최장 5년까지 1년단위 연장)"
    # When
    result = parse_fss_term(value)
    # Then
    assert result == 60


def test_parse_fss_term_년과_개월이_붙은_값():
    # Given
    value = "2년6개월"
    # When
    result = parse_fss_term(value)
    # Then
    assert result == 30


def test_parse_fss_term_단위_없으면_회사_단위로():
    # Given: 회사 단위가 년(12)
    value = "15"
    # When
    result = parse_fss_term(value, bare_months=12)
    # Then
    assert result == 180


def test_parse_fss_term_더하기_뒤_기간은_보지_않는다():
    # Given: 납품 날짜에 더하는 기간만 있는 글
    value = "납품기한 + 6개월"
    # When
    result = parse_fss_term(value)
    # Then
    assert result is None


def test_parse_fss_term_더하기_뒤_기간을_빼고_남은_기간은_읽는다():
    # Given
    value = "(한도약정) 1년 (한도내 개별대출) 발주정보상 납품기일+1개월"
    # When
    result = parse_fss_term(value)
    # Then
    assert result == 12


def test_bare_term_units_가장_큰_값이_24_이상이면_개월():
    # Given
    base = pd.DataFrame({"kor_co_nm": ["가캐피탈", "가캐피탈", "나은행", "나은행"],
                         "loan_term": ["84", "6~12", "10", "15"]})
    # When
    result = bare_term_units(base)
    # Then
    assert result == {"가캐피탈": 1, "나은행": 12}


# ---------- 2단계: 신용 ----------

def test_parse_credit_이상은_1000까지():
    # Given
    value = "대표자 개인신용평점 595점 이상"
    # When
    result = parse_credit(value)
    # Then
    assert result == (595, 1000)


def test_parse_credit_하위_20퍼센트는_749점_이하():
    # Given
    value = "개인신용평점이 하위 100분의 20 이하"
    # When
    result = parse_credit(value)
    # Then
    assert result == (0, 749)


def test_parse_credit_범위_뒤_이하를_다시_세지_않음():
    # Given
    value = "대표자의 개인신용평점이 595~839점 이하인 기업"
    # When
    result = parse_credit(value)
    # Then
    assert result == (595, 839)


def test_parse_credit_등급_조건은_빈_값():
    # Given
    value = "재단 신용평가시스템에 의한 평가등급이 B등급 이상일 것"
    # When
    result = parse_credit(value)
    # Then
    assert result == (None, None)


def test_parse_credit_무관_조건이_붙으면_빈_값():
    # Given
    value = "하위 100분의 20%(연소득 3,500만원 이하는 무관)"
    # When
    result = parse_credit(value)
    # Then
    assert result == (None, None)


def test_credit_from_rates_공시_구간을_합친_범위():
    # Given: 구간 4(801~900) 공시, 5(701~800) 추정, 6(601~700) 공시
    rates = [{"rate_kind": "CREDIT", "rate_key": "4", "rate_source": "DISCLOSED"},
             {"rate_kind": "CREDIT", "rate_key": "5", "rate_source": "ESTIMATED"},
             {"rate_kind": "CREDIT", "rate_key": "6", "rate_source": "DISCLOSED"}]
    # When
    result = credit_from_rates(rates)
    # Then
    assert result == (601, 900)


# ---------- 2단계: 나이 ----------

def test_parse_age_범위():
    # Given
    value = "만 19세 이상 34세 이하 청년"
    # When
    result = parse_age(value)
    # Then
    assert result == (19, 34)


def test_parse_age_미만은_하나_뺀다():
    # Given
    value = "40세 미만"
    # When
    result = parse_age(value)
    # Then
    assert result == (None, 39)


def test_parse_age_민법상_성년은_19세_이상():
    # Given
    value = "민법상 성년"
    # When
    result = parse_age(value)
    # Then
    assert result == (19, None)


# ---------- 2단계: 소득 ----------

def test_parse_income_월_소득은_12배():
    # Given
    value = "월평균 소득 315만원 이하 (비정규직 근로자 예외)"
    # When
    result = parse_income(value)
    # Then
    assert result[:3] == (None, 3780, "SELF")


def test_parse_income_부부합산_여러_금액이면_가장_큰_상한():
    # Given
    value = "부부합산 연소득 6천만원 이하(생애최초, 2자녀 이상 가구 7천만원, 신혼가구 8천5백만원)"
    # When
    result = parse_income(value)
    # Then
    assert result[:3] == (None, 8500, "COUPLE")


def test_parse_income_이상은_하한():
    # Given
    value = "가처분소득 연 600만원 이상"
    # When
    result = parse_income(value)
    # Then
    assert result[:3] == (600, None, "SELF")


def test_parse_income_금액_없는_조건은_OTHER와_원문():
    # Given
    value = "3인가구 기준 중위소득 이하"
    # When
    result = parse_income(value)
    # Then
    assert result == (None, None, "OTHER", "3인가구 기준 중위소득 이하")


def test_parse_income_없음은_모두_빈_값():
    # Given
    value = "없음"
    # When
    result = parse_income(value)
    # Then
    assert result == (None, None, None, None)


# ---------- 2단계: 중도상환수수료 ----------

def test_parse_prepay_면제는_0과_Y():
    # Given
    value = "면제"
    # When
    result = parse_prepay(value)
    # Then
    assert result == (0.0, "Y")


def test_parse_prepay_가장_큰_퍼센트와_N():
    # Given
    value = "상환금액X요율*X(잔존일수/대출일수) *0.02%~0.53%"
    # When
    result = parse_prepay(value)
    # Then
    assert result == (0.53, "N")


def test_parse_prepay_수수료율이_아닌_큰_퍼센트는_뺀다():
    # Given
    value = "조기상환원금 × 0.4% × [(3년-대출경과일수) / 3년] 매년 대출잔액의 10% 까지 중도상환수수료 면제"
    # When
    result = parse_prepay(value)
    # Then
    assert result == (0.4, "N")


def test_parse_prepay_빈_값은_모름():
    # Given
    value = "-"
    # When
    result = parse_prepay(value)
    # Then
    assert result == (None, None)


# ---------- 3단계: 금리 방식 ----------

def test_rate_type_from_texts_고정과_변동이_같이_있으면_BOTH():
    # Given
    values = ["고정금리/변동금리"]
    # When
    result = rate_type_from_texts(values)
    # Then
    assert result == "BOTH"


def test_rate_type_from_texts_무이자는_FIXED():
    # Given
    values = ["무이자"]
    # When
    result = rate_type_from_texts(values)
    # Then
    assert result == "FIXED"


def test_rate_type_from_texts_방식_없는_글은_빈_값():
    # Given
    values = ["은행금리"]
    # When
    result = rate_type_from_texts(values)
    # Then
    assert result is None


def test_rate_type_from_texts_조합마다_다르면_BOTH():
    # Given
    values = ["고정금리", "변동금리"]
    # When
    result = rate_type_from_texts(values)
    # Then
    assert result == "BOTH"


def test_fss_rate_type_전세_옵션_코드가_C만이면_VARIABLE():
    # Given
    options = pd.DataFrame([{"lend_rate_type": "C"}, {"lend_rate_type": "C"}])
    # When
    result = fss_rate_type("RENT", {}, options)
    # Then
    assert result == "VARIABLE"


def test_fss_rate_type_개인신용은_칸이_없어_빈_값():
    # Given
    row = {"lend_rate_type": "고정금리"}
    # When
    result = fss_rate_type("CREDIT", row, None)
    # Then
    assert result is None


# ---------- 3단계: 비대면, 정책, 세대 조건 ----------

def test_kinfa_online_어플_신청은_Y():
    # Given
    value = "사업장 소재 강원신용보증재단 각 지점 방문 혹은 보증드림 어플로 신청"
    # When
    result = kinfa_online(value)
    # Then
    assert result == "Y"


def test_kinfa_online_홈페이지_상담_예약은_N():
    # Given
    value = "광주신용보증재단 홈페이지에서 보증상담 예약"
    # When
    result = kinfa_online(value)
    # Then
    assert result == "N"


def test_kinfa_online_지점_방문만이면_N():
    # Given
    value = "사업장 소재 서울신용보증재단 각 지점 방문"
    # When
    result = kinfa_online(value)
    # Then
    assert result == "N"


def test_kinfa_online_방법을_알_수_없으면_빈_값():
    # Given
    value = "기관 문의"
    # When
    result = kinfa_online(value)
    # Then
    assert result is None


def test_fss_online_스마트폰이_있으면_Y():
    # Given
    value = "영업점,스마트폰"
    # When
    result = fss_online(value)
    # Then
    assert result == "Y"


def test_fss_online_전화만이면_N():
    # Given
    value = "전화(텔레뱅킹)"
    # When
    result = fss_online(value)
    # Then
    assert result == "N"


def test_fss_policy_정책금융상품은_Y():
    # Given
    value = "정책금융상품"
    # When
    result = fss_policy(value)
    # Then
    assert result == "Y"


def test_merge_yn_하나라도_Y면_Y():
    # Given
    values = ["N", None, "Y"]
    # When
    result = merge_yn(values)
    # Then
    assert result == "Y"


def test_parse_extra_cond_세대_조건은_원문():
    # Given
    value = "1주택 이내"
    # When
    result = parse_extra_cond(value)
    # Then
    assert result == "1주택 이내"


def test_parse_extra_cond_무관은_빈_값():
    # Given
    value = "무관"
    # When
    result = parse_extra_cond(value)
    # Then
    assert result is None


def test_clean_fss_신협은_조합들_금리_방식을_합친다():
    # Given
    biz_base = [
        _base_row("0001", "100", "정락", "시설자금대출금", top_fin_grp_no="032000",
                  lend_rate_type="고정금리", join_way="영업점", fin_prdt_type_nm="일반대출상품"),
        _base_row("0002", "100", "중앙", "시설자금대출금", top_fin_grp_no="032000",
                  lend_rate_type="변동금리", join_way="영업점,스마트폰", fin_prdt_type_nm="일반대출상품"),
    ]
    # When
    product = clean_fss(_fss_tables(biz_base=biz_base))[0]
    # Then
    assert (product["rate_type"], product["online_yn"], product["policy_yn"]) == ("BOTH", "Y", "N")


# ---------- 4단계: 필터 칩 (4-1 지원 대상, 자금 용도) ----------

TAG_TYPES = ("TARGET", "PURPOSE", "AMOUNT", "REPAY", "SECTOR", "COMPANY", "REGION", "CREDIT")
CHIP_GROUPS = ("fss_loan_types", "rate_keys", "fss_option_codes")   # 아래 글이 전부 칩 이름인 칸


def _chips_in(value, key="", all_strings=False):
    """단어표 안의 칩 이름 ('chip', 'default'로 끝나는 칸 + CHIP_GROUPS 아래 글)"""
    if isinstance(value, dict):
        for k, v in value.items():
            yield from _chips_in(v, k, all_strings or k in CHIP_GROUPS)
    elif isinstance(value, list):
        for v in value:
            yield from _chips_in(v, key, all_strings)
    elif isinstance(value, str) and (all_strings or key.endswith(("chip", "chips", "default"))):
        yield value


def test_tag_words_단어표_칩은_모두_칩_목록_값():
    # Given
    used = {(t, chip) for t in TAG_TYPES for chip in _chips_in(WORDS[t])}
    allowed = {(t, chip) for t in TAG_TYPES for chip in WORDS[t]["chips"]}
    # When
    unknown = used - allowed
    # Then
    assert unknown == set()


def test_kinfa_target_단어가_여러_개면_칩_여러_개():
    # Given
    row = {"trgt": "근로자, 사업자, 청년", "finprdnm": "가대출"}
    # When
    chips, _, _ = kinfa_target(row)
    # Then
    assert chips == ["청년/학생", "직장인", "사업자"]


def test_kinfa_target_특별_지원_대상은_세부_값():
    # Given
    row = {"trgt": "채무조정자", "finprdnm": "가대출"}
    # When
    result = kinfa_target(row)
    # Then
    assert result == (["특별 지원 대상"], "채무조정", False)


def test_kinfa_target_기타는_다른_칩이_있으면_뺀다():
    # Given
    row = {"trgt": "금융취약계층, 기타", "finprdnm": "보금자리론"}
    # When
    chips, _, _ = kinfa_target(row)
    # Then
    assert chips == ["저신용/서민"]


def test_kinfa_target_기타만_있으면_기타_칩():
    # Given
    row = {"trgt": "기타", "finprdnm": "신혼희망타운전용 주택담보장기대출"}
    # When
    result = kinfa_target(row)
    # Then
    assert result == (["기타"], None, False)


def test_kinfa_target_대상을_알_수_없는_원문은_상품명으로():
    # Given
    row = {"trgt": "개인", "finprdnm": "성실상환자 대출(소액금융)"}
    # When
    result = kinfa_target(row)
    # Then
    assert result == (["특별 지원 대상"], "성실상환", False)


def test_kinfa_target_옮길_상품은_목록의_칩():
    # Given
    row = {"trgt": "근로자", "finprdnm": "직업훈련생계비 융자(직업훈련생계비)"}
    # When
    result = kinfa_target(row)
    # Then
    assert result == (["특별 지원 대상"], None, False)


def test_kinfa_target_옮길_상품_칩_여러_개와_세부_값():
    # Given
    row = {"trgt": "영세 개인사업자", "finprdnm": "햇살론119"}
    # When
    result = kinfa_target(row)
    # Then
    assert result == (["사업자", "특별 지원 대상"], "채무조정, 성실상환", False)


def test_kinfa_target_옮길_상품은_HTML_괄호_상품명도_찾음():
    # Given
    row = {"trgt": "서민계층", "finprdnm": "보증부 서민대출&#40;햇살론&#41; 협약보증"}
    # When
    chips, _, _ = kinfa_target(row)
    # Then
    assert chips == ["저신용/서민", "사업자"]


def test_kinfa_target_모르는_문구는_기타와_새_문구():
    # Given
    row = {"trgt": "우주비행사", "finprdnm": "가대출"}
    # When
    result = kinfa_target(row)
    # Then
    assert result == (["기타"], None, True)


def test_kinfa_purpose_주거는_상품명에_구입_단어가_있으면_주택_구입():
    # Given
    row = {"usge": "주거", "finprdnm": "디딤돌대출"}
    # When
    result = kinfa_purpose(row)
    # Then
    assert result == (["주택 구입"], False)


def test_kinfa_purpose_주거는_적격대출이면_주택_구입():
    # Given
    row = {"usge": "주거", "finprdnm": "기본형 적격대출"}
    # When
    chips, _ = kinfa_purpose(row)
    # Then
    assert chips == ["주택 구입"]


def test_kinfa_purpose_주거는_구입_단어가_없으면_전월세():
    # Given
    row = {"usge": "주거", "finprdnm": "전세자금보증_일반"}
    # When
    chips, _ = kinfa_purpose(row)
    # Then
    assert chips == ["전월세"]


def test_kinfa_purpose_기타는_다른_칩과_같이_붙는다():
    # Given
    row = {"usge": "생계, 기타", "finprdnm": "자영업자스피드대출금"}
    # When
    chips, _ = kinfa_purpose(row)
    # Then
    assert chips == ["생활비", "기타"]


def test_kinfa_purpose_용도가_비면_상품명으로():
    # Given
    row = {"usge": "-", "finprdnm": "햇살론15"}
    # When
    result = kinfa_purpose(row)
    # Then
    assert result == (["생활비"], False)


def test_kinfa_purpose_상품명에도_없으면_결측():
    # Given
    row = {"usge": "-", "finprdnm": "청년 미래이음 대출"}
    # When
    result = kinfa_purpose(row)
    # Then
    assert result == ([], False)


def test_kinfa_purpose_모르는_문구는_기타와_새_문구():
    # Given
    row = {"usge": "우주여행", "finprdnm": "가대출"}
    # When
    result = kinfa_purpose(row)
    # Then
    assert result == (["기타"], True)


def test_fss_target_사업자_가입_제한에_저신용자면_추가():
    # Given
    join_deny = "저신용자, 기타"
    # When
    chips = fss_target("BIZ", join_deny)
    # Then
    assert chips == ["저신용/서민", "사업자"]


def test_fss_target_전세는_제한_없음():
    # Given
    loan_type = "RENT"
    # When
    chips = fss_target(loan_type)
    # Then
    assert chips == ["제한 없음"]


def test_fss_purpose_개인신용은_생활비():
    # Given
    loan_type = "CREDIT"
    # When
    chips = fss_purpose(loan_type)
    # Then
    assert chips == ["생활비"]


def test_fss_purpose_사업자_대출_용도에_대환이면_추가():
    # Given
    use_way = "일반,대환"
    # When
    chips = fss_purpose("BIZ", use_way)
    # Then
    assert chips == ["대환", "사업 운영"]


def test_clean_kinfa_새_문구면_확인_필요():
    # Given
    rows = [{"seq": "1", "finprdnm": "가대출", "trgt": "우주비행사", "usge": "생계"}]
    # When
    product = clean_kinfa(rows, date(2026, 11, 12))[0]
    # Then
    assert product["check_reasons"] == ["NEW_PHRASE"]


def test_clean_fss_신협은_조합들_가입_제한을_합친다():
    # Given
    biz_base = [
        _base_row("0001", "100", "정락", "시설자금대출금", top_fin_grp_no="032000", join_deny="제한없음"),
        _base_row("0002", "100", "중앙", "시설자금대출금", top_fin_grp_no="032000", join_deny="저신용자"),
    ]
    # When
    product = clean_fss(_fss_tables(biz_base=biz_base))[0]
    # Then
    assert [t["tag_value"] for t in product["tags"] if t["tag_type"] == "TARGET"] == ["저신용/서민", "사업자"]


# ---------- 4단계: 필터 칩 (4-2 필요 금액, 상환 방법, 신용점수 구간) ----------

def test_amount_chips_한도_숫자는_그_금액_이상_누적():
    # Given
    limit_amount = 5000
    # When
    chips = amount_chips(limit_amount)
    # Then
    assert chips == ["1천만원 이상", "3천만원 이상", "5천만원 이상"]


def test_amount_chips_1천만원_안_되면_1천만원_미만():
    # Given
    limit_amount = 500
    # When
    chips = amount_chips(limit_amount)
    # Then
    assert chips == ["1천만원 미만"]


def test_amount_chips_사업자_구간이_1천만원_미만이면_그_칩():
    # Given
    limit_range = "1천만원 미만"
    # When
    chips = amount_chips(None, "해당없음", "보증대출", limit_range)
    # Then
    assert chips == ["1천만원 미만"]


def test_amount_chips_해당사항_없음_담보대출만이면_담보_보증_비율():
    # Given
    text, loan_kinds = "해당사항 없음", "담보대출"
    # When
    chips = amount_chips(None, text, loan_kinds)
    # Then
    assert chips == ["담보/보증 비율"]


def test_amount_chips_빈_글_신용대출이면_심사_후_결정():
    # Given
    text, loan_kinds = "", "담보대출, 신용대출"
    # When
    chips = amount_chips(None, text, loan_kinds)
    # Then
    assert chips == ["심사 후 결정"]


def test_amount_chips_별도_한도_없음은_한도_제한_없음():
    # Given
    text = "별도 한도 없음"
    # When
    chips = amount_chips(None, text, "담보대출")
    # Then
    assert chips == ["한도 제한 없음"]


def test_amount_chips_총_한도_없음은_한도_제한_없음이_아니다():
    # Given: 서민 학자금 한도 글 (한도 제한 없음은 금감원 사업자 문구만)
    text = "해당 학기 소요액 전액(학부생: 개인 총 한도 없음, 대학원생 개인 총한도 있음)"
    # When
    chips = amount_chips(None, text)
    # Then
    assert chips == ["매출/실비 기준"]


def test_amount_chips_발주금액은_매출_실비():
    # Given
    text = "발주금액의 80%, 결제정보등록 이후 대출가능액 상이"
    # When
    chips = amount_chips(None, text)
    # Then
    assert chips == ["매출/실비 기준"]


def test_amount_chips_매출과_담보가_같이_있으면_매출_실비_먼저():
    # Given
    text = "과거 1년 매출액 1/2 이내 (담보 감정가 80% 이내)"
    # When
    chips = amount_chips(None, text)
    # Then
    assert chips == ["매출/실비 기준"]


def test_amount_chips_LTV는_담보_보증_비율():
    # Given
    text = "LTV 70%"
    # When
    chips = amount_chips(None, text)
    # Then
    assert chips == ["담보/보증 비율"]


def test_amount_chips_못_정하면_결측():
    # Given
    text = "1"
    # When
    chips = amount_chips(None, text)
    # Then
    assert chips == []


def test_fss_amount_개인신용은_심사_후_결정():
    # Given
    loan_type = "CREDIT"
    # When
    chips = fss_amount(loan_type, None, None)
    # Then
    assert chips == ["심사 후 결정"]


def test_repay_chips_원리금_괄호는_두_칩():
    # Given
    text = "원(리)금균등분할상환"
    # When
    chips = repay_chips(text)
    # Then
    assert chips == ["원리금균등", "원금균등"]


def test_repay_chips_원금균등분할은_방식_미표기를_붙이지_않음():
    # Given
    text = "원금균등분할상환"
    # When
    chips = repay_chips(text)
    # Then
    assert chips == ["원금균등"]


def test_repay_chips_기한연장은_만기일시():
    # Given
    text = "1년마다 기한연장 또는 1년거치 4년 월단위 원금균등분할상환"
    # When
    chips = repay_chips(text)
    # Then
    assert chips == ["원금균등", "만기일시"]


def test_repay_chips_균등분할상환은_방식_미표기():
    # Given
    text = "일시상환, 균등분할상환"
    # When
    chips = repay_chips(text)
    # Then
    assert chips == ["만기일시", "분할상환(방식 미표기)"]


def test_repay_chips_임의상환은_다른_방식이_있으면_뺀다():
    # Given
    text = "만기일시상환, 임의상환"
    # When
    chips = repay_chips(text)
    # Then
    assert chips == ["만기일시"]


def test_repay_chips_임의상환만_있으면_기타():
    # Given
    text = "임의상환"
    # When
    chips = repay_chips(text)
    # Then
    assert chips == ["기타"]


def test_repay_chips_빈_값은_결측():
    # Given
    text = "-"
    # When
    chips = repay_chips(text)
    # Then
    assert chips == []


def test_fss_repay_전세_옵션_코드로():
    # Given
    options = pd.DataFrame([{"rpay_type": "D"}, {"rpay_type": "S"}])
    # When
    chips = fss_repay("RENT", None, options)
    # Then
    assert chips == ["만기일시", "분할상환(방식 미표기)"]


def test_credit_bands_하위_20퍼센트는_걸치는_구간_모두():
    # Given
    credit_min, credit_max = 0, 749
    # When
    chips = credit_bands(credit_min, credit_max)
    # Then
    assert chips == ["701~800", "601~700", "600 이하"]


def test_kinfa_credit_없음은_신용_무관():
    # Given
    row = {"crdtsc": "없음"}
    # When
    chips = kinfa_credit(row, None, None)
    # Then
    assert chips == ["신용 무관"]


def test_kinfa_credit_빈_칸_보증기관이_있으면_심사_후_결정():
    # Given
    row = {"crdtsc": "-", "grninst": "신용보증기금"}
    # When
    chips = kinfa_credit(row, None, None)
    # Then
    assert chips == ["심사 후 결정"]


def test_kinfa_credit_빈_칸_보증기관도_없으면_결측():
    # Given
    row = {"crdtsc": "-", "grninst": "-"}
    # When
    chips = kinfa_credit(row, None, None)
    # Then
    assert chips == []


def test_kinfa_credit_점수_없는_조건은_심사_후_결정():
    # Given
    row = {"crdtsc": "재단 내부신용평가 B 등급 이상인 기업"}
    # When
    chips = kinfa_credit(row, None, None)
    # Then
    assert chips == ["심사 후 결정"]


def test_fss_credit_공시_구간만_칩():
    # Given
    rates = [{"rate_kind": "CREDIT", "rate_key": "1", "rate_source": "DISCLOSED"},
             {"rate_kind": "CREDIT", "rate_key": "6", "rate_source": "ESTIMATED"},
             {"rate_kind": "CREDIT", "rate_key": "12", "rate_source": "DISCLOSED"}]
    # When
    chips = fss_credit("CREDIT", rates)
    # Then
    assert chips == ["900 초과", "600 이하"]


def test_fss_credit_개인신용_금리_행이_없으면_결측():
    # Given
    rates = []
    # When
    chips = fss_credit("CREDIT", rates)
    # Then
    assert chips == []


def test_fss_credit_전세는_심사_후_결정():
    # Given
    rates = []
    # When
    chips = fss_credit("RENT", rates)
    # Then
    assert chips == ["심사 후 결정"]


# ---------- 4단계: 필터 칩 (4-3 금융권, 취급기관, 지원 지역) ----------

def test_fss_group_chip_은행_권역_특수은행():
    # Given
    company = "중소기업은행"
    # When
    chips = fss_group_chip("SECTOR", "020000", company)
    # Then
    assert chips == ["특수은행"]


def test_fss_group_chip_아이엠뱅크는_시중은행():
    # Given
    company = "아이엠뱅크"
    # When
    chips = fss_group_chip("SECTOR", "020000", company)
    # Then
    assert chips == ["시중은행"]


def test_fss_group_chip_여신전문_카드는_카드사():
    # Given
    company = "신한카드"
    # When
    chips = fss_group_chip("SECTOR", "030200", company)
    # Then
    assert chips == ["카드사"]


def test_fss_group_chip_보험_생명이_없으면_손해보험():
    # Given
    company = "삼성화재해상보험"
    # When
    chips = fss_group_chip("SECTOR", "050000", company)
    # Then
    assert chips == ["손해보험"]


def test_fss_group_chip_취급기관은_이름_말고_권역_코드로():
    # Given
    company = "현대오일뱅크"
    # When
    chips = fss_group_chip("COMPANY", "032000", company)
    # Then
    assert chips == ["신협/새마을금고"]


def test_kinfa_sector_도_이름이_있으면_지자체():
    # Given
    company = "경상북도 김천시"
    # When
    chips = kinfa_sector(company)
    # Then
    assert chips == ["지자체"]


def test_kinfa_sector_서민금융진흥원은_서민금융기관():
    # Given
    company = "서민금융진흥원"
    # When
    chips = kinfa_sector(company)
    # Then
    assert chips == ["서민금융기관"]


def test_kinfa_sector_제공기관이_없으면_기타():
    # Given
    company = None
    # When
    chips = kinfa_sector(company)
    # Then
    assert chips == ["기타"]


def test_kinfa_company_여러_곳이면_칩_여러_개():
    # Given
    row = {"hdlinst": "한국주택금융공사, 취급은행"}
    # When
    chips = kinfa_company(row)
    # Then
    assert chips == ["은행", "공공기관"]


def test_kinfa_company_저축은행은_은행으로_다시_세지_않음():
    # Given
    row = {"hdlinst": "지역농협, 수협, 산림조합, 새마을금고, 신협, 저축은행"}
    # When
    chips = kinfa_company(row)
    # Then
    assert chips == ["저축은행", "신협/새마을금고"]


def test_kinfa_company_수협은행은_은행만():
    # Given
    row = {"hdlinst": "SH수협은행"}
    # When
    chips = kinfa_company(row)
    # Then
    assert chips == ["은행"]


def test_kinfa_company_지역수협은_신협_새마을금고():
    # Given
    row = {"hdlinst": "수협은행, 수협"}
    # When
    chips = kinfa_company(row)
    # Then
    assert chips == ["은행", "신협/새마을금고"]


def test_kinfa_company_금감원_은행_이름과_같으면_은행():
    # Given
    row = {"hdlinst": "아이엠뱅크"}
    # When
    chips = kinfa_company(row, {"아이엠뱅크"})
    # Then
    assert chips == ["은행"]


def test_kinfa_company_표기가_다르면_별칭으로_대조():
    # Given
    row = {"hdlinst": "iM뱅크"}
    # When
    chips = kinfa_company(row, {"아이엠뱅크"})
    # Then
    assert chips == ["은행"]


def test_kinfa_company_금감원_은행에_없는_뱅크는_기타():
    # Given
    row = {"hdlinst": "푸드뱅크"}
    # When
    chips = kinfa_company(row, {"아이엠뱅크"})
    # Then
    assert chips == ["기타"]


def test_kinfa_company_금감원_이름이_없으면_대조_못_해_기타():
    # Given
    row = {"hdlinst": "아이엠뱅크"}
    # When
    chips = kinfa_company(row, set())
    # Then
    assert chips == ["기타"]


def test_kinfa_company_어디인지_없는_글은_결측():
    # Given
    row = {"hdlinst": "취급기관(10개)"}
    # When
    chips = kinfa_company(row)
    # Then
    assert chips == []


def test_fss_bank_names_은행_권역_회사명만():
    # Given
    tables = _fss_tables(credit_base=[
        _base_row("0010001", "P01", "가은행", "직장인대출", top_fin_grp_no="020000"),
        _base_row("0010002", "P02", "나저축은행", "비상금대출", top_fin_grp_no="030300"),
    ])
    # When
    names = fss_bank_names(tables)
    # Then
    assert names == {"가은행"}


def test_kinfa_region_시도가_여러_개면_칩_여러_개():
    # Given
    row = {"rsdAreaPamtEqltIstm": "경남, 울산"}
    # When
    chips = kinfa_region(row, "")
    # Then
    assert chips == ["울산", "경남"]


def test_kinfa_region_전국이_있으면_전국만():
    # Given
    row = {"rsdAreaPamtEqltIstm": "전국(농어촌)"}
    # When
    chips = kinfa_region(row, "")
    # Then
    assert chips == ["전국"]


def test_kinfa_region_칸이_비면_상품명_시도():
    # Given
    row = {"rsdAreaPamtEqltIstm": "-", "finprdnm": "경기도 중소기업 육성자금"}
    # When
    chips = kinfa_region(row, "경기신용보증재단")
    # Then
    assert chips == ["경기"]


def test_kinfa_region_은행_이름의_시도는_빼고_본다():
    # Given
    row = {"rsdAreaPamtEqltIstm": "-", "finprdnm": "경남은행 특별출연 협약보증"}
    # When
    chips = kinfa_region(row, "울산신용보증재단")
    # Then
    assert chips == ["울산"]


def test_kinfa_region_시도_이름이_없으면_결측():
    # Given
    row = {"rsdAreaPamtEqltIstm": "-", "finprdnm": "햇살론일반"}
    # When
    chips = kinfa_region(row, "서민금융진흥원")
    # Then
    assert chips == []


def test_clean_fss_신협_API_빈_칸_None도_합칠_수_있다():
    # Given
    biz_base = [
        _base_row("0001", "100", "정락", "시설자금대출금", top_fin_grp_no="032000", join_deny=None),
        _base_row("0002", "100", "중앙", "시설자금대출금", top_fin_grp_no="032000", join_deny="저신용자"),
    ]
    # When
    product = clean_fss(_fss_tables(biz_base=biz_base))[0]
    # Then
    assert [t["tag_value"] for t in product["tags"] if t["tag_type"] == "TARGET"] == ["저신용/서민", "사업자"]


def test_clean_fss_금감원은_지원_지역_전국():
    # Given
    base = [_base_row("0010001", "P01", "가은행", "직장인대출", crdt_prdt_type="1")]
    # When
    product = clean_fss(_fss_tables(credit_base=base))[0]
    # Then
    assert [t["tag_value"] for t in product["tags"] if t["tag_type"] == "REGION"] == ["전국"]


# ---------- 5단계: 검증 ----------

def _product(product_name="가대출", company_name="가은행", rate_min=3.0, rate_max=5.0):
    """check_product 입력: 검증에 쓰는 칸만"""
    return {"product_name": product_name, "company_name": company_name,
            "rate_min": rate_min, "rate_max": rate_max}


def test_check_product_정상이면_사유_없음():
    # Given
    product = _product(rate_max=20.0)
    # When
    reasons = check_product(product)
    # Then
    assert reasons == []


def test_check_product_상품명이_없으면_NO_NAME():
    # Given
    product = _product(product_name=None)
    # When
    reasons = check_product(product)
    # Then
    assert reasons == ["NO_NAME"]


def test_check_product_기관이_없으면_NO_NAME():
    # Given
    product = _product(company_name=None)
    # When
    reasons = check_product(product)
    # Then
    assert reasons == ["NO_NAME"]


def test_check_product_최저가_최고보다_크면_RATE_REVERSED():
    # Given
    product = _product(rate_min=4.96, rate_max=3.72)
    # When
    reasons = check_product(product)
    # Then
    assert reasons == ["RATE_REVERSED"]


def test_check_product_최고_20퍼센트_초과면_RATE_OVER_20():
    # Given
    product = _product(rate_max=21.74)
    # When
    reasons = check_product(product)
    # Then
    assert reasons == ["RATE_OVER_20"]


def test_check_product_금리가_비면_금리_검사_안_함():
    # Given
    product = _product(rate_min=None, rate_max=None)
    # When
    reasons = check_product(product)
    # Then
    assert reasons == []


def test_clean_products_사유가_여러_개면_모두_붙인다():
    # Given
    tables = {"kinfa_loan_products": [{"seq": "1", "finprdnm": "가대출", "ofrinstnm": "", "irt": "5~3",
                                       "trgt": "근로자", "usge": "생계"}]}
    # When
    product = clean_products(tables, ["KINFA"], date(2026, 11, 12), date(2026, 11, 12))[0]
    # Then
    assert product["check_reasons"] == ["NO_NAME", "RATE_REVERSED"]


def test_clean_products_수집한_출처만_정제한다():
    # Given
    tables = _fss_tables(credit_base=[_base_row("0010001", "P01", "가은행", "직장인대출", crdt_prdt_type="1")])
    # When
    products = clean_products(tables, ["FSS"], date(2026, 11, 12), date(2026, 11, 12))
    # Then
    assert {p["source"] for p in products} == {"FSS"}
