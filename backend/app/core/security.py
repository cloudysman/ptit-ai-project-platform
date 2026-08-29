"""Băm mật khẩu và phát hành token truy cập."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import settings
from app.db.base import utcnow

# bcrypt chỉ xử lý tối đa 72 byte đầu của mật khẩu. Kiểm tra trước và báo lỗi rõ
# ràng, thay vì im lặng cắt bớt rồi tạo ra một mật khẩu khác với mật khẩu người
# dùng nhập.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    """Băm mật khẩu bằng bcrypt và trả về chuỗi để lưu vào cơ sở dữ liệu."""
    raw = password.encode("utf-8")
    if len(raw) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Mật khẩu vượt quá {MAX_PASSWORD_BYTES} byte sau khi mã hoá UTF-8.")
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """So khớp mật khẩu với chuỗi băm đã lưu."""
    raw = password.encode("utf-8")
    if len(raw) > MAX_PASSWORD_BYTES:
        return False
    try:
        return bcrypt.checkpw(raw, hashed_password.encode("utf-8"))
    except ValueError:
        # Chuỗi băm trong cơ sở dữ liệu bị hỏng định dạng.
        return False


def create_access_token(user_id: int, ttl: timedelta | None = None) -> tuple[str, int]:
    """Tạo token truy cập cho một người dùng.

    Trả về cặp gồm token và số giây token còn hiệu lực, để phía frontend biết khi
    nào cần đăng nhập lại mà không phải tự giải mã token.
    """
    ttl = ttl or timedelta(minutes=settings.access_token_ttl_minutes)
    issued_at = utcnow()
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": issued_at,
        "exp": issued_at + ttl,
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token, int(ttl.total_seconds())


def decode_access_token(token: str) -> int | None:
    """Đọc token và trả về id người dùng. Trả về None nếu token không hợp lệ."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        return None
