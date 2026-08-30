"""Truy vấn phần catalog: lọc, tìm kiếm và đọc chi tiết project."""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import ColumnElement, Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.chuoi import bo_dau
from app.core.config import settings
from app.models.catalog import Level, Mentor, Project, Roadmap, Skill, Track, project_skill
from app.models.enums import ProjectSort
from app.schemas.catalog import CatalogStats, LevelCount, LevelRead, TrackCount, TrackRead
from app.schemas.common import PageParams


def _khoa_chu(cot: ColumnElement[str]) -> ColumnElement[str]:
    """Khoá so sánh của một cột chữ: chữ thường, không dấu.

    SQLite được nền tảng đăng ký thêm hàm bo_dau ngay lúc mở kết nối, xem
    app/db/session.py. Các cơ sở dữ liệu khác không có hàm đó nên chỉ hạ chữ
    hoa; khi nào thật sự chạy trên một cơ sở dữ liệu khác thì mới cần bản thay
    thế tương ứng của chúng.
    """
    return func.bo_dau(cot) if settings.is_sqlite else func.lower(cot)


# Ánh xạ từng cách sắp xếp sang cột thật, để không phải ghép chuỗi SQL từ tham
# số người dùng gửi lên.
SORT_OPTIONS = {
    ProjectSort.LEVEL: (Project.level_id.asc(), Project.estimated_hours.asc()),
    ProjectSort.LEVEL_DESC: (Project.level_id.desc(), Project.estimated_hours.desc()),
    ProjectSort.HOURS: (Project.estimated_hours.asc(),),
    ProjectSort.HOURS_DESC: (Project.estimated_hours.desc(),),
    ProjectSort.POINTS: (Project.reward_points.asc(),),
    ProjectSort.POINTS_DESC: (Project.reward_points.desc(),),
    ProjectSort.NEWEST: (Project.created_at.desc(),),
    # Sắp theo khoá không dấu, nếu không thì "Ứng dụng" rơi xuống sau chữ Z.
    ProjectSort.TITLE: (_khoa_chu(Project.title).asc(),),
}
DEFAULT_SORT = ProjectSort.LEVEL

# Ba ký tự mang nghĩa riêng trong mẫu LIKE. Nếu không thoát, người gõ dấu phần
# trăm vào ô tìm kiếm sẽ nhận về toàn bộ kho project.
_KY_TU_LIKE = ("\\", "%", "_")


@dataclass(slots=True)
class ProjectFilter:
    """Tập bộ lọc của trang danh sách project."""

    levels: list[int] = field(default_factory=list)
    tracks: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    max_hours: int | None = None
    min_hours: int | None = None
    query: str | None = None
    include_unpublished: bool = False
    sort: ProjectSort = DEFAULT_SORT


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

    if filters.min_hours is not None:
        statement = statement.where(Project.estimated_hours >= filters.min_hours)

    if filters.max_hours is not None:
        statement = statement.where(Project.estimated_hours <= filters.max_hours)

    if filters.query:
        # Cả từ khoá lẫn hai cột được so khớp đều đưa về chữ thường không dấu,
        # nên gõ "nhan dang" cũng ra project tên "Nhận dạng".
        tu_khoa = bo_dau(filters.query.strip())
        for ky_tu in _KY_TU_LIKE:
            tu_khoa = tu_khoa.replace(ky_tu, f"\\{ky_tu}")
        pattern = f"%{tu_khoa}%"
        statement = statement.where(
            or_(
                _khoa_chu(Project.title).like(pattern, escape="\\"),
                _khoa_chu(Project.summary).like(pattern, escape="\\"),
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

    order_by = SORT_OPTIONS[filters.sort]
    statement = (
        _apply_filter(select(Project), filters)
        # Sắp thêm theo id để thứ tự luôn cố định giữa các trang, kể cả khi nhiều
        # project trùng khoá sắp xếp chính.
        .order_by(*order_by, Project.id.asc())
        .offset(params.offset)
        .limit(params.page_size)
    )
    return list(db.scalars(statement).all()), total


def get_published_project(db: Session, slug: str) -> Project | None:
    """Đọc một project đã xuất bản theo slug.

    Điều kiện đã xuất bản được ghép thẳng vào truy vấn thay vì kiểm tra lại ở
    từng endpoint, nhờ vậy mọi nơi dùng chung một cách hiểu về việc project nào
    được phép hiển thị.
    """
    return db.scalar(select(Project).where(Project.slug == slug, Project.is_published.is_(True)))


def get_random_project(db: Session, filters: ProjectFilter) -> Project | None:
    """Chọn ngẫu nhiên một project trong số các project khớp bộ lọc."""
    statement = _apply_filter(select(Project), filters).order_by(func.random()).limit(1)
    return db.scalar(statement)


def list_levels(db: Session) -> list[Level]:
    return list(db.scalars(select(Level).order_by(Level.id)).all())


def list_tracks(db: Session) -> list[Track]:
    return list(db.scalars(select(Track).order_by(Track.order_index, Track.name)).all())


def list_mentors(db: Session) -> list[Mentor]:
    return list(db.scalars(select(Mentor).order_by(Mentor.order_index, Mentor.name)).all())


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


def count_projects_by_level(db: Session) -> dict[int, int]:
    """Đếm số project đã xuất bản của từng level."""
    rows = db.execute(
        select(Project.level_id, func.count(Project.id))
        .where(Project.is_published.is_(True))
        .group_by(Project.level_id)
    ).all()
    return dict(rows)


def summarize_catalog(db: Session) -> CatalogStats:
    """Gom mọi số liệu tổng quan của kho project vào một phản hồi.

    Level và track nào chưa có project vẫn xuất hiện trong danh sách với số
    project bằng không, để frontend dựng đủ sáu mục lục mà không phải đoán.
    """
    by_level = count_projects_by_level(db)
    by_track = count_projects_by_track(db)

    return CatalogStats(
        projects=sum(by_level.values()),
        skills=db.scalar(select(func.count(Skill.id))) or 0,
        roadmaps=db.scalar(select(func.count(Roadmap.id))) or 0,
        by_level=[
            LevelCount(level=LevelRead.model_validate(level), projects=by_level.get(level.id, 0))
            for level in list_levels(db)
        ],
        by_track=[
            TrackCount(track=TrackRead.model_validate(track), projects=by_track.get(track.id, 0))
            for track in list_tracks(db)
        ],
    )
