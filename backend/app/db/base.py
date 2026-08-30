"""Lớp cơ sở của mọi model, kiểu thời gian dùng chung và quy ước đặt tên ràng buộc."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, Dialect, MetaData, TypeDecorator
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


class UtcDateTime(TypeDecorator[datetime]):
    """Cột thời gian luôn ghi và đọc theo UTC, luôn kèm thông tin múi giờ.

    SQLite không có kiểu thời gian riêng nên phần múi giờ bị mất khi ghi xuống
    đĩa. Nếu để nguyên, API trả về chuỗi dạng 2026-08-29T10:08:36 không có hậu
    tố Z, và frontend sẽ hiểu đó là giờ địa phương rồi hiển thị lệch đúng bằng
    chênh lệch múi giờ, ở Việt Nam là bảy giờ. Lớp này gắn lại UTC ở cả hai
    chiều nên mọi mốc thời gian ra khỏi API đều tự mô tả đầy đủ.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        """Quy mọi giá trị ghi xuống cơ sở dữ liệu về UTC."""
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        """Gắn lại UTC cho giá trị đọc lên từ cơ sở dữ liệu."""
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    """Hai cột thời gian dùng chung cho các bảng cần theo dõi thời điểm thay đổi."""

    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=utcnow, onupdate=utcnow, nullable=False
    )
