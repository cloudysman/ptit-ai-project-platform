"""Kiểm thử phần tài khoản và đăng nhập."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.services.chan_doan_mat_khau import SO_LAN_TOI_DA
from tests.conftest import MAT_KHAU_MAU


def test_register_and_read_me(client: TestClient, user_factory) -> None:
    account = user_factory()
    response = client.get("/api/v1/auth/me", headers=account["headers"])
    assert response.status_code == 200
    assert response.json()["username"] == account["user"]["username"]


def test_login_by_email_and_by_username(client: TestClient, user_factory) -> None:
    account = user_factory()
    for identifier in (account["user"]["email"], account["user"]["username"]):
        response = client.post(
            "/api/v1/auth/login",
            json={"identifier": identifier, "password": "matkhau12345"},
        )
        assert response.status_code == 200, identifier
        assert response.json()["user"]["id"] == account["user"]["id"]


def test_login_with_wrong_password(client: TestClient, user_factory) -> None:
    account = user_factory()
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": account["user"]["username"], "password": "matkhausai123"},
    )
    assert response.status_code == 401


def test_duplicate_email_is_rejected(client: TestClient, user_factory) -> None:
    account = user_factory()
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": account["user"]["email"],
            "username": "tenkhac123",
            "password": "matkhau12345",
        },
    )
    assert response.status_code == 409


def test_username_is_normalised(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "chuhoa@example.com",
            "username": "ChuHoa_01",
            "password": "matkhau12345",
        },
    )
    assert response.status_code == 201
    assert response.json()["user"]["username"] == "chuhoa_01"


def test_invalid_username_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "kytu@example.com",
            "username": "co dau và khoảng trắng",
            "password": "matkhau12345",
        },
    )
    assert response.status_code == 422


def test_password_longer_than_bcrypt_limit_is_rejected(client: TestClient) -> None:
    """Mật khẩu 40 ký tự tiếng Việt có dấu vượt 72 byte nên phải bị chặn."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "matkhaudai@example.com",
            "username": "matkhaudai",
            "password": "ố" * 40,
        },
    )
    assert response.status_code == 422


def test_protected_endpoint_requires_token(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/me/progress").status_code == 401

    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer token-gia-mao"})
    assert response.status_code == 401


def test_reading_user_does_not_revalidate_email(client: TestClient, db: Session) -> None:
    """Bản ghi có email không qua được bộ kiểm tra hiện tại vẫn phải đọc ra được.

    Đây là tình huống xảy ra khi quy tắc kiểm tra email thay đổi sau này, còn dữ
    liệu cũ trong cơ sở dữ liệu thì vẫn giữ nguyên.
    """
    from app.core.security import create_access_token, hash_password
    from app.models.user import User

    user = User(
        email="tai.khoan.cu@vi-du.local",
        username="taikhoancu",
        display_name="Tài khoản cũ",
        hashed_password=hash_password("matkhau12345"),
    )
    db.add(user)
    db.commit()

    token, _ = create_access_token(user.id)
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "tai.khoan.cu@vi-du.local"


def test_display_name_is_trimmed(client: TestClient) -> None:
    """Tên hiển thị toàn dấu cách phải thành rỗng rồi lấy username thay thế."""
    phan_hoi = client.post(
        "/api/v1/auth/register",
        json={
            "email": "ten-trong@example.com",
            "username": "tentrong",
            "password": "matkhau12345",
            "display_name": "   ",
        },
    )
    assert phan_hoi.status_code == 201
    assert phan_hoi.json()["user"]["display_name"] == "tentrong"


def test_login_identifier_is_trimmed(client: TestClient, user_factory) -> None:
    """Dán nhầm cả dấu cách vào ô đăng nhập vẫn phải vào được."""
    account = user_factory()
    phan_hoi = client.post(
        "/api/v1/auth/login",
        json={"identifier": f"  {account['user']['username']}  ", "password": "matkhau12345"},
    )
    assert phan_hoi.status_code == 200


def test_email_longer_than_the_column_is_rejected(client: TestClient) -> None:
    """Thư điện tử dài hơn độ rộng cột phải bị chặn ngay ở tầng kiểm tra dữ liệu."""
    phan_hoi = client.post(
        "/api/v1/auth/register",
        json={
            "email": "a" * 250 + "@example.com",
            "username": "thudienrudai",
            "password": "matkhau12345",
        },
    )
    assert phan_hoi.status_code == 422


def _anh_png() -> bytes:
    """Một tệp PNG một điểm ảnh, đủ để kiểm tra luồng tải ảnh lên."""
    import base64

    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )


def test_avatar_upload_and_delete(client: TestClient, user_factory) -> None:
    """Tải ảnh đại diện lên, đọc lại, rồi bỏ ảnh đi."""
    account = user_factory()

    phan_hoi = client.put(
        "/api/v1/me/avatar",
        files={"file": ("toi.png", _anh_png(), "image/png")},
        headers=account["headers"],
    )
    assert phan_hoi.status_code == 200
    ten_tep = phan_hoi.json()["avatar"]
    assert ten_tep.endswith(".png")

    assert client.get(f"/anh-dai-dien/{ten_tep}").status_code == 200
    assert client.get("/api/v1/auth/me", headers=account["headers"]).json()["avatar"] == ten_tep

    assert client.delete("/api/v1/me/avatar", headers=account["headers"]).status_code == 204
    assert client.get("/api/v1/auth/me", headers=account["headers"]).json()["avatar"] == ""


def test_avatar_rejects_other_file_types(client: TestClient, user_factory) -> None:
    """Tệp không phải ảnh, và ảnh giả mạo phần mở rộng, đều bị từ chối."""
    account = user_factory()

    van_ban = client.put(
        "/api/v1/me/avatar",
        files={"file": ("ghi-chu.txt", b"chi la van ban", "text/plain")},
        headers=account["headers"],
    )
    assert van_ban.status_code == 422

    gia_mao = client.put(
        "/api/v1/me/avatar",
        files={"file": ("gia.png", b"day khong phai anh png", "image/png")},
        headers=account["headers"],
    )
    assert gia_mao.status_code == 422


def test_avatar_needs_login(client: TestClient) -> None:
    phan_hoi = client.put("/api/v1/me/avatar", files={"file": ("a.png", _anh_png(), "image/png")})
    assert phan_hoi.status_code == 401


def test_too_many_wrong_passwords_are_blocked(client: TestClient, user_factory) -> None:
    """Sai quá số lần cho phép thì tài khoản tạm thời không nhận thêm lần thử nào."""
    account = user_factory()
    ten = account["user"]["username"]

    sai = {"identifier": ten, "password": "matkhausai12345"}
    for _ in range(SO_LAN_TOI_DA):
        assert client.post("/api/v1/auth/login", json=sai).status_code == 401

    bi_chan = client.post("/api/v1/auth/login", json=sai)
    assert bi_chan.status_code == 429
    assert "thử lại" in bi_chan.json()["detail"]
    assert bi_chan.headers["Retry-After"].isdigit()

    # Mật khẩu đúng cũng phải chờ, vì nếu không thì chốt chặn này vô nghĩa: kẻ dò
    # mật khẩu chỉ cần thử tiếp cho tới khi trúng.
    dung = {"identifier": ten, "password": MAT_KHAU_MAU}
    assert client.post("/api/v1/auth/login", json=dung).status_code == 429


def test_successful_login_clears_the_counter(client: TestClient, user_factory) -> None:
    """Đăng nhập đúng xoá bộ đếm, để người gõ nhầm vài lần không bị chặn oan."""
    account = user_factory()
    ten = account["user"]["username"]

    for _ in range(SO_LAN_TOI_DA - 1):
        client.post("/api/v1/auth/login", json={"identifier": ten, "password": "sairoi12345"})

    dung = {"identifier": ten, "password": MAT_KHAU_MAU}
    assert client.post("/api/v1/auth/login", json=dung).status_code == 200
    assert client.post("/api/v1/auth/login", json=dung).status_code == 200


def _anh_webp() -> bytes:
    """Một tệp WebP nhỏ nhất có thể, đủ để nhận ra qua chữ ký định dạng."""
    than = b"VP8 " + b"\x00" * 16
    return b"RIFF" + (len(than) + 4).to_bytes(4, "little") + b"WEBP" + than


def test_avatar_rejects_riff_files_that_are_not_webp(client: TestClient, user_factory) -> None:
    """Tệp WAV đổi đuôi thành .webp cũng mở đầu bằng RIFF, và phải bị chặn."""
    account = user_factory()

    # Bốn byte đầu giống hệt một tệp WebP, chỉ khác ở loại nằm sau đó.
    gia_wav = b"RIFF" + (36).to_bytes(4, "little") + b"WAVEfmt " + b"\x00" * 16
    phan_hoi = client.put(
        "/api/v1/me/avatar",
        files={"file": ("thuc-ra-la-am-thanh.webp", gia_wav, "image/webp")},
        headers=account["headers"],
    )
    assert phan_hoi.status_code == 422

    # Còn WebP thật thì vẫn nhận, và được trả về đúng loại nội dung.
    that = client.put(
        "/api/v1/me/avatar",
        files={"file": ("toi.webp", _anh_webp(), "image/webp")},
        headers=account["headers"],
    )
    assert that.status_code == 200
    ten_tep = that.json()["avatar"]
    assert ten_tep.endswith(".webp")
    assert client.get(f"/anh-dai-dien/{ten_tep}").headers["content-type"] == "image/webp"


def test_new_avatar_gets_a_new_address(client: TestClient, user_factory) -> None:
    """Đổi ảnh phải đổi luôn địa chỉ tệp, nếu không trình duyệt hiện lại ảnh cũ."""
    account = user_factory()

    dau = client.put(
        "/api/v1/me/avatar",
        files={"file": ("mot.png", _anh_png(), "image/png")},
        headers=account["headers"],
    ).json()["avatar"]
    sau = client.put(
        "/api/v1/me/avatar",
        files={"file": ("hai.png", _anh_png(), "image/png")},
        headers=account["headers"],
    ).json()["avatar"]

    assert dau != sau
    assert client.get(f"/anh-dai-dien/{sau}").status_code == 200
    # Ảnh cũ được dọn ngay, mỗi người chỉ chiếm đúng một tệp trên đĩa.
    assert client.get(f"/anh-dai-dien/{dau}").status_code == 404
