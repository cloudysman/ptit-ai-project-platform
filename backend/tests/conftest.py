"""Cấu hình chung cho bộ kiểm thử.

File này phải đặt biến môi trường trỏ cơ sở dữ liệu sang một file tạm trước khi
nạp bất kỳ module nào của ứng dụng, để kiểm thử không bao giờ đụng vào cơ sở dữ
liệu thật trong thư mục data.
"""

from __future__ import annotations

import itertools
import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

_TEMP_DIR = Path(tempfile.mkdtemp(prefix="nen-tang-project-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TEMP_DIR / 'test.db').as_posix()}"
os.environ["SECRET_KEY"] = "khoa-chi-dung-cho-kiem-thu-du-dai-32-byte"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import SessionFactory, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402
from app.seed.loader import load_seed  # noqa: E402
from app.services import chan_doan_mat_khau  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def prepare_database() -> Iterator[None]:
    """Tạo bảng và nạp dữ liệu mẫu một lần cho cả phiên kiểm thử."""
    Base.metadata.create_all(bind=engine)
    with SessionFactory() as session:
        load_seed(session)
        session.commit()
    yield
    engine.dispose()


@pytest.fixture
def db() -> Iterator[Session]:
    """Session dùng trực tiếp trong kiểm thử, ví dụ để nâng quyền quản trị."""
    session = SessionFactory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Client gọi API. Dùng chung một ứng dụng với cấu hình đã trỏ sang file tạm."""
    # Bộ đếm lần đăng nhập sai nằm trong bộ nhớ của tiến trình và sống lâu hơn
    # một bài kiểm thử. Xoá trước mỗi bài để những lần đăng nhập sai của bài này
    # không làm bài sau bị chặn.
    chan_doan_mat_khau.xoa_het()
    with TestClient(app) as test_client:
        yield test_client


# Bộ đếm dùng chung cho cả phiên kiểm thử. Cơ sở dữ liệu tồn tại suốt phiên nên
# username phải khác nhau giữa mọi lần gọi, kể cả ở các bài kiểm thử khác nhau.
MAT_KHAU_MAU = "matkhau12345"

_user_counter = itertools.count(1)


@pytest.fixture
def user_factory(client: TestClient):
    """Tạo một người dùng mới và trả về thông tin kèm tiêu đề xác thực."""

    def create(is_mentor: bool = False, db: Session | None = None) -> dict:
        index = next(_user_counter)
        username = f"nguoidung{index}"
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": f"{username}@example.com",
                "username": username,
                "password": MAT_KHAU_MAU,
                "display_name": f"Người dùng {index}",
            },
        )
        assert response.status_code == 201, response.text
        payload = response.json()

        if is_mentor:
            assert db is not None, "Cần truyền session để đặt quyền giảng viên."
            account = db.get(User, payload["user"]["id"])
            account.is_mentor = True
            db.commit()

        return {
            "user": payload["user"],
            "token": payload["access_token"],
            "headers": {"Authorization": f"Bearer {payload['access_token']}"},
        }

    return create
