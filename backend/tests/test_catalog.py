"""Kiểm thử phần catalog."""

from __future__ import annotations

from fastapi.testclient import TestClient


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
    assert page["total"] == 36
    assert page["pages"] == 8


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
