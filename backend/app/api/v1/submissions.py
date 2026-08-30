"""Endpoint nộp bài và chấm bài."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, Response, status

from app.api.deps import CurrentMentor, CurrentUser, DbSession, Paging
from app.models.enums import SubmissionStatus
from app.models.progress import Submission
from app.schemas.common import MAX_SO_NGUYEN, Page
from app.schemas.progress import (
    BadgeRead,
    ReviewResult,
    SubmissionCreate,
    SubmissionRead,
    SubmissionReview,
    SubmissionWithAuthor,
)
from app.services import catalog as catalog_service
from app.services import progress as progress_service

router = APIRouter(tags=["submissions"])


@router.post(
    "/projects/{slug}/submissions",
    response_model=SubmissionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_submission(
    slug: str, payload: SubmissionCreate, user: CurrentUser, db: DbSession, response: Response
) -> SubmissionRead:
    """Nộp kết quả cho một project.

    Trả về 201 khi đây là bài nộp đầu tiên đang chờ chấm của project, và 200 khi
    nội dung của bài đang chờ được thay bằng bản vừa nộp.
    """
    project = catalog_service.get_published_project(db, slug)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy project.")

    try:
        submission, la_bai_moi = progress_service.create_submission(db, user, project, payload)
    except progress_service.ChuaMoKhoa as loi:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cần hoàn thành trước những project sau rồi mới nộp bài cho project này: "
                f"{', '.join(loi.con_thieu)}."
            ),
        ) from None
    except progress_service.ProjectAlreadyCompleted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bạn đã hoàn thành project này rồi.",
        ) from None

    if not la_bai_moi:
        response.status_code = status.HTTP_200_OK
    return SubmissionRead.model_validate(submission)


@router.get("/submissions", response_model=Page[SubmissionWithAuthor])
def list_submissions(
    mentor: CurrentMentor,
    db: DbSession,
    paging: Paging,
    submission_status: Annotated[
        SubmissionStatus | None,
        Query(alias="status", description="Lọc theo trạng thái."),
    ] = None,
) -> Page[SubmissionWithAuthor]:
    """Danh sách bài nộp của mọi người dùng. Chỉ tài khoản giảng viên được gọi.

    Đây là nguồn dữ liệu cho màn hình chấm bài: lọc theo trạng thái chờ chấm là
    ra đúng những bài đang phải xử lý.
    """
    items, total = progress_service.list_all_submissions(db, paging, submission_status)
    return Page[SubmissionWithAuthor].create(
        [SubmissionWithAuthor.model_validate(item) for item in items], total, paging
    )


@router.patch("/submissions/{submission_id}/review", response_model=ReviewResult)
def review_submission(
    submission_id: Annotated[int, Path(ge=1, le=MAX_SO_NGUYEN)],
    payload: SubmissionReview,
    mentor: CurrentMentor,
    db: DbSession,
) -> ReviewResult:
    """Chấm một bài nộp. Chỉ tài khoản giảng viên được gọi."""
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bài nộp.")

    try:
        submission, awarded = progress_service.review_submission(db, submission, mentor, payload)
    except progress_service.KhongTuChamBai:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không tự chấm bài của mình được. Bài này phải do một giảng viên khác chấm.",
        ) from None
    except progress_service.SubmissionAlreadyReviewed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Bài nộp này đã được chấm."
        ) from None

    return ReviewResult(
        submission=SubmissionRead.model_validate(submission),
        awarded_badges=[BadgeRead.model_validate(badge) for badge in awarded],
    )
