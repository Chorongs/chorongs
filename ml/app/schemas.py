"""요청/응답 스키마 (EXT-05, Spring common/dto의 FastApi*DTO와 칸 이름을 맞춤)"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Source = Literal["KINFA", "FSS"]     # Literal: 정해진 값만 허용 (다른 값이면 422)


# ---------- 상품 불러오기 (ADMIN-04, Spring FastApiImportResponseDTO) ----------

class ImportStartRequest(BaseModel):
    sources: list[Source] = Field(..., min_length=1, max_length=2,
                                  description="불러올 출처 (KINFA 서민금융진흥원, FSS 금융감독원)")
    admin_id: int = Field(..., ge=1, description="불러오기를 누른 관리자 번호")


class ImportStartResponse(BaseModel):
    job_id: int                 # 작업 번호 (진행 확인, 반영에 씀)


class SourceResult(BaseModel):
    source: str
    success: bool
    count: int                  # 정제한 상품 수 (실패면 0)
    error: str | None = None    # 실패 사유 (성공이면 None)


class ImportItem(BaseModel):
    """바뀐 상품 1개 (import_item 행). 반영할 값(after_data)은 화면에 안 보내고 DB에만 둠"""
    item_id: int
    diff_type: Literal["NEW", "CHANGE", "REMOVE", "REOPEN", "CHECK"]
    product_id: int | None      # 지금 상품 번호 (신규는 None)
    product_name: str | None    # 확인 필요 '상품명 없음'은 None
    company_name: str | None
    source: str
    changed_fields: list[str]   # 바뀐 칸 이름 (dcls_month, tags, rates 포함)
    check_reasons: list[str]    # 확인 필요 사유 (CHECK만)
    hidden_yn: str              # 지금 숨김(HIDDEN) 중이면 Y


class ImportStatusResponse(BaseModel):
    job_id: int
    job_status: Literal["RUNNING", "DONE", "FAILED", "PUBLISHED", "EXPIRED"]
    base_version: int | None    # 비교할 때의 마지막 반영 이력 번호 (반영 요청에 그대로 보냄)
    created_at: datetime | None = None      # 작업 시작 시각
    finished_at: datetime | None = None     # DONE, FAILED가 된 시각 = 반영 대기 테이블 적재 시각 (화면 '마지막 갱신'. RUNNING이면 None)
    source_results: list[SourceResult]
    items: list[ImportItem]


# ---------- 반영, 되돌리기 (ADMIN-04, 05, Spring FastApiVersionResponseDTO) ----------

class PublishRequest(BaseModel):
    item_ids: list[int] = Field(..., min_length=1, description="반영할 항목 번호")
    base_version: int = Field(..., ge=1, description="기준 버전 (진행 확인 응답의 base_version)")
    admin_id: int = Field(..., ge=1, description="반영한 관리자 번호")


class RollbackRequest(BaseModel):
    history_id: int = Field(..., ge=1, description="되돌릴 시점의 이력 번호")
    base_version: int = Field(..., ge=1, description="기준 버전 (지금 마지막 이력 번호)")
    admin_id: int = Field(..., ge=1, description="되돌린 관리자 번호")


class VersionResponse(BaseModel):
    version: int                # 새 이력 번호 (= 새 버전)


# ---------- 신용 진단 점수 (CREDIT-01, Spring FastApiScoreRequestDTO, FastApiScoreResponseDTO) ----------

class AnswerItem(BaseModel):
    question_no: int = Field(..., ge=1, le=10, description="문항 번호")
    # 보기 번호 목록 (1부터, '잘 모르겠어요' = [0], 문항 5 대출 없음 = [])
    choices: list[int] = Field(..., max_length=4, description="보기 번호 목록")


class ScoreRequest(BaseModel):
    answers: list[AnswerItem] = Field(..., min_length=1, max_length=10, description="문항 1~10 답")


class ItemScore(BaseModel):
    question_no: int
    score: int


class ScoreResponse(BaseModel):
    score: int                      # 예상 점수 1~1000
    item_scores: list[ItemScore]    # 문항별 점수 (상태, 팁용)
