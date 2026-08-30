"""Xét và cấp badge cho người dùng."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.catalog import Project
from app.models.enums import BadgeRule, SubmissionStatus
from app.models.progress import Badge, Submission, UserBadge
from app.models.user import User


@dataclass(slots=True)
class UserStats:
    """Các số liệu cần thiết để xét mọi loại badge, gom lại trong một lần đọc."""

    total_points: int
    completed_projects: int
    highest_level: int
    completed_by_track: dict[int, int]
    completed_by_level: dict[int, int]


def collect_stats(db: Session, user: User) -> UserStats:
    """Đọc số liệu tiến độ của một người dùng.

    Chỉ dùng bốn truy vấn gộp thay vì tải toàn bộ bài nộp về rồi đếm trong Python.
    """
    accepted = (
        select(Submission.project_id)
        .where(Submission.user_id == user.id, Submission.status == SubmissionStatus.ACCEPTED)
        .distinct()
        .subquery()
    )

    completed_projects = db.scalar(select(func.count()).select_from(accepted)) or 0
    highest_level = (
        db.scalar(
            select(func.max(Project.level_id)).where(Project.id.in_(select(accepted.c.project_id)))
        )
        or 0
    )
    theo_track = db.execute(
        select(Project.track_id, func.count(Project.id))
        .where(Project.id.in_(select(accepted.c.project_id)))
        .group_by(Project.track_id)
    ).all()
    theo_level = db.execute(
        select(Project.level_id, func.count(Project.id))
        .where(Project.id.in_(select(accepted.c.project_id)))
        .group_by(Project.level_id)
    ).all()

    return UserStats(
        total_points=user.total_points,
        completed_projects=completed_projects,
        highest_level=highest_level,
        completed_by_track=dict(theo_track),
        completed_by_level=dict(theo_level),
    )


def _is_satisfied(badge: Badge, stats: UserStats) -> bool:
    """Kiểm tra một badge đã đủ điều kiện cấp hay chưa."""
    match badge.rule:
        case BadgeRule.PROJECT_COUNT:
            return stats.completed_projects >= badge.rule_value
        case BadgeRule.TRACK_COUNT:
            if badge.rule_track_id is None:
                return False
            return stats.completed_by_track.get(badge.rule_track_id, 0) >= badge.rule_value
        case BadgeRule.LEVEL_REACHED:
            return stats.highest_level >= badge.rule_value
        case BadgeRule.POINTS_REACHED:
            return stats.total_points >= badge.rule_value
    return False


def evaluate(db: Session, user: User) -> list[Badge]:
    """Xét toàn bộ badge chưa cấp và cấp những badge đã đủ điều kiện.

    Hàm chỉ thêm bản ghi vào session, việc commit do phía gọi quyết định để mọi
    thay đổi của một lần chấm bài nằm gọn trong một giao dịch.
    """
    owned_ids = set(
        db.scalars(select(UserBadge.badge_id).where(UserBadge.user_id == user.id)).all()
    )
    statement = select(Badge)
    if owned_ids:
        statement = statement.where(Badge.id.notin_(owned_ids))
    candidates = list(db.scalars(statement).all())
    if not candidates:
        return []

    stats = collect_stats(db, user)
    awarded: list[Badge] = []
    for badge in candidates:
        if _is_satisfied(badge, stats):
            db.add(UserBadge(user_id=user.id, badge_id=badge.id))
            awarded.append(badge)
    return awarded


def list_user_badges(db: Session, user: User) -> list[UserBadge]:
    """Danh sách badge của một người dùng, badge mới cấp đứng trước."""
    return list(
        db.scalars(
            select(UserBadge)
            .where(UserBadge.user_id == user.id)
            .order_by(UserBadge.awarded_at.desc())
        ).all()
    )
