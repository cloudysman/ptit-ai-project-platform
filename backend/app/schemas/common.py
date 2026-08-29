"""Schema dùng chung: phân trang và thông báo lỗi."""

from __future__ import annotations

from math import ceil

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    """Lớp cơ sở cho mọi schema đọc dữ liệu trực tiếp từ model SQLAlchemy."""

    model_config = ConfigDict(from_attributes=True)


class PageParams(BaseModel):
    """Tham số phân trang dùng chung cho mọi API trả về danh sách."""

    page: int = Field(default=1, ge=1, description="Số thứ tự trang, bắt đầu từ 1.")
    page_size: int = Field(default=20, ge=1, le=100, description="Số bản ghi mỗi trang.")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class Page[T](BaseModel):
    """Một trang kết quả kèm thông tin để frontend dựng thanh phân trang."""

    items: list[T]
    total: int = Field(description="Tổng số bản ghi khớp bộ lọc.")
    page: int
    page_size: int
    pages: int = Field(description="Tổng số trang.")

    @classmethod
    def create(cls, items: list[T], total: int, params: PageParams) -> Page[T]:
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            pages=ceil(total / params.page_size) if params.page_size else 0,
        )


class Message(BaseModel):
    """Phản hồi chỉ gồm một câu thông báo."""

    detail: str
