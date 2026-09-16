"""Kiểm thử cho các sửa đổi sau đợt kiểm thử kt6.

Mỗi bài ghi mã của phát hiện tương ứng trong docstring, để tra ngược được vì sao
hành vi này tồn tại.
"""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.pool import QueuePool

from app import tai_khoan_demo
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import engine
from app.main import app
from app.models.enums import SubmissionStatus
from app.models.progress import Submission
from app.models.user import User

# Không nhập từ tests.conftest: nhập theo tên module sẽ chạy lại conftest và đặt
# lại các biến môi trường sang một thư mục tạm khác.
MAT_KHAU_MAU = "matkhau12345"

# ------------------------------------------------------------ KHO-1: bể kết nối


def test_sqlite_engine_pool_covers_every_worker_thread() -> None:
    """KHO-1: bể có trần thì luồng và kết nối chờ nhau vòng tròn; phần dôi không giới hạn."""
    assert settings.is_sqlite
    assert isinstance(engine.pool, QueuePool)
    assert engine.pool.size() == 40 and engine.pool._max_overflow == -1


def test_unexpected_error_is_vietnamese_json(client: TestClient) -> None:
    """KHO-1: lỗi bất ngờ không được lộ dòng 'Internal Server Error' tiếng Anh."""

    async def no() -> None:
        raise RuntimeError("lỗi giả để kiểm thử")

    app.add_api_route("/kt6-loi-gia", no, include_in_schema=False)
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            r = c.get("/kt6-loi-gia")
    finally:
        app.router.routes[:] = [
            r_ for r_ in app.router.routes if getattr(r_, "path", "") != "/kt6-loi-gia"
        ]
    assert r.status_code == 500
    assert r.json() == {"detail": "Máy chủ gặp lỗi, thử lại sau."}


# ------------------------------------------------------------ KT6-04: thư mục ảnh


def test_avatar_dir_is_isolated_for_tests(client: TestClient, user_factory) -> None:
    """KT6-04: kiểm thử ghi ảnh vào thư mục tạm riêng, không vào data/anh-dai-dien thật."""
    thu_muc = settings.resolved_avatar_dir
    assert thu_muc.parent.name.startswith("nen-tang-project-test-")
    assert "data/anh-dai-dien" not in thu_muc.as_posix()

    png = bytes.fromhex("89504e470d0a1a0a") + b"\x00" * 16
    account = user_factory()
    r = client.put(
        "/api/v1/me/avatar",
        files={"file": ("a.png", png, "image/png")},
        headers=account["headers"],
    )
    assert r.status_code == 200, r.text
    assert (settings.resolved_avatar_dir / r.json()["avatar"]).is_file()


def test_relative_avatar_dir_resolves_against_base_dir() -> None:
    """KT6-04: giá trị mặc định 'data/anh-dai-dien' vẫn tính từ thư mục backend."""
    from app.core.config import BASE_DIR, Settings

    cau_hinh = Settings(avatar_dir="data/anh-dai-dien", secret_key="x" * 40)
    assert cau_hinh.resolved_avatar_dir == BASE_DIR / "data" / "anh-dai-dien"
    cau_hinh = Settings(avatar_dir="/tmp/anh-kt6", secret_key="x" * 40)
    assert cau_hinh.resolved_avatar_dir == Path("/tmp/anh-kt6")


# ------------------------------------------------------------ kt6-3: ảnh quá lớn


def test_oversized_avatar_is_refused_by_content_length_before_reading(
    client: TestClient, user_factory
) -> None:
    """kt6-3: Content-Length vượt giới hạn thì 413 ngay, không nhận trọn thân request."""
    account = user_factory()
    gioi_han = settings.max_avatar_bytes
    r = client.put(
        "/api/v1/me/avatar",
        headers={
            **account["headers"],
            "Content-Type": "multipart/form-data; boundary=kt6",
            "Content-Length": str(gioi_han * 10),
        },
        content=b"",
    )
    assert r.status_code == 413
    assert r.json()["detail"] == "Ảnh vượt quá 2 MB."


# ------------------------------------------------------------ GDL-8: token không hạn


def test_token_without_exp_is_rejected(client: TestClient, user_factory) -> None:
    """GDL-8: token ký đúng nhưng thiếu exp là token sống mãi, phải bị từ chối."""
    account = user_factory()
    khong_han = jwt.encode(
        {"sub": str(account["user"]["id"])}, settings.secret_key, algorithm=settings.jwt_algorithm
    )
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {khong_han}"})
    assert r.status_code == 401
    khong_sub = jwt.encode(
        {"exp": 4_102_444_800}, settings.secret_key, algorithm=settings.jwt_algorithm
    )
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {khong_sub}"})
    assert r.status_code == 401
    # Token bình thường vẫn dùng được.
    assert client.get("/api/v1/auth/me", headers=account["headers"]).status_code == 200


# ------------------------------------------------------------ NC-04: điểm true/false


def test_review_refuses_bool_score_with_vietnamese_message(
    client: TestClient, db: Session, user_factory
) -> None:
    """NC-04: score=true không được thành 1; câu báo lỗi vẫn gọi đúng tên trường."""
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    sid = client.post(
        "/api/v1/projects/image-basics-lab/submissions",
        json={"repo_url": "https://github.com/kt6/x"},
        headers=acc["headers"],
    ).json()["id"]
    for sai in (True, False):
        r = client.patch(
            f"/api/v1/submissions/{sid}/review",
            json={"status": "accepted", "score": sai},
            headers=mentor["headers"],
        )
        assert r.status_code == 422, sai
        assert r.json()["detail"] == "Điểm bài nộp phải là số nguyên, không phải đúng/sai."
    r = client.patch(
        f"/api/v1/submissions/{sid}/review",
        json={"status": "accepted", "score": 1.5},
        headers=mentor["headers"],
    )
    assert r.status_code == 422 and "điểm bài nộp" in r.json()["detail"]
    # Chuỗi số vẫn được đọc như trước: chỉ bool bị chặn.
    r = client.patch(
        f"/api/v1/submissions/{sid}/review",
        json={"status": "accepted", "score": "90"},
        headers=mentor["headers"],
    )
    assert r.status_code == 200 and r.json()["submission"]["score"] == 90


# ------------------------------------------------------------ NC-02: nộp lại sau khi chấm


def test_resubmit_after_grade_creates_a_new_pending_row_when_rejected(
    client: TestClient, db: Session, user_factory
) -> None:
    """NC-02: bài bị trả về rồi nộp lại thì ra bài mới (201), không đụng bài đã chấm."""
    acc = user_factory()
    mentor = user_factory(is_mentor=True, db=db)
    dau = client.post(
        "/api/v1/projects/image-basics-lab/submissions",
        json={"repo_url": "https://github.com/kt6/x", "note": "ban-mot"},
        headers=acc["headers"],
    )
    assert dau.status_code == 201
    r = client.patch(
        f"/api/v1/submissions/{dau.json()['id']}/review",
        json={"status": "rejected", "feedback": "chưa đạt"},
        headers=mentor["headers"],
    )
    assert r.status_code == 200
    sau = client.post(
        "/api/v1/projects/image-basics-lab/submissions",
        json={"repo_url": "https://github.com/kt6/y", "note": "ban-hai"},
        headers=acc["headers"],
    )
    assert sau.status_code == 201 and sau.json()["id"] != dau.json()["id"]
    cu = db.get(Submission, dau.json()["id"])
    db.refresh(cu)
    assert cu.note == "ban-mot" and cu.status is SubmissionStatus.REJECTED


# ------------------------------------------------------------ KT6-02 / NC-05: bộ tài khoản demo


def test_demo_set_has_no_admin_and_sets_reviewed_at(db: Session) -> None:
    """KT6-02, NC-05: admin không thuộc bộ; bài mẫu đã chấm có reviewed_at."""
    assert "admin" not in {mau.username for mau in tai_khoan_demo.BO_TAI_KHOAN}
    try:
        tai_khoan_demo.tao(db)
        db.commit()
        da_cham = db.scalars(
            select(Submission)
            .join(User, User.id == Submission.user_id)
            .where(
                User.username == "ngocanh",
                Submission.status == SubmissionStatus.ACCEPTED,
            )
        ).all()
        assert len(da_cham) == 8
        assert all(bai.reviewed_at is not None for bai in da_cham)
        assert all(bai.reviewer_id is not None for bai in da_cham)
    finally:
        tai_khoan_demo.xoa(db)
        db.commit()


def test_demo_tao_skips_real_account_with_same_username(client: TestClient, db: Session) -> None:
    """KT6-02: username trùng nhưng thư điện tử khác là tài khoản thật, phải giữ nguyên."""
    r = client.post(
        "/api/v1/auth/register",
        json={
            "email": "ngocanh.that@example.com",
            "username": "ngocanh",
            "password": "mat-khau-rieng-1",
        },
    )
    assert r.status_code == 201, r.text
    that = r.json()["user"]
    bai = client.post(
        "/api/v1/projects/image-basics-lab/submissions",
        json={"repo_url": "https://github.com/that/x", "note": "cua-toi"},
        headers={"Authorization": f"Bearer {r.json()['access_token']}"},
    )
    assert bai.status_code == 201

    try:
        dong = tai_khoan_demo.tao(db)
        db.commit()
        assert any(d.startswith("ngocanh") and "BỎ QUA" in d for d in dong)

        user = db.get(User, that["id"])
        db.refresh(user)
        assert user.email == "ngocanh.that@example.com"
        assert (
            client.post(
                "/api/v1/auth/login",
                json={"identifier": "ngocanh", "password": "mat-khau-rieng-1"},
            ).status_code
            == 200
        )
        assert (
            client.post(
                "/api/v1/auth/login",
                json={"identifier": "ngocanh", "password": tai_khoan_demo.MAT_KHAU_CHUNG},
            ).status_code
            == 401
        )
        cua_toi = db.scalars(select(Submission).where(Submission.user_id == that["id"])).all()
        assert [b.note for b in cua_toi] == ["cua-toi"]

        # Lệnh xoa cũng không đụng tới tài khoản thật đó.
        so_xoa = tai_khoan_demo.xoa(db)
        db.commit()
        assert so_xoa == len(tai_khoan_demo.BO_TAI_KHOAN) - 1
        assert db.get(User, that["id"]) is not None
    finally:
        tai_khoan_demo.xoa(db)
        db.execute(Submission.__table__.delete().where(Submission.user_id == that["id"]))
        db.delete(db.get(User, that["id"]))
        db.commit()


def test_demo_tao_refuses_without_flag_when_not_debug(monkeypatch, capsys) -> None:
    """KT6-01: DEBUG=false thì lệnh tao dừng lại trừ khi có cờ xác nhận."""
    monkeypatch.setattr(settings, "debug", False)
    monkeypatch.setattr("sys.argv", ["tai_khoan_demo", "tao"])
    assert tai_khoan_demo.main() == 2
    assert tai_khoan_demo.CO_DB_THAT in capsys.readouterr().err


# ------------------------------------------------------------ kt6-1: khoá theo tài khoản


def test_lockout_by_account_does_not_block_other_accounts(client: TestClient, user_factory) -> None:
    """kt6-1: khoá theo tài khoản, nhưng tài khoản khác cùng địa chỉ vẫn đăng nhập được."""
    a, b = user_factory(), user_factory()
    for _ in range(8):
        client.post(
            "/api/v1/auth/login", json={"identifier": a["user"]["email"], "password": "sai"}
        )
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"identifier": a["user"]["username"], "password": MAT_KHAU_MAU},
        ).status_code
        == 429
    )
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"identifier": b["user"]["username"], "password": MAT_KHAU_MAU},
        ).status_code
        == 200
    )


@pytest.mark.parametrize("identifier", ["khong-ton-tai-kt6", "khong@ton.tai"])
def test_unknown_identifier_is_still_locked_by_string(client: TestClient, identifier: str) -> None:
    """kt6-1: chuỗi không khớp tài khoản nào vẫn bị đếm theo chuỗi như trước."""
    for _ in range(8):
        r = client.post("/api/v1/auth/login", json={"identifier": identifier, "password": "sai"})
        assert r.status_code == 401
    r = client.post("/api/v1/auth/login", json={"identifier": identifier, "password": "sai"})
    assert r.status_code == 429


def test_hash_gia_is_a_real_bcrypt_hash() -> None:
    """kt6-2: chuỗi băm giả phải là bcrypt thật để thời gian so sánh giống tài khoản thật."""
    from app.services.auth import _HASH_GIA

    assert _HASH_GIA.startswith("$2") and len(_HASH_GIA) == len(hash_password("x"))


# ------------------------------------------------------------ KHO-6: sắp xếp lộ trình


def test_roadmaps_sorted_by_vietnamese_key(client: TestClient) -> None:
    """KHO-6: /roadmaps cũng sắp theo khoá không dấu, cùng cách với /skills."""
    from app.core.chuoi import bo_dau

    names = [r["name"] for r in client.get("/api/v1/roadmaps").json()]
    assert names == sorted(names, key=bo_dau)


# ------------------------------------------------------------ KHO-3: 304 cho trang HTML


def test_html_page_304_keeps_no_cache_and_if_modified_since(client: TestClient) -> None:
    """KHO-3: trang HTML trả 304 theo cả If-Modified-Since, và vẫn mang no-cache."""
    dau = client.get("/")
    assert dau.headers["cache-control"] == "no-cache"
    r = client.get("/", headers={"If-Modified-Since": dau.headers["last-modified"]})
    assert r.status_code == 304 and r.content == b""
    r = client.get("/", headers={"If-None-Match": '"khac"'})
    assert r.status_code == 200 and len(r.content) > 1000


def test_token_ttl_is_still_enforced(client: TestClient, user_factory) -> None:
    """GDL-8: token hết hạn vẫn bị chặn như trước khi bắt buộc exp."""
    from app.core.security import create_access_token

    account = user_factory()
    het_han, _ = create_access_token(account["user"]["id"], ttl=timedelta(seconds=-1))
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {het_han}"})
    assert r.status_code == 401
