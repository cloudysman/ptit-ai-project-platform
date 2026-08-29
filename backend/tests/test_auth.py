"""Kiểm thử phần tài khoản và đăng nhập."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


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
        email="tai.khoan.cu@project200.local",
        username="taikhoancu",
        display_name="Tài khoản cũ",
        hashed_password=hash_password("matkhau12345"),
    )
    db.add(user)
    db.commit()

    token, _ = create_access_token(user.id)
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "tai.khoan.cu@project200.local"
