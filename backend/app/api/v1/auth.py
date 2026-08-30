"""Endpoint đăng ký, đăng nhập và đọc tài khoản đang đăng nhập."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import CurrentUser, DbSession
from app.core.security import create_access_token
from app.schemas.auth import Token, UserCreate, UserLogin, UserRead
from app.services import auth as auth_service
from app.services import chan_doan_mat_khau as chan_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: DbSession) -> Token:
    """Tạo tài khoản mới và trả về token luôn, để người dùng không phải đăng nhập lại."""
    try:
        user = auth_service.register_user(db, payload)
    except auth_service.EmailAlreadyUsed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Thư điện tử này đã được đăng ký."
        ) from None
    except auth_service.UsernameAlreadyUsed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Username này đã được đăng ký."
        ) from None

    token, expires_in = create_access_token(user.id)
    return Token(access_token=token, expires_in=expires_in, user=UserRead.model_validate(user))


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: DbSession, request: Request) -> Token:
    """Đăng nhập bằng email hoặc username.

    Sai quá số lần cho phép trong một khoảng thời gian ngắn thì tài khoản đó tạm
    thời không nhận thêm lần thử nào nữa. Không có chốt này, một chương trình dò
    mật khẩu thử được vài lần mỗi giây mà không gặp trở ngại nào.
    """
    dia_chi = request.client.host if request.client else "khong-ro"

    con_cho = chan_service.con_phai_cho(payload.identifier, dia_chi)
    if con_cho > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Đã nhập sai quá nhiều lần. Chờ khoảng "
                f"{max(1, round(con_cho / 60))} phút rồi thử lại."
            ),
            headers={"Retry-After": str(con_cho)},
        )

    user = auth_service.authenticate(db, payload.identifier, payload.password)
    if user is None:
        chan_service.ghi_lan_sai(payload.identifier, dia_chi)
        # Không nói rõ sai ở đâu, để tránh lộ thông tin tài khoản nào đang tồn tại.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thông tin đăng nhập không đúng.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    chan_service.xoa_lan_sai(payload.identifier, dia_chi)
    token, expires_in = create_access_token(user.id)
    return Token(access_token=token, expires_in=expires_in, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def read_me(user: CurrentUser) -> UserRead:
    """Đọc thông tin tài khoản đang đăng nhập."""
    return UserRead.model_validate(user)
