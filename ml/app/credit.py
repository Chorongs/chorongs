"""
    신용 셀프 진단 문항 보기 (CREDIT-01, EXT-05)
    규칙 기준: docs 데이터 처리 기획서 3-9 (문항과 학습 칸 대응), 3-10 2번

    - OPTIONS: 문항별 보기 (화면 보기 순서 = 보기 번호 1, 2, ... / 0은 '잘 모르겠어요')
    - to_answers: 학원 합성 데이터 행 → 문항별 보기 (학습용, 02~04 노트북이 같이 씀)
    - to_finance: 문항 5 이용 금융권 (여러 개)
    - score_answers: 점수표 파일로 점수 계산 (03 확인, 04 평가, /credit/score가 같이 씀)
    - 학습 입력과 서비스 입력이 같은 보기여야 점수가 맞음 (기획서 3-9) → 보기는 이 파일에만 정의

    단위는 학원 데이터 칸 사전(column_dictionary_207.csv) 기준
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

SCORE_TABLE_PATH = Path(__file__).resolve().parent / "artifacts" / "credit_score_table.json"   # 03 노트북이 만듦

OPTIONS = {
    "Q1": ["없음", "1회", "2회 이상"],                                   # 1년 안 30일 이상 연체
    "Q2": ["없음", "10일 미만", "10~29일", "30일 이상"],                    # 3개월 안 최장 연체
    "Q3": ["없음", "있음"],                                              # 5년 안 채무조정, 연체 등록
    "Q4": ["0건", "1건", "2~3건", "4건 이상"],                              # 갖고 있는 대출 건수
    "Q6": ["없음", "1천 미만", "1천~3천", "3천~5천", "5천~1억", "1억 이상"],   # 총 대출 잔액 (만원)
    "Q7": ["카드 없음", "30 미만", "30~60", "60~90", "90 이상"],             # 카드 한도 사용 비율 (%)
    "Q8": ["없음", "1~2개월", "3개월 이상"],                               # 6개월 현금서비스(단기카드대출) 사용 달
    "Q9": ["0개", "1~2개", "3개 이상"],                                   # 6개월 안 새로 만든 대출, 카드
    "Q10": ["1년 미만", "1~3년", "3~5년", "5~10년", "10년 이상"],            # 금융거래 기간 (2026-11-13 보기 5개)
}

# 문항 5 이용 금융권: 칸별 금액(천원) > 0이면 이용 (상호금융은 따로 칸이 없어 저축은행에 묶음)
FINANCE_COLUMNS = {
    "은행": ["LC0025202"],
    "카드/캐피탈": ["L00060002", "L00140002"],
    "저축은행(상호금융 포함)": ["L00080002"],
    "대부업": ["LA0099212"],
}

DAY_YEAR = 365           # 거래 기간 칸(C00000090, L23003700)은 일 단위
NEW_CARD_DAYS = 180      # 최근 카드 발급 뒤 이 일수 안이면 6개월 안 새 카드 1건 (C00000093, 0은 카드 없음)
MAN_WON = 10             # 대출 잔액 칸(L00000002)은 천원 단위 → 1만원 = 10천원

# 보기마다 시작 값 (그 값 포함). 마지막 보기는 끝까지
STARTS = {
    "Q1": [0, 1, 2],                                           # 건
    "Q2": [0, 1, 10, 30],                                      # 일
    "Q4": [0, 1, 2, 4],                                        # 건
    "Q6": [0, 1, 1000 * MAN_WON, 3000 * MAN_WON, 5000 * MAN_WON, 10000 * MAN_WON],   # 천원
    "Q7": [0, 30, 60, 90],                                     # % ('카드 없음' 뒤 보기들)
    "Q8": [0, 1, 3],                                           # 개월
    "Q9": [0, 1, 3],                                           # 개
    "Q10": [0, DAY_YEAR, 3 * DAY_YEAR, 5 * DAY_YEAR, 10 * DAY_YEAR],   # 일
}

# to_answers가 읽는 학원 데이터 칸 (읽을 때 usecols로 쓸 수 있음)
SOURCE_COLUMNS = ["DQ1251001", "KC5000016", "BS0000164", "BS0000772", "B32000100", "L00000001",
                  "L00000002", "CL0631905", "C00000090", "CF0600611", "L23001911", "C00000093", "L23003700",
                  *[c for cols in FINANCE_COLUMNS.values() for c in cols]]


def _cut(values, starts, labels):
    """숫자 → 보기 (starts의 각 값 이상이면 그 보기)"""
    return pd.cut(values, bins=[-np.inf, *starts[1:], np.inf], labels=labels, right=False)


def _options(values, question):
    """보기 글 → OPTIONS 순서를 가진 범주"""
    return pd.Categorical(values, categories=OPTIONS[question])


def to_answers(df):
    """
        학원 데이터 행 → 문항별 보기 (문항 5는 to_finance)

        - Q3: BS0000164, BS0000772, B32000100 중 하나라도 1 이상이면 있음
        - Q7: C00000090(최초 카드 발급 뒤 일수)이 0이면 카드 없음, 아니면 CL0631905(%)로
        - Q9: L23001911(6개월 대출 건수) + C00000093이 1~180일이면 1건
        - Q10: C00000090, L23003700 중 큰 값(일). 둘 다 0이면 1년 미만
    """
    new_card = df["C00000093"].between(1, NEW_CARD_DAYS).astype(int)
    history = df[["C00000090", "L23003700"]].max(axis=1)
    card_rate = _cut(df["CL0631905"], STARTS["Q7"], OPTIONS["Q7"][1:]).astype(str)

    return pd.DataFrame({
        "Q1": _cut(df["DQ1251001"], STARTS["Q1"], OPTIONS["Q1"]),
        "Q2": _cut(df["KC5000016"], STARTS["Q2"], OPTIONS["Q2"]),
        "Q3": _options(np.where((df[["BS0000164", "BS0000772", "B32000100"]] >= 1).any(axis=1),
                                "있음", "없음"), "Q3"),
        "Q4": _cut(df["L00000001"], STARTS["Q4"], OPTIONS["Q4"]),
        "Q6": _cut(df["L00000002"], STARTS["Q6"], OPTIONS["Q6"]),
        "Q7": _options(np.where(df["C00000090"] == 0, "카드 없음", card_rate), "Q7"),
        "Q8": _cut(df["CF0600611"], STARTS["Q8"], OPTIONS["Q8"]),
        "Q9": _cut(df["L23001911"] + new_card, STARTS["Q9"], OPTIONS["Q9"]),
        "Q10": _cut(history, STARTS["Q10"], OPTIONS["Q10"]),
    }, index=df.index)


def to_finance(df):
    """학원 데이터 행 → 문항 5 금융권별 이용 여부 (True/False, 여러 개 가능)"""
    return pd.DataFrame({name: (df[cols] > 0).any(axis=1) for name, cols in FINANCE_COLUMNS.items()},
                        index=df.index)


# ---------- 점수표로 점수 계산 ----------

UNKNOWN = 0     # '잘 모르겠어요' 보기 번호 (CREDIT-01)


def middle_points(points):
    """'잘 모르겠어요' 점수: 가운데 보기 점수, 보기 수가 짝수면 가운데 두 보기 평균 (2026-11-13 결정)"""
    n = len(points)
    if n % 2:
        return points[n // 2]
    return (points[n // 2 - 1] + points[n // 2]) / 2


def load_score_table(path=SCORE_TABLE_PATH):
    """점수표 파일 → dict"""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def score_answers(table, answers):
    """
        문항 답 → (점수 1~1000, 문항별 점수 {문항 번호: 점수})

        - answers: {문항 번호(1~10): 보기 번호 목록}. 보기 번호는 1부터, 0은 '잘 모르겠어요' (FastApiScoreRequestDTO)
        - 1. 선형 점수 = 기본 점수 + 보기 점수 합 ('잘 모르겠어요'는 그 문항의 unknown 점수, 문항 5는 0)
        - 2. 경계표로 NICE 점수 축에 맞춤 (구간 안은 선형, 끝을 넘으면 1 또는 1000)
        - 3. 상한: 실제로 고른 답이 상한 보기면 최대 점수로 낮춤 ('잘 모르겠어요'는 상한에 안 걸림)
        - 정해진 보기 번호가 아니면 ValueError
    """
    questions = table["questions"]
    linear = table["base_points"]
    items, chosen = {}, {}

    for no in range(1, 11):
        q = questions.get(f"Q{no}")
        choices = answers.get(no, [])
        if q is None:                       # 문항 5: 점수 0, 상태와 팁에만 씀
            items[no] = 0
            continue
        if len(choices) != 1 or not 0 <= choices[0] <= len(q["options"]):
            raise ValueError(f"문항 {no} 보기 번호가 정해진 범위가 아님")
        choice = choices[0]
        points = q["unknown_points"] if choice == UNKNOWN else q["points"][choice - 1]
        if choice != UNKNOWN:
            chosen[f"Q{no}"] = q["options"][choice - 1]
        linear += points
        items[no] = int(round(points))

    edges = table["edges"]
    score = float(np.interp(linear, edges["linear"], edges["score"]))
    for rule in table["caps"]:
        if chosen.get(rule["question"]) in rule["options"]:
            score = min(score, rule["max_score"])
    return int(round(min(max(score, 1), 1000))), items
