"""Bearer 토큰 인증 (B14)"""
import secrets

from fastapi import Header, HTTPException

from app.config import FASTAPI_TOKEN


def verify_token(authorization: str | None = Header(default=None)):
    """Authorization: Bearer <token> 검증. 없거나 틀리면 401"""
    expected = f"Bearer {FASTAPI_TOKEN}"
    if authorization is None or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing token")
