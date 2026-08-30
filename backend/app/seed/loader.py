"""Đọc dữ liệu mẫu từ các file JSON và nạp vào cơ sở dữ liệu.

Hàm nạp được viết để chạy lại nhiều lần vẫn cho cùng kết quả: bản ghi nào đã có
thì cập nhật, chưa có thì tạo mới, không bao giờ tạo bản sao.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.catalog import (
    Hint,
    Level,
    Mentor,
    Project,
    Roadmap,
    RoadmapStep,
    Skill,
    Track,
)
from app.models.enums import BadgeRule
from app.models.progress import Badge, UserBadge

SEED_DIR = Path(__file__).resolve().parent


class SeedError(Exception):
    """Dữ liệu mẫu sai khuôn hoặc tham chiếu tới một bản ghi không tồn tại."""


# Trường bắt buộc của từng file dữ liệu mẫu. Thiếu một trường thì chương trình
# dừng ngay với câu nói rõ file nào, dòng thứ mấy, thiếu gì, thay vì để Python
# ném ra một KeyError trơ trọi ở giữa quá trình ghi.
_TRUONG_BAT_BUOC = {
    "levels": ("id", "slug", "name", "description"),
    "mentors": ("slug", "name", "title", "bio", "photo", "order_index"),
    "tracks": ("slug", "name", "description", "order_index", "mentor"),
    "skills": ("slug", "name"),
    "badges": ("slug", "name", "description", "icon", "rule", "rule_value"),
    "projects": (
        "slug",
        "title",
        "summary",
        "context",
        "objective",
        "level",
        "track",
        "estimated_hours",
        "reward_points",
    ),
    "roadmaps": ("slug", "name", "description", "steps"),
}


@dataclass(slots=True)
class SeedReport:
    """Thống kê số bản ghi đã tạo mới và đã cập nhật."""

    created: dict[str, int] = field(default_factory=dict)
    updated: dict[str, int] = field(default_factory=dict)

    def record(self, entity: str, is_new: bool) -> None:
        target = self.created if is_new else self.updated
        target[entity] = target.get(entity, 0) + 1

    def as_lines(self) -> list[str]:
        entities = sorted(set(self.created) | set(self.updated))
        return [
            f"{entity}: tạo mới {self.created.get(entity, 0)}, "
            f"cập nhật {self.updated.get(entity, 0)}"
            for entity in entities
        ]


def kiem_tra_khuon(name: str, rows: object) -> list[dict]:
    """Kiểm tra khuôn của một file dữ liệu mẫu và trả lại chính dữ liệu đó.

    Ba thứ được xét: dữ liệu phải là một danh sách các đối tượng, mỗi đối tượng
    phải có đủ trường bắt buộc, và khoá của chúng không được trùng nhau. Câu báo
    lỗi luôn nói rõ file nào, phần tử thứ mấy và sai ở đâu.
    """
    if not isinstance(rows, list):
        raise SeedError(f"File {name}.json phải chứa một danh sách.")

    bat_buoc = _TRUONG_BAT_BUOC[name]
    khoa = "id" if name == "levels" else "slug"
    da_gap: set = set()

    for chi_so, row in enumerate(rows, 1):
        if not isinstance(row, dict):
            raise SeedError(f"File {name}.json, phần tử thứ {chi_so} không phải một đối tượng.")

        thieu = [ten for ten in bat_buoc if ten not in row]
        if thieu:
            raise SeedError(
                f"File {name}.json, phần tử thứ {chi_so} thiếu trường: {', '.join(thieu)}."
            )

        gia_tri_khoa = row[khoa]
        if gia_tri_khoa in da_gap:
            raise SeedError(f"File {name}.json có hai phần tử trùng {khoa}: {gia_tri_khoa}.")
        da_gap.add(gia_tri_khoa)

    return rows


def _read(name: str) -> list[dict]:
    """Đọc một file JSON trong thư mục dữ liệu mẫu rồi kiểm tra khuôn dữ liệu.

    Việc kiểm tra làm ngay lúc đọc, trước khi ghi bất cứ thứ gì xuống cơ sở dữ
    liệu. Nhờ vậy một file hỏng không để lại nửa vời một lần nạp dở dang.
    """
    path = SEED_DIR / f"{name}.json"
    with path.open(encoding="utf-8") as handle:
        return kiem_tra_khuon(name, json.load(handle))


def _load_levels(db: Session, report: SeedReport) -> None:
    existing = {level.id: level for level in db.scalars(select(Level)).all()}
    for row in _read("levels"):
        level = existing.get(row["id"])
        is_new = level is None
        if level is None:
            level = Level(id=row["id"])
            db.add(level)
        level.slug = row["slug"]
        level.name = row["name"]
        level.description = row["description"]
        report.record("level", is_new)


def _load_tracks(db: Session, mentors: dict[str, Mentor], report: SeedReport) -> dict[str, Track]:
    existing = {track.slug: track for track in db.scalars(select(Track)).all()}
    for row in _read("tracks"):
        mentor_slug = row["mentor"]
        if mentor_slug not in mentors:
            raise SeedError(
                f"Track {row['slug']} tham chiếu giảng viên không tồn tại: {mentor_slug}"
            )

        track = existing.get(row["slug"])
        is_new = track is None
        if track is None:
            track = Track(slug=row["slug"])
            db.add(track)
            existing[row["slug"]] = track
        track.name = row["name"]
        track.description = row["description"]
        track.order_index = row["order_index"]
        track.mentor_id = mentors[mentor_slug].id
        report.record("track", is_new)
    db.flush()
    return existing


def _load_mentors(db: Session, report: SeedReport) -> dict[str, Mentor]:
    """Nạp danh sách giảng viên. Phải chạy trước track vì track trỏ tới giảng viên."""
    existing = {mentor.slug: mentor for mentor in db.scalars(select(Mentor)).all()}
    for row in _read("mentors"):
        mentor = existing.get(row["slug"])
        is_new = mentor is None
        if mentor is None:
            mentor = Mentor(slug=row["slug"])
            db.add(mentor)
            existing[row["slug"]] = mentor
        mentor.name = row["name"]
        mentor.title = row["title"]
        mentor.bio = row["bio"]
        mentor.photo = row["photo"]
        mentor.order_index = row["order_index"]
        report.record("mentor", is_new)

    db.flush()
    return existing


def _load_skills(db: Session, report: SeedReport) -> dict[str, Skill]:
    existing = {skill.slug: skill for skill in db.scalars(select(Skill)).all()}
    for row in _read("skills"):
        skill = existing.get(row["slug"])
        is_new = skill is None
        if skill is None:
            skill = Skill(slug=row["slug"])
            db.add(skill)
            existing[row["slug"]] = skill
        skill.name = row["name"]
        report.record("skill", is_new)
    db.flush()
    return existing


def _load_badges(db: Session, tracks: dict[str, Track], report: SeedReport) -> None:
    existing = {badge.slug: badge for badge in db.scalars(select(Badge)).all()}
    rows = _read("badges")

    # Badge nào không còn trong file dữ liệu thì xoá hẳn, cùng với những lần đã
    # cấp cho người dùng. Nếu để lại, đổi tên một badge sẽ thành thêm badge mới
    # mà badge cũ vẫn nằm trong hồ sơ người học, và cùng một thành tích hiện ra
    # hai lần dưới hai cái tên.
    con_dung = {row["slug"] for row in rows}
    thua = [badge.id for slug, badge in existing.items() if slug not in con_dung]
    if thua:
        db.execute(delete(UserBadge).where(UserBadge.badge_id.in_(thua)))
        db.execute(delete(Badge).where(Badge.id.in_(thua)))
        for slug in [slug for slug in existing if slug not in con_dung]:
            del existing[slug]

    for row in rows:
        badge = existing.get(row["slug"])
        is_new = badge is None
        if badge is None:
            badge = Badge(slug=row["slug"])
            db.add(badge)
        badge.name = row["name"]
        badge.description = row["description"]
        badge.icon = row.get("icon", "")
        badge.rule = BadgeRule(row["rule"])
        badge.rule_value = row["rule_value"]

        track_slug = row.get("rule_track")
        if track_slug is not None:
            if track_slug not in tracks:
                raise SeedError(f"Badge {row['slug']} tham chiếu track không tồn tại: {track_slug}")
            badge.rule_track_id = tracks[track_slug].id
        else:
            badge.rule_track_id = None
        report.record("badge", is_new)


def _load_projects(
    db: Session, tracks: dict[str, Track], skills: dict[str, Skill], report: SeedReport
) -> dict[str, Project]:
    """Nạp project theo hai lượt.

    Lượt một tạo hoặc cập nhật từng project. Lượt hai mới nối quan hệ tiên quyết,
    vì một project có thể phụ thuộc project đứng sau nó trong file dữ liệu.
    """
    rows = _read("projects")
    existing = {project.slug: project for project in db.scalars(select(Project)).all()}
    level_ids = set(db.scalars(select(Level.id)).all())

    for row in rows:
        if row["estimated_hours"] <= 0:
            raise SeedError(
                f"Project {row['slug']} có estimated_hours bằng {row['estimated_hours']}, "
                "giá trị này phải lớn hơn 0."
            )
        if row["reward_points"] < 0:
            raise SeedError(
                f"Project {row['slug']} có reward_points bằng {row['reward_points']}, "
                "giá trị này không được âm."
            )
        if row["level"] not in level_ids:
            raise SeedError(f"Project {row['slug']} tham chiếu level không tồn tại: {row['level']}")

        track_slug = row["track"]
        if track_slug not in tracks:
            raise SeedError(f"Project {row['slug']} tham chiếu track không tồn tại: {track_slug}")

        project = existing.get(row["slug"])
        is_new = project is None
        if project is None:
            project = Project(slug=row["slug"])
            db.add(project)
            existing[row["slug"]] = project

        project.title = row["title"]
        project.summary = row["summary"]
        project.context = row["context"]
        project.objective = row["objective"]
        project.level_id = row["level"]
        project.track_id = tracks[track_slug].id
        project.estimated_hours = row["estimated_hours"]
        project.reward_points = row["reward_points"]
        project.dataset_url = row.get("dataset_url")
        project.deliverables = row.get("deliverables", [])
        project.bonus_challenges = row.get("bonus_challenges", [])
        project.is_published = row.get("is_published", True)

        unknown_skills = set(row.get("skills", [])) - set(skills)
        if unknown_skills:
            raise SeedError(
                f"Project {row['slug']} tham chiếu skill không tồn tại: {sorted(unknown_skills)}"
            )
        project.skills = [skills[slug] for slug in row.get("skills", [])]
        report.record("project", is_new)

    db.flush()

    # Xoá hết gợi ý cũ rồi ghi lại từ đầu, để file dữ liệu luôn là nguồn duy nhất.
    # Phải xoá và đẩy xuống cơ sở dữ liệu trước khi thêm, nếu không bản ghi mới và
    # bản ghi cũ sẽ trùng ràng buộc duy nhất trên cặp project và tầng gợi ý.
    db.execute(delete(Hint).where(Hint.project_id.in_([p.id for p in existing.values()])))
    db.flush()
    for row in rows:
        project = existing[row["slug"]]
        db.expire(project, ["hints"])
        for tier, content in enumerate(row.get("hints", []), start=1):
            db.add(Hint(project_id=project.id, tier=tier, content=content))

    for row in rows:
        project = existing[row["slug"]]
        unknown = set(row.get("prerequisites", [])) - set(existing)
        if unknown:
            raise SeedError(
                f"Project {row['slug']} tham chiếu project tiên quyết "
                f"không tồn tại: {sorted(unknown)}"
            )
        project.prerequisites = [existing[slug] for slug in row.get("prerequisites", [])]

    db.flush()
    return existing


def _load_roadmaps(db: Session, projects: dict[str, Project], report: SeedReport) -> None:
    existing = {roadmap.slug: roadmap for roadmap in db.scalars(select(Roadmap)).all()}
    for row in _read("roadmaps"):
        roadmap = existing.get(row["slug"])
        is_new = roadmap is None
        if roadmap is None:
            roadmap = Roadmap(slug=row["slug"])
            db.add(roadmap)
        roadmap.name = row["name"]
        roadmap.description = row["description"]
        db.flush()

        # Cùng lý do như với gợi ý: xoá bước cũ trước khi thêm bước mới.
        db.execute(delete(RoadmapStep).where(RoadmapStep.roadmap_id == roadmap.id))
        db.flush()
        db.expire(roadmap, ["steps"])

        for index, step in enumerate(row["steps"], start=1):
            if step["project"] not in projects:
                raise SeedError(
                    f"Lộ trình {row['slug']} tham chiếu project không tồn tại: {step['project']}"
                )
            db.add(
                RoadmapStep(
                    roadmap_id=roadmap.id,
                    project_id=projects[step["project"]].id,
                    order_index=index,
                    note=step.get("note", ""),
                )
            )
        report.record("roadmap", is_new)


def load_seed(db: Session) -> SeedReport:
    """Nạp toàn bộ dữ liệu mẫu trong một giao dịch duy nhất.

    Nếu bất kỳ tham chiếu nào sai thì toàn bộ lần nạp bị huỷ, cơ sở dữ liệu giữ
    nguyên trạng thái cũ chứ không rơi vào tình trạng nạp được một nửa.
    """
    report = SeedReport()
    _load_levels(db, report)
    mentors = _load_mentors(db, report)
    tracks = _load_tracks(db, mentors, report)
    skills = _load_skills(db, report)
    _load_badges(db, tracks, report)
    projects = _load_projects(db, tracks, skills, report)
    _load_roadmaps(db, projects, report)
    db.flush()
    return report
