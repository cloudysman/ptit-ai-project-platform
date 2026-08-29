"""Truy vấn phần catalog: lọc, tìm kiếm và đọc chi tiết project."""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models.catalog import Level, Project, Roadmap, Skill, Track, project_skill
from app.models.enums import ProjectType
from app.schemas.common import PageParams

# Các cách sắp xếp được phép, ánh xạ sang cột thật để không phải ghép chuỗi SQL.
SORT_OPTIONS = {
    "level": (Project.level_id.asc(), Project.estimated_hours.asc()),
    "-level": (Project.level_id.desc(), Project.estimated_hours.desc()),
    "hours": (Project.estimated_hours.asc(),),
    "-hours": (Project.estimated_hours.desc(),),
    "xp": (Project.xp_reward.asc(),),
    "-xp": (Project.xp_reward.desc(),),
    "newest": (Project.created_at.desc(),),
    "title": (Project.title.asc(),),
}
DEFAULT_SORT = "level"


@dataclass(slots=True)
class ProjectFilter:
    """Tập bộ lọc của trang danh sách project."""

    levels: list[int] = field(default_factory=list)
    tracks: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    project_types: list[ProjectType] = field(default_factory=list)
    max_hours: int | None = None
    min_hours: int | None = None
    query: str | None = None
    include_unpublished: bool = False
    sort: str = DEFAULT_SORT


def _apply_filter(statement: Select, filters: ProjectFilter) -> Select:
    """Gắn mọi điều kiện lọc vào một câu lệnh select đã có sẵn."""
    if not filters.include_unpublished:
        statement = statement.where(Project.is_published.is_(True))

    if filters.levels:
        statement = statement.where(Project.level_id.in_(filters.levels))

    if filters.tracks:
        statement = statement.where(
            Project.track_id.in_(select(Track.id).where(Track.slug.in_(filters.tracks)))
        )

    if filters.skills:
        # Dùng truy vấn con thay vì join để tránh nhân bản dòng khi một project
        # khớp nhiều skill cùng lúc.
        statement = statement.where(
            Project.id.in_(
                select(project_skill.c.project_id)
                .join(Skill, Skill.id == project_skill.c.skill_id)
                .where(Skill.slug.in_(filters.skills))
            )
        )

    if filters.project_types:
        statement = statement.where(Project.project_type.in_(filters.project_types))

    if filters.min_hours is not None:
        statement = statement.where(Project.estimated_hours >= filters.min_hours)

    if filters.max_hours is not None:
        statement = statement.where(Project.estimated_hours <= filters.max_hours)

    if filters.query:
        pattern = f"%{filters.query.strip().lower()}%"
        statement = statement.where(
            or_(
                func.lower(Project.title).like(pattern),
                func.lower(Project.summary).like(pattern),
            )
        )

    return statement


def list_projects(
    db: Session, filters: ProjectFilter, params: PageParams
) -> tuple[list[Project], int]:
    """Trả về một trang project cùng tổng số project khớp bộ lọc."""
    total = db.scalar(_apply_filter(select(func.count(Project.id)), filters)) or 0
    if total == 0:
        return [], 0

    order_by = SORT_OPTIONS.get(filters.sort, SORT_OPTIONS[DEFAULT_SORT])
    statement = (
        _apply_filter(select(Project), filters)
        # Sắp thêm theo id để thứ tự luôn cố định giữa các trang, kể cả khi nhiều
        # project trùng khoá sắp xếp chính.
        .order_by(*order_by, Project.id.asc())
        .offset(params.offset)
        .limit(params.page_size)
    )
    return list(db.scalars(statement).all()), total


def get_project_by_slug(db: Session, slug: str) -> Project | None:
    """Đọc một project theo slug, kèm danh sách project tiên quyết."""
    return db.scalar(select(Project).where(Project.slug == slug))


def get_random_project(db: Session, filters: ProjectFilter) -> Project | None:
    """Chọn ngẫu nhiên một project trong số các project khớp bộ lọc."""
    statement = _apply_filter(select(Project), filters).order_by(func.random()).limit(1)
    return db.scalar(statement)


def list_levels(db: Session) -> list[Level]:
    return list(db.scalars(select(Level).order_by(Level.id)).all())


def list_tracks(db: Session) -> list[Track]:
    return list(db.scalars(select(Track).order_by(Track.order_index, Track.name)).all())


def list_skills(db: Session) -> list[Skill]:
    return list(db.scalars(select(Skill).order_by(Skill.name)).all())


def list_roadmaps(db: Session) -> list[Roadmap]:
    return list(db.scalars(select(Roadmap).order_by(Roadmap.name)).all())


def get_roadmap_by_slug(db: Session, slug: str) -> Roadmap | None:
    return db.scalar(select(Roadmap).where(Roadmap.slug == slug))


def count_projects_by_track(db: Session) -> dict[int, int]:
    """Đếm số project đã xuất bản của từng track, dùng cho trang tiến độ."""
    rows = db.execute(
        select(Project.track_id, func.count(Project.id))
        .where(Project.is_published.is_(True))
        .group_by(Project.track_id)
    ).all()
    return dict(rows)
