"""Endpoint danh sách và chi tiết project."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import Field

from app.api.deps import DbSession, Paging
from app.models.enums import ProjectType
from app.schemas.catalog import HintRead, ProjectDetail, ProjectSummary
from app.schemas.common import Page
from app.services import catalog as catalog_service
from app.services.catalog import SORT_OPTIONS, ProjectFilter

router = APIRouter(prefix="/projects", tags=["projects"])

# Ràng buộc phải đặt vào kiểu của từng phần tử. Nếu đặt thẳng vào Query thì
# ràng buộc sẽ được áp lên cả danh sách thay vì lên từng giá trị level.
LevelValue = Annotated[int, Field(ge=0, le=5)]


def _build_filter(
    level: list[int] | None,
    track: list[str] | None,
    skill: list[str] | None,
    project_type: list[ProjectType] | None,
    min_hours: int | None,
    max_hours: int | None,
    q: str | None,
    sort: str,
) -> ProjectFilter:
    """Gom các tham số truy vấn thành một bộ lọc."""
    return ProjectFilter(
        levels=level or [],
        tracks=track or [],
        skills=skill or [],
        project_types=project_type or [],
        min_hours=min_hours,
        max_hours=max_hours,
        query=q,
        sort=sort,
    )


@router.get("", response_model=Page[ProjectSummary])
def list_projects(
    db: DbSession,
    paging: Paging,
    level: Annotated[list[LevelValue] | None, Query(description="Lọc theo level.")] = None,
    track: Annotated[list[str] | None, Query(description="Lọc theo slug của track.")] = None,
    skill: Annotated[list[str] | None, Query(description="Lọc theo slug của skill.")] = None,
    project_type: Annotated[list[ProjectType] | None, Query(description="Lọc theo quy mô.")] = None,
    min_hours: Annotated[int | None, Query(ge=1, description="Thời gian tối thiểu.")] = None,
    max_hours: Annotated[int | None, Query(ge=1, description="Thời gian tối đa.")] = None,
    q: Annotated[str | None, Query(min_length=1, max_length=100, description="Từ khoá.")] = None,
    sort: Annotated[str, Query(description=f"Một trong: {', '.join(SORT_OPTIONS)}.")] = "level",
) -> Page[ProjectSummary]:
    """Trả về một trang project theo bộ lọc.

    Mọi tham số lọc đều nhận nhiều giá trị, ví dụ level=0&level=1 nghĩa là lấy
    project ở cả hai level.
    """
    if sort not in SORT_OPTIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Giá trị sort không hợp lệ. Chọn một trong: {', '.join(SORT_OPTIONS)}.",
        )

    filters = _build_filter(level, track, skill, project_type, min_hours, max_hours, q, sort)
    items, total = catalog_service.list_projects(db, filters, paging)
    return Page[ProjectSummary].create(
        [ProjectSummary.model_validate(item) for item in items], total, paging
    )


@router.get("/random", response_model=ProjectSummary)
def get_random_project(
    db: DbSession,
    level: Annotated[list[LevelValue] | None, Query(description="Lọc theo level.")] = None,
    track: Annotated[list[str] | None, Query(description="Lọc theo slug của track.")] = None,
    max_hours: Annotated[int | None, Query(ge=1)] = None,
) -> ProjectSummary:
    """Chọn ngẫu nhiên một project, dùng cho nút gợi ý nhanh trên trang chủ."""
    filters = ProjectFilter(levels=level or [], tracks=track or [], max_hours=max_hours)
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
    project = catalog_service.get_project_by_slug(db, slug)
    if project is None or not project.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy project.")
    return ProjectDetail.model_validate(project)


@router.get("/{slug}/hints", response_model=list[HintRead])
def list_hints(
    slug: str,
    db: DbSession,
    max_tier: Annotated[int, Query(ge=1, le=3, description="Tầng gợi ý cao nhất muốn xem.")] = 1,
) -> list[HintRead]:
    """Trả về gợi ý của project, tối đa tới tầng người dùng yêu cầu.

    Việc cắt theo tầng được làm ở phía backend để người dùng không thể xem hết
    gợi ý chỉ bằng cách sửa giao diện.
    """
    project = catalog_service.get_project_by_slug(db, slug)
    if project is None or not project.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy project.")
    return [HintRead.model_validate(hint) for hint in project.hints if hint.tier <= max_tier]
