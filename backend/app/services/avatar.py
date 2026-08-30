"""Lưu và xoá ảnh đại diện của người dùng."""

from __future__ import annotations

import secrets
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import AVATAR_DIR, settings
from app.models.user import User

# Ba định dạng ảnh mà trình duyệt nào cũng hiển thị được. Phần mở rộng của tệp
# lấy theo loại nội dung chứ không lấy theo tên tệp người dùng gửi lên, vì tên
# tệp là do người dùng đặt và không đáng tin.
LOAI_ANH = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

# Vài byte đầu của mỗi định dạng. Kiểm tra thêm phần này để một tệp bất kỳ đổi
# tên thành .jpg không lọt qua được.
_CHU_KY = {
    ".jpg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
}

# WebP không nhận ra được chỉ bằng vài byte đầu: bốn byte "RIFF" mở đầu cho cả
# tệp âm thanh WAV lẫn video AVI. Chữ WEBP nằm ở byte thứ chín mới là dấu hiệu
# thật, nên định dạng này được xét riêng.
_WEBP_DAU = b"RIFF"
_WEBP_LOAI = b"WEBP"


class AnhKhongHopLe(Exception):
    """Tệp gửi lên không phải ảnh thuộc ba định dạng được nhận."""


class AnhQuaLon(Exception):
    """Tệp gửi lên vượt quá dung lượng cho phép."""


def kiem_tra(noi_dung: bytes, content_type: str | None) -> str:
    """Kiểm tra tệp và trả về phần mở rộng tương ứng.

    Ba lớp kiểm tra: loại nội dung phải nằm trong danh sách, dung lượng không
    vượt giới hạn, và vài byte đầu của tệp phải khớp định dạng đã khai báo.
    """
    duoi = LOAI_ANH.get((content_type or "").split(";")[0].strip().lower())
    if duoi is None:
        raise AnhKhongHopLe

    if len(noi_dung) > settings.max_avatar_bytes:
        raise AnhQuaLon
    if not noi_dung:
        raise AnhKhongHopLe

    if duoi == ".webp":
        hop_le = (
            len(noi_dung) >= 12 and noi_dung.startswith(_WEBP_DAU) and noi_dung[8:12] == _WEBP_LOAI
        )
    else:
        hop_le = any(noi_dung.startswith(chu_ky) for chu_ky in _CHU_KY[duoi])

    if not hop_le:
        raise AnhKhongHopLe
    return duoi


def duong_dan(ten_tep: str) -> Path:
    """Đường dẫn tuyệt đối tới một tệp ảnh đại diện."""
    return AVATAR_DIR / ten_tep


def luu(db: Session, user: User, noi_dung: bytes, content_type: str | None) -> str:
    """Ghi ảnh xuống đĩa rồi lưu tên tệp vào bảng người dùng.

    Tên tệp gồm mã người dùng và một chuỗi ngẫu nhiên đổi theo mỗi lần tải lên.
    Nếu tên cố định theo mã người dùng, ảnh mới trùng địa chỉ với ảnh cũ và trình
    duyệt lấy lại bản trong bộ nhớ đệm: người dùng đổi ảnh xong vẫn thấy ảnh cũ
    cho tới khi tải lại trang. Ảnh cũ được xoá ngay sau đó nên mỗi người vẫn chỉ
    chiếm đúng một tệp trên đĩa.
    """
    duoi = kiem_tra(noi_dung, content_type)
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)

    ten_tep = f"{user.id}-{secrets.token_hex(4)}{duoi}"
    duong_dan(ten_tep).write_bytes(noi_dung)
    xoa_tep_cu(user, tru=ten_tep)

    user.avatar = ten_tep
    db.commit()
    db.refresh(user)
    return ten_tep


def xoa_tep_cu(user: User, tru: str = "") -> None:
    """Xoá mọi tệp ảnh của một người dùng, trừ tệp vừa ghi."""
    if not AVATAR_DIR.is_dir():
        return

    # Bắt cả tên kiểu cũ, dạng "12.jpg", lẫn tên kiểu mới, dạng "12-a1b2c3d4.jpg".
    for tep in AVATAR_DIR.iterdir():
        cung_nguoi = tep.stem == str(user.id) or tep.stem.startswith(f"{user.id}-")
        if cung_nguoi and tep.name != tru and tep.is_file():
            tep.unlink()


def xoa(db: Session, user: User) -> None:
    """Bỏ ảnh đại diện, đưa người dùng về lại hai chữ cái đầu tên."""
    xoa_tep_cu(user)
    user.avatar = ""
    db.commit()
