"""Nghiệp vụ tài khoản: đăng ký, xác thực và đọc người dùng."""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import UserCreate


class EmailAlreadyUsed(Exception):
    """Thư điện tử đã có người dùng khác đăng ký."""


class UsernameAlreadyUsed(Exception):
    """Username đã có người dùng khác đăng ký."""


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_user_by_identifier(db: Session, identifier: str) -> User | None:
    """Tìm người dùng theo thư điện tử hoặc username, không phân biệt hoa thường."""
    normalized = identifier.strip().lower()
    return db.scalar(
        select(User).where(or_(func.lower(User.email) == normalized, User.username == normalized))
    )


def register_user(db: Session, payload: UserCreate) -> User:
    """Tạo tài khoản mới.

    Kiểm tra trùng lặp trước khi ghi để trả về thông báo cụ thể cho frontend, thay
    vì để cơ sở dữ liệu ném ra lỗi ràng buộc chung chung.
    """
    email = payload.email.strip().lower()

    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise EmailAlreadyUsed
    if db.scalar(select(User.id).where(User.username == payload.username)):
        raise UsernameAlreadyUsed

    user = User(
        email=email,
        username=payload.username,
        display_name=payload.display_name or payload.username,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Hai yêu cầu đăng ký cùng một thư điện tử có thể cùng qua được phần
        # kiểm tra ở trên rồi mới đụng nhau ở ràng buộc của cơ sở dữ liệu. Khi
        # đó vẫn phải trả về đúng lỗi trùng lặp thay vì lỗi của máy chủ.
        db.rollback()
        if db.scalar(select(User.id).where(func.lower(User.email) == email)):
            raise EmailAlreadyUsed from None
        raise UsernameAlreadyUsed from None

    db.refresh(user)
    return user


def authenticate(db: Session, identifier: str, password: str) -> User | None:
    """Kiểm tra cặp định danh và mật khẩu. Trả về None nếu không hợp lệ."""
    user = get_user_by_identifier(db, identifier)
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
