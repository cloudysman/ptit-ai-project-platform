"""Schema dùng chung: phân trang và thông báo lỗi."""

from __future__ import annotations

from math import ceil

from pydantic import BaseModel, ConfigDict, Field

from app.core.config import settings


class ORMModel(BaseModel):
    """Lớp cơ sở cho mọi schema đọc dữ liệu trực tiếp từ model SQLAlchemy."""

    model_config = ConfigDict(from_attributes=True)


# Trần của mọi số nguyên nhận từ bên ngoài. SQLite chỉ lưu số nguyên 64 bit, nên
# một con số lớn hơn thế đi tới tầng truy vấn sẽ làm câu lệnh hỏng và người gọi
# nhận về lỗi 500 kèm câu tiếng Anh. Chặn ngay ở tầng kiểm tra dữ liệu thì lỗi
# thành 422 với một câu tiếng Việt, giống mọi giá trị sai khác.
MAX_SO_NGUYEN = 2**31 - 1


class PageParams(BaseModel):
    """Tham số phân trang dùng chung cho mọi API trả về danh sách."""

    page: int = Field(
        default=1, ge=1, le=MAX_SO_NGUYEN, description="Số thứ tự trang, bắt đầu từ 1."
    )
    # Giới hạn lấy từ cấu hình để chỉ phải sửa một chỗ khi muốn đổi.
    page_size: int = Field(
        default=settings.default_page_size,
        ge=1,
        le=settings.max_page_size,
        description="Số bản ghi mỗi trang.",
    )

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
