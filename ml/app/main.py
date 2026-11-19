"""
    캐링 데이터 처리 FastAPI 앱 (EXT-05)

    - GET  /health                    : 인증 없음
    - POST /imports                   : 불러오기 시작 → 작업 번호 바로 응답, 수집·정제·비교는 응답 뒤 이어서 (ADMIN-04, EXT-01, 02)
    - GET  /imports/{job_id}          : 진행 상태, 기준 버전, 출처별 결과, 바뀐 상품 목록
    - POST /imports/{job_id}/publish  : 고른 항목 반영 → 새 버전 (ADMIN-04)
    - POST /catalog/rollback          : 되돌리기 → 새 버전 (ADMIN-05)
    - POST /credit/score              : 진단 문항 답 → 점수, 문항별 점수 (CREDIT-01). 답과 점수는 로그 금지 (B8)
    /health 말고는 모두 Bearer 토큰 (B14)
    409 detail: IMPORT_RUNNING / IMPORT_EXPIRED / VERSION_CONFLICT / NOTHING_TO_ROLLBACK, 422 detail: NOT_PUBLISHABLE,
    404 detail: JOB_NOT_FOUND / HISTORY_NOT_FOUND (Spring FastApiClient가 ErrorCode로 바꿈)

    실행: ml 폴더에서  fastapi dev app/main.py
"""
import logging

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.credit import load_score_table, score_answers
from app.imports import JobConflict, NotFound, NotPublishable, SOURCE_ORDER, read_job, run_import, start_job
from app.load import make_engine
from app.publish import publish, rollback
from app.schemas import (ImportStartRequest, ImportStartResponse, ImportStatusResponse, ItemScore, PublishRequest,
                         RollbackRequest, ScoreRequest, ScoreResponse, VersionResponse)
from app.security import verify_token

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="캐링 데이터 처리 API")

SCORE_TABLE = load_score_table()      # 진단 점수표 (03 노트북이 만듦). 없으면 서버가 시작되지 않음
ENGINE = make_engine()                # DB 접속 (환경변수 DB_URL, DB_USERNAME, DB_PASSWORD 없으면 서버가 시작되지 않음)


# ---------- 오류 → 상태 코드 (detail은 Spring이 ErrorCode로 바꾸는 코드 값) ----------

@app.exception_handler(JobConflict)
def job_conflict(request: Request, exc: JobConflict):
    return JSONResponse(status_code=409, content={"detail": exc.detail})


@app.exception_handler(NotPublishable)
def not_publishable(request: Request, exc: NotPublishable):
    return JSONResponse(status_code=422, content={"detail": "NOT_PUBLISHABLE"})


@app.exception_handler(NotFound)
def not_found(request: Request, exc: NotFound):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- 상품 불러오기, 반영, 되돌리기 ----------

@app.post("/imports", response_model=ImportStartResponse, dependencies=[Depends(verify_token)])
def start_import(body: ImportStartRequest, background_tasks: BackgroundTasks):
    """
        작업 1행(RUNNING)을 만들고 번호를 바로 돌려줌. 진행 중 작업이 있으면 409 IMPORT_RUNNING
        수집, 정제, 비교(run_import)는 응답을 보낸 뒤 같은 서버에서 이어서 함 (BackgroundTasks)
    """
    sources = [s for s in SOURCE_ORDER if s in body.sources]    # 같은 출처 중복 제거 + 'KINFA,FSS' 순서
    with ENGINE.begin() as conn:
        job_id = start_job(conn, sources, body.admin_id)
    background_tasks.add_task(run_import, ENGINE, job_id, sources)
    logger.info("불러오기 작업 %d 시작: %s", job_id, ",".join(sources))
    return ImportStartResponse(job_id=job_id)


@app.get("/imports/{job_id}", response_model=ImportStatusResponse, dependencies=[Depends(verify_token)])
def get_import(job_id: int):
    """진행 상태 (화면이 1초마다 Spring을 거쳐 물음). 없는 작업은 404"""
    with ENGINE.connect() as conn:
        job = read_job(conn, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="JOB_NOT_FOUND")
    return job


@app.post("/imports/{job_id}/publish", response_model=VersionResponse, dependencies=[Depends(verify_token)])
def publish_import(job_id: int, body: PublishRequest):
    """고른 항목만 한 트랜잭션으로 반영 → 새 버전. 409 IMPORT_EXPIRED, VERSION_CONFLICT / 422 NOT_PUBLISHABLE"""
    version = publish(ENGINE, job_id, body.item_ids, body.base_version, body.admin_id)
    return VersionResponse(version=version)


@app.post("/catalog/rollback", response_model=VersionResponse, dependencies=[Depends(verify_token)])
def rollback_catalog(body: RollbackRequest):
    """고른 이력 시점으로 되돌리기 → 새 버전. 409 VERSION_CONFLICT, NOTHING_TO_ROLLBACK / 404 없는 이력"""
    version = rollback(ENGINE, body.history_id, body.base_version, body.admin_id)
    return VersionResponse(version=version)


# ---------- 신용 진단 점수 ----------

@app.post("/credit/score", response_model=ScoreResponse, dependencies=[Depends(verify_token)])
def credit_score(body: ScoreRequest):
    """
        진단 문항 답 → 점수표로 점수 (구간은 Spring이 정함, CREDIT-01)
        같은 문항이 두 번이거나 정해진 보기 번호가 아니면 422 (답 값은 응답, 로그에 넣지 않음, B8)
    """
    answers = {item.question_no: item.choices for item in body.answers}
    if len(answers) != len(body.answers):
        raise HTTPException(status_code=422, detail="같은 문항 번호가 두 번 있음")
    try:
        score, items = score_answers(SCORE_TABLE, answers)
    except ValueError:
        raise HTTPException(status_code=422, detail="문항 답이 정해진 보기 번호가 아님") from None

    return ScoreResponse(score=score,
                         item_scores=[ItemScore(question_no=no, score=points) for no, points in items.items()])
