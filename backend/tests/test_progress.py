"""Kiểm thử luồng nộp bài, chấm bài, điểm tích luỹ, badge và gợi ý."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.progress import Submission

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


def test_accepted_submission_grants_points_and_badge(
    client: TestClient, db: Session, user_factory
) -> None:
    """Bài nộp được duyệt phải cộng đúng điểm tích luỹ và cấp badge project đầu tiên."""
    account = user_factory()
    admin = user_factory(is_mentor=True, db=db)

    submission = _submit(client, account["headers"], "cli-quiz-python").json()
    assert submission["status"] == "pending"
    assert submission["awarded_points"] == 0

    result = _review(client, admin["headers"], submission["id"]).json()
    assert result["submission"]["status"] == "accepted"
    assert result["submission"]["awarded_points"] == 100
    assert "first-step" in {badge["slug"] for badge in result["awarded_badges"]}

    progress = client.get("/api/v1/me/progress", headers=account["headers"]).json()
    assert progress["total_points"] == 100
    assert progress["completed_projects"] == 1
    assert progress["highest_level"] == 0
    assert {badge["badge"]["slug"] for badge in progress["badges"]} == {"first-step"}


def test_rejected_submission_does_not_grant_points(
    client: TestClient, db: Session, user_factory
) -> None:
    account = user_factory()
    admin = user_factory(is_mentor=True, db=db)

    submission = _submit(client, account["headers"], "cli-quiz-python").json()
    result = _review(client, admin["headers"], submission["id"], status="rejected").json()
    assert result["submission"]["awarded_points"] == 0

    progress = client.get("/api/v1/me/progress", headers=account["headers"]).json()
    assert progress["total_points"] == 0
    assert progress["completed_projects"] == 0


def test_cannot_submit_twice_after_accepted(client: TestClient, db: Session, user_factory) -> None:
    account = user_factory()
    admin = user_factory(is_mentor=True, db=db)

    submission = _submit(client, account["headers"], "cli-quiz-python").json()
    _review(client, admin["headers"], submission["id"])

    assert _submit(client, account["headers"], "cli-quiz-python").status_code == 409


def test_cannot_review_twice(client: TestClient, db: Session, user_factory) -> None:
    account = user_factory()
    admin = user_factory(is_mentor=True, db=db)

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

    admin = user_factory(is_mentor=True, db=db)
    submission = _submit(client, account["headers"], "cli-quiz-python").json()
    _review(client, admin["headers"], submission["id"])

    updated = client.get("/api/v1/me/recommendations", headers=account["headers"]).json()
    updated_slugs = {item["project"]["slug"] for item in updated}
    # Project đã hoàn thành phải biến mất, project được nó mở khoá phải xuất hiện.
    assert "cli-quiz-python" not in updated_slugs
    assert "csv-grade-report" in updated_slugs


def test_submission_list_and_filter(client: TestClient, db: Session, user_factory) -> None:
    account = user_factory()
    admin = user_factory(is_mentor=True, db=db)

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


def test_submission_list_needs_mentor_rights(client: TestClient, user_factory) -> None:
    account = user_factory()
    assert client.get("/api/v1/submissions").status_code == 401
    assert client.get("/api/v1/submissions", headers=account["headers"]).status_code == 403


def test_submission_list_shows_the_author(client: TestClient, db: Session, user_factory) -> None:
    """Màn hình chấm bài cần biết ai nộp, nên mỗi bài nộp phải kèm người nộp."""
    account = user_factory()
    admin = user_factory(is_mentor=True, db=db)
    _submit(client, account["headers"], "panorama-stitching-campus")

    page = client.get(
        "/api/v1/submissions",
        params={"status": "pending", "page_size": 100},
        headers=admin["headers"],
    ).json()

    mine = [
        item for item in page["items"] if item["user"]["username"] == account["user"]["username"]
    ]
    assert len(mine) == 1
    assert mine[0]["project"]["slug"] == "panorama-stitching-campus"
    assert mine[0]["status"] == "pending"


def test_resubmitting_while_pending_replaces_the_waiting_submission(
    client: TestClient, user_factory
) -> None:
    """Nộp lại lúc bài trước còn chờ chấm thì thay nội dung bài đó, không thêm bài mới."""
    account = user_factory()

    dau = _submit(client, account["headers"], "image-basics-lab")
    assert dau.status_code == 201

    sau = client.post(
        "/api/v1/projects/image-basics-lab/submissions",
        json={"repo_url": "https://github.com/sinhvien/ban-sua", "note": "Đã sửa đường dẫn."},
        headers=account["headers"],
    )
    assert sau.status_code == 200
    assert sau.json()["id"] == dau.json()["id"]
    assert sau.json()["repo_url"] == "https://github.com/sinhvien/ban-sua"

    trang = client.get("/api/v1/me/submissions", headers=account["headers"]).json()
    cua_project = [item for item in trang["items"] if item["project"]["slug"] == "image-basics-lab"]
    assert len(cua_project) == 1


def test_one_project_grants_points_only_once(client: TestClient, db: Session, user_factory) -> None:
    """Hai bài nộp cùng một project, cùng được duyệt, chỉ cộng điểm tích luỹ một lần.

    Qua API thì không tạo được hai bài cùng chờ chấm cho một project nữa, nên bài
    thứ hai ở đây được ghi thẳng vào cơ sở dữ liệu. Đó là hình ảnh của dữ liệu cũ
    còn sót lại, và quy tắc cộng điểm phải đứng vững trước cả trường hợp đó.
    """
    account = user_factory()
    admin = user_factory(is_mentor=True, db=db)

    dau = _submit(client, account["headers"], "image-basics-lab").json()

    them = Submission(
        user_id=account["user"]["id"],
        project_id=dau["project"]["id"],
        repo_url=REPO,
        note="Bản nộp thứ hai.",
    )
    db.add(them)
    db.commit()
    db.refresh(them)

    ket_dau = _review(client, admin["headers"], dau["id"]).json()
    ket_sau = _review(client, admin["headers"], them.id).json()

    assert ket_dau["submission"]["awarded_points"] > 0
    assert ket_sau["submission"]["status"] == "accepted"
    assert ket_sau["submission"]["awarded_points"] == 0

    tien_do = client.get("/api/v1/me/progress", headers=account["headers"]).json()
    assert tien_do["completed_projects"] == 1
    assert tien_do["total_points"] == ket_dau["submission"]["awarded_points"]


def test_review_cannot_set_status_back_to_pending(
    client: TestClient, db: Session, user_factory
) -> None:
    account = user_factory()
    admin = user_factory(is_mentor=True, db=db)
    bai = _submit(client, account["headers"], "code-review-agent").json()

    phan_hoi = _review(client, admin["headers"], bai["id"], status="pending")
    assert phan_hoi.status_code == 422


def test_submission_url_longer_than_the_column_is_rejected(
    client: TestClient, user_factory
) -> None:
    """Đường dẫn dài hơn độ rộng cột phải bị chặn, vì SQLite không tự chặn."""
    account = user_factory()
    phan_hoi = client.post(
        "/api/v1/projects/cli-quiz-python/submissions",
        json={"repo_url": "https://github.com/" + "a" * 600},
        headers=account["headers"],
    )
    assert phan_hoi.status_code == 422


def test_submission_note_is_trimmed(client: TestClient, user_factory) -> None:
    account = user_factory()
    phan_hoi = client.post(
        "/api/v1/projects/id-photo-quality-checker/submissions",
        json={"repo_url": REPO, "note": "   Đã làm xong.   "},
        headers=account["headers"],
    )
    assert phan_hoi.status_code == 201
    assert phan_hoi.json()["note"] == "Đã làm xong."


def test_leaderboard_orders_by_points(client: TestClient, db: Session, user_factory) -> None:
    """Bảng xếp hạng xếp theo điểm tích luỹ, người nhiều điểm nhất đứng đầu."""
    account = user_factory()
    admin = user_factory(is_mentor=True, db=db)

    bai = _submit(client, account["headers"], "text-cleaning-toolkit").json()
    _review(client, admin["headers"], bai["id"])

    rows = client.get("/api/v1/leaderboard").json()
    assert rows[0]["rank"] == 1
    diem = [row["total_points"] for row in rows]
    assert diem == sorted(diem, reverse=True)
    assert any(row["username"] == account["user"]["username"] for row in rows)


def test_nobody_reviews_their_own_submission(client: TestClient, db: Session, user_factory) -> None:
    """Giảng viên nộp bài thì vẫn phải để người khác chấm, không tự duyệt cho mình."""
    giang_vien = user_factory(is_mentor=True, db=db)
    bai = _submit(client, giang_vien["headers"], "ops-incident-agent").json()

    tu_cham = _review(client, giang_vien["headers"], bai["id"])
    assert tu_cham.status_code == 403
    assert "tự chấm bài của mình" in tu_cham.json()["detail"]

    # Một giảng viên khác thì chấm được bình thường.
    nguoi_khac = user_factory(is_mentor=True, db=db)
    assert _review(client, nguoi_khac["headers"], bai["id"]).status_code == 200


def test_locked_project_cannot_be_submitted(client: TestClient, db: Session, user_factory) -> None:
    """Project còn tiên quyết chưa hoàn thành thì chưa nộp bài được."""
    account = user_factory()
    admin = user_factory(is_mentor=True, db=db)

    bi_khoa = client.post(
        "/api/v1/projects/csv-grade-report/submissions",
        json={"repo_url": REPO},
        headers=account["headers"],
    )
    assert bi_khoa.status_code == 409
    assert "Ứng dụng trắc nghiệm chạy trên dòng lệnh" in bi_khoa.json()["detail"]

    # Hoàn thành project tiên quyết thì project kia mở khoá.
    bai = _submit(client, account["headers"], "cli-quiz-python").json()
    _review(client, admin["headers"], bai["id"])
    assert _submit(client, account["headers"], "csv-grade-report").status_code == 201


def test_leaderboard_lists_students_only(client: TestClient, db: Session, user_factory) -> None:
    """Giảng viên là người chấm bài, không đứng chung bảng xếp hạng với sinh viên."""
    giang_vien = user_factory(is_mentor=True, db=db)
    rows = client.get("/api/v1/leaderboard", params={"limit": 100}).json()
    assert all(row["username"] != giang_vien["user"]["username"] for row in rows)


def test_reviewing_the_same_submission_twice_is_refused(
    client: TestClient, db: Session, user_factory
) -> None:
    """Người chấm thứ hai phải nhận lỗi, không được im lặng ghi đè kết quả của người trước."""
    account = user_factory()
    admin = user_factory(is_mentor=True, db=db)
    khac = user_factory(is_mentor=True, db=db)

    bai = _submit(client, account["headers"], "cli-quiz-python").json()
    assert _review(client, admin["headers"], bai["id"], status="accepted").status_code == 200

    lan_hai = _review(client, khac["headers"], bai["id"], status="rejected")
    assert lan_hai.status_code == 409
    assert lan_hai.json()["detail"] == "Bài nộp này đã được chấm."

    # Kết quả của người chấm đầu tiên còn nguyên.
    trang = client.get("/api/v1/me/submissions", headers=account["headers"]).json()
    cua_bai = next(item for item in trang["items"] if item["id"] == bai["id"])
    assert cua_bai["status"] == "accepted"


def test_progress_reports_completion_by_level(
    client: TestClient, db: Session, user_factory
) -> None:
    """Tiến độ phải kèm số project đã hoàn thành trên tổng số của từng level."""
    account = user_factory()
    admin = user_factory(is_mentor=True, db=db)

    bai = _submit(client, account["headers"], "image-basics-lab").json()
    _review(client, admin["headers"], bai["id"])

    tien_do = client.get("/api/v1/me/progress", headers=account["headers"]).json()
    theo_level = {muc["level"]["id"]: muc for muc in tien_do["by_level"]}

    assert len(theo_level) == 6
    assert theo_level[0]["completed"] == 1
    assert theo_level[0]["total"] == 25
    assert sum(muc["total"] for muc in theo_level.values()) == 200
