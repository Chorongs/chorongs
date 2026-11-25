"""도움말 적재 (help_load.py) 테스트: DB 없이 되는 함수만 (CSV 검사, 값 변환, 추가/덮어쓰기/삭제 계획)"""
from app.help_load import COLUMNS, check_all, check_rows, plan_changes, to_params, value_counts


def _row(help_type="TIP", help_no="1", **changes):
    """검사를 통과하는 CSV 1행 (TIP 기준: 키워드, 요약까지 채움)"""
    row = {c: "" for c in COLUMNS}
    row.update({"HELP_TYPE": help_type, "HELP_NO": help_no, "CATEGORY": "금리", "KEYWORD1": "금리",
                "TITLE": "제목", "SUMMARY": "한 줄 설명", "CONTENT": "내용"})
    row.update(changes)
    return row


# ---------- check_rows ----------

def test_check_rows_양식대로면_통과():
    # Given
    rows = [_row(help_no="1"), _row(help_no="2", KEYWORD2="상환")]
    # When
    errors = check_rows("TIP", rows)
    # Then
    assert errors == []


def test_check_rows_행이_0개면_멈춤():
    # Given
    rows = []
    # When
    errors = check_rows("FAQ", rows)
    # Then
    assert len(errors) == 1 and "0개" in errors[0]


def test_check_rows_칸_이름이_빠지면_멈춤():
    # Given
    row = _row()
    del row["SUMMARY"]
    # When
    errors = check_rows("TIP", [row])
    # Then
    assert errors == ["TIP: 칸 이름이 없음 ['SUMMARY']"]


def test_check_rows_HELP_TYPE이_파일_종류와_다르면_걸림():
    # Given
    rows = [_row(help_type="FAQ")]
    # When
    errors = check_rows("TIP", rows)
    # Then
    assert len(errors) == 1 and "HELP_TYPE" in errors[0]


def test_check_rows_번호가_숫자가_아니거나_0이면_걸림():
    # Given
    rows = [_row(help_no="1a"), _row(help_no="0"), _row(help_no="")]
    # When
    errors = check_rows("TIP", rows)
    # Then
    assert len(errors) == 3 and all("숫자가 아님" in e for e in errors)


def test_check_rows_같은_종류_안_번호_중복이면_두_행_모두_걸림():
    # Given
    rows = [_row(help_no="3"), _row(help_no="3")]
    # When
    errors = check_rows("TIP", rows)
    # Then
    assert len(errors) == 2 and all("중복" in e for e in errors)


def test_check_rows_필수_칸이_공백뿐이면_걸림():
    # Given
    rows = [_row(help_type="TERM", CATEGORY="  ", KEYWORD1="고정금리", SUMMARY="")]
    # When
    errors = check_rows("TERM", rows)
    # Then
    assert len(errors) == 1 and "CATEGORY 빔" in errors[0]


def test_check_rows_FAQ는_분류_키워드_요약이_비어도_통과():
    # Given
    rows = [_row(help_type="FAQ", CATEGORY="", KEYWORD1="", SUMMARY="")]
    # When
    errors = check_rows("FAQ", rows)
    # Then
    assert errors == []


def test_check_rows_길이를_넘으면_걸림():
    # Given
    rows = [_row(TITLE="가" * 201, CATEGORY="가" * 31)]
    # When
    errors = check_rows("TIP", rows)
    # Then
    assert len(errors) == 2 and any("TITLE 201자" in e for e in errors) and any("CATEGORY 31자" in e for e in errors)


def test_check_rows_키워드_중간_빈칸이면_걸림():
    # Given
    rows = [_row(KEYWORD1="금리", KEYWORD2="", KEYWORD3="상환")]
    # When
    errors = check_rows("TIP", rows)
    # Then
    assert len(errors) == 1 and "빈칸" in errors[0]


def test_check_rows_TIP_키워드가_6개_밖이면_걸림():
    # Given
    rows = [_row(KEYWORD1="금리", KEYWORD2="대출")]
    # When
    errors = check_rows("TIP", rows)
    # Then
    assert len(errors) == 1 and "['대출']" in errors[0]


def test_check_rows_줄_번호는_CSV_줄_기준으로_2부터():
    # Given
    rows = [_row(help_no="1"), _row(help_no="2", TITLE="")]
    # When
    errors = check_rows("TIP", rows)
    # Then
    assert errors == ["TIP 3줄 (번호 2): TITLE 빔"]


def test_check_all_세_종류의_걸린_내용을_모두_모음():
    # Given
    rows_by_type = {"FAQ": [], "TERM": [], "TIP": [_row()]}
    # When
    errors = check_all(rows_by_type)
    # Then
    assert len(errors) == 2


# ---------- to_params, value_counts ----------

def test_to_params_빈_칸은_None_번호는_숫자_글은_그대로():
    # Given
    row = _row(help_type="FAQ", help_no="12", KEYWORD1="", SUMMARY="", CONTENT="A&B 'C'\n두 번째 줄")
    # When
    params = to_params("FAQ", row)
    # Then
    assert (params["help_no"] == 12 and params["keyword1"] is None and params["summary"] is None
            and params["content"] == "A&B 'C'\n두 번째 줄")


def test_value_counts_빈_값은_빼고_많은_순():
    # Given
    rows = [_row(KEYWORD1="금리", KEYWORD2="상환"), _row(KEYWORD1="상환")]
    # When
    counts = value_counts(rows, ["KEYWORD1", "KEYWORD2"])
    # Then
    assert counts == {"상환": 2, "금리": 1}


# ---------- plan_changes ----------

def test_plan_changes_새_번호는_추가_있던_번호는_덮어쓰기_CSV에_없는_번호는_삭제():
    # Given
    existing = {("TIP", 1): 101, ("TIP", 2): 102, ("FAQ", 1): 201}
    rows_by_type = {"TIP": [_row(help_no="1"), _row(help_no="3")]}
    # When
    plan = plan_changes(existing, rows_by_type)
    # Then
    assert plan == {"TIP": {"추가": 1, "덮어쓰기": 1, "삭제": [("TIP", 2)]}}
