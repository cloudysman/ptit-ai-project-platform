"""Kiểm thử các cam kết chung của API: cấu trúc lỗi, múi giờ và phân trang."""

from __future__ import annotations

from datetime import datetime

from fastapi.testclient import TestClient


def test_root_serves_the_interface(client: TestClient) -> None:
    """Địa chỉ gốc trả về trang giao diện, vì backend phục vụ luôn frontend."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")


def test_api_routes_win_over_static_files(client: TestClient) -> None:
    """Thư mục tĩnh gắn ở địa chỉ gốc không được che mất route của API."""
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/api/v1/levels").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_validation_error_detail_is_a_sentence(client: TestClient) -> None:
    """Trường detail phải luôn là một câu, kể cả với lỗi kiểm tra dữ liệu.

    Frontend đã cam kết hiển thị thẳng nội dung của detail, nên trường này không
    được là danh sách đối tượng như mặc định của FastAPI.
    """
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "khong-phai-email", "username": "a", "password": "1"},
    )
    assert response.status_code == 422

    body = response.json()
    assert isinstance(body["detail"], str)
    assert {"email", "username", "password"} <= {error["field"] for error in body["errors"]}


def test_http_error_detail_is_a_sentence(client: TestClient) -> None:
    body = client.get("/api/v1/projects/khong-co-project-nay").json()
    assert isinstance(body["detail"], str)


def test_time_fields_carry_timezone(client: TestClient, user_factory) -> None:
    """Mốc thời gian trả về phải kèm múi giờ, nếu không frontend hiểu sai bảy giờ."""
    account = user_factory()
    response = client.post(
        "/api/v1/projects/cli-quiz-python/submissions",
        json={"repo_url": "https://github.com/sinhvien/project"},
        headers=account["headers"],
    )
    assert response.status_code == 201

    submitted_at = response.json()["submitted_at"]
    assert datetime.fromisoformat(submitted_at).tzinfo is not None


def test_page_size_over_limit_is_rejected(client: TestClient) -> None:
    assert client.get("/api/v1/projects", params={"page_size": 101}).status_code == 422


def test_page_beyond_last_returns_empty_list(client: TestClient) -> None:
    """Trang vượt quá trang cuối trả về danh sách rỗng chứ không phải lỗi."""
    page = client.get("/api/v1/projects", params={"page": 999, "page_size": 20}).json()
    assert page["items"] == []
    assert page["total"] == 200
    assert page["pages"] == 10


def test_unknown_address_reports_in_vietnamese(client: TestClient) -> None:
    """Địa chỉ không tồn tại cũng phải trả về một câu tiếng Việt, đúng cam kết."""
    phan_hoi = client.get("/api/v1/khong-co-duong-dan-nay")
    assert phan_hoi.status_code == 404
    assert phan_hoi.json()["detail"] == "Không tìm thấy địa chỉ này."

    sai_phuong_thuc = client.delete("/api/v1/levels")
    assert sai_phuong_thuc.status_code == 405
    assert sai_phuong_thuc.json()["detail"] == "Phương thức này không dùng được cho địa chỉ đó."


def test_trailing_slash_still_redirects(client: TestClient) -> None:
    """Thư mục tĩnh không được nuốt mất phần tự chuyển hướng của các route API."""
    phan_hoi = client.get("/api/v1/projects/", follow_redirects=False)
    assert phan_hoi.status_code == 307
    assert phan_hoi.headers["location"].endswith("/api/v1/projects")


def test_static_folder_only_serves_its_own_files(client: TestClient) -> None:
    """Chỉ ba thư mục tài nguyên được đưa ra ngoài, file cạnh index.html thì không."""
    assert client.get("/css/style.css").status_code == 200
    assert client.get("/js/app.js").status_code == 200
    assert client.get("/anh/logo-khoa-ai.png").status_code == 200
    assert client.get("/README.md").status_code == 404


def test_broken_json_gets_its_own_message(client: TestClient) -> None:
    """Thân request không phải JSON thì câu báo lỗi không được nêu vị trí ký tự."""
    phan_hoi = client.post(
        "/api/v1/auth/login",
        content=b"{khong-phai-json",
        headers={"Content-Type": "application/json"},
    )
    assert phan_hoi.status_code == 422
    assert phan_hoi.json()["detail"] == "Dữ liệu gửi lên không phải JSON hợp lệ."


def test_static_files_ask_the_server_every_time(client: TestClient) -> None:
    """Tệp giao diện phải kèm no-cache, để trình duyệt không dùng nhầm bản cũ."""
    for duong_dan in ("/", "/kho.html", "/css/style.css", "/js/app.js"):
        phan_hoi = client.get(duong_dan)
        assert phan_hoi.status_code == 200, duong_dan
        assert phan_hoi.headers.get("cache-control") == "no-cache", duong_dan


def test_validation_message_names_fields_the_way_users_see_them(client: TestClient) -> None:
    """Câu báo lỗi gọi tên trường bằng đúng chữ trên giao diện, không phải tên cột."""
    phan_hoi = client.get("/api/v1/projects", params={"min_hours": 0})
    assert phan_hoi.status_code == 422

    than = phan_hoi.json()
    assert than["detail"] == "Phần số giờ tối thiểu phải từ 1 trở lên."
    # Phần errors vẫn giữ tên trường thật, để người phát triển lần ra chỗ sai.
    assert than["errors"][0]["field"] == "min_hours"

    # Sai từ hai chỗ trở lên thì câu thông báo liệt kê tên các chỗ đó.
    nhieu_cho = client.get("/api/v1/projects", params={"min_hours": 0, "max_hours": 0}).json()
    assert nhieu_cho["detail"] == "Dữ liệu không hợp lệ ở: số giờ tối thiểu, số giờ tối đa."


def test_password_too_long_says_why(client: TestClient) -> None:
    """Mật khẩu vượt giới hạn của bcrypt phải nói rõ lý do, không chỉ nêu tên trường."""
    phan_hoi = client.post(
        "/api/v1/auth/register",
        json={
            "email": "matkhaudai@ptit.edu.vn",
            "username": "matkhaudai",
            # Năm mươi ký tự tiếng Việt có dấu vượt 72 byte khi mã hoá UTF-8,
            # dù vẫn nằm trong giới hạn 64 ký tự.
            "password": "mậtkhẩurấtdàiviếtbằngtiếngViệtcóđầyđủdấuthanhvàmũ",
        },
    )
    assert phan_hoi.status_code == 422
    assert phan_hoi.json()["detail"] == "Mật khẩu quá dài, tối đa 72 byte."
