"""Endpoint danh sách và chi tiết project."""

from __future__ import annotations

import unicodedata
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import Field

from app.api.deps import DbSession, OptionalUser, Paging
from app.models.enums import ProjectSort
from app.schemas.catalog import HintRead, ProjectDetail, ProjectSummary
from app.schemas.common import Page
from app.services import catalog as catalog_service
from app.services import progress as progress_service
from app.services.catalog import DEFAULT_SORT, ProjectFilter

router = APIRouter(prefix="/projects", tags=["projects"])

# Ràng buộc phải đặt vào kiểu của từng phần tử. Nếu đặt thẳng vào Query thì
# ràng buộc sẽ được áp lên cả danh sách thay vì lên từng giá trị level.
LevelValue = Annotated[int, Field(ge=0, le=5)]
# Slug trong cơ sở dữ liệu rộng nhất là 128 ký tự, chuỗi dài hơn chắc chắn không
# khớp gì mà vẫn bắt máy chủ quét cả bảng.
SlugValue = Annotated[str, Field(min_length=1, max_length=128)]

MAX_HINT_TIER = 3

# Trần của số giờ trong bộ lọc. Project dài nhất trong kho là 80 giờ, nên 1000
# giờ đã quá rộng. Trần này còn chặn được những con số vượt ngoài dải số nguyên
# mà SQLite xử lý được, vốn làm truy vấn hỏng và trả về lỗi 500.
MAX_FILTER_HOURS = 1000


def _chuan_hoa_tu_khoa(q: str | None) -> str | None:
    """Đưa từ khoá về dạng so sánh được, và chặn từ khoá không có nội dung.

    Pydantic chỉ đo độ dài thô, nên chuỗi toàn khoảng trắng lọt qua kiểm tra
    "ít nhất 1 ký tự" rồi khớp với cả kho, trong khi chuỗi rỗng bị 422. Ký tự NUL
    thì làm SQLite cắt mẫu LIKE ngay tại đó, nên "nhan<NUL>zzzz" khớp như
    "nhan". Dạng NFC để chữ có dấu gõ kiểu tổ hợp cũng tìm được như gõ kiểu
    dựng sẵn.
    """
    if q is None:
        return None
    q = unicodedata.normalize("NFC", q).replace("\x00", "").strip()
    if not q:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Phần từ khoá tìm kiếm phải có ít nhất 1 ký tự.",
        )
    return q


def _kiem_tra_khoang_gio(min_hours: int | None, max_hours: int | None) -> None:
    """Chặn khoảng thời gian không thể có project nào rơi vào.

    Hai tham số này hợp lệ khi đứng riêng, nên Pydantic không bắt được. Nếu để
    lọt thì API trả về danh sách rỗng kèm mã 200, và người gọi tưởng kho không
    có project nào thay vì hiểu rằng mình đã gõ nhầm khoảng thời gian.
    """
    if min_hours is not None and max_hours is not None and min_hours > max_hours:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Thời gian tối thiểu đang lớn hơn thời gian tối đa.",
        )


@router.get("", response_model=Page[ProjectSummary])
def list_projects(
    db: DbSession,
    paging: Paging,
    level: Annotated[list[LevelValue] | None, Query(description="Lọc theo level.")] = None,
    track: Annotated[list[SlugValue] | None, Query(description="Lọc theo slug của track.")] = None,
    skill: Annotated[list[SlugValue] | None, Query(description="Lọc theo slug của skill.")] = None,
    min_hours: Annotated[
        int | None, Query(ge=1, le=MAX_FILTER_HOURS, description="Thời gian tối thiểu.")
    ] = None,
    max_hours: Annotated[
        int | None, Query(ge=1, le=MAX_FILTER_HOURS, description="Thời gian tối đa.")
    ] = None,
    q: Annotated[str | None, Query(min_length=1, max_length=100, description="Từ khoá.")] = None,
    sort: Annotated[ProjectSort, Query(description="Cách sắp xếp.")] = DEFAULT_SORT,
) -> Page[ProjectSummary]:
    """Trả về một trang project theo bộ lọc.

    Mọi tham số lọc đều nhận nhiều giá trị, ví dụ level=0&level=1 nghĩa là lấy
    project ở cả hai level. Giá trị sort nằm ngoài danh sách cho phép bị chặn
    ngay ở bước kiểm tra tham số và trả về lỗi 422.
    """
    _kiem_tra_khoang_gio(min_hours, max_hours)
    filters = ProjectFilter(
        levels=level or [],
        tracks=track or [],
        skills=skill or [],
        min_hours=min_hours,
        max_hours=max_hours,
        query=_chuan_hoa_tu_khoa(q),
        sort=sort,
    )
    items, total = catalog_service.list_projects(db, filters, paging)
    return Page[ProjectSummary].create(
        [ProjectSummary.model_validate(item) for item in items], total, paging
    )


@router.get("/random", response_model=ProjectSummary)
def get_random_project(
    db: DbSession,
    user: OptionalUser,
    level: Annotated[list[LevelValue] | None, Query(description="Lọc theo level.")] = None,
    track: Annotated[list[SlugValue] | None, Query(description="Lọc theo slug của track.")] = None,
    max_hours: Annotated[
        int | None, Query(ge=1, le=MAX_FILTER_HOURS, description="Thời gian tối đa.")
    ] = None,
) -> ProjectSummary:
    """Chọn ngẫu nhiên một project, dùng cho nút chọn giúp một project trên trang chủ.

    Gọi kèm token thì project được chọn phải vừa sức người đó: chưa hoàn thành,
    đã mở khoá và không cao hơn một level so với level cao nhất đã hoàn thành,
    trừ khi tham số level được chỉ rõ. Gọi ẩn danh thì chỉ theo bộ lọc gửi lên.
    """
    filters = ProjectFilter(levels=level or [], tracks=track or [], max_hours=max_hours)
    if user is not None:
        project = progress_service.random_suitable_project(db, user, filters)
    else:
        project = catalog_service.get_random_project(db, filters)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không có project nào khớp bộ lọc.",
        )
    return ProjectSummary.model_validate(project)


@router.get("/{slug}", response_model=ProjectDetail)
def get_project(slug: str, db: DbSession) -> ProjectDetail:
    """Đọc chi tiết một project theo slug."""
    project = catalog_service.get_published_project(db, slug)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy project.")
    return ProjectDetail.model_validate(project)


@router.get("/{slug}/hints", response_model=list[HintRead])
def list_hints(
    slug: str,
    db: DbSession,
    max_tier: Annotated[
        int,
        Query(ge=1, le=MAX_HINT_TIER, description="Tầng gợi ý cao nhất muốn xem."),
    ] = 1,
) -> list[HintRead]:
    """Trả về gợi ý của project, tối đa tới tầng người gọi yêu cầu.

    Gợi ý là công khai và tầng cao nhất do người gọi chọn, không cần đăng nhập.
    Việc mở dần từng tầng là cách giao diện dẫn người học, không phải một chốt
    chặn của backend: ai muốn xem cả ba tầng vẫn xem được.
    """
    project = catalog_service.get_published_project(db, slug)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy project.")
    return [HintRead.model_validate(hint) for hint in project.hints if hint.tier <= max_tier]
