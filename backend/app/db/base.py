"""Lớp cơ sở của mọi model và quy ước đặt tên ràng buộc."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, MetaData
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Đặt tên ràng buộc theo một quy ước cố định để công cụ sinh migration về sau
# luôn tạo ra cùng một tên, không phụ thuộc vào cơ sở dữ liệu đang dùng.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def utcnow() -> datetime:
    """Thời điểm hiện tại theo UTC, luôn kèm thông tin múi giờ."""
    return datetime.now(UTC)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    """Hai cột thời gian dùng chung cho các bảng cần theo dõi thời điểm thay đổi."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
