"""Kiểm thử bổ sung cho phần tài khoản, đăng nhập và phiên (lens kt6-api-tai-khoan).

Bổ sung cho tests/test_auth.py: các trạng thái không dựng được qua HTTP (tài khoản
bị vô hiệu hoá), biên của token (hết hạn, sai thuật toán, sai khoá, sub giả), và
hai phát hiện kt6-1 (khoá theo tài khoản) và kt6-2 (thời gian trả lời đều nhau).
"""

from __future__ import annotations

from datetime import timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import User
from app.services import auth as auth_service
from app.services.chan_doan_mat_khau import SO_LAN_TOI_DA
from tests.conftest import MAT_KHAU_MAU

# --------------------------- tài khoản bị vô hiệu hoá ---------------------------


def test_inactive_user_cannot_login(client: TestClient, user_factory, db: Session) -> None:
    """Tài khoản is_active=False không đăng nhập được, dù mật khẩu đúng."""
    account = user_factory()
    user = db.get(User, account["user"]["id"])
    user.is_active = False
    db.commit()

    r = client.post(
        "/api/v1/auth/login",
        json={"identifier": account["user"]["username"], "password": MAT_KHAU_MAU},
    )
    assert r.status_code == 401


def test_inactive_user_token_is_rejected(client: TestClient, user_factory, db: Session) -> None:
    """Token cấp trước đó cũng vô hiệu ngay khi tài khoản bị khoá."""
    account = user_factory()
    r = client.get("/api/v1/auth/me", headers=account["headers"])
    assert r.status_code == 200

    user = db.get(User, account["user"]["id"])
    user.is_active = False
    db.commit()

    r = client.get("/api/v1/auth/me", headers=account["headers"])
    assert r.status_code == 401


# --------------------------------- biên token ---------------------------------


def test_expired_token_is_rejected(client: TestClient, user_factory) -> None:
    account = user_factory()
    token, _ = create_access_token(account["user"]["id"], ttl=timedelta(seconds=-5))
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_token_signed_with_wrong_key_is_rejected(client: TestClient, user_factory) -> None:
    account = user_factory()
    forged = jwt.encode(
        {"sub": str(account["user"]["id"])},
        "mot-khoa-hoan-toan-khac-du-dai-32-byte-de-test",
        algorithm=settings.jwt_algorithm,
    )
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


def test_token_with_alg_none_is_rejected(client: TestClient, user_factory) -> None:
    account = user_factory()
    forged = jwt.encode({"sub": str(account["user"]["id"])}, key=None, algorithm="none")
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


def test_token_for_nonexistent_user_is_rejected(client: TestClient) -> None:
    token, _ = create_access_token(987654321)
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_token_non_numeric_sub_is_rejected(client: TestClient) -> None:
    forged = jwt.encode(
        {"sub": "khong-phai-so"}, settings.secret_key, algorithm=settings.jwt_algorithm
    )
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


@pytest.mark.parametrize(
    "header",
    ["Basic abc123", "token-khong-scheme", "Bearer", "Bearer   "],
)
def test_malformed_authorization_header(client: TestClient, header: str) -> None:
    r = client.get("/api/v1/auth/me", headers={"Authorization": header})
    assert r.status_code == 401


# --------------------------- biên đăng ký còn thiếu ----------------------------


def test_register_ignores_privilege_fields(client: TestClient) -> None:
    """Gửi kèm is_mentor / total_points trong body không được nâng quyền."""
    r = client.post(
        "/api/v1/auth/register",
        json={
            "email": "khongnangquyen@example.com",
            "username": "khongnangquyen",
            "password": MAT_KHAU_MAU,
            "is_mentor": True,
            "total_points": 999999,
        },
    )
    assert r.status_code == 201
    body = r.json()["user"]
    assert body["is_mentor"] is False
    assert body["total_points"] == 0


def test_password_exactly_72_bytes_is_accepted(client: TestClient) -> None:
    """24 ký tự 'ố' = 72 byte, đúng trần bcrypt, phải nhận và đăng nhập lại được."""
    pw = "ố" * 24
    assert len(pw.encode("utf-8")) == 72
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "bay-hai-byte@example.com", "username": "bayhaibyte", "password": pw},
    )
    assert r.status_code == 201
    r = client.post("/api/v1/auth/login", json={"identifier": "bayhaibyte", "password": pw})
    assert r.status_code == 200


def test_duplicate_username_differing_by_case_and_space(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "hoa-thuong-1@example.com",
            "username": "TrungTen",
            "password": MAT_KHAU_MAU,
        },
    )
    r = client.post(
        "/api/v1/auth/register",
        json={
            "email": "hoa-thuong-2@example.com",
            "username": "  trungten  ",
            "password": MAT_KHAU_MAU,
        },
    )
    assert r.status_code == 409


def test_unicode_email_round_trips(client: TestClient) -> None:
    """Thư điện tử quốc tế hoá đăng ký được và đăng nhập lại đúng địa chỉ đó."""
    email = "sinhvien@bưu-điện.vn"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "username": "quoctehoa", "password": MAT_KHAU_MAU},
    )
    assert r.status_code == 201
    r = client.post("/api/v1/auth/login", json={"identifier": email, "password": MAT_KHAU_MAU})
    assert r.status_code == 200


# ------------------------------- chấm bài (phi logic) ---------------------------


def test_student_cannot_reach_mentor_queue(client: TestClient, user_factory) -> None:
    account = user_factory()
    assert client.get("/api/v1/submissions", headers=account["headers"]).status_code == 403


def test_student_cannot_review(client: TestClient, user_factory) -> None:
    account = user_factory()
    r = client.patch(
        "/api/v1/submissions/1/review",
        json={"status": "accepted", "score": 100},
        headers=account["headers"],
    )
    assert r.status_code == 403


def test_mentor_cannot_self_grade(client: TestClient, user_factory, db: Session) -> None:
    """Giảng viên nộp bài rồi tự chấm cho mình phải bị chặn 403."""
    mentor = user_factory(is_mentor=True, db=db)
    # dùng project không cần tiên quyết đầu tiên
    projects = client.get("/api/v1/projects?page_size=100").json()["items"]
    slug = None
    for it in projects:
        if not client.get(f"/api/v1/projects/{it['slug']}").json()["prerequisites"]:
            slug = it["slug"]
            break
    assert slug
    sub = client.post(
        f"/api/v1/projects/{slug}/submissions",
        json={"repo_url": "https://github.com/mentor/self"},
        headers=mentor["headers"],
    )
    assert sub.status_code == 201
    sub_id = sub.json()["id"]
    r = client.patch(
        f"/api/v1/submissions/{sub_id}/review",
        json={"status": "accepted", "score": 100},
        headers=mentor["headers"],
    )
    assert r.status_code == 403


# ------------------------------- tải ảnh (biên) --------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "/anh-dai-dien/../../../../etc/passwd",
        "/anh-dai-dien/..%2f..%2f..%2fetc%2fpasswd",
        "/js/../../backend/.env",
    ],
)
def test_static_path_traversal_blocked(client: TestClient, path: str) -> None:
    r = client.get(path)
    assert r.status_code != 200
    assert b"root:" not in r.content and b"SECRET_KEY" not in r.content


def test_oversized_avatar_is_rejected(client: TestClient, user_factory) -> None:
    account = user_factory()
    import base64

    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    big = png + b"\x00" * (settings.max_avatar_bytes + 1)
    r = client.put(
        "/api/v1/me/avatar",
        files={"file": ("big.png", big, "image/png")},
        headers=account["headers"],
    )
    assert r.status_code == 413


# ============================ PHÁT HIỆN kt6-1 và kt6-2 (đã sửa) ========================


def test_lockout_should_cover_all_identifiers_of_the_same_account(
    client: TestClient, user_factory
) -> None:
    account = user_factory()
    username = account["user"]["username"]
    email = account["user"]["email"]

    for _ in range(SO_LAN_TOI_DA):
        client.post("/api/v1/auth/login", json={"identifier": username, "password": "sai-roi-123"})
    # username giờ đã bị khoá
    assert (
        client.post(
            "/api/v1/auth/login", json={"identifier": username, "password": MAT_KHAU_MAU}
        ).status_code
        == 429
    )
    # MONG MUỐN: email của cùng tài khoản cũng phải bị khoá theo
    assert (
        client.post(
            "/api/v1/auth/login", json={"identifier": email, "password": MAT_KHAU_MAU}
        ).status_code
        == 429
    )


def test_authenticate_should_run_constant_time_for_unknown_user(
    db: Session, user_factory, monkeypatch
) -> None:
    """Gốc rễ: verify_password phải được gọi cả khi người dùng không tồn tại."""
    user_factory()

    calls = {"n": 0}
    real = auth_service.verify_password

    def dem(*a, **k):
        calls["n"] += 1
        return real(*a, **k)

    monkeypatch.setattr(auth_service, "verify_password", dem)

    from app.db.session import SessionFactory

    with SessionFactory() as s:
        auth_service.authenticate(s, "chac-chan-khong-ton-tai-999", "batky12345")
    # MONG MUỐN: để tránh lộ qua thời gian, vẫn phải so với một hash giả (>=1 lần).
    assert calls["n"] >= 1
