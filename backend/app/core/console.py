"""Chuẩn bị luồng ra chuẩn để in được tiếng Việt."""

from __future__ import annotations

import sys


def use_utf8_output() -> None:
    """Chuyển luồng ra chuẩn và luồng lỗi chuẩn sang bảng mã UTF-8.

    Cửa sổ dòng lệnh của Windows mặc định dùng một bảng mã không có chữ tiếng
    Việt, nên mọi câu thông báo có dấu sẽ làm chương trình dừng giữa chừng vì lỗi
    mã hoá. Gọi hàm này ngay đầu mỗi điểm khởi động thì chương trình chạy đúng ở
    mọi cửa sổ dòng lệnh, không phụ thuộc vào việc người dùng có đặt sẵn biến môi
    trường PYTHONIOENCODING hay không.
    """
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="replace")
