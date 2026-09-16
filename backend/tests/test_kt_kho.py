"""Kiểm thử hợp đồng phần chỉ-đọc của kho project (lens kt6-api-kho).

Những phát hiện của lens này đã được sửa, nên các bài từng đánh dấu xfail nay
chạy như bài thường.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.chuoi import bo_dau
from app.models.catalog import Project
from app.models.user import User

SEED = Path(__file__).resolve().parents[1] / "app" / "seed"
P = "/api/v1/projects"


def _seed(name: str) -> list[dict]:
    return json.loads((SEED / f"{name}.json").read_text(encoding="utf-8"))


def _tat_ca(client: TestClient, **params) -> list[dict]:
    items, page = [], 1
    while True:
        body = client.get(P, params={"page": page, "page_size": 100, **params}).json()
        items += body["items"]
        if page >= body["pages"]:
            return items
        page += 1


# ---------------------------------------------------------------- phân trang


@pytest.mark.parametrize("page", ["0", "-1", "abc", "1.5", "", "2147483648", "1e1", "١"])
def test_page_out_of_range_is_422_in_vietnamese(client: TestClient, page: str) -> None:
    r = client.get(P, params={"page": page})
    assert r.status_code == 422
    assert "số trang" in r.json()["detail"]
    assert r.json()["errors"][0]["field"] == "page"


@pytest.mark.parametrize("page_size", ["0", "-1", "101", "abc", "", "1.5"])
def test_page_size_out_of_range_is_422(client: TestClient, page_size: str) -> None:
    r = client.get(P, params={"page_size": page_size})
    assert r.status_code == 422
    assert "số project mỗi trang" in r.json()["detail"]


def test_page_at_int32_ceiling_is_empty_not_500(client: TestClient) -> None:
    r = client.get(P, params={"page": 2147483647})
    assert r.status_code == 200
    assert r.json()["items"] == [] and r.json()["total"] == 200


def test_walking_every_page_collects_200_unique_projects(client: TestClient) -> None:
    ids = []
    for page in range(1, 11):
        ids += [i["id"] for i in client.get(P, params={"page": page}).json()["items"]]
    assert len(ids) == 200 and len(set(ids)) == 200


def test_last_partial_page(client: TestClient) -> None:
    body = client.get(P, params={"page": 67, "page_size": 3}).json()
    assert body["pages"] == 67 and len(body["items"]) == 2


def test_repeated_scalar_param_last_wins(client: TestClient) -> None:
    assert client.get(P + "?page=1&page=3&page_size=4").json()["page"] == 3


# ---------------------------------------------------------------- sắp xếp


KHOA = {
    "level": lambda i: (i["level"]["id"], i["estimated_hours"], i["id"]),
    "-level": lambda i: (-i["level"]["id"], -i["estimated_hours"], i["id"]),
    "hours": lambda i: (i["estimated_hours"], i["id"]),
    "-hours": lambda i: (-i["estimated_hours"], i["id"]),
    "points": lambda i: (i["reward_points"], i["id"]),
    "-points": lambda i: (-i["reward_points"], i["id"]),
    "title": lambda i: (bo_dau(i["title"]), i["id"]),
}


@pytest.mark.parametrize("sort", list(KHOA))
def test_sort_order_is_total_and_stable_by_id(client: TestClient, sort: str) -> None:
    items = _tat_ca(client, sort=sort)
    assert len(items) == 200
    assert [i["id"] for i in items] == [i["id"] for i in sorted(items, key=KHOA[sort])]


@pytest.mark.parametrize("sort", ["-title", "LEVEL", "", " level", "newest,title", "-newest"])
def test_unknown_sort_values_are_422_and_not_echoed(client: TestClient, sort: str) -> None:
    r = client.get(P, params={"sort": sort})
    assert r.status_code == 422
    assert "cách sắp xếp" in r.json()["detail"]
    assert "<" not in r.text


# ---------------------------------------------------------------- bộ lọc


def test_level_filters_match_stats(client: TestClient) -> None:
    stats = client.get("/api/v1/stats").json()
    for row in stats["by_level"]:
        lv = row["level"]["id"]
        items = _tat_ca(client, level=lv)
        assert len(items) == row["projects"]
        assert all(i["level"]["id"] == lv for i in items)


def test_track_filters_match_stats_and_seed(client: TestClient) -> None:
    stats = client.get("/api/v1/stats").json()
    seed = Counter(p["track"] for p in _seed("projects"))
    for row in stats["by_track"]:
        slug = row["track"]["slug"]
        assert row["projects"] == seed[slug]
        items = _tat_ca(client, track=slug)
        assert len(items) == row["projects"] and all(i["track"]["slug"] == slug for i in items)


def test_multi_value_filters_are_unions(client: TestClient) -> None:
    stats = client.get("/api/v1/stats").json()
    lv = {r["level"]["id"]: r["projects"] for r in stats["by_level"]}
    tr = {r["track"]["slug"]: r["projects"] for r in stats["by_track"]}
    assert client.get(P + "?level=0&level=1").json()["total"] == lv[0] + lv[1]
    assert client.get(P + "?level=0&level=0").json()["total"] == lv[0]
    assert client.get(P + "?track=python&track=nlp").json()["total"] == tr["python"] + tr["nlp"]
    assert client.get(P + "?track=python&track=khong-co").json()["total"] == tr["python"]
    assert client.get(P + "?" + "&".join(f"level={i}" for i in range(6))).json()["total"] == 200


@pytest.mark.parametrize("level", ["6", "-1", "abc", "0,1", "", "0x1"])
def test_bad_level_value_is_422(client: TestClient, level: str) -> None:
    r = client.get(P, params={"level": level})
    assert r.status_code == 422 and "level" in r.json()["detail"]


def test_one_bad_level_among_good_ones_rejects_whole_request(client: TestClient) -> None:
    assert client.get(P + "?level=0&level=6").status_code == 422


@pytest.mark.parametrize(
    "track",
    [
        "khong-co",
        "DATA-SCIENCE",
        " data-science",
        "data_science",
        "data-science%",
        "'; DROP TABLE project; --",
        "a" * 128,
    ],
)
def test_unknown_track_slug_returns_empty_200(client: TestClient, track: str) -> None:
    r = client.get(P, params={"track": track})
    assert r.status_code == 200 and r.json()["total"] == 0


def test_track_and_skill_length_bounds(client: TestClient) -> None:
    assert client.get(P, params={"track": ""}).status_code == 422
    assert client.get(P, params={"track": "a" * 129}).status_code == 422
    assert client.get(P, params={"skill": "a" * 129}).status_code == 422
    assert client.get(P, params={"skill": ""}).status_code == 422


def test_skill_filter_counts_and_union(client: TestClient) -> None:
    tat = _tat_ca(client)
    dem = Counter(s["slug"] for i in tat for s in i["skills"])
    a, b = list(dem)[:2]
    assert client.get(P, params={"skill": a}).json()["total"] == dem[a]
    hop = {i["id"] for i in tat if {a, b} & {s["slug"] for s in i["skills"]}}
    items = _tat_ca(client, skill=[a, b])
    assert len(items) == len(hop) and len({i["id"] for i in items}) == len(items)


def test_hours_range_boundaries(client: TestClient) -> None:
    tat = _tat_ca(client)
    assert client.get(P, params={"min_hours": 8, "max_hours": 16}).json()["total"] == sum(
        1 for i in tat if 8 <= i["estimated_hours"] <= 16
    )
    assert client.get(P, params={"min_hours": 1000, "max_hours": 1000}).status_code == 200
    assert client.get(P, params={"min_hours": 81}).json()["total"] == 0
    assert client.get(P, params={"min_hours": 80}).json()["total"] >= 1
    for v in ("0", "-1", "abc", "1001", "1.5", ""):
        assert client.get(P, params={"min_hours": v}).status_code == 422, v
        assert client.get(P, params={"max_hours": v}).status_code == 422, v


def test_max_hours_in_projects_json_documents_the_real_ceiling() -> None:
    """Ghi chú trong projects.py nói project dài nhất là 80 giờ, khớp với seed."""
    assert max(p["estimated_hours"] for p in _seed("projects")) == 80
    src = (Path(__file__).resolve().parents[1] / "app" / "api" / "v1" / "projects.py").read_text(
        encoding="utf-8"
    )
    assert "Project dài nhất trong kho là 80 giờ" in src


# ---------------------------------------------------------------- tìm kiếm


def _ky_vong(tat: list[dict], q: str) -> set[int]:
    """Quy tắc khớp của kho: từ khoá đứng đầu một từ; có dấu thì so giữ dấu; xét
    cả tên track và tên skill (xem _dieu_kien_khop trong app/services/catalog.py)."""
    q = q.strip()
    giu_dau = bo_dau(q) != q.lower()
    khoa = (lambda v: v.lower()) if giu_dau else bo_dau
    mau = re.compile(r"(?<!\w)" + re.escape(khoa(q)))

    def khop(i: dict) -> bool:
        cac_cot = [i["title"], i["summary"], i["track"]["name"], *(s["name"] for s in i["skills"])]
        return any(mau.search(khoa(v)) for v in cac_cot)

    return {i["id"] for i in tat if khop(i)}


@pytest.mark.parametrize(
    "q",
    [
        "nhận dạng",
        "nhan dang",
        "NHẬN DẠNG",
        "Ứng dụng",
        "ung dung",
        "mô hình",
        "API",
        "tiếng Việt",
        "Đổi tên",
        "đ",
        "d",
    ],
)
def test_search_matches_title_and_summary_without_diacritics(client: TestClient, q: str) -> None:
    tat = _tat_ca(client)
    items = _tat_ca(client, q=q)
    assert {i["id"] for i in items} == _ky_vong(tat, q)


def test_search_nfd_input_equals_nfc(client: TestClient) -> None:
    nfc = client.get(P, params={"q": "nhận dạng"}).json()["total"]
    nfd = client.get(P, params={"q": unicodedata.normalize("NFD", "nhận dạng")}).json()["total"]
    assert nfc == nfd > 0


@pytest.mark.parametrize(
    "q",
    ["%", "_", "\\", "%%", "a%b", "_a_", "[a-z]", "' OR 1=1 --", "​", "🐍", "<script>", "{{7*7}}"],
)
def test_search_wildcards_and_junk_are_literal(client: TestClient, q: str) -> None:
    r = client.get(P, params={"q": q})
    assert r.status_code == 200 and r.json()["total"] == 0


def test_search_length_bounds(client: TestClient) -> None:
    assert client.get(P, params={"q": ""}).status_code == 422
    assert client.get(P, params={"q": "a" * 100}).status_code == 200
    assert client.get(P, params={"q": "ứ" * 100}).status_code == 200
    r = client.get(P, params={"q": "a" * 101})
    assert r.status_code == 422 and "100" in r.json()["detail"]
    assert client.get(P, params={"q": "x" * 10_240}).status_code == 422


def test_search_trims_surrounding_whitespace(client: TestClient) -> None:
    assert (
        client.get(P, params={"q": "  nhan dang  "}).json()["total"]
        == client.get(P, params={"q": "nhan dang"}).json()["total"]
    )


@pytest.mark.parametrize("q", ["   ", "\t", "\n", " "])
def test_whitespace_only_search_is_rejected_like_empty(client: TestClient, q: str) -> None:
    r = client.get(P, params={"q": q})
    assert r.status_code == 422 and "từ khoá" in r.json()["detail"]


@pytest.mark.parametrize("q", ["\x00zzzz", "nhan\x00zzzz", "\x00"])
def test_nul_in_search_does_not_truncate_pattern(client: TestClient, q: str) -> None:
    r = client.get(P, params={"q": q})
    assert r.status_code in (200, 422)
    if r.status_code == 200:
        assert r.json()["total"] == 0


# ---------------------------------------------------------------- random


def test_random_distribution_is_sane(client: TestClient) -> None:
    dem = Counter(client.get(P + "/random").json()["slug"] for _ in range(400))
    assert len(dem) >= 130  # kỳ vọng ~173 khi 400 lần rút trong 200
    assert max(dem.values()) <= 16


def test_random_respects_filters_and_404s_when_nothing_matches(client: TestClient) -> None:
    for _ in range(10):
        p = client.get(P + "/random", params={"level": [0, 5], "max_hours": 30}).json()
        assert p["level"]["id"] in (0, 5) and p["estimated_hours"] <= 30
    r = client.get(P + "/random", params={"track": "khong-co"})
    assert r.status_code == 404 and r.json()["detail"] == "Không có project nào khớp bộ lọc."
    assert client.get(P + "/random", params={"max_hours": 1}).status_code == 404
    assert client.get(P + "/random", params={"level": 9}).status_code == 422
    assert client.get(P + "/random", params={"max_hours": 0}).status_code == 422


# ---------------------------------------------------------------- chi tiết & gợi ý


@pytest.mark.parametrize(
    "slug",
    [
        "CLI-QUIZ-PYTHON",
        "cli-quiz-python ",
        "cli_quiz_python",
        "cli-quiz-python%",
        "nhận-dạng",
        "%00",
        "a" * 3000,
    ],
)
def test_project_slug_is_exact_match_only(client: TestClient, slug: str) -> None:
    r = client.get(f"{P}/{slug}")
    assert r.status_code == 404 and r.json()["detail"] == "Không tìm thấy project."


def test_every_project_has_three_ordered_hints_and_default_is_tier_one(
    client: TestClient, db: Session
) -> None:
    slugs = db.scalars(select(Project.slug).where(Project.is_published.is_(True))).all()
    assert len(slugs) == 200
    for slug in slugs:
        full = client.get(f"{P}/{slug}/hints", params={"max_tier": 3}).json()
        assert [h["tier"] for h in full] == [1, 2, 3], slug
        assert all(h["content"].strip() for h in full), slug
        assert [h["tier"] for h in client.get(f"{P}/{slug}/hints").json()] == [1], slug


@pytest.mark.parametrize(
    "max_tier, ma",
    [
        ("0", 422),
        ("4", 422),
        ("abc", 422),
        ("-1", 422),
        ("", 422),
        ("1", 200),
        ("2", 200),
        ("3", 200),
        ("2.0", 200),
        (" 3", 200),
    ],
)
def test_hint_tier_bounds(client: TestClient, max_tier: str, ma: int) -> None:
    r = client.get(f"{P}/cli-quiz-python/hints", params={"max_tier": max_tier})
    assert r.status_code == ma
    if ma == 200:
        assert [h["tier"] for h in r.json()] == list(range(1, int(float(max_tier)) + 1))


def test_hint_tier_error_uses_a_human_field_name(client: TestClient) -> None:
    detail = client.get(f"{P}/cli-quiz-python/hints", params={"max_tier": "abc"}).json()["detail"]
    assert "max_tier" not in detail and "tầng gợi ý" in detail


def test_hints_are_public_and_ignore_garbage_tokens(client: TestClient) -> None:
    r = client.get(
        f"{P}/cli-quiz-python/hints",
        params={"max_tier": 3},
        headers={"Authorization": "Bearer rac.rac.rac"},
    )
    assert r.status_code == 200 and len(r.json()) == 3


def test_hints_of_unknown_project_404_but_bad_tier_wins(client: TestClient) -> None:
    assert client.get(f"{P}/khong-co/hints?max_tier=3").status_code == 404
    assert client.get(f"{P}/khong-co/hints?max_tier=9").status_code == 422


def test_project_detail_has_every_field_and_valid_prerequisites(client: TestClient) -> None:
    tat = {i["slug"] for i in _tat_ca(client)}
    d = client.get(f"{P}/house-price-regression").json()
    assert set(d) >= {
        "context",
        "objective",
        "dataset_url",
        "deliverables",
        "bonus_challenges",
        "prerequisites",
        "skills",
        "level",
        "track",
    }
    assert all(p["slug"] in tat for p in d["prerequisites"])


# ---------------------------------------------------------------- stats & taxonomy


def test_stats_equal_seed_files(client: TestClient) -> None:
    s = client.get("/api/v1/stats").json()
    assert s["projects"] == len(_seed("projects")) == 200
    assert s["skills"] == len(_seed("skills")) == 37
    assert s["roadmaps"] == len(_seed("roadmaps")) == 3
    assert (
        sum(r["projects"] for r in s["by_level"])
        == sum(r["projects"] for r in s["by_track"])
        == 200
    )
    assert [r["level"]["id"] for r in s["by_level"]] == list(range(6))
    assert Counter(p["level"] for p in _seed("projects")) == {
        r["level"]["id"]: r["projects"] for r in s["by_level"]
    }


def test_taxonomy_lists_match_seed(client: TestClient) -> None:
    assert [lv["slug"] for lv in client.get("/api/v1/levels").json()] == [
        lv["slug"] for lv in _seed("levels")
    ]
    tracks = client.get("/api/v1/tracks").json()
    assert {t["slug"] for t in tracks} == {t["slug"] for t in _seed("tracks")}
    assert tracks == sorted(tracks, key=lambda t: (t["order_index"], t["name"]))
    assert all(t["mentor"] for t in tracks)
    mentors = client.get("/api/v1/mentors").json()
    assert [m["slug"] for m in mentors] == [
        m["slug"] for m in sorted(_seed("mentors"), key=lambda m: (m["order_index"], m["name"]))
    ]
    assert {s["slug"] for s in client.get("/api/v1/skills").json()} == {
        s["slug"] for s in _seed("skills")
    }


def test_skills_sorted_by_vietnamese_alphabet(client: TestClient) -> None:
    names = [s["name"] for s in client.get("/api/v1/skills").json()]
    assert names == sorted(names, key=bo_dau)


def test_roadmaps_steps_are_contiguous_unique_and_published(client: TestClient) -> None:
    tat = {i["slug"] for i in _tat_ca(client)}
    roadmaps = client.get("/api/v1/roadmaps").json()
    assert [r["name"] for r in roadmaps] == sorted(r["name"] for r in roadmaps)
    for r in roadmaps:
        steps = client.get(f"/api/v1/roadmaps/{r['slug']}").json()["steps"]
        assert [s["order_index"] for s in steps] == list(range(1, len(steps) + 1))
        slugs = [s["project"]["slug"] for s in steps]
        assert len(set(slugs)) == len(slugs) and set(slugs) <= tat
    assert client.get("/api/v1/roadmaps/AI-ENGINEER").status_code == 404
    assert client.get("/api/v1/roadmaps/x").json()["detail"] == "Không tìm thấy lộ trình."


def test_stats_drop_unpublished_project_from_level_and_track(
    client: TestClient, db: Session
) -> None:
    project = db.scalar(select(Project).where(Project.slug == "cli-quiz-python"))
    before = client.get("/api/v1/stats").json()
    project.is_published = False
    db.commit()
    try:
        after = client.get("/api/v1/stats").json()
        assert after["projects"] == before["projects"] - 1
        lv = {r["level"]["id"]: r["projects"] for r in after["by_level"]}
        tr = {r["track"]["slug"]: r["projects"] for r in after["by_track"]}
        assert (
            lv[project.level_id]
            == {r["level"]["id"]: r["projects"] for r in before["by_level"]}[project.level_id] - 1
        )
        assert sum(lv.values()) == sum(tr.values()) == after["projects"]
        assert client.get(
            P + "/random", params={"track": "python", "max_hours": 4, "level": 0}
        ).status_code in (200, 404)
    finally:
        project.is_published = True
        db.commit()


# ---------------------------------------------------------------- leaderboard


@pytest.mark.parametrize("limit", ["0", "101", "abc", "-1", "", "1.5"])
def test_leaderboard_limit_bounds(client: TestClient, limit: str) -> None:
    r = client.get("/api/v1/leaderboard", params={"limit": limit})
    assert r.status_code == 422 and "số lượng" in r.json()["detail"]


def test_leaderboard_ties_break_by_id_and_excludes_mentors_and_inactive(
    client: TestClient, db: Session, user_factory
) -> None:
    a, b, c_ = user_factory(), user_factory(), user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    inactive = user_factory()
    for acc in (a, b, c_, mentor, inactive):
        db.get(User, acc["user"]["id"]).total_points = 99_999
    db.get(User, inactive["user"]["id"]).is_active = False
    db.commit()
    try:
        rows = client.get("/api/v1/leaderboard", params={"limit": 100}).json()
        names = [r["username"] for r in rows]
        assert names[:3] == [a["user"]["username"], b["user"]["username"], c_["user"]["username"]]
        assert mentor["user"]["username"] not in names
        assert inactive["user"]["username"] not in names
        assert [r["rank"] for r in rows] == list(range(1, len(rows) + 1))
        assert len(client.get("/api/v1/leaderboard", params={"limit": 1}).json()) == 1
    finally:
        for acc in (a, b, c_, mentor, inactive):
            u = db.get(User, acc["user"]["id"])
            u.total_points = 0
            u.is_active = True
        db.commit()


# ---------------------------------------------------------------- HTTP


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/projects/",
        "/api/v1/levels/",
        "/api/v1/projects/random/",
        "/api/v1/projects/cli-quiz-python/hints/",
        "/api/v1/leaderboard/",
        "/health/",
        "/kho.html/",
    ],
)
def test_trailing_slash_redirects_to_canonical(client: TestClient, path: str) -> None:
    r = client.get(path, follow_redirects=False)
    assert r.status_code == 307 and r.headers["location"].endswith(path.rstrip("/"))


def test_trailing_slash_redirect_keeps_query_string(client: TestClient) -> None:
    r = client.get("/api/v1/projects/?level=5&page_size=3", follow_redirects=False)
    assert r.headers["location"].endswith("/api/v1/projects?level=5&page_size=3")


@pytest.mark.parametrize("method", ["post", "put", "delete", "patch"])
def test_wrong_method_is_405_in_vietnamese(client: TestClient, method: str) -> None:
    r = getattr(client, method)("/api/v1/projects")
    assert (
        r.status_code == 405
        and r.json()["detail"] == "Phương thức này không dùng được cho địa chỉ đó."
    )


@pytest.mark.parametrize("path", ["/", "/kho.html", "/health", "/api/v1/projects", "/api/v1/stats"])
def test_head_is_supported_wherever_get_is(client: TestClient, path: str) -> None:
    r = client.head(path)
    assert r.status_code == 200 and r.content == b""
    assert r.headers["content-type"] == client.get(path).headers["content-type"]


def test_head_works_on_static_files(client: TestClient) -> None:
    assert client.head("/js/api.js").status_code == 200


@pytest.mark.parametrize("path", ["/", "/kho.html"])
def test_html_pages_answer_304_to_conditional_get(client: TestClient, path: str) -> None:
    etag = client.get(path).headers["etag"]
    assert client.get(path, headers={"If-None-Match": etag}).status_code == 304


def test_static_files_answer_304_and_no_cache(client: TestClient) -> None:
    first = client.get("/js/api.js")
    assert first.headers["cache-control"] == "no-cache"
    assert (
        client.get("/js/api.js", headers={"If-None-Match": first.headers["etag"]}).status_code
        == 304
    )
    assert client.get("/").headers["cache-control"] == "no-cache"


@pytest.mark.parametrize(
    "path, ct",
    [
        ("/anh/logo-mo.webp", "image/webp"),
        ("/anh/video-huong-dan.vtt", "text/vtt"),
        ("/anh/video-huong-dan.mp4", "video/mp4"),
        ("/anh/video-mo-dau.webm", "video/webm"),
        ("/js/goc.js", "text/javascript"),
        ("/css/style.css", "text/css"),
    ],
)
def test_static_content_types(client: TestClient, path: str, ct: str) -> None:
    r = client.get(path)
    assert r.status_code == 200 and r.headers["content-type"].startswith(ct)


def test_range_requests_on_video(client: TestClient) -> None:
    r = client.get("/anh/video-huong-dan.mp4", headers={"Range": "bytes=0-99"})
    assert (
        r.status_code == 206
        and len(r.content) == 100
        and r.headers["content-range"].startswith("bytes 0-99/")
    )
    r = client.get("/anh/video-huong-dan.mp4", headers={"Range": "bytes=99999999-"})
    assert r.status_code == 416 and r.headers["content-range"].startswith("bytes */")
    assert r.json()["detail"] == "Khoảng byte yêu cầu nằm ngoài tệp."


def test_malformed_range_error_is_vietnamese_json(client: TestClient) -> None:
    r = client.get("/anh/video-huong-dan.mp4", headers={"Range": "bytes=abc"})
    assert r.status_code == 400 and r.headers["content-type"].startswith("application/json")
    assert r.json()["detail"] == "Khoảng byte yêu cầu không hợp lệ."


@pytest.mark.parametrize(
    "path",
    [
        "/README.md",
        "/quay-video-huong-dan.mjs",
        "/lam-video-mo-dau.sh",
        "/js/",
        "/anh/",
        "/css/",
        "/js/.env",
        "/css/.hidden",
        "/.env",
        "/.git/config",
        "/js/..%2fREADME.md",
        "/anh/..%2f..%2fREADME.md",
        "/js/%2e%2e/README.md",
        "/anh-dai-dien/..%2fjs%2fapi.js",
        "/js/api.js%00.png",
    ],
)
def test_only_three_static_dirs_and_no_traversal(client: TestClient, path: str) -> None:
    r = client.get(path)
    assert r.status_code == 404 and r.headers["content-type"].startswith("application/json")
    assert "frontend" not in r.text


def test_cors_only_for_listed_origins(client: TestClient) -> None:
    ok = client.get("/api/v1/levels", headers={"Origin": "http://localhost:5500"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5500"
    for origin in (
        "https://evil.example",
        "http://localhost:5500.evil.example",
        "null",
        "http://LOCALHOST:5500",
        "*",
    ):
        r = client.get("/api/v1/levels", headers={"Origin": origin})
        assert "access-control-allow-origin" not in r.headers, origin
        pre = client.options(
            "/api/v1/levels", headers={"Origin": origin, "Access-Control-Request-Method": "GET"}
        )
        assert pre.status_code == 400 and "access-control-allow-origin" not in pre.headers, origin


def test_crlf_in_path_and_query_cannot_inject_headers(client: TestClient) -> None:
    r = client.get("/api/v1/projects/abc%0d%0aX-Injected:1/", follow_redirects=False)
    assert (
        r.status_code == 307 and "x-injected" not in r.headers and "%0D%0A" in r.headers["location"]
    )
    r = client.get(P, params={"q": "\r\nSet-Cookie: a=b"})
    assert r.status_code == 200 and "set-cookie" not in r.headers


def test_validation_errors_never_echo_input(client: TestClient) -> None:
    for p, v in (("sort", "<img src=x>"), ("page", "<svg/onload=1>"), ("level", '"><script>')):
        r = client.get(P, params={p: v})
        assert r.status_code == 422 and v not in r.text and "<" not in r.text
    assert "<script>" not in client.get(f"{P}/<script>alert(1)</script>").text


def test_unknown_page_for_a_browser_is_html_with_links_home(client: TestClient) -> None:
    """Người gõ nhầm /kho trên trình duyệt nhận trang báo lỗi có đường về, không phải JSON."""
    r = client.get("/kho", headers={"Accept": "text/html"})
    assert r.status_code == 404 and r.headers["content-type"].startswith("text/html")
    assert 'href="./"' in r.text and 'href="./kho.html"' in r.text
    # API và các client không phải trình duyệt vẫn nhận JSON.
    r = client.get("/kho")
    assert r.status_code == 404 and r.headers["content-type"].startswith("application/json")
    r = client.get("/api/v1/khong-co", headers={"Accept": "text/html"})
    assert r.status_code == 404 and r.headers["content-type"].startswith("application/json")


def test_security_headers_on_pages_and_api(client: TestClient) -> None:
    """Ba tiêu đề do backend gắn; Content-Security-Policy thuộc về nginx (ten-mien.sh)."""
    for path in ("/", "/kho.html", "/api/v1/levels", "/js/api.js", "/khong-co", "/docs"):
        h = client.get(path).headers
        assert h["x-content-type-options"] == "nosniff", path
        assert h["x-frame-options"] == "SAMEORIGIN", path
        assert h["referrer-policy"] == "strict-origin-when-cross-origin", path


def test_nginx_template_sets_content_security_policy() -> None:
    src = (Path(__file__).resolve().parents[1] / "ten-mien.sh").read_text(encoding="utf-8")
    assert "Content-Security-Policy" in src and "frame-ancestors 'self'" in src
    # Trang tài liệu API nạp Swagger UI từ CDN nên phải có khối riêng không mang CSP.
    assert "location = /projects/docs" in src
