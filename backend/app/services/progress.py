"""Nghiệp vụ tiến độ: nộp bài, chấm bài, tổng hợp tiến độ và bảng xếp hạng."""

from __future__ import annotations

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.models.catalog import Project
from app.models.enums import SubmissionStatus
from app.models.progress import Submission
from app.models.user import User
from app.schemas.common import PageParams
from app.schemas.progress import SubmissionCreate, SubmissionReview
from app.services import badges as badge_service
from app.services import catalog as catalog_service


class ProjectAlreadyCompleted(Exception):
    """Người dùng đã có bài nộp được duyệt cho project này."""


class SubmissionAlreadyReviewed(Exception):
    """Bài nộp đã được chấm rồi, không chấm lại."""


def completed_project_ids(db: Session, user_id: int) -> set[int]:
    """Tập id project mà người dùng đã có bài nộp được duyệt."""
    return set(
        db.scalars(
            select(Submission.project_id)
            .where(
                Submission.user_id == user_id,
                Submission.status == SubmissionStatus.ACCEPTED,
            )
            .distinct()
        ).all()
    )


def create_submission(
    db: Session, user: User, project: Project, payload: SubmissionCreate
) -> Submission:
    """Ghi nhận một bài nộp mới ở trạng thái chờ chấm."""
    already_accepted = db.scalar(
        select(Submission.id).where(
            Submission.user_id == user.id,
            Submission.project_id == project.id,
            Submission.status == SubmissionStatus.ACCEPTED,
        )
    )
    if already_accepted:
        raise ProjectAlreadyCompleted

    submission = Submission(
        user_id=user.id,
        project_id=project.id,
        repo_url=str(payload.repo_url),
        demo_url=str(payload.demo_url) if payload.demo_url else None,
        note=payload.note,
        status=SubmissionStatus.PENDING,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


def review_submission(
    db: Session, submission: Submission, reviewer: User, payload: SubmissionReview
) -> tuple[Submission, list]:
    """Chấm một bài nộp, cộng XP nếu được duyệt và xét badge ngay sau đó.

    Trả về bài nộp đã cập nhật cùng danh sách badge vừa được cấp. Toàn bộ thay đổi
    nằm trong một giao dịch để XP và badge không bao giờ lệch nhau.
    """
    if submission.status is not SubmissionStatus.PENDING:
        raise SubmissionAlreadyReviewed

    submission.status = payload.status
    submission.score = payload.score
    submission.feedback = payload.feedback
    submission.reviewed_at = utcnow()
    submission.reviewer_id = reviewer.id

    awarded_badges: list = []
    if payload.status is SubmissionStatus.ACCEPTED:
        user = db.get(User, submission.user_id)
        project = db.get(Project, submission.project_id)
        submission.awarded_xp = project.xp_reward
        user.total_xp += project.xp_reward
        db.flush()
        awarded_badges = badge_service.evaluate(db, user)

    db.commit()
    db.refresh(submission)
    return submission, awarded_badges


def list_submissions(
    db: Session, user_id: int, params: PageParams, status: SubmissionStatus | None = None
) -> tuple[list[Submission], int]:
    """Một trang bài nộp của người dùng, bài mới nộp đứng trước."""
    conditions = [Submission.user_id == user_id]
    if status is not None:
        conditions.append(Submission.status == status)

    total = db.scalar(select(func.count(Submission.id)).where(*conditions)) or 0
    if total == 0:
        return [], 0

    items = db.scalars(
        select(Submission)
        .where(*conditions)
        .order_by(Submission.submitted_at.desc(), Submission.id.desc())
        .offset(params.offset)
        .limit(params.page_size)
    ).all()
    return list(items), total


def summarize(db: Session, user: User) -> dict:
    """Tổng hợp tiến độ của một người dùng cho trang hồ sơ."""
    stats = badge_service.collect_stats(db, user)
    pending = (
        db.scalar(
            select(func.count(Submission.id)).where(
                Submission.user_id == user.id,
                Submission.status == SubmissionStatus.PENDING,
            )
        )
        or 0
    )

    totals = catalog_service.count_projects_by_track(db)
    by_track = [
        {
            "track": track,
            "completed": stats.completed_by_track.get(track.id, 0),
            "total": totals.get(track.id, 0),
        }
        for track in catalog_service.list_tracks(db)
    ]

    return {
        "total_xp": user.total_xp,
        "completed_projects": stats.completed_projects,
        "pending_submissions": pending,
        "highest_level": stats.highest_level,
        "by_track": by_track,
        "badges": badge_service.list_user_badges(db, user),
    }


def leaderboard(db: Session, limit: int = 20) -> list[dict]:
    """Bảng xếp hạng theo tổng XP.

    Số project hoàn thành được đếm bằng một phép gộp có điều kiện trong cùng một
    truy vấn, nên bảng xếp hạng luôn tốn đúng một lần đọc cơ sở dữ liệu.
    """
    completed = func.count(
        func.distinct(case((Submission.status == SubmissionStatus.ACCEPTED, Submission.project_id)))
    )
    rows = db.execute(
        select(User.username, User.display_name, User.total_xp, completed)
        .outerjoin(Submission, Submission.user_id == User.id)
        .where(User.is_active.is_(True))
        .group_by(User.id)
        .order_by(User.total_xp.desc(), User.id.asc())
        .limit(limit)
    ).all()

    return [
        {
            "rank": index,
            "username": username,
            "display_name": display_name,
            "total_xp": total_xp,
            "completed_projects": completed_projects,
        }
        for index, (username, display_name, total_xp, completed_projects) in enumerate(rows, 1)
    ]
