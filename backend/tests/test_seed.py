"""Kiểm thử chương trình nạp dữ liệu mẫu."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.catalog import (
    Hint,
    Mentor,
    Project,
    Roadmap,
    RoadmapStep,
    Skill,
    Track,
    project_prerequisite,
)
from app.models.progress import Badge
from app.seed.loader import SeedError, _read, kiem_tra_khuon, load_seed

EXPECTED_COUNTS = {Mentor: 4, Track: 11, Skill: 37, Badge: 12, Project: 200, Roadmap: 3}


def _count(db: Session, model: type) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


def test_seed_counts_match_the_data_files(db: Session) -> None:
    for model, expected in EXPECTED_COUNTS.items():
        assert _count(db, model) == expected, model.__name__


def test_seed_is_idempotent(db: Session) -> None:
    """Chạy lại lần hai không được tạo thêm bản ghi nào.

    Gợi ý và bước lộ trình được xoá rồi ghi lại từ đầu, nên bài kiểm thử đếm cả
    hai bảng đó để chắc chắn số lượng không nhân lên sau mỗi lần nạp.
    """
    before = {model: _count(db, model) for model in EXPECTED_COUNTS}
    before[Hint] = _count(db, Hint)
    before[RoadmapStep] = _count(db, RoadmapStep)

    load_seed(db)
    db.commit()

    for model, expected in before.items():
        assert _count(db, model) == expected, model.__name__


def test_projects_cover_every_level_and_track(db: Session) -> None:
    """36 project phải phủ hết 6 level và 11 track, đúng như tài liệu cam kết."""
    levels = set(db.scalars(select(Project.level_id)).all())
    tracks = set(db.scalars(select(Project.track_id)).all())
    assert levels == set(range(6))
    assert len(tracks) == EXPECTED_COUNTS[Track]


def test_prerequisite_graph_is_acyclic_and_ordered_by_level(db: Session) -> None:
    """Đồ thị tiên quyết không được có chu trình, và không được đi ngược level.

    Hai điều kiện này giữ cho mọi project đều tới được. Có chu trình thì cả nhóm
    project trong chu trình vĩnh viễn không mở khoá; project tiên quyết ở level
    cao hơn thì người dùng bị chặn bởi một bài khó hơn chính bài mình muốn làm.
    """
    levels = dict(db.execute(select(Project.id, Project.level_id)).all())
    edges = db.execute(select(project_prerequisite)).all()

    prerequisites: dict[int, list[int]] = {}
    for project_id, prerequisite_id in edges:
        assert levels[prerequisite_id] <= levels[project_id]
        prerequisites.setdefault(project_id, []).append(prerequisite_id)

    visiting: set[int] = set()
    done: set[int] = set()

    def visit(project_id: int) -> None:
        if project_id in done:
            return
        assert project_id not in visiting, f"Có chu trình tại project id {project_id}."
        visiting.add(project_id)
        for prerequisite_id in prerequisites.get(project_id, []):
            visit(prerequisite_id)
        visiting.discard(project_id)
        done.add(project_id)

    for project_id in levels:
        visit(project_id)


def test_seed_checker_rejects_broken_data() -> None:
    """Dữ liệu mẫu sai khuôn phải dừng ngay, kèm câu nói rõ sai ở đâu."""
    truong_hop = [
        ({"khong": "phai danh sach"}, "phải chứa một danh sách"),
        ([["khong", "phai", "doi tuong"]], "không phải một đối tượng"),
        ([{"slug": "a", "name": "A"}], "thiếu trường"),
        (
            [
                {"slug": "a", "name": "A", "description": "", "order_index": 1, "mentor": "m"},
                {"slug": "a", "name": "B", "description": "", "order_index": 2, "mentor": "m"},
            ],
            "trùng slug",
        ),
    ]
    for noi_dung, phan_cau in truong_hop:
        with pytest.raises(SeedError) as loi:
            kiem_tra_khuon("tracks", noi_dung)
        assert phan_cau in str(loi.value)


def test_seed_checker_accepts_the_real_files() -> None:
    """Sáu file dữ liệu mẫu đang dùng phải qua được chính bộ kiểm tra đó."""
    for ten in ("levels", "mentors", "tracks", "skills", "badges", "projects", "roadmaps"):
        assert len(_read(ten)) > 0


def test_every_track_has_a_mentor(db: Session) -> None:
    """Mỗi track phải có một giảng viên phụ trách, vì project lấy theo track."""
    tracks = db.scalars(select(Track)).all()
    assert tracks
    assert all(track.mentor_id is not None for track in tracks)
