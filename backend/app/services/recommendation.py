"""Gợi ý project tiếp theo cho một người dùng."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.catalog import Project, project_prerequisite
from app.models.enums import SubmissionStatus
from app.models.progress import Submission
from app.models.user import User
from app.services.progress import completed_project_ids

# Trọng số của từng thành phần trong công thức tính điểm ưu tiên.
WEIGHT_LEVEL_MATCH = 10.0
WEIGHT_LEVEL_PENALTY = 4.0
WEIGHT_FAVORITE_TRACK = 3.0
WEIGHT_NEW_TRACK = 1.5
WEIGHT_SHORT_PROJECT = 2.0
WEIGHT_UNLOCK = 0.5
MAX_UNLOCK_BONUS = 3.0

# Số project phải hoàn thành ở level hiện tại trước khi được coi là nên lên level kế tiếp.
PROJECTS_PER_LEVEL = 2
MAX_LEVEL = 5
SHORT_PROJECT_HOURS = 8


@dataclass(slots=True)
class Recommendation:
    """Một project được gợi ý kèm điểm ưu tiên và lý do."""

    project: Project
    score: float
    reason: str


def _target_level(db: Session, completed: set[int]) -> int:
    """Suy ra level nên làm tiếp.

    Người dùng chỉ được đẩy lên level cao hơn sau khi đã hoàn thành đủ số project
    ở level cao nhất hiện có, để tránh nhảy cóc rồi tắc.
    """
    if not completed:
        return 0

    rows = db.execute(
        select(Project.level_id, func.count(Project.id))
        .where(Project.id.in_(completed))
        .group_by(Project.level_id)
    ).all()
    counts = dict(rows)
    highest = max(counts)

    if counts[highest] >= PROJECTS_PER_LEVEL:
        return min(highest + 1, MAX_LEVEL)
    return highest


def _favorite_track(db: Session, completed: set[int]) -> int | None:
    """Track mà người dùng đã hoàn thành nhiều project nhất."""
    if not completed:
        return None

    row = db.execute(
        select(Project.track_id, func.count(Project.id))
        .where(Project.id.in_(completed))
        .group_by(Project.track_id)
        .order_by(func.count(Project.id).desc(), Project.track_id.asc())
        .limit(1)
    ).first()
    return row[0] if row else None


def _describe(project: Project, target_level: int, favorite_track_id: int | None) -> str:
    """Viết lý do gợi ý bằng một câu ngắn cho frontend hiển thị."""
    if project.level_id == target_level and project.track_id == favorite_track_id:
        return f"Đúng level {target_level} và thuộc track bạn đang theo."
    if project.level_id == target_level:
        return f"Đúng level {target_level} bạn nên làm tiếp."
    if project.track_id == favorite_track_id:
        return "Thuộc track bạn đang theo."
    if project.estimated_hours <= SHORT_PROJECT_HOURS:
        return "Project ngắn, hợp để đổi không khí."
    return "Đã mở khoá và nằm gần level hiện tại của bạn."


def recommend(db: Session, user: User, limit: int) -> list[Recommendation]:
    """Chọn ra các project nên làm tiếp, sắp theo điểm ưu tiên giảm dần.

    Toàn bộ phép tính chạy trên tập project đã xuất bản, vốn chỉ vài trăm bản ghi,
    nên nạp một lần rồi tính trong bộ nhớ nhanh hơn nhiều so với việc dựng một câu
    lệnh SQL phức tạp cho công thức tính điểm.
    """
    completed = completed_project_ids(db, user.id)
    pending = set(
        db.scalars(
            select(Submission.project_id).where(
                Submission.user_id == user.id,
                Submission.status.in_([SubmissionStatus.PENDING, SubmissionStatus.REVISION]),
            )
        ).all()
    )
    excluded = completed | pending

    projects = list(db.scalars(select(Project).where(Project.is_published.is_(True))).all())
    if not projects:
        return []

    # Nạp toàn bộ quan hệ tiên quyết bằng đúng một truy vấn.
    prerequisites: dict[int, set[int]] = defaultdict(set)
    unlock_counts: dict[int, int] = defaultdict(int)
    for project_id, prerequisite_id in db.execute(select(project_prerequisite)).all():
        prerequisites[project_id].add(prerequisite_id)
        unlock_counts[prerequisite_id] += 1

    target_level = _target_level(db, completed)
    favorite_track_id = _favorite_track(db, completed)
    touched_tracks = {project.track_id for project in projects if project.id in completed}

    results: list[Recommendation] = []
    for project in projects:
        if project.id in excluded:
            continue
        # Chỉ gợi ý project đã mở khoá, tức mọi project tiên quyết đều đã hoàn thành.
        if not prerequisites[project.id] <= completed:
            continue

        score = WEIGHT_LEVEL_MATCH - WEIGHT_LEVEL_PENALTY * abs(project.level_id - target_level)
        if project.track_id == favorite_track_id:
            score += WEIGHT_FAVORITE_TRACK
        elif project.track_id not in touched_tracks:
            score += WEIGHT_NEW_TRACK
        if project.estimated_hours <= SHORT_PROJECT_HOURS:
            score += WEIGHT_SHORT_PROJECT
        score += min(WEIGHT_UNLOCK * unlock_counts[project.id], MAX_UNLOCK_BONUS)

        if score <= 0:
            continue

        results.append(
            Recommendation(
                project=project,
                score=round(score, 2),
                reason=_describe(project, target_level, favorite_track_id),
            )
        )

    results.sort(key=lambda item: (-item.score, item.project.level_id, item.project.id))
    return results[:limit]
