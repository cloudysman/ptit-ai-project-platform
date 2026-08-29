"""Model tài khoản người dùng."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:  # pragma: no cover - chỉ phục vụ công cụ kiểm tra kiểu
    from app.models.progress import Submission, UserBadge


class User(Base, TimestampMixin):
    """Tài khoản của một người dùng trên nền tảng."""

    __tablename__ = "user"
    __table_args__ = (CheckConstraint("total_xp >= 0", name="non_negative_total_xp"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Tổng XP được cộng dồn ngay khi một bài nộp được duyệt. Lưu sẵn ở đây để
    # bảng xếp hạng chỉ phải đọc một cột thay vì cộng lại toàn bộ bài nộp.
    total_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)

    submissions: Mapped[list[Submission]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="Submission.user_id",
    )
    badges: Mapped[list[UserBadge]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
