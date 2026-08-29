"""Schema của phần tài khoản và đăng nhập."""

from __future__ import annotations

import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import MAX_PASSWORD_BYTES
from app.schemas.common import ORMModel

USERNAME_PATTERN = re.compile(r"^[a-z0-9_]{3,50}$")


class _PasswordField(BaseModel):
    password: str = Field(min_length=8, max_length=64)

    @field_validator("password")
    @classmethod
    def check_byte_length(cls, value: str) -> str:
        """Chặn mật khẩu dài quá giới hạn của bcrypt.

        Giới hạn tính theo byte chứ không theo ký tự, vì một ký tự tiếng Việt có
        dấu chiếm tới ba byte khi mã hoá UTF-8.
        """
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError(f"Mật khẩu quá dài, tối đa {MAX_PASSWORD_BYTES} byte.")
        return value


class UserCreate(_PasswordField):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    display_name: str = Field(default="", max_length=100)

    @field_validator("username")
    @classmethod
    def check_username(cls, value: str) -> str:
        """Chuẩn hoá username về chữ thường và giới hạn tập ký tự cho phép."""
        value = value.strip().lower()
        if not USERNAME_PATTERN.fullmatch(value):
            raise ValueError("Username chỉ gồm chữ thường, chữ số và dấu gạch dưới.")
        return value


class UserLogin(BaseModel):
    # Cho phép đăng nhập bằng email hoặc username để đỡ phải nhớ mình dùng cái nào.
    identifier: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=64)


class UserRead(ORMModel):
    id: int
    # Kiểu chuỗi thường chứ không phải EmailStr. Email đã được kiểm tra ở lúc đăng
    # ký, kiểm tra lại lúc đọc ra chỉ khiến API hỏng khi cơ sở dữ liệu có sẵn một
    # bản ghi cũ không qua được bộ kiểm tra hiện tại.
    email: str
    username: str
    display_name: str
    total_xp: int
    is_admin: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Số giây token còn hiệu lực.")
    user: UserRead
