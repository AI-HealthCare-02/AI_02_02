"""CORS 미들웨어 설정."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core import config
from backend.core.config import Env


def setup_cors(app: FastAPI) -> None:
    """CORS 미들웨어를 FastAPI 앱에 등록한다."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://localhost",
            "http://127.0.0.1",
            "https://danaa-project.vercel.app",
            "https://danaa.r-e.kr",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=0 if config.ENV == Env.LOCAL else 600,
    )
