"""
    도움말 적재 (EXT-07): ml/data/csv/의 help_faq.csv, help_term.csv, help_tip.csv → help_content

    - ml 폴더에서: python -m app.help_load --check (검사, 접속, 추가/덮어쓰기/삭제 건수만 보여 줌. DB 안 바꿈)
                   python -m app.help_load          (실제로 넣음)
    - 검사에 하나라도 걸리면 DB에 접속하지 않고 멈춤
    - 한 트랜잭션: 종류 + 번호(help_type, help_no)로 MERGE (help_id 유지 → help_stat 통계가 이어짐),
      종류별로 CSV에 없는 번호는 DELETE (help_stat 행은 남김). 중간에 실패하면 전부 되돌림 (B16)
    - 글은 HTML로 바꾸지 않고 CSV 글자 그대로 (B15)
    - 적재 뒤 Spring 서버를 다시 시작해야 화면에 보임 (도움말 메모리 캐시, B10)
    - DB 접속: load.py와 같은 환경변수 DB_URL, DB_USERNAME, DB_PASSWORD (B12)
"""
import logging
import re
import sys
from collections import Counter

import pandas as pd
from sqlalchemy import CLOB, bindparam, text

from app.clean import CSV_DIR
from app.load import id_map, make_engine

log = logging.getLogger(__name__)

HELP_FILES = {"FAQ": "help_faq.csv", "TERM": "help_term.csv", "TIP": "help_tip.csv"}
KEYWORD_COLS = [f"KEYWORD{i}" for i in range(1, 6)]
COLUMNS = ["HELP_TYPE", "HELP_NO", "CATEGORY", *KEYWORD_COLS, "TITLE", "SUMMARY", "CONTENT"]   # CSV 1행 칸 이름

# 비면 안 되는 칸 (번호는 HELP_NO 검사에서 따로 봄)
REQUIRED = {"FAQ": ["TITLE", "CONTENT"],
            "TERM": ["CATEGORY", "TITLE", "CONTENT"],
            "TIP": ["KEYWORD1", "TITLE", "SUMMARY", "CONTENT"]}
MAX_LEN = {"TITLE": 200, "CATEGORY": 30, "SUMMARY": 200, **{c: 30 for c in KEYWORD_COLS}}   # db/schema.sql 칸 길이
TIP_KEYWORDS = ("금리", "수수료", "상환", "계약", "불법/사기", "연체")
HELP_NO_PATTERN = re.compile(r"[1-9][0-9]{0,5}")    # 1부터, NUMBER(6)

SELECT_HELP_IDS = "SELECT help_type, help_no, help_id FROM help_content"
# 값은 USING 쪽에서 한 번만 받고, 있으면 갱신 / 없으면 추가
MERGE_HELP = text(
    "MERGE INTO help_content t "
    "USING (SELECT :help_type AS help_type, :help_no AS help_no, :category AS category, "
    ":keyword1 AS keyword1, :keyword2 AS keyword2, :keyword3 AS keyword3, :keyword4 AS keyword4, "
    ":keyword5 AS keyword5, :title AS title, :content AS content, :summary AS summary FROM dual) s "
    "ON (t.help_type = s.help_type AND t.help_no = s.help_no) "
    "WHEN MATCHED THEN UPDATE SET t.category = s.category, t.keyword1 = s.keyword1, t.keyword2 = s.keyword2, "
    "t.keyword3 = s.keyword3, t.keyword4 = s.keyword4, t.keyword5 = s.keyword5, t.title = s.title, "
    "t.content = s.content, t.summary = s.summary "
    "WHEN NOT MATCHED THEN INSERT (help_type, help_no, category, keyword1, keyword2, keyword3, keyword4, keyword5, "
    "title, content, summary) VALUES (s.help_type, s.help_no, s.category, s.keyword1, s.keyword2, s.keyword3, "
    "s.keyword4, s.keyword5, s.title, s.content, s.summary)"
).bindparams(bindparam("content", type_=CLOB))
DELETE_HELP = text("DELETE FROM help_content WHERE help_type = :help_type AND help_no = :help_no")


def read_help(csv_dir=CSV_DIR):
    """CSV 3개 → {종류: 행 목록} (빈 칸은 '', 엑셀 'CSV UTF-8' 저장의 BOM도 읽음)"""
    return {help_type: pd.read_csv(csv_dir / name, dtype=str, keep_default_na=False,
                                   encoding="utf-8-sig").to_dict("records")
            for help_type, name in HELP_FILES.items()}


def check_rows(help_type, rows):
    """
        한 종류(CSV 1개)의 행 검사 → 걸린 내용 목록 (빈 목록이면 통과)
        '줄'은 CSV 줄 번호 (1줄은 칸 이름이라 첫 내용 행이 2줄 = 엑셀 행 번호)
    """
    if not rows:
        return [f"{help_type}: 행이 0개 (적재하면 그 종류가 전부 지워져서 멈춤)"]
    missing_cols = [c for c in COLUMNS if c not in rows[0]]
    if missing_cols:
        return [f"{help_type}: 칸 이름이 없음 {missing_cols}"]

    errors = []
    help_nos = Counter(row["HELP_NO"] for row in rows)
    for line, row in enumerate(rows, start=2):
        where = f"{help_type} {line}줄 (번호 {row['HELP_NO'] or '없음'})"
        if row["HELP_TYPE"] != help_type:
            errors.append(f"{where}: HELP_TYPE이 '{row['HELP_TYPE']}' ({help_type}이어야 함)")
        if not HELP_NO_PATTERN.fullmatch(row["HELP_NO"]):
            errors.append(f"{where}: 번호가 1 이상 숫자가 아님")
        elif help_nos[row["HELP_NO"]] > 1:
            errors.append(f"{where}: 같은 종류 안에서 번호 중복")
        for col in REQUIRED[help_type]:
            if not row[col].strip():
                errors.append(f"{where}: {col} 빔")
        for col, max_len in MAX_LEN.items():
            if len(row[col]) > max_len:
                errors.append(f"{where}: {col} {len(row[col])}자 ({max_len}자까지)")
        keywords = [row[c] for c in KEYWORD_COLS]
        filled = [k for k in keywords if k]
        if keywords[:len(filled)] != filled:
            errors.append(f"{where}: 키워드 중간에 빈칸 (KEYWORD1부터 빈칸 없이)")
        if help_type == "TIP":
            outside = [k for k in filled if k not in TIP_KEYWORDS]
            if outside:
                errors.append(f"{where}: TIP 키워드가 정한 6개 밖 {outside}")
    return errors


def check_all(rows_by_type):
    """세 종류 모두 검사 → 걸린 내용 전체"""
    return [e for help_type, rows in rows_by_type.items() for e in check_rows(help_type, rows)]


def value_counts(rows, cols):
    """칸들의 값별 행 수 (빈 값 제외). 분류, 키워드 표기가 갈라졌는지 눈으로 보는 용도"""
    return dict(Counter(row[c] for row in rows for c in cols if row[c]).most_common())


def to_params(help_type, row):
    """CSV 1행 → MERGE 값 (빈 칸은 NULL)"""
    params = {"help_type": help_type, "help_no": int(row["HELP_NO"])}
    for col in ["CATEGORY", *KEYWORD_COLS, "TITLE", "CONTENT", "SUMMARY"]:
        params[col.lower()] = row[col] or None
    return params


def plan_changes(existing, rows_by_type):
    """
        DB에 있는 번호 {(종류, 번호): help_id}와 CSV를 비교
        → 종류별 {'추가': n, '덮어쓰기': n, '삭제': [(종류, 번호), ...]}
    """
    plan = {}
    for help_type, rows in rows_by_type.items():
        csv_nos = {int(row["HELP_NO"]) for row in rows}
        db_nos = {no for (t, no) in existing if t == help_type}
        plan[help_type] = {"추가": len(csv_nos - db_nos), "덮어쓰기": len(csv_nos & db_nos),
                           "삭제": [(help_type, no) for no in sorted(db_nos - csv_nos)]}
    return plan


def load_help(conn, rows_by_type, plan):
    """MERGE + 지울 번호 DELETE (conn은 트랜잭션 안)"""
    conn.execute(MERGE_HELP, [to_params(t, row) for t, rows in rows_by_type.items() for row in rows])
    deletes = [{"help_type": t, "help_no": no} for p in plan.values() for (t, no) in p["삭제"]]
    if deletes:
        conn.execute(DELETE_HELP, deletes)


def main():
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    check_only = "--check" in sys.argv[1:]

    rows_by_type = read_help()
    for help_type, rows in rows_by_type.items():
        log.info("%s %d행 / 분류 %s", help_type, len(rows), value_counts(rows, ["CATEGORY"]))
    errors = check_all(rows_by_type)
    if errors:
        log.info("검사에 걸린 %d건 (DB 안 바꿈, CSV를 고친 뒤 다시 실행):", len(errors))
        for e in errors:
            log.info("  %s", e)
        sys.exit(1)
    log.info("검사 통과")

    with make_engine().begin() as conn:   # 블록을 끝까지 마치면 커밋, 오류가 나면 전부 되돌림
        plan = plan_changes(id_map(conn, SELECT_HELP_IDS), rows_by_type)
        for help_type, p in plan.items():
            log.info("%s: 추가 %d / 덮어쓰기 %d / 삭제 %d %s", help_type, p["추가"], p["덮어쓰기"],
                     len(p["삭제"]), [no for _, no in p["삭제"]] or "")
        if check_only:
            log.info("--check: 접속, 건수 확인 끝. DB는 바꾸지 않음")
            return
        load_help(conn, rows_by_type, plan)
    log.info("도움말 적재 끝. Spring 서버를 다시 시작해야 화면에 보임")


if __name__ == "__main__":
    main()
