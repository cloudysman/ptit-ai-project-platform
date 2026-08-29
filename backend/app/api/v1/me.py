"""Endpoint dành riêng cho người dùng đang đăng nhập."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession, Paging
from app.core.config import settings
from app.models.enums import SubmissionStatus
from app.schemas.catalog import ProjectSummary, RecommendedProject
from app.schemas.common import Page
from app.schemas.progress import ProgressSummary, SubmissionRead, UserBadgeRead
from app.services import badges as badge_service
from app.services import progress as progress_service
from app.services import recommendation as recommendation_service

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/progress", response_model=ProgressSummary)
def read_progress(user: CurrentUser, db: DbSession) -> ProgressSummary:
    """Tổng hợp tiến độ: XP, số project đã hoàn thành, tiến độ theo track và badge."""
    return ProgressSummary.model_validate(progress_service.summarize(db, user))


@router.get("/submissions", response_model=Page[SubmissionRead])
def list_submissions(
    user: CurrentUser,
    db: DbSession,
    paging: Paging,
    status: Annotated[SubmissionStatus | None, Query(description="Lọc theo trạng thái.")] = None,
) -> Page[SubmissionRead]:
    """Danh sách bài nộp của chính người dùng đang đăng nhập."""
    items, total = progress_service.list_submissions(db, user.id, paging, status)
    return Page[SubmissionRead].create(
        [SubmissionRead.model_validate(item) for item in items], total, paging
    )


@router.get("/badges", response_model=list[UserBadgeRead])
def list_badges(user: CurrentUser, db: DbSession) -> list[UserBadgeRead]:
    """Danh sách badge người dùng đã đạt được."""
    return [UserBadgeRead.model_validate(item) for item in badge_service.list_user_badges(db, user)]


@router.get("/recommendations", response_model=list[RecommendedProject])
def list_recommendations(
    user: CurrentUser,
    db: DbSession,
    limit: Annotated[int | None, Query(ge=1, le=50, description="Số project muốn nhận.")] = None,
) -> list[RecommendedProject]:
    """Gợi ý project nên làm tiếp, đã lọc bỏ project chưa mở khoá."""
    effective_limit = limit or settings.recommendation_limit
    items = recommendation_service.recommend(db, user, effective_limit)
    return [
        RecommendedProject(
            project=ProjectSummary.model_validate(item.project),
            score=item.score,
            reason=item.reason,
        )
        for item in items
    ]
