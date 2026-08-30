"""Khởi động máy chủ bằng lệnh: python -m app

Uvicorn gọi thẳng từ dòng lệnh không đọc file .env, nên địa chỉ và cổng phải
được truyền vào từ cấu hình của ứng dụng. Nhờ điểm khởi động này, hai biến HOST
và PORT trong .env có tác dụng thật, thay vì bị con số viết cứng trong lệnh chạy
ghi đè.
"""

from __future__ import annotations

import argparse

import uvicorn

from app.core.config import settings
from app.core.console import use_utf8_output


def main() -> None:
    use_utf8_output()

    parser = argparse.ArgumentParser(
        description="Khởi động backend của nền tảng học tập theo project."
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Tự khởi động lại mỗi khi mã nguồn thay đổi. Chỉ dùng khi phát triển.",
    )
    args = parser.parse_args()

    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=args.reload)


if __name__ == "__main__":
    main()
