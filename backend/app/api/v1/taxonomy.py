"""Endpoint đọc level, track, skill và lộ trình."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.deps import DbSession
from app.schemas.catalog import (
    LevelRead,
    MentorRead,
    RoadmapDetail,
    RoadmapSummary,
    SkillRead,
    TrackRead,
)
from app.services import catalog as catalog_service

router = APIRouter(tags=["taxonomy"])


@router.get("/levels", response_model=list[LevelRead])
def list_levels(db: DbSession) -> list[LevelRead]:
    """Sáu level của nền tảng, sắp theo thứ tự từ dễ đến khó."""
    return [LevelRead.model_validate(item) for item in catalog_service.list_levels(db)]


@router.get("/tracks", response_model=list[TrackRead])
def list_tracks(db: DbSession) -> list[TrackRead]:
    """Danh sách track."""
    return [TrackRead.model_validate(item) for item in catalog_service.list_tracks(db)]


@router.get("/mentors", response_model=list[MentorRead])
def list_mentors(db: DbSession) -> list[MentorRead]:
    """Danh sách giảng viên phụ trách, dùng cho mục nhân sự của giao diện."""
    return [MentorRead.model_validate(item) for item in catalog_service.list_mentors(db)]


@router.get("/skills", response_model=list[SkillRead])
def list_skills(db: DbSession) -> list[SkillRead]:
    """Danh sách skill, dùng cho bộ lọc trên trang danh sách project."""
    return [SkillRead.model_validate(item) for item in catalog_service.list_skills(db)]


@router.get("/roadmaps", response_model=list[RoadmapSummary])
def list_roadmaps(db: DbSession) -> list[RoadmapSummary]:
    """Danh sách lộ trình nghề nghiệp."""
    return [RoadmapSummary.model_validate(item) for item in catalog_service.list_roadmaps(db)]


@router.get("/roadmaps/{slug}", response_model=RoadmapDetail)
def get_roadmap(slug: str, db: DbSession) -> RoadmapDetail:
    """Đọc một lộ trình kèm toàn bộ project theo đúng thứ tự."""
    roadmap = catalog_service.get_roadmap_by_slug(db, slug)
    if roadmap is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lộ trình."
        )
    return RoadmapDetail.model_validate(roadmap)
