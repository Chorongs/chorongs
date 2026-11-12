"""
    캐링 데이터 처리 FastAPI 앱 (EXT-05)

    - GET  /health           : 인증 없음
    - POST /products/import  : 출처 수집 → 정제 → 검증 결과 (EXT-01, EXT-02, ADMIN-04)

    실행: ml 폴더에서  fastapi dev app/main.py
"""
import logging
import time
import xml.etree.ElementTree as ET
from datetime import date

import requests
from fastapi import Depends, FastAPI

from app.clean import clean_products
from app.collect import collect_fss, collect_kinfa
from app.schemas import ImportRequest, ImportResponse, SourceResult
from app.security import verify_token

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="캐링 데이터 처리 API")

COLLECTORS = {"KINFA": collect_kinfa, "FSS": collect_fss}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/products/import", response_model=ImportResponse, dependencies=[Depends(verify_token)])
def import_products(body: ImportRequest):
    """
        출처마다 수집하고, 성공한 출처만 정제한다.
        한 출처가 실패해도 나머지는 계속 진행 (B13), 실패한 출처는 success false
    """
    tables, collected, errors = {}, [], {}
    sources = list(dict.fromkeys(body.sources))     # 같은 출처를 두 번 보내도 1번만

    with requests.Session() as session:
        for source in sources:
            start = time.time()
            try:
                tables.update(COLLECTORS[source](session))
                collected.append(source)
                logger.info("%s 수집 끝: %.1f초", source, time.time() - start)
            except requests.RequestException as e:
                # 예외 메시지에 키가 든 주소가 있어서 예외 이름만 남김
                errors[source] = type(e).__name__
                logger.error("%s 수집 실패, 건너뜀: %s", source, errors[source])
            except (RuntimeError, ValueError, ET.ParseError) as e:
                errors[source] = str(e)
                logger.error("%s 수집 실패, 건너뜀: %s", source, errors[source])

    today = date.today()
    products = clean_products(tables, collected, today, today)

    results = [SourceResult(source=source,
                            success=source in collected,
                            count=sum(p["source"] == source for p in products),
                            error=errors.get(source))
               for source in sources]
    logger.info("정제 상품 %d개, 확인 필요 %d개", len(products), sum(bool(p["check_reasons"]) for p in products))

    return ImportResponse(source_results=results, products=products)
