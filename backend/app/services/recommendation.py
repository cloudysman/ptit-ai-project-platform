"""Đề xuất project tiếp theo cho một người dùng."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from sqlalchemy import select
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

_NO_PREREQUISITE: frozenset[int] = frozenset()


@dataclass(slots=True)
class Recommendation:
    """Một project được đề xuất kèm điểm ưu tiên và lý do."""

    project: Project
    score: float
    reason: str


def _target_level(level_counts: Counter[int]) -> int:
    """Suy ra level nên làm tiếp từ số project đã hoàn thành ở từng level.

    Người dùng chỉ được đẩy lên level cao hơn sau khi đã hoàn thành đủ số project
    ở level cao nhất hiện có, để tránh nhảy cóc rồi tắc.
    """
    if not level_counts:
        return 0

    highest = max(level_counts)
    if level_counts[highest] >= PROJECTS_PER_LEVEL:
        return min(highest + 1, MAX_LEVEL)
    return highest


def _favorite_track(track_counts: Counter[int]) -> int | None:
    """Track mà người dùng đã hoàn thành nhiều project nhất.

    Khi hai track bằng điểm thì lấy track có id nhỏ hơn, để cùng một dữ liệu vào
    luôn cho ra cùng một kết quả.
    """
    if not track_counts:
        return None
    return min(track_counts, key=lambda track_id: (-track_counts[track_id], track_id))


def _describe(project: Project, target_level: int, favorite_track_id: int | None) -> str:
    """Viết lý do đề xuất bằng một câu ngắn cho frontend hiển thị."""
    if project.level_id == target_level and project.track_id == favorite_track_id:
        return f"Đúng level {target_level} và thuộc track bạn đang theo."
    if project.level_id == target_level:
        return f"Đúng level {target_level} mà bạn nên làm tiếp."
    if project.track_id == favorite_track_id:
        return "Thuộc track bạn đang theo."
    if project.estimated_hours <= SHORT_PROJECT_HOURS:
        return "Project ngắn, hợp để đổi không khí."
    return "Đã mở khoá và nằm gần level hiện tại của bạn."


def recommend(db: Session, user: User, limit: int) -> list[Recommendation]:
    """Chọn ra các project nên làm tiếp, sắp theo điểm ưu tiên giảm dần.

    Việc tính điểm chạy trên toàn bộ kho project nên chỉ đọc năm cột: bốn cột
    tham gia công thức, cùng một cột để bỏ qua project chưa xuất bản. Đối tượng
    đầy đủ, kèm level, track và skill, chỉ được nạp cho đúng những project lọt
    vào danh sách trả về.
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

    rows = db.execute(
        select(
            Project.id,
            Project.level_id,
            Project.track_id,
            Project.estimated_hours,
            Project.is_published,
        )
    ).all()
    if not rows:
        return []

    # Nạp toàn bộ quan hệ tiên quyết bằng đúng một truy vấn.
    prerequisites: dict[int, set[int]] = {}
    unlock_counts: Counter[int] = Counter()
    for project_id, prerequisite_id in db.execute(select(project_prerequisite)).all():
        prerequisites.setdefault(project_id, set()).add(prerequisite_id)
        unlock_counts[prerequisite_id] += 1

    # Số project đã hoàn thành theo level và theo track được đếm ngay trên tập vừa
    # đọc, nên không cần thêm truy vấn gộp riêng cho từng thứ.
    level_counts: Counter[int] = Counter()
    track_counts: Counter[int] = Counter()
    touched_tracks: set[int] = set()
    for row in rows:
        if row.id not in completed:
            continue
        level_counts[row.level_id] += 1
        track_counts[row.track_id] += 1
        if row.is_published:
            touched_tracks.add(row.track_id)

    target_level = _target_level(level_counts)
    favorite_track_id = _favorite_track(track_counts)

    # Mỗi phần tử gồm điểm ưu tiên, level và id, đủ để sắp xếp mà chưa cần dựng
    # đối tượng project.
    scored: list[tuple[float, int, int]] = []
    for row in rows:
        if not row.is_published or row.id in excluded:
            continue
        # Chỉ đề xuất project đã mở khoá, tức mọi project tiên quyết đều đã hoàn thành.
        if not prerequisites.get(row.id, _NO_PREREQUISITE) <= completed:
            continue

        score = WEIGHT_LEVEL_MATCH - WEIGHT_LEVEL_PENALTY * abs(row.level_id - target_level)
        if row.track_id == favorite_track_id:
            score += WEIGHT_FAVORITE_TRACK
        elif row.track_id not in touched_tracks:
            score += WEIGHT_NEW_TRACK
        if row.estimated_hours <= SHORT_PROJECT_HOURS:
            score += WEIGHT_SHORT_PROJECT
        score += min(WEIGHT_UNLOCK * unlock_counts[row.id], MAX_UNLOCK_BONUS)

        if score <= 0:
            continue
        scored.append((round(score, 2), row.level_id, row.id))

    scored.sort(key=lambda item: (-item[0], item[1], item[2]))
    top = scored[:limit]
    if not top:
        return []

    projects = {
        project.id: project
        for project in db.scalars(
            select(Project).where(Project.id.in_([project_id for _, _, project_id in top]))
        ).all()
    }
    return [
        Recommendation(
            project=projects[project_id],
            score=score,
            reason=_describe(projects[project_id], target_level, favorite_track_id),
        )
        for score, _, project_id in top
    ]
