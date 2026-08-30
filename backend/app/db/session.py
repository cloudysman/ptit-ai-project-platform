"""Tạo engine, cấu hình SQLite và cung cấp session cho tầng API."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.chuoi import bo_dau
from app.core.config import settings
from app.db.base import Base


def _create_engine() -> Engine:
    """Tạo engine phù hợp với loại cơ sở dữ liệu đang cấu hình."""
    url = settings.resolved_database_url
    kwargs: dict = {"echo": settings.debug, "future": True}

    if settings.is_sqlite:
        # SQLite mặc định chỉ cho phép dùng một kết nối trong chính luồng đã tạo
        # ra nó. FastAPI chạy các endpoint đồng bộ trên một nhóm luồng nên phải
        # tắt kiểm tra này.
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_pre_ping"] = True

    return create_engine(url, **kwargs)


engine = _create_engine()


def _lower_unicode(value: object) -> object:
    """Hạ chữ hoa theo quy tắc Unicode, dùng để thay hàm lower của SQLite.

    Hàm dựng sẵn của SQLite nhận mọi kiểu giá trị, nên bản thay thế cũng phải
    trả lại nguyên vẹn những gì không phải chuỗi thay vì ném lỗi.
    """
    return value.lower() if isinstance(value, str) else value


def _bo_dau_sql(value: object) -> object:
    """Bản dùng trong SQL của hàm bỏ dấu, cũng phải chịu được giá trị không phải chuỗi."""
    return bo_dau(value) if isinstance(value, str) else value


@event.listens_for(engine, "connect")
def _configure_sqlite(dbapi_connection, _connection_record) -> None:
    """Bật các tuỳ chọn cần thiết mỗi khi mở một kết nối SQLite mới.

    - foreign_keys: SQLite mặc định bỏ qua khoá ngoại, phải bật thủ công.
    - journal_mode=WAL: cho phép đọc song song với ghi, hợp với backend nhiều luồng.
    - synchronous=NORMAL: giảm số lần ghi đĩa mà vẫn an toàn khi dùng WAL.
    - busy_timeout: chờ 5 giây thay vì báo lỗi ngay khi cơ sở dữ liệu đang bận.

    Hàm lower dựng sẵn của SQLite chỉ hạ được 26 chữ cái không dấu, nên
    "Ứng dụng" giữ nguyên chữ Ứ và người tìm bằng chữ thường không ra kết quả.
    Hàm lower ở đây được thay bằng bản của Python, vốn theo đúng quy tắc Unicode.
    MySQL và PostgreSQL đã xử lý đúng phần này nên không cần thay.

    Hàm bo_dau là hàm riêng của nền tảng, SQLite không có sẵn. Phần tìm kiếm và
    phần sắp xếp theo tên project gọi tới nó, nên nó phải được đăng ký lại trên
    mọi kết nối mới.
    """
    if not settings.is_sqlite:
        return

    dbapi_connection.create_function("lower", 1, _lower_unicode, deterministic=True)
    dbapi_connection.create_function("bo_dau", 1, _bo_dau_sql, deterministic=True)

    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=5000")
    finally:
        cursor.close()


# expire_on_commit=False để đối tượng vẫn đọc được sau khi commit, nhờ đó tầng
# API không phải truy vấn lại cơ sở dữ liệu chỉ để dựng phản hồi.
SessionFactory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


def get_db() -> Iterator[Session]:
    """Dependency của FastAPI: mở một session cho mỗi request rồi đóng lại."""
    session = SessionFactory()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Session dùng ngoài request, ví dụ khi nạp dữ liệu mẫu.

    Tự commit khi khối lệnh kết thúc bình thường và tự rollback khi có lỗi.
    """
    session = SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    """Tạo mọi bảng chưa tồn tại.

    Cách này đủ cho giai đoạn đầu. Khi lược đồ bắt đầu thay đổi thường xuyên thì
    nên chuyển sang công cụ migration để không phải xoá cơ sở dữ liệu mỗi lần sửa.
    """
    from app import models  # noqa: F401  - nạp model để đăng ký vào metadata

    Base.metadata.create_all(bind=engine)
