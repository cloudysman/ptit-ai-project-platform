"""Cấu hình toàn ứng dụng, đọc từ biến môi trường và file .env."""

from __future__ import annotations

import warnings
from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Thư mục gốc của backend, dùng để quy chiếu mọi đường dẫn tương đối.
BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
# Ảnh đại diện do người dùng tải lên. Để trong data vì đây là dữ liệu chạy thật,
# không phải mã nguồn, và thư mục data đã được bỏ qua khi đưa lên kho mã nguồn.
AVATAR_DIR = DATA_DIR / "anh-dai-dien"

_SQLITE_PREFIX = "sqlite:///"

# Khoá mặc định trong file .env.example, chỉ dùng để chạy thử.
_PLACEHOLDER_SECRET_KEY = "doi-khoa-nay-truoc-khi-chay-that"
# Thuật toán HS256 yêu cầu khoá tối thiểu 32 byte.
MIN_SECRET_KEY_BYTES = 32


class Settings(BaseSettings):
    """Tập hợp tham số cấu hình. Mỗi thuộc tính tương ứng một biến môi trường."""

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "API nền tảng học tập theo project"
    api_prefix: str = "/api/v1"
    debug: bool = False

    host: str = "127.0.0.1"
    port: int = 8421

    database_url: str = f"{_SQLITE_PREFIX}data/nen-tang-project.db"

    secret_key: str = _PLACEHOLDER_SECRET_KEY
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60 * 24 * 7

    # Chuỗi origin ngăn cách bằng dấu phẩy. Dùng chuỗi thay vì danh sách để
    # tránh phải viết JSON trong file .env. Danh sách mặc định gồm các cổng mà
    # những cách chạy frontend riêng hay dùng: 5500 của tiện ích Live Server,
    # 8080 của máy chủ tĩnh có sẵn trong Python, 5173 và 3000 của các công cụ
    # dựng giao diện. Khi backend phục vụ luôn frontend thì hai bên cùng một
    # origin nên danh sách này không được dùng tới.
    cors_origins: str = (
        "http://127.0.0.1:5500,http://localhost:5500,"
        "http://127.0.0.1:8080,http://localhost:8080,"
        "http://127.0.0.1:5173,http://localhost:5173,http://localhost:3000"
    )

    # Đường dẫn tới thư mục frontend, tính từ thư mục backend. Để trống thì
    # backend chỉ phục vụ API và địa chỉ gốc chuyển hướng sang trang tài liệu.
    frontend_dir: str = "../frontend"

    default_page_size: int = 20
    max_page_size: int = 100

    # Số project tối đa mà API đề xuất trả về một lần.
    recommendation_limit: int = 10

    # Dung lượng tối đa của một ảnh đại diện, tính bằng byte.
    max_avatar_bytes: int = 2 * 1024 * 1024

    @model_validator(mode="after")
    def check_secret_key(self) -> Settings:
        """Chặn việc chạy thật với khoá ký yếu hoặc khoá mặc định.

        Ở chế độ gỡ lỗi thì chỉ cảnh báo, để người mới tải mã nguồn về vẫn chạy
        thử được ngay mà không phải cấu hình gì.
        """
        is_weak = (
            self.secret_key == _PLACEHOLDER_SECRET_KEY
            or len(self.secret_key.encode("utf-8")) < MIN_SECRET_KEY_BYTES
        )
        if not is_weak:
            return self

        message = (
            "SECRET_KEY đang là khoá mặc định hoặc ngắn hơn "
            f"{MIN_SECRET_KEY_BYTES} byte. Sinh khoá mới bằng lệnh: "
            'python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )
        if self.debug:
            warnings.warn(message, stacklevel=2)
            return self
        raise ValueError(message)

    @property
    def cors_origin_list(self) -> list[str]:
        """Tách chuỗi cors_origins thành danh sách origin đã bỏ khoảng trắng."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_database_url(self) -> str:
        """Đưa đường dẫn SQLite tương đối về đường dẫn tuyệt đối theo BASE_DIR.

        SQLAlchemy hiểu đường dẫn tương đối theo thư mục làm việc hiện tại, nên
        nếu chạy backend từ thư mục khác thì file cơ sở dữ liệu sẽ bị tạo sai chỗ.
        """
        if not self.database_url.startswith(_SQLITE_PREFIX):
            return self.database_url

        raw_path = self.database_url[len(_SQLITE_PREFIX) :]
        if raw_path in ("", ":memory:"):
            return self.database_url

        path = Path(raw_path)
        if not path.is_absolute():
            path = BASE_DIR / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return f"{_SQLITE_PREFIX}{path.as_posix()}"

    @property
    def frontend_path(self) -> Path | None:
        """Thư mục frontend nếu thư mục đó có thật và có file index.html.

        Trả về None khi không tìm thấy, để ứng dụng vẫn khởi động bình thường
        trong trường hợp chỉ cần chạy riêng phần API, ví dụ lúc chạy kiểm thử.
        """
        if not self.frontend_dir.strip():
            return None

        path = Path(self.frontend_dir)
        if not path.is_absolute():
            path = BASE_DIR / path
        path = path.resolve()
        return path if (path / "index.html").is_file() else None

    @property
    def is_sqlite(self) -> bool:
        return self.resolved_database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    """Trả về cấu hình dùng chung. Kết quả được nhớ lại để chỉ đọc .env một lần."""
    return Settings()


settings = get_settings()
