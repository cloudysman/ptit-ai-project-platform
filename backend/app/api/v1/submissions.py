"""Endpoint nộp bài và chấm bài."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import CurrentAdmin, CurrentUser, DbSession
from app.models.progress import Submission
from app.schemas.progress import BadgeRead, SubmissionCreate, SubmissionRead, SubmissionReview
from app.services import catalog as catalog_service
from app.services import progress as progress_service

router = APIRouter(tags=["submissions"])


class ReviewResult(BaseModel):
    """Kết quả chấm bài, kèm các badge vừa được cấp cho người dùng."""

    submission: SubmissionRead
    awarded_badges: list[BadgeRead]


@router.post(
    "/projects/{slug}/submissions",
    response_model=SubmissionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_submission(
    slug: str, payload: SubmissionCreate, user: CurrentUser, db: DbSession
) -> SubmissionRead:
    """Nộp kết quả cho một project."""
    project = catalog_service.get_project_by_slug(db, slug)
    if project is None or not project.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy project.")

    try:
        submission = progress_service.create_submission(db, user, project, payload)
    except progress_service.ProjectAlreadyCompleted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bạn đã hoàn thành project này rồi.",
        ) from None

    return SubmissionRead.model_validate(submission)


@router.patch("/submissions/{submission_id}/review", response_model=ReviewResult)
def review_submission(
    submission_id: int, payload: SubmissionReview, admin: CurrentAdmin, db: DbSession
) -> ReviewResult:
    """Chấm một bài nộp. Chỉ tài khoản quản trị được gọi."""
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bài nộp.")

    try:
        submission, awarded = progress_service.review_submission(db, submission, admin, payload)
    except progress_service.SubmissionAlreadyReviewed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Bài nộp này đã được chấm."
        ) from None

    return ReviewResult(
        submission=SubmissionRead.model_validate(submission),
        awarded_badges=[BadgeRead.model_validate(badge) for badge in awarded],
    )
