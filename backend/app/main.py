"""Điểm khởi tạo ứng dụng FastAPI."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app import __version__
from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import init_db

logger = logging.getLogger(__name__)

DESCRIPTION = """
Backend của Project 200, nền tảng học tập theo project cho sinh viên.

Mỗi project có level từ 0 đến 5, thuộc một track chuyên môn và có thể yêu cầu
hoàn thành một số project tiên quyết. Người dùng nộp bài, được chấm, nhận XP và
badge, rồi được gợi ý project tiếp theo dựa trên tiến độ của chính mình.
"""


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Chuẩn bị cơ sở dữ liệu khi ứng dụng khởi động."""
    init_db()
    logger.info("Đã sẵn sàng tại http://%s:%s", settings.host, settings.port)
    yield


app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description=DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
)

# Nén phản hồi lớn. Trang danh sách project trả về nhiều văn bản nên phần tiết
# kiệm được là đáng kể.
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health", tags=["system"], summary="Kiểm tra backend còn sống")
def health() -> dict[str, str]:
    """Endpoint để frontend hoặc công cụ giám sát kiểm tra nhanh."""
    return {"status": "ok", "version": __version__}
