"""Kiểm thử các sửa đổi sau vòng thử nghiệm với người dùng thật (ux-xac-nhan).

Bốn nhóm: tìm kiếm giữ dấu và khớp đầu từ (SV-03, SV-04), chọn ngẫu nhiên
project vừa sức (SV-09), hàng đợi chấm bài kèm lịch sử nộp (GV-03) và nhận xét
bắt buộc khi bài không đạt (GV-04). Dùng chung fixture trong conftest.py.
"""

from __future__ import annotations

import re

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.chuoi import bo_dau

P = "/api/v1/projects"
CAU_THIEU_NHAN_XET = "Cần ghi nhận xét khi kết quả là cần sửa lại hoặc chưa đạt."
REPO = "https://github.com/ux/bai-nop"


def _tat_ca(client: TestClient, **params) -> list[dict]:
    items, page = [], 1
    while True:
        body = client.get(P, params={"page": page, "page_size": 100, **params}).json()
        items += body["items"]
        if page >= body["pages"]:
            return items
        page += 1


def _submit(client: TestClient, headers: dict, slug: str):
    return client.post(f"{P}/{slug}/submissions", json={"repo_url": REPO}, headers=headers)


def _review(client: TestClient, headers: dict, sid: int, **body):
    return client.patch(f"/api/v1/submissions/{sid}/review", json=body, headers=headers)


def _hang_doi(client: TestClient, mentor: dict) -> list[dict]:
    return client.get(
        "/api/v1/submissions",
        params={"status": "pending", "page_size": 100},
        headers=mentor["headers"],
    ).json()["items"]


# ---------------------------------------------------------------- tìm kiếm


def test_accented_query_matches_only_accented_words(client: TestClient) -> None:
    """Gõ "ảnh" không được ra "thành" hay "ảnh hưởng" ở giữa từ khác; gõ "dễ" không ra "để"."""
    co_dau = _tat_ca(client, q="ảnh")
    assert co_dau
    mau = re.compile(r"(?<!\w)ảnh")
    for item in co_dau:
        van_ban = [item["title"], item["summary"], item["track"]["name"]]
        van_ban += [skill["name"] for skill in item["skills"]]
        assert any(mau.search(v.lower()) for v in van_ban), item["slug"]

    khong_dau = _tat_ca(client, q="anh")
    assert {i["id"] for i in co_dau} <= {i["id"] for i in khong_dau}
    # "de" không dấu khớp "để", "đếm"; "dễ" có dấu thì không.
    assert not any("dễ" not in (i["title"] + i["summary"]).lower() for i in _tat_ca(client, q="dễ"))


def test_unaccented_query_matches_at_word_start_only(client: TestClient) -> None:
    """ "anh" khớp "Ảnh", "ảnh" nhưng không khớp "thành" hay "hành"."""
    items = _tat_ca(client, q="anh")
    mau = re.compile(r"(?<!\w)anh")
    for item in items:
        van_ban = [item["title"], item["summary"], item["track"]["name"]]
        van_ban += [skill["name"] for skill in item["skills"]]
        assert any(mau.search(bo_dau(v)) for v in van_ban), item["slug"]
    assert not any("thành" in i["title"].lower() and "ảnh" not in i["title"].lower() for i in items)


def test_track_name_query_returns_whole_track(client: TestClient) -> None:
    """Gõ tên track "python" ra ít nhất mọi project của track Python."""
    stats = client.get("/api/v1/stats").json()
    so_python = next(t["projects"] for t in stats["by_track"] if t["track"]["slug"] == "python")
    items = _tat_ca(client, q="python")
    assert so_python == 18
    assert sum(1 for i in items if i["track"]["slug"] == "python") == so_python
    assert len(items) >= so_python


def test_title_matches_are_listed_before_other_matches(client: TestClient) -> None:
    items = _tat_ca(client, q="ảnh")
    o_ten = [re.search(r"(?<!\w)ảnh", i["title"].lower()) is not None for i in items]
    # Mọi True đứng trước mọi False.
    assert o_ten == sorted(o_ten, reverse=True)
    assert True in o_ten and False in o_ten


def test_list_rows_carry_prerequisites(client: TestClient) -> None:
    """Dòng danh sách biết project nào còn khoá mà không phải mở chi tiết."""
    items = _tat_ca(client)
    co_khoa = [i for i in items if i["prerequisites"]]
    assert co_khoa
    assert {"id", "slug", "title", "reward_points"} <= set(co_khoa[0]["prerequisites"][0])


# ---------------------------------------------------------------- ngẫu nhiên


def test_random_for_anonymous_follows_the_level_filter_only(client: TestClient) -> None:
    for _ in range(10):
        body = client.get(f"{P}/random", params={"level": [0, 1]}).json()
        assert body["level"]["id"] in (0, 1)


def test_random_for_logged_in_user_is_suitable(
    client: TestClient, db: Session, user_factory
) -> None:
    """Người mới: chỉ level 0 và không có project còn khoá. Xong level 0 thì thêm level 1."""
    account = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    for _ in range(15):
        body = client.get(f"{P}/random", headers=account["headers"]).json()
        assert body["level"]["id"] == 0
        assert body["prerequisites"] == []

    sid = _submit(client, account["headers"], "cli-quiz-python").json()["id"]
    assert _review(client, mentor["headers"], sid, status="accepted", score=90).status_code == 200
    thay = set()
    for _ in range(40):
        body = client.get(f"{P}/random", headers=account["headers"]).json()
        assert body["level"]["id"] in (0, 1)
        assert body["slug"] != "cli-quiz-python"
        # csv-grade-report cần cli-quiz-python, giờ đã mở khoá nên được phép; project
        # còn tiên quyết chưa xong thì không.
        for tien_quyet in body["prerequisites"]:
            assert tien_quyet["slug"] == "cli-quiz-python"
        thay.add(body["level"]["id"])
    assert thay == {0, 1}


def test_random_with_explicit_level_still_skips_finished_projects(
    client: TestClient, db: Session, user_factory
) -> None:
    account = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    sid = _submit(client, account["headers"], "image-basics-lab").json()["id"]
    _review(client, mentor["headers"], sid, status="accepted")
    for _ in range(30):
        body = client.get(f"{P}/random", params={"level": 0}, headers=account["headers"]).json()
        assert body["level"]["id"] == 0
        assert body["slug"] != "image-basics-lab"


def test_random_rejects_a_broken_token(client: TestClient) -> None:
    r = client.get(f"{P}/random", headers={"Authorization": "Bearer hong"})
    assert r.status_code == 401


# ---------------------------------------------------------------- chấm bài


def test_revision_and_rejection_require_feedback(
    client: TestClient, db: Session, user_factory
) -> None:
    account = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    sid = _submit(client, account["headers"], "text-cleaning-toolkit").json()["id"]

    for ket_qua in ("revision", "rejected"):
        for feedback in ("", "   "):
            r = _review(client, mentor["headers"], sid, status=ket_qua, feedback=feedback)
            assert r.status_code == 422, r.text
            assert r.json()["detail"] == CAU_THIEU_NHAN_XET
    # Bài vẫn chờ chấm, và đạt thì không cần nhận xét.
    r = _review(client, mentor["headers"], sid, status="accepted")
    assert r.status_code == 200, r.text


def test_mentor_queue_shows_attempt_and_previous_review(
    client: TestClient, db: Session, user_factory
) -> None:
    account = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    slug = "excel-attendance-reader"

    lan_1 = _submit(client, account["headers"], slug).json()
    hang_doi = _hang_doi(client, mentor)
    bai = next(b for b in hang_doi if b["id"] == lan_1["id"])
    assert bai["attempt"] == 1 and bai["previous_review"] is None
    assert bai["project"]["level"]["id"] == 0 and bai["project"]["track"]["slug"]

    r = _review(
        client, mentor["headers"], lan_1["id"], status="revision", feedback="Thiếu phần đếm."
    )
    assert r.status_code == 200
    lan_2 = _submit(client, account["headers"], slug)
    assert lan_2.status_code == 201
    hang_doi = _hang_doi(client, mentor)
    bai = next(b for b in hang_doi if b["id"] == lan_2.json()["id"])
    assert bai["attempt"] == 2
    assert bai["previous_review"]["status"] == "revision"
    assert bai["previous_review"]["feedback"] == "Thiếu phần đếm."
    assert bai["previous_review"]["reviewed_at"] is not None

    # Danh sách của chính người nộp cũng kèm level và track của project.
    cua_toi = client.get("/api/v1/me/submissions", headers=account["headers"]).json()["items"]
    assert all("level" in b["project"] and "track" in b["project"] for b in cua_toi)
