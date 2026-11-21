"""불러오기 비교 (imports.py) 테스트: DB 없이 되는 함수만 (compare, changed_fields, match_products, item_row)"""
import json
from datetime import date, datetime
from decimal import Decimal

from app.imports import (SourceUnavailable, build_check, changed_fields, check_latest, compare, db_bank_names, item_row,
                         kinfa_diff, match_products, norm, read_check_state, read_job, read_latest_job, source_results,
                         split_list)
from app.load import PRODUCT_COLS

RAW_FSS = json.dumps({"base": {"dcls_month": "202611", "fin_co_subm_day": "202611101200", "top_fin_grp_no": "020000"},
                      "options": []})


def _product(**changes):
    """정제 상품 1개 (금감원 신용대출). 바꿀 칸만 넘김"""
    product = {c: None for c in PRODUCT_COLS}
    product.update({
        "source": "FSS", "source_code": "0010001_P1_1", "loan_type": "CREDIT",
        "company_name": "가은행", "product_name": "가대출", "rate_min": 3.5, "rate_max": 7.25,
        "limit_amount": 5000, "term_max": 60, "raw_json": RAW_FSS, "base_date": date(2026, 11, 10),
        "tags": [{"tag_type": "TARGET", "tag_value": "직장인"}],
        "rates": [{"rate_kind": "CREDIT", "rate_key": "1", "rate_min": 3.5, "rate_max": 3.5, "rate_source": "DISCLOSED"}],
        "check_reasons": [],
    })
    product.update(changes)
    return product


def _existing(product_id=1, status="ON", **changes):
    """지금 상품 1개 (DB에서 읽은 모양: Decimal, datetime). 바꿀 칸(changes)은 DB 모양으로 바꾼 뒤 덮어씀"""
    current = _product()
    current.update({"product_id": product_id, "product_status": status,
                    "rate_min": Decimal("3.50"), "rate_max": Decimal("7.25"),
                    "base_date": datetime(2026, 11, 10, 0, 0)})
    current["rates"] = [{**r, "rate_min": Decimal("3.5"), "rate_max": Decimal("3.5")} for r in current["rates"]]
    del current["check_reasons"]
    current.update(changes)
    return current


def _kinfa(**changes):
    """정제 상품 1개 (서민). 바꿀 칸만 넘김"""
    defaults = {"source": "KINFA", "loan_type": "KINFA", "source_code": "101", "company_name": "가재단",
                "product_name": "햇살", "raw_json": json.dumps({"seq": "101"}), "rates": []}
    return _product(**{**defaults, **changes})


# ---------- norm, changed_fields ----------

def test_norm_DB_Decimal과_정제_float이_같은_값이면_같다():
    # Given
    db_value, cleaned_value = Decimal("3.50"), 3.5
    # When
    same = norm(db_value) == norm(cleaned_value)
    # Then
    assert same


def test_norm_DB_datetime과_정제_date가_같은_날이면_같다():
    # Given
    db_value, cleaned_value = datetime(2026, 11, 10, 0, 0), date(2026, 11, 10)
    # When
    same = norm(db_value) == norm(cleaned_value)
    # Then
    assert same


def test_changed_fields_같은_내용이면_빈_목록():
    # Given
    current, new = _existing(), _product()
    # When
    fields = changed_fields(current, new)
    # Then
    assert fields == []


def test_changed_fields_base_date만_다르면_변경_아님():
    # Given
    current, new = _existing(), _product(base_date=date(2026, 11, 19))
    # When
    fields = changed_fields(current, new)
    # Then
    assert fields == []


def test_changed_fields_raw_json_제출일만_다르면_변경_아님():
    # Given
    raw = json.dumps({"base": {"dcls_month": "202611", "fin_co_subm_day": "202611191200"}, "options": []})
    current, new = _existing(), _product(raw_json=raw)
    # When
    fields = changed_fields(current, new)
    # Then
    assert fields == []


def test_changed_fields_공시월이_바뀌면_dcls_month():
    # Given
    raw = json.dumps({"base": {"dcls_month": "202612"}, "options": []})
    current, new = _existing(), _product(raw_json=raw)
    # When
    fields = changed_fields(current, new)
    # Then
    assert fields == ["dcls_month"]


def test_changed_fields_금리와_한도가_바뀌면_그_칸_이름():
    # Given
    current, new = _existing(), _product(rate_min=3.0, limit_amount=3000)
    # When
    fields = changed_fields(current, new)
    # Then
    assert fields == ["rate_min", "limit_amount"]


def test_changed_fields_칩이_바뀌면_tags():
    # Given
    current = _existing()
    new = _product(tags=[{"tag_type": "TARGET", "tag_value": "청년/학생"}])
    # When
    fields = changed_fields(current, new)
    # Then
    assert fields == ["tags"]


def test_changed_fields_구간_금리가_바뀌면_rates():
    # Given
    current = _existing()
    new = _product(rates=[{"rate_kind": "CREDIT", "rate_key": "1", "rate_min": 3.9, "rate_max": 3.9,
                           "rate_source": "DISCLOSED"}])
    # When
    fields = changed_fields(current, new)
    # Then
    assert fields == ["rates"]


def test_changed_fields_서민은_공시월을_보지_않는다():
    # Given
    current = _existing(**{k: v for k, v in _kinfa().items() if k != "check_reasons"})
    new = _kinfa(raw_json=json.dumps({"seq": "101", "x": "y"}))
    # When
    fields = changed_fields(current, new)
    # Then
    assert fields == []


# ---------- match_products ----------

def test_match_products_열쇠가_같으면_맞춤():
    # Given
    existing, cleaned = [_existing()], [_product()]
    # When
    pairs, matched = match_products(existing, cleaned)
    # Then
    assert pairs[0][1]["product_id"] == 1 and matched == {1}


def test_match_products_서민_seq가_바뀌면_상품명과_기관으로_맞춤():
    # Given
    existing = [_existing(**{k: v for k, v in _kinfa().items() if k != "check_reasons"})]
    cleaned = [_kinfa(source_code="999")]
    # When
    pairs, matched = match_products(existing, cleaned)
    # Then
    assert pairs[0][1]["product_id"] == 1 and matched == {1}


def test_match_products_금감원은_이름이_같아도_열쇠가_다르면_맞추지_않는다():
    # Given
    existing, cleaned = [_existing()], [_product(source_code="0010001_P2_1")]
    # When
    pairs, matched = match_products(existing, cleaned)
    # Then
    assert pairs[0][1] is None and matched == set()


# ---------- compare ----------

def test_compare_같은_내용이면_항목_없음():
    # Given
    existing, cleaned = [_existing()], [_product()]
    # When
    items = compare(existing, cleaned, ["FSS"])
    # Then
    assert items == []


def test_compare_지금_없는_상품은_NEW_product_id_없음():
    # Given
    cleaned = [_product()]
    # When
    items = compare([], cleaned, ["FSS"])
    # Then
    assert [(i["diff_type"], i["product_id"]) for i in items] == [("NEW", None)]


def test_compare_값이_바뀌면_CHANGE_바뀐_칸():
    # Given
    existing, cleaned = [_existing()], [_product(rate_max=8.0)]
    # When
    items = compare(existing, cleaned, ["FSS"])
    # Then
    assert (items[0]["diff_type"], items[0]["changed_fields"], items[0]["product_id"]) == ("CHANGE", ["rate_max"], 1)


def test_compare_출처에서_빠진_게시_상품은_REMOVE():
    # Given
    existing = [_existing()]
    # When
    items = compare(existing, [], ["FSS"])
    # Then
    assert (items[0]["diff_type"], items[0]["product_id"], items[0]["after_data"]) == ("REMOVE", 1, None)


def test_compare_실패한_출처의_상품은_REMOVE가_아니다():
    # Given
    existing = [_existing()]    # FSS 상품, 이번 수집은 KINFA만 성공
    # When
    items = compare(existing, [], ["KINFA"])
    # Then
    assert items == []


def test_compare_이미_판매_종료인_상품이_빠져도_REMOVE가_아니다():
    # Given
    existing = [_existing(status="CLOSED")]
    # When
    items = compare(existing, [], ["FSS"])
    # Then
    assert items == []


def test_compare_판매_종료_상품이_다시_오면_REOPEN():
    # Given
    existing, cleaned = [_existing(status="CLOSED")], [_product()]
    # When
    items = compare(existing, cleaned, ["FSS"])
    # Then
    assert (items[0]["diff_type"], items[0]["product_id"]) == ("REOPEN", 1)


def test_compare_숨긴_상품이_바뀌면_CHANGE_hidden_yn_Y():
    # Given
    existing, cleaned = [_existing(status="HIDDEN")], [_product(rate_max=8.0)]
    # When
    items = compare(existing, cleaned, ["FSS"])
    # Then
    assert (items[0]["diff_type"], items[0]["hidden_yn"]) == ("CHANGE", "Y")


def test_compare_확인_필요는_지금_상품이_있어도_CHECK_사유_포함():
    # Given
    existing, cleaned = [_existing()], [_product(rate_max=25.0, check_reasons=["RATE_OVER_20"])]
    # When
    items = compare(existing, cleaned, ["FSS"])
    # Then
    assert (items[0]["diff_type"], items[0]["product_id"], items[0]["check_reasons"]) == ("CHECK", 1, ["RATE_OVER_20"])


def test_compare_확인_필요_상품명_없음은_product_name_None():
    # Given
    cleaned = [_product(product_name=None, check_reasons=["NO_NAME"])]
    # When
    items = compare([], cleaned, ["FSS"])
    # Then
    assert (items[0]["diff_type"], items[0]["product_name"]) == ("CHECK", None)


def test_compare_after_data는_상품_칸과_칩_구간_금리():
    # Given
    cleaned = [_product()]
    # When
    item = compare([], cleaned, ["FSS"])[0]
    # Then
    assert set(item["after_data"]) == set(PRODUCT_COLS) | {"tags", "rates"}


# ---------- item_row, split_list, source_results ----------

def test_item_row_목록은_쉼표로_날짜는_응답_규칙과_같은_yyyy_MM_dd_HH_mm():
    # Given
    item = compare([_existing()], [_product(rate_max=8.0, limit_amount=1)], ["FSS"])[0]
    # When
    row = item_row(7, item)
    # Then
    assert (row["job_id"], row["changed_fields"], row["check_reasons"],
            json.loads(row["after_data"])["base_date"]) == (7, "rate_max,limit_amount", None, "2026-11-10 00:00")


def test_split_list_NULL은_빈_목록():
    # Given
    value = None
    # When
    result = split_list(value)
    # Then
    assert result == []


def test_source_results_실패한_출처는_count_0과_사유():
    # Given
    products = [_product(), _kinfa()]
    # When
    results = source_results(["KINFA", "FSS"], ["FSS"], {"KINFA": "ConnectTimeout"}, [products[0]])
    # Then
    assert results == [{"source": "KINFA", "success": False, "count": 0, "error": "ConnectTimeout"},
                       {"source": "FSS", "success": True, "count": 1, "error": None}]


# ---------- db_bank_names ----------

def test_db_bank_names_금감원_은행_권역_회사명만_서민은_뺀다():
    # Given
    savings = json.dumps({"base": {"top_fin_grp_no": "030300"}, "options": []})
    existing = [_existing(product_id=1, company_name="가은행"),
                _existing(product_id=2, company_name="나저축은행", raw_json=savings),
                _existing(**{**{k: v for k, v in _kinfa().items() if k != "check_reasons"}, "product_id": 3})]
    # When
    names = db_bank_names(existing)
    # Then
    assert names == {"가은행"}


# ---------- read_job (가짜 conn) ----------

class _Row:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class _FakeConn:
    """호출 순서대로 정해진 행을 돌려줌 (read_job: SELECT_JOB, SELECT_ITEMS / read_latest_job: 그 앞에 LATEST_JOB_ID)"""

    def __init__(self, *results):
        self.results = list(results)
        self.params = []        # 호출마다 받은 값 (어느 작업 번호로 읽었는지 확인용)

    def execute(self, sql, params=None):
        self.params.append(params)
        result = self.results.pop(0)
        return _FakeResult(result)


class _FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def first(self):
        return self.rows

    def scalar(self):
        return self.rows

    def __iter__(self):
        return iter(self.rows)


def test_read_job_DONE_뒤_24시간_지났으면_EXPIRED로_보여_준다():
    # Given
    job = _Row(job_id=3, job_status="DONE", base_version=1, source_result='[{"source":"FSS"}]', expired=1, created_at=None, finished_at=None)
    conn = _FakeConn(job, [])
    # When
    result = read_job(conn, 3)
    # Then
    assert (result["job_status"], result["source_results"]) == ("EXPIRED", [{"source": "FSS"}])


def test_read_job_항목의_쉼표_칸은_목록으로():
    # Given
    job = _Row(job_id=3, job_status="DONE", base_version=1, source_result=None, expired=0, created_at=None, finished_at=None)
    item = _Row(item_id=1, diff_type="CHANGE", product_id=5, product_name="가대출", company_name="가은행",
                source="FSS", changed_fields="rate_max,tags", check_reasons=None, hidden_yn="N")
    conn = _FakeConn(job, [item])
    # When
    result = read_job(conn, 3)
    # Then
    assert (result["items"][0]["changed_fields"], result["items"][0]["check_reasons"]) == (["rate_max", "tags"], [])


def test_read_latest_job_작업이_하나도_없으면_None():
    # Given
    conn = _FakeConn(None)
    # When
    result = read_latest_job(conn)
    # Then
    assert result is None


def test_read_latest_job_가장_최근_작업_번호로_읽는다():
    # Given: 가장 최근 작업 7
    job = _Row(job_id=7, job_status="RUNNING", base_version=1, source_result=None, expired=0, created_at=None, finished_at=None)
    conn = _FakeConn(7, job, [])
    # When
    read_latest_job(conn)
    # Then
    assert conn.params[1]["job_id"] == 7


# ---------- 최신 확인 (kinfa_diff, build_check, read_check_state, check_latest) ----------

def _state(**changes):
    """read_check_state 결과 모양. 바꿀 칸만 넘김"""
    state = {"loaded_at": {"KINFA": datetime(2026, 11, 20, 9, 0), "FSS": datetime(2026, 11, 20, 9, 0)},
             "kinfa_rows": [("101", "ON"), ("102", "HIDDEN")], "db_month": "202611", "pending_job": None}
    state.update(changes)
    return state


def test_kinfa_diff_출처와_DB가_같으면_새로_온_수와_빠진_수가_0():
    # Given
    seqs, rows = ["101", "102"], [("101", "ON"), ("102", "ON")]
    # When
    result = kinfa_diff(seqs, rows)
    # Then
    assert result == (2, 0, 0)


def test_kinfa_diff_판매_종료_상품은_DB_수와_빠진_수에_넣지_않는다():
    # Given: 103은 CLOSED라 출처에 없어도 빠진 것이 아님, 104는 출처에 새로 옴
    seqs, rows = ["101", "104"], [("101", "ON"), ("102", "ON"), ("103", "CLOSED")]
    # When
    result = kinfa_diff(seqs, rows)
    # Then
    assert result == (2, 1, 1)


def test_build_check_모두_최신이면_needs_refresh_False():
    # Given
    peeked = {"KINFA": ["101", "102"], "FSS": "202611"}
    # When
    result = build_check(_state(), peeked, {}, datetime(2026, 11, 21, 14, 0))
    # Then
    assert (result["needs_refresh"], [s["is_latest"] for s in result["sources"]]) == (False, [True, True])


def test_build_check_금감원_공시월이_다르면_그_출처만_최신_아님():
    # Given
    peeked = {"KINFA": ["101", "102"], "FSS": "202612"}
    # When
    result = build_check(_state(), peeked, {}, datetime(2026, 11, 21, 14, 0))
    # Then
    fss = result["sources"][1]
    assert (result["needs_refresh"], fss["is_latest"], fss["db_mark"], fss["source_mark"]) == \
        (True, False, "202611", "202612")


def test_build_check_서민_기준값은_상품_수와_새로_온_수_빠진_수():
    # Given: 102 빠짐, 105 새로 옴
    peeked = {"KINFA": ["101", "105"], "FSS": "202611"}
    # When
    kinfa = build_check(_state(), peeked, {}, datetime(2026, 11, 21, 14, 0))["sources"][0]
    # Then
    assert (kinfa["db_mark"], kinfa["source_mark"], kinfa["new_count"], kinfa["missing_count"], kinfa["is_latest"]) == \
        ("2", "2", 1, 1, False)


def test_build_check_실패한_출처는_error만_채우고_최신_판단에_넣지_않는다():
    # Given: 서민 실패, 금감원 최신
    peeked, errors = {"FSS": "202611"}, {"KINFA": "ConnectTimeout"}
    # When
    result = build_check(_state(), peeked, errors, datetime(2026, 11, 21, 14, 0))
    # Then
    kinfa = result["sources"][0]
    assert (kinfa["error"], kinfa["is_latest"], kinfa["source_mark"], result["needs_refresh"]) == \
        ("ConnectTimeout", None, None, False)


def test_build_check_반영_전_작업과_적재_시각을_그대로_담는다():
    # Given
    pending = {"job_id": 7, "finished_at": datetime(2026, 11, 21, 13, 0), "item_count": 12}
    state = _state(pending_job=pending)
    # When
    result = build_check(state, {"KINFA": [], "FSS": None}, {}, datetime(2026, 11, 21, 14, 0))
    # Then
    assert (result["pending_job"], result["sources"][0]["loaded_at"]) == (pending, datetime(2026, 11, 20, 9, 0))


def test_read_check_state_갱신한_적_없는_출처는_첫_적재_시각을_쓴다():
    # Given: INIT 11-10, KINFA 갱신 11-20, FSS 갱신 없음, 서민 행 1개, 공시월 202611, 반영 전 작업 없음
    init_at, kinfa_at = datetime(2026, 11, 10, 9, 0), datetime(2026, 11, 20, 9, 0)
    conn = _FakeConn(init_at, kinfa_at, None, [_Row(source_code="101", product_status="ON")], "202611", None)
    # When
    state = read_check_state(conn)
    # Then
    assert (state["loaded_at"], state["kinfa_rows"], state["db_month"], state["pending_job"]) == \
        ({"KINFA": kinfa_at, "FSS": init_at}, [("101", "ON")], "202611", None)


def test_read_check_state_반영_전_작업이_있으면_항목_수까지_읽는다():
    # Given: 작업 7 DONE, 항목 12개
    finished = datetime(2026, 11, 21, 13, 0)
    conn = _FakeConn(None, None, None, [], None, _Row(job_id=7, finished_at=finished), 12)
    # When
    state = read_check_state(conn)
    # Then
    assert state["pending_job"] == {"job_id": 7, "finished_at": finished, "item_count": 12}


def _fail(session):
    raise RuntimeError("응답 코드 99")


def test_check_latest_출처_모두_실패면_SourceUnavailable():
    # Given
    peekers = {"KINFA": _fail, "FSS": _fail}
    # When, Then
    try:
        check_latest(None, peekers)
        raised = False
    except SourceUnavailable:
        raised = True
    assert raised


def test_read_job_시작_시각과_끝난_시각을_담는다():
    # Given
    created, finished = datetime(2026, 11, 21, 13, 0), datetime(2026, 11, 21, 13, 2)
    job = _Row(job_id=3, job_status="DONE", base_version=1, source_result=None, expired=0,
               created_at=created, finished_at=finished)
    conn = _FakeConn(job, [])
    # When
    result = read_job(conn, 3)
    # Then
    assert (result["created_at"], result["finished_at"]) == (created, finished)
