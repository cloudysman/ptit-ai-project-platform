"""Kiểm thử phần catalog."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.chuoi import bo_dau
from app.models.catalog import Project
from app.models.enums import ProjectSort


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_list_levels_and_tracks(client: TestClient) -> None:
    levels = client.get("/api/v1/levels").json()
    assert [level["id"] for level in levels] == [0, 1, 2, 3, 4, 5]

    tracks = client.get("/api/v1/tracks").json()
    assert len(tracks) == 11
    assert tracks == sorted(tracks, key=lambda track: (track["order_index"], track["name"]))


def test_list_projects_pagination(client: TestClient) -> None:
    response = client.get("/api/v1/projects", params={"page": 1, "page_size": 5})
    assert response.status_code == 200
    page = response.json()
    assert len(page["items"]) == 5
    assert page["total"] == 200
    assert page["pages"] == 40


def test_filter_by_level_and_track(client: TestClient) -> None:
    response = client.get(
        "/api/v1/projects",
        params={"level": [0, 1], "track": "data-science", "page_size": 50},
    )
    items = response.json()["items"]
    assert items
    assert all(item["level"]["id"] in (0, 1) for item in items)
    assert all(item["track"]["slug"] == "data-science" for item in items)


def test_filter_by_skill_does_not_duplicate(client: TestClient) -> None:
    """Một project khớp nhiều skill vẫn chỉ được trả về một lần."""
    response = client.get("/api/v1/projects", params={"skill": ["pandas", "eda"], "page_size": 50})
    items = response.json()["items"]
    slugs = [item["slug"] for item in items]
    assert len(slugs) == len(set(slugs))


def test_search_and_sort(client: TestClient) -> None:
    response = client.get("/api/v1/projects", params={"q": "gợi ý", "page_size": 50})
    assert response.status_code == 200

    response = client.get("/api/v1/projects", params={"sort": "-hours", "page_size": 5})
    hours = [item["estimated_hours"] for item in response.json()["items"]]
    assert hours == sorted(hours, reverse=True)


def test_invalid_sort_is_rejected(client: TestClient) -> None:
    response = client.get("/api/v1/projects", params={"sort": "khong-ton-tai"})
    assert response.status_code == 422


def test_every_sort_option_works(client: TestClient) -> None:
    """Mọi giá trị sort công bố trong tài liệu đều phải chạy được."""
    for option in ProjectSort:
        response = client.get("/api/v1/projects", params={"sort": option.value, "page_size": 5})
        assert response.status_code == 200, option.value


def test_unpublished_project_is_hidden(client: TestClient, db: Session) -> None:
    """Project chưa xuất bản không hiện trong danh sách và không đọc được chi tiết."""
    track_id = db.scalar(select(Project.track_id))
    hidden = Project(
        slug="project-chua-xuat-ban",
        title="Project chưa xuất bản",
        level_id=0,
        track_id=track_id,
        estimated_hours=1,
        reward_points=0,
        is_published=False,
    )
    db.add(hidden)
    db.commit()
    try:
        assert client.get("/api/v1/projects/project-chua-xuat-ban").status_code == 404
        assert client.get("/api/v1/projects/project-chua-xuat-ban/hints").status_code == 404

        page = client.get("/api/v1/projects", params={"page_size": 100}).json()
        assert "project-chua-xuat-ban" not in {item["slug"] for item in page["items"]}
    finally:
        db.delete(hidden)
        db.commit()


def test_project_detail(client: TestClient) -> None:
    response = client.get("/api/v1/projects/house-price-regression")
    assert response.status_code == 200
    project = response.json()
    assert project["level"]["id"] == 1
    assert project["deliverables"]
    assert [item["slug"] for item in project["prerequisites"]] == ["student-score-eda"]


def test_project_not_found(client: TestClient) -> None:
    assert client.get("/api/v1/projects/khong-co-project-nay").status_code == 404


def test_hints_are_revealed_gradually(client: TestClient) -> None:
    """Backend chỉ trả về gợi ý tới đúng tầng được yêu cầu."""
    first = client.get("/api/v1/projects/cli-quiz-python/hints").json()
    assert [hint["tier"] for hint in first] == [1]

    full = client.get("/api/v1/projects/cli-quiz-python/hints", params={"max_tier": 3}).json()
    assert [hint["tier"] for hint in full] == [1, 2, 3]


def test_random_project(client: TestClient) -> None:
    response = client.get("/api/v1/projects/random", params={"level": 0})
    assert response.status_code == 200
    assert response.json()["level"]["id"] == 0


def test_roadmap_detail(client: TestClient) -> None:
    response = client.get("/api/v1/roadmaps/ai-engineer")
    assert response.status_code == 200
    steps = response.json()["steps"]
    assert [step["order_index"] for step in steps] == list(range(1, len(steps) + 1))


def test_stats_match_the_project_list(client: TestClient) -> None:
    """Số liệu tổng quan phải khớp với chính danh sách project mà API trả về."""
    stats = client.get("/api/v1/stats").json()
    total = client.get("/api/v1/projects", params={"page_size": 1}).json()["total"]

    assert stats["projects"] == total
    assert sum(item["projects"] for item in stats["by_level"]) == total
    assert sum(item["projects"] for item in stats["by_track"]) == total
    # Level và track chưa có project vẫn phải xuất hiện, để frontend dựng đủ mục lục.
    assert [item["level"]["id"] for item in stats["by_level"]] == [0, 1, 2, 3, 4, 5]
    assert len(stats["by_track"]) == 11


def test_stats_count_only_published_projects(client: TestClient, db: Session) -> None:
    project = db.scalar(select(Project).where(Project.slug == "cli-quiz-python"))
    project.is_published = False
    db.commit()
    try:
        stats = client.get("/api/v1/stats").json()
        assert stats["projects"] == 199
    finally:
        project.is_published = True
        db.commit()


def test_search_ignores_vietnamese_letter_case(client: TestClient) -> None:
    """Gõ chữ thường phải tìm được cả tiêu đề viết hoa chữ cái tiếng Việt có dấu."""
    hoa = client.get("/api/v1/projects", params={"q": "Ứng dụng", "page_size": 50}).json()
    thuong = client.get("/api/v1/projects", params={"q": "ứng dụng", "page_size": 50}).json()

    assert hoa["total"] > 0
    assert hoa["total"] == thuong["total"]
    assert any("Ứng dụng" in item["title"] for item in thuong["items"])


def test_search_treats_wildcards_as_plain_text(client: TestClient) -> None:
    """Dấu phần trăm là chữ người dùng gõ, không phải ký tự đại diện của LIKE."""
    tat_ca = client.get("/api/v1/projects", params={"page_size": 1}).json()["total"]
    ket = client.get("/api/v1/projects", params={"q": "%", "page_size": 100}).json()

    assert tat_ca > 0
    assert ket["total"] == 0


def test_reversed_hour_range_is_rejected(client: TestClient) -> None:
    """Khoảng thời gian đảo ngược phải báo lỗi thay vì trả về danh sách rỗng."""
    phan_hoi = client.get("/api/v1/projects", params={"min_hours": 100, "max_hours": 1})
    assert phan_hoi.status_code == 422
    assert phan_hoi.json()["detail"] == "Thời gian tối thiểu đang lớn hơn thời gian tối đa."

    # Hai giá trị bằng nhau vẫn là một khoảng dùng được.
    assert (
        client.get("/api/v1/projects", params={"min_hours": 4, "max_hours": 4}).status_code == 200
    )


def test_search_ignores_vietnamese_diacritics(client: TestClient) -> None:
    """Gõ không dấu vẫn phải ra project có tên đầy đủ dấu."""
    co_dau = client.get("/api/v1/projects", params={"q": "tiếng Việt", "page_size": 100}).json()
    khong_dau = client.get("/api/v1/projects", params={"q": "tieng viet", "page_size": 100}).json()

    assert co_dau["total"] > 0
    assert khong_dau["total"] == co_dau["total"]
    assert {item["slug"] for item in khong_dau["items"]} == {
        item["slug"] for item in co_dau["items"]
    }


def test_sort_by_title_follows_vietnamese_alphabet(client: TestClient) -> None:
    """Sắp theo tên phải đi theo chữ cái gốc, không theo vị trí chữ có dấu trong bảng mã."""
    ten = []
    for trang in (1, 2):
        page = client.get(
            "/api/v1/projects", params={"sort": "title", "page": trang, "page_size": 100}
        ).json()
        ten.extend(item["title"] for item in page["items"])

    assert len(ten) == 200
    assert ten == sorted(ten, key=bo_dau)
    # Chữ Ứ nằm giữa bảng chữ cái chứ không bị đẩy xuống sau chữ Z.
    assert ten[-1][0].lower() < "z"


def test_hour_filter_rejects_numbers_beyond_the_ceiling(client: TestClient) -> None:
    """Số giờ quá lớn phải bị từ chối ngay, không được để truy vấn hỏng ở tầng dưới."""
    assert client.get("/api/v1/projects", params={"min_hours": 10**20}).status_code == 422
    assert client.get("/api/v1/projects", params={"max_hours": 10**20}).status_code == 422
    assert client.get("/api/v1/projects", params={"min_hours": 1001}).status_code == 422
    assert client.get("/api/v1/projects", params={"min_hours": 1000}).status_code == 200
