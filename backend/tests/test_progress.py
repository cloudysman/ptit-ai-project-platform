"""Kiểm thử luồng nộp bài, chấm bài, XP, badge và gợi ý."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

REPO = "https://github.com/sinhvien/project"


def _submit(client: TestClient, headers: dict, slug: str):
    return client.post(
        f"/api/v1/projects/{slug}/submissions",
        json={"repo_url": REPO, "note": "Đã làm xong phần bắt buộc."},
        headers=headers,
    )


def _review(client: TestClient, headers: dict, submission_id: int, status: str = "accepted"):
    return client.patch(
        f"/api/v1/submissions/{submission_id}/review",
        json={"status": status, "score": 90, "feedback": "Đạt yêu cầu."},
        headers=headers,
    )


def test_submission_requires_login(client: TestClient) -> None:
    assert _submit(client, {}, "cli-quiz-python").status_code == 401


def test_submit_to_unknown_project(client: TestClient, user_factory) -> None:
    account = user_factory()
    assert _submit(client, account["headers"], "khong-co-project").status_code == 404


def test_review_requires_admin(client: TestClient, user_factory) -> None:
    account = user_factory()
    submission = _submit(client, account["headers"], "cli-quiz-python").json()
    response = _review(client, account["headers"], submission["id"])
    assert response.status_code == 403


def test_accepted_submission_grants_xp_and_badge(
    client: TestClient, db: Session, user_factory
) -> None:
    """Bài nộp được duyệt phải cộng đúng XP và cấp badge project đầu tiên."""
    account = user_factory()
    admin = user_factory(is_admin=True, db=db)

    submission = _submit(client, account["headers"], "cli-quiz-python").json()
    assert submission["status"] == "pending"
    assert submission["awarded_xp"] == 0

    result = _review(client, admin["headers"], submission["id"]).json()
    assert result["submission"]["status"] == "accepted"
    assert result["submission"]["awarded_xp"] == 100
    assert "first-step" in {badge["slug"] for badge in result["awarded_badges"]}

    progress = client.get("/api/v1/me/progress", headers=account["headers"]).json()
    assert progress["total_xp"] == 100
    assert progress["completed_projects"] == 1
    assert progress["highest_level"] == 0
    assert {badge["badge"]["slug"] for badge in progress["badges"]} == {"first-step"}


def test_rejected_submission_does_not_grant_xp(
    client: TestClient, db: Session, user_factory
) -> None:
    account = user_factory()
    admin = user_factory(is_admin=True, db=db)

    submission = _submit(client, account["headers"], "cli-quiz-python").json()
    result = _review(client, admin["headers"], submission["id"], status="rejected").json()
    assert result["submission"]["awarded_xp"] == 0

    progress = client.get("/api/v1/me/progress", headers=account["headers"]).json()
    assert progress["total_xp"] == 0
    assert progress["completed_projects"] == 0


def test_cannot_submit_twice_after_accepted(client: TestClient, db: Session, user_factory) -> None:
    account = user_factory()
    admin = user_factory(is_admin=True, db=db)

    submission = _submit(client, account["headers"], "cli-quiz-python").json()
    _review(client, admin["headers"], submission["id"])

    assert _submit(client, account["headers"], "cli-quiz-python").status_code == 409


def test_cannot_review_twice(client: TestClient, db: Session, user_factory) -> None:
    account = user_factory()
    admin = user_factory(is_admin=True, db=db)

    submission = _submit(client, account["headers"], "cli-quiz-python").json()
    assert _review(client, admin["headers"], submission["id"]).status_code == 200
    assert _review(client, admin["headers"], submission["id"]).status_code == 409


def test_recommendations_respect_prerequisites(
    client: TestClient, db: Session, user_factory
) -> None:
    """Người dùng mới chỉ được gợi ý project không có điều kiện tiên quyết."""
    account = user_factory()
    items = client.get("/api/v1/me/recommendations", headers=account["headers"]).json()
    assert items
    assert all(item["project"]["level"]["id"] == 0 for item in items[:3])

    slugs = {item["project"]["slug"] for item in items}
    assert "house-price-regression" not in slugs

    admin = user_factory(is_admin=True, db=db)
    submission = _submit(client, account["headers"], "cli-quiz-python").json()
    _review(client, admin["headers"], submission["id"])

    updated = client.get("/api/v1/me/recommendations", headers=account["headers"]).json()
    updated_slugs = {item["project"]["slug"] for item in updated}
    # Project đã hoàn thành phải biến mất, project được nó mở khoá phải xuất hiện.
    assert "cli-quiz-python" not in updated_slugs
    assert "csv-grade-report" in updated_slugs


def test_submission_list_and_filter(client: TestClient, db: Session, user_factory) -> None:
    account = user_factory()
    admin = user_factory(is_admin=True, db=db)

    first = _submit(client, account["headers"], "cli-quiz-python").json()
    _submit(client, account["headers"], "image-basics-lab")
    _review(client, admin["headers"], first["id"])

    page = client.get("/api/v1/me/submissions", headers=account["headers"]).json()
    assert page["total"] == 2

    pending = client.get(
        "/api/v1/me/submissions", params={"status": "pending"}, headers=account["headers"]
    ).json()
    assert pending["total"] == 1
    assert pending["items"][0]["project"]["slug"] == "image-basics-lab"


def test_leaderboard_orders_by_xp(client: TestClient, db: Session, user_factory) -> None:
    account = user_factory()
    admin = user_factory(is_admin=True, db=db)

    submission = _submit(client, account["headers"], "text-cleaning-toolkit").json()
    _review(client, admin["headers"], submission["id"])

    rows = client.get("/api/v1/leaderboard").json()
    assert rows[0]["rank"] == 1
    xp_values = [row["total_xp"] for row in rows]
    assert xp_values == sorted(xp_values, reverse=True)
    assert any(row["username"] == account["user"]["username"] for row in rows)
