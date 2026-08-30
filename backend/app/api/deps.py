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
from app.schemas.common import MAX_SO_NGUYEN, PageParams
from app.services import auth as auth_service

# auto_error=False để tự quyết định nội dung thông báo lỗi, thay vì dùng câu
# tiếng Anh mặc định của FastAPI.
bearer_scheme = HTTPBearer(auto_error=False, description="Token lấy từ /auth/login.")

DbSession = Annotated[Session, Depends(get_db)]
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]


def _credentials_error() -> HTTPException:
    """Lỗi dùng chung cho mọi trường hợp token thiếu, sai hoặc đã hết hạn."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token không hợp lệ hoặc đã hết hạn.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(db: DbSession, credentials: Credentials) -> User:
    """Lấy người dùng đang đăng nhập. Báo lỗi 401 nếu token không dùng được.

    Mọi trường hợp hỏng đều trả về cùng một thông báo, để người gọi không suy ra
    được tài khoản nào đang tồn tại từ sự khác nhau giữa các câu báo lỗi.
    """
    if credentials is None:
        raise _credentials_error()

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise _credentials_error()

    user = auth_service.get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise _credentials_error()
    return user


def get_current_mentor(user: Annotated[User, Depends(get_current_user)]) -> User:
    """Chỉ cho qua nếu người dùng là giảng viên.

    Việc chấm bài thuộc về giảng viên, nên mọi endpoint liên quan tới chấm bài
    đều đi qua đây. Sinh viên gọi vào sẽ nhận lỗi 403.
    """
    if not user.is_mentor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chức năng này chỉ dành cho tài khoản giảng viên.",
        )
    return user


def get_page_params(
    page: Annotated[
        int, Query(ge=1, le=MAX_SO_NGUYEN, description="Số thứ tự trang, bắt đầu từ 1.")
    ] = 1,
    page_size: Annotated[
        int | None,
        Query(ge=1, le=settings.max_page_size, description="Số bản ghi mỗi trang."),
    ] = None,
) -> PageParams:
    """Đọc tham số phân trang từ chuỗi truy vấn."""
    return PageParams(page=page, page_size=page_size or settings.default_page_size)


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentMentor = Annotated[User, Depends(get_current_mentor)]
Paging = Annotated[PageParams, Depends(get_page_params)]
