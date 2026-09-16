"""Kiểm thử "phi logic" phần nộp bài, chấm bài, điểm, badge, đề xuất, xếp hạng.

Bộ này do lens kt6-api-nop-cham viết thêm, dùng chung fixture trong conftest.py.
Chạy:
  cd <bản sao backend> && FRONTEND_DIR=<bản sao frontend> \
    .venv/bin/python -m pytest -p no:warnings -q tests/test_kt_nop_cham.py
"""

from __future__ import annotations

import json
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.main import app
from app.models.catalog import Project
from app.models.enums import SubmissionStatus
from app.models.progress import Badge, Submission, UserBadge
from app.models.user import User
from app.services import progress as progress_service

REPO = "https://github.com/kt6/bai-nop"
SEED = Path(__file__).resolve().parents[1] / "app" / "seed"
PROJECTS = json.loads((SEED / "projects.json").read_text(encoding="utf-8"))
BADGES = json.loads((SEED / "badges.json").read_text(encoding="utf-8"))
NO_PREREQ = [p for p in PROJECTS if not p.get("prerequisites")]


def _by_track(track: str) -> list[str]:
    return [p["slug"] for p in NO_PREREQ if p["track"] == track]


def _by_level(level: int) -> list[str]:
    return [p["slug"] for p in NO_PREREQ if p["level"] == level]


def _points(slug: str) -> int:
    return next(p["reward_points"] for p in PROJECTS if p["slug"] == slug)


def _submit(client: TestClient, headers: dict, slug: str, **extra):
    body = {"repo_url": REPO, "note": "kt6"}
    body.update(extra)
    return client.post(f"/api/v1/projects/{slug}/submissions", json=body, headers=headers)


def _review(client: TestClient, headers: dict, sid: int, status: str = "accepted", **extra):
    body = {"status": status, "score": 90, "feedback": "ok"}
    body.update(extra)
    return client.patch(f"/api/v1/submissions/{sid}/review", json=body, headers=headers)


def _accept(client: TestClient, student: dict, mentor: dict, slug: str) -> dict:
    s = _submit(client, student["headers"], slug)
    assert s.status_code in (200, 201), (slug, s.text)
    r = _review(client, mentor["headers"], s.json()["id"])
    assert r.status_code == 200, (slug, r.text)
    return r.json()


def _progress(client: TestClient, acc: dict) -> dict:
    return client.get("/api/v1/me/progress", headers=acc["headers"]).json()


def _badge_count(db: Session, user_id: int, slug: str) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(UserBadge)
            .join(Badge, Badge.id == UserBadge.badge_id)
            .where(UserBadge.user_id == user_id, Badge.slug == slug)
        )
        or 0
    )


# ---------------------------------------------------------------- nộp bài


def test_create_submission_requires_token(client: TestClient) -> None:
    r = client.post("/api/v1/projects/cli-quiz-python/submissions", json={"repo_url": REPO})
    assert r.status_code == 401
    r = client.post(
        "/api/v1/projects/cli-quiz-python/submissions",
        json={"repo_url": REPO},
        headers={"Authorization": "Bearer khong.hop.le"},
    )
    assert r.status_code == 401


def test_mentor_can_submit_but_never_self_grade(
    client: TestClient, db: Session, user_factory
) -> None:
    """Mã nguồn cho phép giảng viên nộp bài (CurrentUser) và chỉ chặn tự chấm."""
    mentor = user_factory(is_mentor=True, db=db)
    other = user_factory(is_mentor=True, db=db)
    r = _submit(client, mentor["headers"], "image-basics-lab")
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    assert _review(client, mentor["headers"], sid).status_code == 403
    assert db.get(Submission, sid).status is SubmissionStatus.PENDING
    r = _review(client, other["headers"], sid)
    assert r.status_code == 200
    assert r.json()["submission"]["awarded_points"] == _points("image-basics-lab")
    # giảng viên có điểm nhưng không lên bảng xếp hạng
    names = [e["username"] for e in client.get("/api/v1/leaderboard?limit=100").json()]
    assert mentor["user"]["username"] not in names


@pytest.mark.parametrize(
    "repo",
    [
        "ftp://a.b/c",
        "javascript:alert(1)",
        "example.com/x",
        "",
        "http://",
        "mailto:a@b.c",
        "//a.b/c",
        None,
        5,
    ],
)
def test_repo_url_must_be_http_or_https(client: TestClient, user_factory, repo) -> None:
    acc = user_factory()
    r = client.post(
        "/api/v1/projects/image-basics-lab/submissions",
        json={"repo_url": repo},
        headers=acc["headers"],
    )
    assert r.status_code == 422, r.text


def test_url_and_note_length_limits(client: TestClient, user_factory) -> None:
    acc = user_factory()
    u512 = "https://example.com/" + "a" * (512 - len("https://example.com/"))
    r = _submit(client, acc["headers"], "image-basics-lab", repo_url=u512)
    assert r.status_code == 201 and len(r.json()["repo_url"]) == 512
    assert (
        _submit(client, acc["headers"], "image-basics-lab", repo_url=u512 + "a").status_code == 422
    )
    assert (
        _submit(client, acc["headers"], "image-basics-lab", demo_url=u512 + "a").status_code == 422
    )
    assert _submit(client, acc["headers"], "image-basics-lab", demo_url="").status_code == 422
    assert _submit(client, acc["headers"], "image-basics-lab", demo_url=None).status_code == 200
    r = _submit(client, acc["headers"], "image-basics-lab", note="x" * 2000)
    assert r.status_code == 200 and len(r.json()["note"]) == 2000
    assert _submit(client, acc["headers"], "image-basics-lab", note="x" * 2001).status_code == 422
    # unicode: giới hạn áp lên dạng đã chuẩn hoá (percent-encoded)
    assert (
        _submit(
            client, acc["headers"], "image-basics-lab", repo_url="https://example.com/" + "ư" * 490
        ).status_code
        == 422
    )


def test_unknown_and_unpublished_project_404(client: TestClient, db: Session, user_factory) -> None:
    acc = user_factory()
    assert _submit(client, acc["headers"], "khong-ton-tai").status_code == 404
    project = db.scalar(select(Project).where(Project.slug == "motion-alert-camera"))
    project.is_published = False
    db.commit()
    try:
        assert _submit(client, acc["headers"], "motion-alert-camera").status_code == 404
        recs = client.get("/api/v1/me/recommendations?limit=50", headers=acc["headers"]).json()
        assert "motion-alert-camera" not in [r["project"]["slug"] for r in recs]
    finally:
        project.is_published = True
        db.commit()


def test_prerequisite_locks_submission_409(client: TestClient, db: Session, user_factory) -> None:
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    r = _submit(client, acc["headers"], "csv-grade-report")
    assert r.status_code == 409 and "hoàn thành" in r.text
    _accept(client, acc, mentor, "cli-quiz-python")
    assert _submit(client, acc["headers"], "csv-grade-report").status_code == 201


def test_pending_update_returns_200_and_single_pending_row(
    client: TestClient, db: Session, user_factory
) -> None:
    acc = user_factory()
    r1 = _submit(client, acc["headers"], "image-basics-lab", note="1", demo_url="https://demo.x/y")
    assert r1.status_code == 201
    r2 = _submit(client, acc["headers"], "image-basics-lab", note="2")
    assert r2.status_code == 200
    assert r2.json()["id"] == r1.json()["id"]
    assert r2.json()["note"] == "2" and r2.json()["demo_url"] is None
    for _ in range(5):
        assert _submit(client, acc["headers"], "image-basics-lab").status_code == 200
    n = db.scalar(
        select(func.count(Submission.id)).where(
            Submission.user_id == acc["user"]["id"], Submission.status == SubmissionStatus.PENDING
        )
    )
    assert n == 1


def test_state_machine_after_grading(client: TestClient, db: Session, user_factory) -> None:
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    # accepted -> 409
    _accept(client, acc, mentor, "image-basics-lab")
    assert _submit(client, acc["headers"], "image-basics-lab").status_code == 409
    # rejected -> new row
    s = _submit(client, acc["headers"], "text-cleaning-toolkit").json()
    assert _review(client, mentor["headers"], s["id"], "rejected", score=None).status_code == 200
    s2 = _submit(client, acc["headers"], "text-cleaning-toolkit")
    assert s2.status_code == 201 and s2.json()["id"] != s["id"]
    # revision -> new row
    assert _review(client, mentor["headers"], s2.json()["id"], "revision").status_code == 200
    s3 = _submit(client, acc["headers"], "text-cleaning-toolkit")
    assert s3.status_code == 201 and s3.json()["id"] not in (s["id"], s2.json()["id"])
    # accept the third -> points once; rejected/revision rows have 0
    r = _review(client, mentor["headers"], s3.json()["id"], "accepted")
    assert r.json()["submission"]["awarded_points"] == _points("text-cleaning-toolkit")
    rows = db.scalars(
        select(Submission).where(
            Submission.user_id == acc["user"]["id"],
            Submission.project_id
            == db.scalar(select(Project.id).where(Project.slug == "text-cleaning-toolkit")),
        )
    ).all()
    assert sorted((s_.status.value, s_.awarded_points) for s_ in rows) == sorted(
        [("rejected", 0), ("revision", 0), ("accepted", _points("text-cleaning-toolkit"))]
    )
    assert _progress(client, acc)["total_points"] == _points("image-basics-lab") + _points(
        "text-cleaning-toolkit"
    )


# ---------------------------------------------------------------- chấm bài


def test_student_cannot_grade_via_any_method(client: TestClient, db: Session, user_factory) -> None:
    acc = user_factory()
    sid = _submit(client, acc["headers"], "image-basics-lab").json()["id"]
    body = {"status": "accepted", "score": 100}
    for method in ("PATCH", "POST", "PUT", "DELETE", "GET"):
        r = client.request(
            method, f"/api/v1/submissions/{sid}/review", json=body, headers=acc["headers"]
        )
        assert r.status_code in (403, 405), (method, r.status_code, r.text)
    assert (
        client.patch(
            f"/api/v1/submissions/{sid}/review", json=body, headers=acc["headers"]
        ).status_code
        == 403
    )
    assert client.get("/api/v1/submissions", headers=acc["headers"]).status_code == 403
    for i in (1, 2, 3, 99999):
        assert (
            client.patch(
                f"/api/v1/submissions/{i}/review", json=body, headers=acc["headers"]
            ).status_code
            == 403
        )
    assert db.get(Submission, sid).status is SubmissionStatus.PENDING
    assert _progress(client, acc)["total_points"] == 0


@pytest.mark.parametrize(
    "body",
    [
        {"status": "accepted", "score": -1},
        {"status": "accepted", "score": 101},
        {"status": "accepted", "score": 1.5},
        {"status": "accepted", "score": "abc"},
        {"status": "pending"},
        {"status": "PENDING"},
        {"status": "ACCEPTED"},
        {"status": "done"},
        {"status": ""},
        {"status": None},
        {},
        {"status": "accepted", "feedback": "x" * 4001},
        {"status": "accepted", "feedback": None},
        {"status": ["accepted"]},
    ],
)
def test_review_validation_422(client: TestClient, db: Session, user_factory, body) -> None:
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    sid = _submit(client, acc["headers"], "image-basics-lab").json()["id"]
    r = client.patch(f"/api/v1/submissions/{sid}/review", json=body, headers=mentor["headers"])
    assert r.status_code == 422, r.text
    assert db.get(Submission, sid).status is SubmissionStatus.PENDING


def test_review_accepts_bounds_and_null_score(
    client: TestClient, db: Session, user_factory
) -> None:
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    a = _submit(client, acc["headers"], "image-basics-lab").json()["id"]
    r = _review(client, mentor["headers"], a, "rejected", score=0, feedback="x" * 4000)
    assert r.status_code == 200 and r.json()["submission"]["score"] == 0
    b = _submit(client, acc["headers"], "image-basics-lab").json()["id"]
    r = _review(
        client, mentor["headers"], b, "revision", score=None, feedback="  Đạt 🎓 <b>x</b>  "
    )
    assert r.status_code == 200 and r.json()["submission"]["score"] is None
    assert r.json()["submission"]["feedback"] == "Đạt 🎓 <b>x</b>"
    c = _submit(client, acc["headers"], "image-basics-lab").json()["id"]
    r = _review(client, mentor["headers"], c, "accepted", score=100)
    assert r.status_code == 200 and r.json()["submission"]["score"] == 100


def test_review_bool_score_is_coerced_to_int(client: TestClient, db: Session, user_factory) -> None:
    """Điểm gửi lên là true/false phải bị từ chối, không được thành 1/0."""
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    sid = _submit(client, acc["headers"], "image-basics-lab").json()["id"]
    r = client.patch(
        f"/api/v1/submissions/{sid}/review",
        json={"status": "accepted", "score": True},
        headers=mentor["headers"],
    )
    diem = r.json().get("submission", {}).get("score")
    assert r.status_code == 422, f"bool score should be refused, got {r.status_code} score={diem}"


def test_review_ids_and_double_grade(client: TestClient, db: Session, user_factory) -> None:
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    for bad in (0, -1, 2**31, 2**63, "abc", "1.5"):
        assert (
            client.patch(
                f"/api/v1/submissions/{bad}/review",
                json={"status": "accepted"},
                headers=mentor["headers"],
            ).status_code
            == 422
        )
    assert _review(client, mentor["headers"], 999_999_999).status_code == 404
    sid = _submit(client, acc["headers"], "image-basics-lab").json()["id"]
    assert _review(client, mentor["headers"], sid, "accepted").status_code == 200
    assert _review(client, mentor["headers"], sid, "rejected").status_code == 409
    assert _review(client, mentor["headers"], sid, "accepted").status_code == 409
    assert _progress(client, acc)["total_points"] == _points("image-basics-lab")


def test_grading_after_user_deleted_404(client: TestClient, db: Session, user_factory) -> None:
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    sid = _submit(client, acc["headers"], "image-basics-lab").json()["id"]
    db.delete(db.get(User, acc["user"]["id"]))
    db.commit()
    assert _review(client, mentor["headers"], sid).status_code == 404
    assert client.get("/api/v1/me/progress", headers=acc["headers"]).status_code == 401


def test_deactivated_user_token_rejected_and_off_leaderboard(
    client: TestClient, db: Session, user_factory
) -> None:
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    sid = _submit(client, acc["headers"], "image-basics-lab").json()["id"]
    user = db.get(User, acc["user"]["id"])
    user.is_active = False
    db.commit()
    assert client.get("/api/v1/me/progress", headers=acc["headers"]).status_code == 401
    assert _review(client, mentor["headers"], sid).status_code == 200
    names = [e["username"] for e in client.get("/api/v1/leaderboard?limit=100").json()]
    assert acc["user"]["username"] not in names


# ---------------------------------------------------------------- điểm


def test_points_once_even_if_two_pending_rows_both_accepted(
    client: TestClient, db: Session, user_factory
) -> None:
    """Mô phỏng hai bản ghi chờ chấm cùng project (kết quả của race khi nộp song song)."""
    acc = user_factory()
    m1 = user_factory(is_mentor=True, db=db)
    m2 = user_factory(is_mentor=True, db=db)
    a = _submit(client, acc["headers"], "image-basics-lab").json()["id"]
    project_id = db.scalar(select(Project.id).where(Project.slug == "image-basics-lab"))
    dup = Submission(
        user_id=acc["user"]["id"],
        project_id=project_id,
        repo_url=REPO,
        status=SubmissionStatus.PENDING,
    )
    db.add(dup)
    db.commit()
    r1 = _review(client, m1["headers"], a)
    r2 = _review(client, m2["headers"], dup.id)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["submission"]["awarded_points"] == _points("image-basics-lab")
    assert r2.json()["submission"]["awarded_points"] == 0
    assert [b["slug"] for b in r1.json()["awarded_badges"]] == ["first-step"]
    assert r2.json()["awarded_badges"] == []
    prog = _progress(client, acc)
    assert prog["total_points"] == _points("image-basics-lab") and prog["completed_projects"] == 1


def test_total_points_equals_sum_of_awarded_points(
    client: TestClient, db: Session, user_factory
) -> None:
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    for slug in ("image-basics-lab", "text-cleaning-toolkit", "prompt-pattern-workbook"):
        _accept(client, acc, mentor, slug)
    s = _submit(client, acc["headers"], "keyword-extractor-tfidf").json()["id"]
    _review(client, mentor["headers"], s, "rejected")
    total = db.scalar(
        select(func.sum(Submission.awarded_points)).where(Submission.user_id == acc["user"]["id"])
    )
    user = db.get(User, acc["user"]["id"])
    db.refresh(user)
    assert (
        user.total_points
        == total
        == sum(
            _points(x)
            for x in ("image-basics-lab", "text-cleaning-toolkit", "prompt-pattern-workbook")
        )
    )
    # bất biến trên toàn bộ db
    bad = db.execute(
        select(User.id, User.total_points, func.coalesce(func.sum(Submission.awarded_points), 0))
        .outerjoin(Submission, Submission.user_id == User.id)
        .group_by(User.id)
        .having(User.total_points != func.coalesce(func.sum(Submission.awarded_points), 0))
    ).all()
    assert bad == []


# ---------------------------------------------------------------- badge


@pytest.mark.parametrize("badge", BADGES, ids=[b["slug"] for b in BADGES])
def test_each_badge_awarded_exactly_once(
    client: TestClient, db: Session, user_factory, badge
) -> None:
    """Dựng kịch bản tối thiểu cho từng badge trong seed, cấp đúng một lần và không cấp lại."""
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    rule, value = badge["rule"], badge["rule_value"]
    if rule == "project_count":
        slugs = [p["slug"] for p in NO_PREREQ][: value + 1]
    elif rule == "level_reached":
        lv = _by_level(value)
        slugs = lv[:2]
    elif rule == "track_count":
        slugs = _by_track(badge["rule_track"])[: value + 1]
    elif rule == "points_reached":
        slugs, total = [], 0
        for p in sorted(NO_PREREQ, key=lambda p: -p["reward_points"]):
            slugs.append(p["slug"])
            total += p["reward_points"]
            if total >= value:
                break
        slugs.append(next(p["slug"] for p in NO_PREREQ if p["slug"] not in slugs))
    else:
        pytest.fail(f"rule lạ: {rule}")

    awarded_at: list[int] = []
    for i, slug in enumerate(slugs, 1):
        res = _accept(client, acc, mentor, slug)
        if badge["slug"] in [b["slug"] for b in res["awarded_badges"]]:
            awarded_at.append(i)
    # badge được cấp ở đúng bước đạt ngưỡng...
    if rule == "project_count" or rule == "track_count":
        expected = value
    elif rule == "level_reached":
        expected = 1
    else:
        expected = len(slugs) - 1
    assert awarded_at == [expected], (badge["slug"], awarded_at, slugs)
    assert _badge_count(db, acc["user"]["id"], badge["slug"]) == 1
    mine = [
        b["badge"]["slug"] for b in client.get("/api/v1/me/badges", headers=acc["headers"]).json()
    ]
    assert mine.count(badge["slug"]) == 1
    # ... và bài bị từ chối không cấp thêm gì
    s = _submit(
        client, acc["headers"], next(p["slug"] for p in NO_PREREQ if p["slug"] not in slugs)
    ).json()["id"]
    r = _review(client, mentor["headers"], s, "rejected")
    assert r.json()["awarded_badges"] == []
    _an_khoi_bang_xep_hang(db, acc)


def _an_khoi_bang_xep_hang(db: Session, acc: dict) -> None:
    """Tắt tài khoản nhiều điểm sau khi kiểm thử xong.

    Cơ sở dữ liệu kiểm thử dùng chung cả phiên; tài khoản leo tới 5000 điểm sẽ
    đẩy người của test_progress.py::test_leaderboard_orders_by_points ra khỏi
    20 dòng đầu bảng xếp hạng. Tài khoản tắt không lên bảng nên không ảnh hưởng.
    """
    user = db.get(User, acc["user"]["id"])
    user.is_active = False
    db.commit()


def test_track_badge_ignores_other_tracks(client: TestClient, db: Session, user_factory) -> None:
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    others = [
        p["slug"]
        for p in NO_PREREQ
        if p["track"] not in ("computer-vision", "nlp", "generative-ai", "deployment")
    ][:3]
    for slug in others:
        _accept(client, acc, mentor, slug)
    mine = {
        b["badge"]["slug"] for b in client.get("/api/v1/me/badges", headers=acc["headers"]).json()
    }
    assert not mine & {
        "cv-specialist",
        "nlp-specialist",
        "genai-specialist",
        "deployment-specialist",
    }


# ---------------------------------------------------------------- đề xuất / xếp hạng / hàng đợi


def test_recommendations_exclude_done_pending_locked_and_respect_limit(
    client: TestClient, db: Session, user_factory
) -> None:
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    _accept(client, acc, mentor, "cli-quiz-python")
    _submit(client, acc["headers"], "csv-grade-report")  # pending
    r = _submit(client, acc["headers"], "image-basics-lab").json()
    _review(client, mentor["headers"], r["id"], "revision")  # revision cũng bị loại
    recs = client.get("/api/v1/me/recommendations", headers=acc["headers"]).json()
    slugs = [x["project"]["slug"] for x in recs]
    assert len(recs) == 10
    assert (
        "cli-quiz-python" not in slugs
        and "csv-grade-report" not in slugs
        and "image-basics-lab" not in slugs
    )
    assert "weather-data-explorer" not in slugs  # cần csv-grade-report
    done = {"cli-quiz-python"}
    for slug in slugs:
        pre = next(p.get("prerequisites") or [] for p in PROJECTS if p["slug"] == slug)
        assert set(pre) <= done, (slug, pre)
    assert [x["score"] for x in recs] == sorted([x["score"] for x in recs], reverse=True)
    assert len(client.get("/api/v1/me/recommendations?limit=1", headers=acc["headers"]).json()) == 1
    assert (
        len(client.get("/api/v1/me/recommendations?limit=50", headers=acc["headers"]).json()) <= 50
    )
    for bad in (0, 51, "x"):
        assert (
            client.get(
                f"/api/v1/me/recommendations?limit={bad}", headers=acc["headers"]
            ).status_code
            == 422
        )


def test_leaderboard_immediate_and_students_only(
    client: TestClient, db: Session, user_factory
) -> None:
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    _accept(client, acc, mentor, "browser-automation-agent")  # 900 điểm, level 5
    lb = client.get("/api/v1/leaderboard?limit=100").json()
    me = next(e for e in lb if e["username"] == acc["user"]["username"])
    assert (
        me["total_points"] == _points("browser-automation-agent") and me["completed_projects"] == 1
    )
    assert [e["total_points"] for e in lb] == sorted([e["total_points"] for e in lb], reverse=True)
    assert [e["rank"] for e in lb] == list(range(1, len(lb) + 1))
    mentors = set(db.scalars(select(User.username).where(User.is_mentor.is_(True))).all())
    assert not mentors & {e["username"] for e in lb}
    for bad in (0, 101, -1, "x"):
        assert client.get(f"/api/v1/leaderboard?limit={bad}").status_code == 422
    assert len(client.get("/api/v1/leaderboard?limit=1").json()) == 1
    _an_khoi_bang_xep_hang(db, acc)


def test_queue_filter_ordering_pagination(client: TestClient, db: Session, user_factory) -> None:
    mentor = user_factory(is_mentor=True, db=db)
    a, b, c = user_factory(), user_factory(), user_factory()
    ids = [_submit(client, x["headers"], "image-basics-lab").json()["id"] for x in (a, b, c)]
    # a nộp lại -> xuống cuối hàng đợi
    _submit(client, a["headers"], "image-basics-lab", note="lại")
    q = client.get(
        "/api/v1/submissions?status=pending&page_size=100", headers=mentor["headers"]
    ).json()
    assert all(i["status"] == "pending" for i in q["items"])
    times = [i["submitted_at"] for i in q["items"]]
    assert times == sorted(times)
    mine = [i["id"] for i in q["items"] if i["id"] in ids]
    assert mine == [ids[1], ids[2], ids[0]]
    assert all("user" in i for i in q["items"])
    for params in (
        "page_size=0",
        "page_size=101",
        "page=0",
        "status=weird",
        "status=PENDING",
        "page=x",
    ):
        assert (
            client.get(f"/api/v1/submissions?{params}", headers=mentor["headers"]).status_code
            == 422
        )
    one = client.get("/api/v1/submissions?page_size=1", headers=mentor["headers"]).json()
    assert one["pages"] == one["total"] and len(one["items"]) == 1
    far = client.get("/api/v1/submissions?page=99999", headers=mentor["headers"]).json()
    assert far["items"] == [] and far["total"] == one["total"]
    seen, page = [], 1
    while True:
        pg = client.get(
            f"/api/v1/submissions?page={page}&page_size=7", headers=mentor["headers"]
        ).json()
        seen += [i["id"] for i in pg["items"]]
        if page >= pg["pages"]:
            break
        page += 1
    assert len(seen) == len(set(seen)) == one["total"]
    # sinh viên chỉ thấy bài của mình
    r = client.get("/api/v1/me/submissions?status=pending", headers=a["headers"]).json()
    assert r["total"] == 1 and r["items"][0]["id"] == ids[0]
    assert (
        client.get("/api/v1/me/submissions?status=weird", headers=a["headers"]).status_code == 422
    )


# ---------------------------------------------------------------- race


def test_concurrent_grade_two_mentors_exactly_one_wins(
    client: TestClient, db: Session, user_factory
) -> None:
    acc = user_factory()
    m1 = user_factory(is_mentor=True, db=db)
    m2 = user_factory(is_mentor=True, db=db)
    sid = _submit(client, acc["headers"], "image-basics-lab").json()["id"]
    barrier = threading.Barrier(2)

    def grade(m, status):
        with TestClient(app) as c:
            barrier.wait()
            return c.patch(
                f"/api/v1/submissions/{sid}/review",
                json={"status": status, "feedback": "kt6"},
                headers=m["headers"],
            )

    with ThreadPoolExecutor(2) as ex:
        ra = ex.submit(grade, m1, "accepted")
        rb = ex.submit(grade, m2, "rejected")
        ra, rb = ra.result(), rb.result()
    assert sorted([ra.status_code, rb.status_code]) == [200, 409], (ra.text, rb.text)
    row = db.get(Submission, sid)
    db.refresh(row)
    winner = ra if ra.status_code == 200 else rb
    assert row.status.value == winner.json()["submission"]["status"]
    assert _progress(client, acc)["total_points"] == (
        _points("image-basics-lab") if row.status is SubmissionStatus.ACCEPTED else 0
    )


def test_parallel_submissions_leave_exactly_one_pending_row(
    client: TestClient, db: Session, user_factory
) -> None:
    """Nộp song song 40 lần cùng project: phải chỉ còn đúng một bản ghi chờ chấm."""
    acc = user_factory()
    n = 40
    barrier = threading.Barrier(n)

    def go(i):
        with TestClient(app) as c:
            barrier.wait()
            return c.post(
                "/api/v1/projects/image-basics-lab/submissions",
                json={"repo_url": REPO, "note": f"lan-{i}"},
                headers=acc["headers"],
            ).status_code

    with ThreadPoolExecutor(n) as ex:
        codes = list(ex.map(go, range(n)))
    assert all(c in (200, 201) for c in codes), codes
    pending = db.scalar(
        select(func.count(Submission.id)).where(
            Submission.user_id == acc["user"]["id"], Submission.status == SubmissionStatus.PENDING
        )
    )
    assert codes.count(201) == 1, f"{codes.count(201)} bản ghi mới được tạo cho cùng một project"
    assert pending == 1, f"có {pending} bản ghi chờ chấm cho cùng (user, project)"


def test_resubmit_racing_with_grade_cannot_overwrite_graded_content(
    client: TestClient, db: Session, user_factory, monkeypatch
) -> None:
    """Nộp lại đúng lúc giảng viên vừa chấm: bản đã chấm không được đổi nội dung.

    Mô phỏng deterministically: create_submission tìm thấy bài đang chờ, rồi
    trước khi ghi (đúng lúc gọi utcnow để đặt submitted_at) thì bài đó được chấm
    đạt trong một session khác.
    """
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    sid = _submit(client, acc["headers"], "image-basics-lab", note="ban-goc").json()["id"]
    real_utcnow = progress_service.utcnow
    hit = {"n": 0}

    def utcnow_va_cham_giua_chung():
        hit["n"] += 1
        if hit["n"] == 1:
            r = _review(client, mentor["headers"], sid, "accepted", feedback="da cham ban-goc")
            assert r.status_code == 200
        return real_utcnow()

    monkeypatch.setattr(progress_service, "utcnow", utcnow_va_cham_giua_chung)
    r = _submit(
        client,
        acc["headers"],
        "image-basics-lab",
        note="ban-moi",
        repo_url="https://github.com/kt6/khac",
    )
    monkeypatch.undo()
    row = db.get(Submission, sid)
    db.refresh(row)
    assert hit["n"] >= 1, "kịch bản không kích hoạt được"
    assert row.status is SubmissionStatus.ACCEPTED
    assert r.status_code == 409 and row.note == "ban-goc" and row.repo_url == REPO, (
        f"nộp lại lên bài đã chấm phải bị 409, nhận {r.status_code}; "
        f"nội dung bài ĐÃ CHẤM ĐẠT bị ghi đè: note={row.note!r} repo={row.repo_url!r} "
        f"(giảng viên chấm bản note='ban-goc', repo={REPO})"
    )


def test_concurrent_accepts_same_user_award_first_step_once(
    client: TestClient, db: Session, user_factory
) -> None:
    acc = user_factory()
    m1 = user_factory(is_mentor=True, db=db)
    m2 = user_factory(is_mentor=True, db=db)
    a = _submit(client, acc["headers"], "image-basics-lab").json()["id"]
    b = _submit(client, acc["headers"], "text-cleaning-toolkit").json()["id"]
    barrier = threading.Barrier(2)

    def grade(m, sid):
        with TestClient(app) as c:
            barrier.wait()
            return c.patch(
                f"/api/v1/submissions/{sid}/review",
                json={"status": "accepted"},
                headers=m["headers"],
            )

    with ThreadPoolExecutor(2) as ex:
        ra, rb = ex.submit(grade, m1, a), ex.submit(grade, m2, b)
        ra, rb = ra.result(), rb.result()
    assert ra.status_code == 200 and rb.status_code == 200, (ra.text, rb.text)
    assert _badge_count(db, acc["user"]["id"], "first-step") == 1
    got = [x["slug"] for r in (ra, rb) for x in r.json()["awarded_badges"]]
    assert got.count("first-step") == 1
    assert _progress(client, acc)["total_points"] == _points("image-basics-lab") + _points(
        "text-cleaning-toolkit"
    )


def test_review_response_and_queue_carry_user_content_verbatim(
    client: TestClient, db: Session, user_factory
) -> None:
    """API trả nguyên văn HTML trong note/feedback/display_name; frontend chịu trách nhiệm thoát."""
    xss = "<img src=x onerror=alert(1)>"
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    r = _submit(
        client,
        acc["headers"],
        "image-basics-lab",
        note=xss,
        repo_url="https://example.com/<svg onload=alert(1)>",
    )
    assert r.status_code == 201 and r.json()["note"] == xss
    q = client.get("/api/v1/submissions?status=pending&page_size=100", headers=mentor["headers"])
    assert q.headers["content-type"].startswith("application/json")
    it = next(i for i in q.json()["items"] if i["id"] == r.json()["id"])
    assert it["note"] == xss
    rr = _review(
        client, mentor["headers"], r.json()["id"], "rejected", feedback=xss + "\r\nSet-Cookie: a=b"
    )
    assert rr.status_code == 200 and "set-cookie" not in {k.lower() for k in rr.headers}
    mine = client.get("/api/v1/me/submissions", headers=acc["headers"]).json()["items"][0]
    assert mine["feedback"].startswith(xss)
