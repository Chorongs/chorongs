"""
    외부 API 원본 수집 → CSV 저장 (EXT-01, EXT-02)

    - 서민금융진흥원 대출상품한눈에 (XML)        → kinfa_loan_products.csv
    - 금융감독원 금융상품통합비교공시 대출 4종 (JSON) → finlife_{종류}_base.csv, finlife_{종류}_option.csv
    - 받은 값을 그대로 저장한다 (정제하지 않음)

    실행: ml 폴더에서  python -m app.collect
"""
import logging
import os
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import pandas as pd
import requests

logger = logging.getLogger(__name__)

# API 키: 환경변수에서 기본값 없이 읽음 (없으면 KeyError로 바로 실패, B12)
KINFA_API_KEY = os.environ["KINFA_API_KEY"]
FSS_API_KEY = os.environ["FSS_API_KEY"]

CSV_DIR = Path(__file__).resolve().parent.parent / "data" / "csv"

TIMEOUT = 10    # 요청 1번 시간 제한(초)
RETRY = 1       # 실패하면 다시 시도하는 횟수 (B13)
DELAY = 0.2     # 요청 사이 대기 시간(초)

KINFA_URL = ("https://apis.data.go.kr/B553701/LoanProductSearchingInfo"
             "/LoanProductSearchingInfo/getLoanProductSearchingInfo")
KINFA_PAGE_SIZE = 500

FSS_URL = "http://finlife.fss.or.kr/finlifeapi/{service}.json"
# CSV 이름에 쓰는 종류 이름 → API 서비스명
FSS_SERVICES = {
    "개인신용대출": "creditLoanProductsSearch",
    "전세자금대출": "rentHouseLoanProductsSearch",
    "주택담보대출": "mortgageLoanProductsSearch",
    "개인사업자대출": "busiLoanProductsSearch",
}
# 권역 코드: 은행, 여신전문, 저축은행, 보험, 금융투자 (신협 032000은 개인사업자대출 API에만 있음)
FSS_GROUPS = ["020000", "030200", "030300", "050000", "060000"]
FSS_BIZ_GROUPS = FSS_GROUPS + ["032000"]


def _get(session, url, params):
    """
        GET 요청. 실패하면 RETRY번 다시 시도하고, 그래도 실패하면 예외를 올린다.
        예외 메시지에는 키가 든 주소가 있어서 로그에는 예외 이름만 남긴다.
    """
    for attempt in range(RETRY + 1):
        try:
            resp = session.get(url, params=params, timeout=TIMEOUT)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            if attempt == RETRY:
                raise
            logger.warning("  요청 실패, 다시 시도: %s", type(e).__name__)
            time.sleep(DELAY)


def collect_kinfa(session):
    """
        서민금융진흥원 상품을 마지막 쪽까지 받는다.

        Return: {CSV 이름: 행 목록}
    """
    rows, page = [], 1

    while True:
        resp = _get(session, KINFA_URL, {"serviceKey": KINFA_API_KEY,
                                         "pageNo": page,
                                         "numOfRows": KINFA_PAGE_SIZE})
        root = ET.fromstring(resp.content)

        code = root.findtext("./header/resultCode")
        if code != "00":
            raise RuntimeError(f"서민금융진흥원 응답 코드 {code}")

        # <item> 안의 태그 이름 = 칸 이름, 글자 = 값 (빈 태그는 None)
        items = root.findall("./body/items/item")
        rows.extend({child.tag: child.text for child in item} for item in items)

        total = int(root.findtext("./body/totalCount") or 0)
        logger.info("  KINFA page %d %d건 (누적 %d / %d)", page, len(items), len(rows), total)

        if not items or len(rows) >= total:
            return {"kinfa_loan_products": rows}

        page += 1
        time.sleep(DELAY)


def _collect_fss_kind(session, service, groups):
    """
        금융감독원 대출 1종을 권역마다 마지막 쪽까지 받는다.
        행마다 권역 코드(top_fin_grp_no) 칸을 붙인다.

        Return: (기본 정보 행 목록, 금리 옵션 행 목록)
    """
    base_rows, option_rows = [], []

    for group in groups:
        page, max_page = 1, 1

        while page <= max_page:
            resp = _get(session, FSS_URL.format(service=service),
                        {"auth": FSS_API_KEY, "topFinGrpNo": group, "pageNo": page})
            result = resp.json()["result"]

            if result["err_cd"] != "000":
                raise RuntimeError(f"금융감독원 {service} 응답 코드 {result['err_cd']}")

            base_rows.extend(dict(row, top_fin_grp_no=group) for row in result.get("baseList") or [])
            option_rows.extend(dict(row, top_fin_grp_no=group) for row in result.get("optionList") or [])

            max_page = int(result["max_page_no"] or 0)
            logger.info("  FSS %s %s page %d / %d", service, group, page, max_page)

            page += 1
            time.sleep(DELAY)

    return base_rows, option_rows


def collect_fss(session):
    """
        금융감독원 대출 4종을 받는다. 1종이라도 실패하면 금융감독원 전체를 실패로 본다.

        Return: {CSV 이름: 행 목록}
    """
    tables = {}

    for kind, service in FSS_SERVICES.items():
        groups = FSS_BIZ_GROUPS if kind == "개인사업자대출" else FSS_GROUPS
        base_rows, option_rows = _collect_fss_kind(session, service, groups)
        tables[f"finlife_{kind}_base"] = base_rows
        tables[f"finlife_{kind}_option"] = option_rows

    return tables


def save_csv(rows, name):
    """행 목록을 CSV로 저장 (utf-8-sig: 엑셀에서 한글 안 깨짐)"""
    path = CSV_DIR / f"{name}.csv"
    pd.DataFrame(rows).to_csv(path, index=False, encoding="utf-8-sig")
    logger.info("  %s 저장: %d행", path.name, len(rows))


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    with requests.Session() as session:
        for source, collect in (("KINFA", collect_kinfa), ("FSS", collect_fss)):
            logger.info("%s 수집 시작", source)
            start = time.time()

            # 출처 하나가 실패해도 나머지 출처는 계속 진행 (B13)
            try:
                tables = collect(session)
            except requests.RequestException as e:
                logger.error("%s 수집 실패, 건너뜀: %s", source, type(e).__name__)
                continue
            except (RuntimeError, ValueError, ET.ParseError) as e:
                logger.error("%s 수집 실패, 건너뜀: %s", source, e)
                continue

            for name, rows in tables.items():
                save_csv(rows, name)

            logger.info("%s 수집 끝: %.1f초", source, time.time() - start)


if __name__ == "__main__":
    main()
