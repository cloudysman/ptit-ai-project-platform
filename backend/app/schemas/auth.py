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
    # Giới hạn 255 ký tự lấy đúng theo độ rộng cột email trong bảng user. SQLite
    # không cưỡng chế độ rộng cột, nên nếu không chặn ở đây thì một địa chỉ quá
    # dài vẫn ghi được, và chỉ hỏng khi đổi sang MySQL hoặc PostgreSQL.
    email: EmailStr = Field(max_length=255)
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

    @field_validator("display_name")
    @classmethod
    def strip_display_name(cls, value: str) -> str:
        """Bỏ khoảng trắng thừa ở hai đầu tên hiển thị.

        Không chuẩn hoá thì một cái tên gồm toàn dấu cách vẫn được coi là có
        giá trị, và giao diện hiển thị ra một khoảng trống thay vì tên người
        dùng. Sau khi cắt, chuỗi rỗng sẽ được thay bằng username lúc tạo tài khoản.
        """
        return value.strip()


class UserLogin(BaseModel):
    # Cho phép đăng nhập bằng thư điện tử hoặc username để đỡ phải nhớ mình dùng
    # cái nào.
    identifier: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=64)

    @field_validator("identifier")
    @classmethod
    def strip_identifier(cls, value: str) -> str:
        """Cắt khoảng trắng hai đầu, thường do người dùng dán nhầm cả dấu cách."""
        value = value.strip()
        if not value:
            raise ValueError("Cần điền thư điện tử hoặc username.")
        return value


class UserRead(ORMModel):
    id: int
    # Kiểu chuỗi thường chứ không phải EmailStr. Thư điện tử đã được kiểm tra lúc
    # đăng ký, kiểm tra lại lúc đọc ra chỉ khiến API hỏng khi cơ sở dữ liệu có
    # sẵn một bản ghi cũ không qua được bộ kiểm tra hiện tại.
    email: str
    username: str
    display_name: str
    avatar: str = Field(default="", description="Tên tệp ảnh đại diện, rỗng nếu chưa có.")
    total_points: int
    is_mentor: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Số giây token còn hiệu lực.")
    user: UserRead
