"""Các dependency dùng chung cho tầng API."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import PageParams
from app.services import auth as auth_service

# auto_error=False để tự quyết định thông báo lỗi, và để dùng lại đúng scheme này
# cho các endpoint không bắt buộc đăng nhập.
bearer_scheme = HTTPBearer(auto_error=False, description="Token lấy từ /auth/login.")

DbSession = Annotated[Session, Depends(get_db)]
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]

CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Token không hợp lệ hoặc đã hết hạn.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(db: DbSession, credentials: Credentials) -> User:
    """Lấy người dùng đang đăng nhập. Báo lỗi 401 nếu token không dùng được."""
    if credentials is None:
        raise CREDENTIALS_ERROR

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise CREDENTIALS_ERROR

    user = auth_service.get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise CREDENTIALS_ERROR
    return user


def get_optional_user(db: DbSession, credentials: Credentials) -> User | None:
    """Như get_current_user nhưng trả về None thay vì báo lỗi khi chưa đăng nhập."""
    if credentials is None:
        return None
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        return None
    user = auth_service.get_user_by_id(db, user_id)
    return user if user is not None and user.is_active else None


def get_current_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    """Chỉ cho qua nếu người dùng có quyền quản trị."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chức năng này chỉ dành cho tài khoản quản trị.",
        )
    return user


def get_page_params(
    page: Annotated[int, Query(ge=1, description="Số thứ tự trang, bắt đầu từ 1.")] = 1,
    page_size: Annotated[
        int | None, Query(ge=1, le=100, description="Số bản ghi mỗi trang.")
    ] = None,
) -> PageParams:
    """Đọc tham số phân trang từ chuỗi truy vấn."""
    return PageParams(page=page, page_size=page_size or settings.default_page_size)


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
CurrentAdmin = Annotated[User, Depends(get_current_admin)]
Paging = Annotated[PageParams, Depends(get_page_params)]
