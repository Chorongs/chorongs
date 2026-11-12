"""요청/응답 스키마 (EXT-05, Spring FastApiCleanResponseDTO와 칸 이름을 맞춤)"""
from typing import Literal

from pydantic import BaseModel, Field


class ImportRequest(BaseModel):
    # Literal: 정해진 값만 허용 (다른 값이면 422)
    sources: list[Literal["KINFA", "FSS"]] = Field(..., min_length=1, max_length=2,
                                                   description="불러올 출처 (KINFA 서민금융진흥원, FSS 금융감독원)")


class SourceResult(BaseModel):
    source: str
    success: bool
    count: int                  # 정제한 상품 수 (실패면 0)
    error: str | None = None    # 실패 사유 (성공이면 None)


class ImportResponse(BaseModel):
    source_results: list[SourceResult]
    products: list[dict]        # 정제한 상품 (loan_product 칸 + tags, rates, check_reasons)
