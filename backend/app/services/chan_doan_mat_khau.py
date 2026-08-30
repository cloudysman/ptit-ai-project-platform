"""Chặn việc dò mật khẩu bằng cách thử liên tục.

Mỗi lần đăng nhập sai được ghi lại theo cặp tên đăng nhập và địa chỉ máy gọi.
Quá số lần cho phép trong một khoảng thời gian thì tài khoản đó tạm thời không
nhận thêm lần thử nào nữa, cho tới khi hết thời gian chờ.

Bộ đếm nằm trong bộ nhớ của tiến trình, đủ cho một nền tảng chạy trên một máy
chủ. Chạy nhiều tiến trình song song thì phải chuyển phần này sang một kho dùng
chung, ví dụ Redis, nếu không mỗi tiến trình đếm một kiểu.
"""

from __future__ import annotations

import threading
import time

# Số lần sai liên tiếp được phép, và khoảng thời gian tính các lần sai đó.
SO_LAN_TOI_DA = 8
CUA_SO_GIAY = 300

# Thời gian phải chờ sau khi đã sai quá số lần cho phép.
CHO_GIAY = 300

_khoa = threading.Lock()
_lan_sai: dict[tuple[str, str], list[float]] = {}


def _don(moc: list[float], bay_gio: float) -> list[float]:
    """Bỏ những lần sai đã quá cũ, không còn tính vào hạn mức."""
    return [m for m in moc if bay_gio - m < CUA_SO_GIAY]


def con_phai_cho(ten_dang_nhap: str, dia_chi: str) -> int:
    """Số giây còn phải chờ trước khi được thử lại. Bằng 0 nghĩa là thử được ngay."""
    bay_gio = time.monotonic()
    khoa_dem = (ten_dang_nhap.strip().lower(), dia_chi)

    with _khoa:
        moc = _don(_lan_sai.get(khoa_dem, []), bay_gio)
        _lan_sai[khoa_dem] = moc
        if len(moc) < SO_LAN_TOI_DA:
            return 0
        return max(1, int(CHO_GIAY - (bay_gio - moc[-1])))


def ghi_lan_sai(ten_dang_nhap: str, dia_chi: str) -> None:
    """Ghi thêm một lần đăng nhập sai."""
    bay_gio = time.monotonic()
    khoa_dem = (ten_dang_nhap.strip().lower(), dia_chi)

    with _khoa:
        moc = _don(_lan_sai.get(khoa_dem, []), bay_gio)
        moc.append(bay_gio)
        _lan_sai[khoa_dem] = moc

        # Dọn những khoá đã nguội hẳn, để bảng đếm không phình theo thời gian chạy.
        if len(_lan_sai) > 1000:
            for khoa_cu in [k for k, v in _lan_sai.items() if not _don(v, bay_gio)]:
                del _lan_sai[khoa_cu]


def xoa_lan_sai(ten_dang_nhap: str, dia_chi: str) -> None:
    """Xoá bộ đếm sau một lần đăng nhập đúng."""
    with _khoa:
        _lan_sai.pop((ten_dang_nhap.strip().lower(), dia_chi), None)


def xoa_het() -> None:
    """Xoá toàn bộ bộ đếm. Dùng trong kiểm thử để các bài không ảnh hưởng nhau."""
    with _khoa:
        _lan_sai.clear()
