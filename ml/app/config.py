"""환경 설정 (B12, B14)"""
import os

# 설정되지 않으면 서버가 시작되지 않도록 함 (KeyError, 기본값 없음)
FASTAPI_TOKEN = os.environ["FASTAPI_TOKEN"]
