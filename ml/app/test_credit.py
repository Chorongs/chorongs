import pandas as pd

from app.credit import OPTIONS, SOURCE_COLUMNS, to_answers, to_finance


def _rows(*changes):
    """학원 데이터 행 (to_answers가 읽는 칸 전부 0) + 행마다 바꿀 값"""
    return pd.DataFrame([{**{c: 0 for c in SOURCE_COLUMNS}, **change} for change in changes])


def test_to_answers_보기_순서는_OPTIONS와_같다():
    # Given
    df = _rows({})
    # When
    answers = to_answers(df)
    # Then
    assert {q: list(answers[q].cat.categories) for q in answers} == OPTIONS


def test_to_answers_최장_연체_9일은_10일_미만_10일은_10_29일():
    # Given
    df = _rows({"KC5000016": 9}, {"KC5000016": 10})
    # When
    result = list(to_answers(df)["Q2"])
    # Then
    assert result == ["10일 미만", "10~29일"]


def test_to_answers_채무조정_칸_하나라도_1이면_있음():
    # Given
    df = _rows({"B32000100": 1})
    # When
    result = to_answers(df)["Q3"][0]
    # Then
    assert result == "있음"


def test_to_answers_대출_잔액은_천원_단위로_나눈다():
    # Given
    df = _rows({"L00000002": 9999}, {"L00000002": 10000}, {"L00000002": 100000})
    # When
    result = list(to_answers(df)["Q6"])
    # Then
    assert result == ["1천 미만", "1천~3천", "1억 이상"]


def test_to_answers_대출_잔액_0은_없음():
    # Given
    df = _rows({"L00000002": 0})
    # When
    result = to_answers(df)["Q6"][0]
    # Then
    assert result == "없음"


def test_to_answers_카드_발급_기간이_0이면_사용_비율과_상관없이_카드_없음():
    # Given
    df = _rows({"C00000090": 0, "CL0631905": 95})
    # When
    result = to_answers(df)["Q7"][0]
    # Then
    assert result == "카드 없음"


def test_to_answers_카드_사용_비율_90은_90_이상():
    # Given
    df = _rows({"C00000090": 1000, "CL0631905": 90})
    # When
    result = to_answers(df)["Q7"][0]
    # Then
    assert result == "90 이상"


def test_to_answers_최근_카드_발급_180일은_새_카드_1건_181일은_0건():
    # Given
    df = _rows({"C00000093": 180}, {"C00000093": 181})
    # When
    result = list(to_answers(df)["Q9"])
    # Then
    assert result == ["1~2개", "0개"]


def test_to_answers_최근_카드_발급_0은_카드_없음이라_0건():
    # Given
    df = _rows({"C00000093": 0})
    # When
    result = to_answers(df)["Q9"][0]
    # Then
    assert result == "0개"


def test_to_answers_새_대출_2건과_새_카드_1건이면_3개_이상():
    # Given
    df = _rows({"L23001911": 2, "C00000093": 30})
    # When
    result = to_answers(df)["Q9"][0]
    # Then
    assert result == "3개 이상"


def test_to_answers_거래_기간은_두_칸_중_큰_값의_일수():
    # Given
    df = _rows({"C00000090": 364, "L23003700": 365}, {"C00000090": 3650, "L23003700": 100})
    # When
    result = list(to_answers(df)["Q10"])
    # Then
    assert result == ["1~3년", "10년 이상"]


def test_to_answers_거래_기간_두_칸_모두_0이면_1년_미만():
    # Given
    df = _rows({"C00000090": 0, "L23003700": 0})
    # When
    result = to_answers(df)["Q10"][0]
    # Then
    assert result == "1년 미만"


def test_to_finance_캐피탈_금액이_있으면_카드_캐피탈_이용():
    # Given
    df = _rows({"L00140002": 500})
    # When
    result = to_finance(df).iloc[0].to_dict()
    # Then
    assert result == {"은행": False, "카드/캐피탈": True, "저축은행(상호금융 포함)": False, "대부업": False}
