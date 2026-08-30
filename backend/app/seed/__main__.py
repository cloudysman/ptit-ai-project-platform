"""Chạy nạp dữ liệu mẫu bằng lệnh: python -m app.seed"""

from __future__ import annotations

import argparse
import sys

from app.core.console import use_utf8_output
from app.core.security import hash_password
from app.db.session import init_db, session_scope
from app.models.user import User
from app.seed.loader import SeedError, load_seed


def _create_admin(email: str, username: str, password: str) -> str:
    """Tạo tài khoản giảng viên nếu chưa có, để có người chấm bài ngay từ đầu.

    Username và thư điện tử được chuẩn hoá về chữ thường giống hệt lúc đăng ký
    qua API. Nếu không, một tài khoản tạo từ dòng lệnh với chữ hoa sẽ không đăng
    nhập được, vì phần tìm người dùng luôn so khớp trên chuỗi đã hạ chữ.
    """
    from sqlalchemy import select

    email = email.strip().lower()
    username = username.strip().lower()

    with session_scope() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is not None:
            user.email = email
            user.hashed_password = hash_password(password)
            user.is_mentor = True
            return f"Đã cập nhật tài khoản giảng viên {username}."

        db.add(
            User(
                email=email,
                username=username,
                display_name="Quản trị viên",
                hashed_password=hash_password(password),
                is_mentor=True,
            )
        )
        return f"Đã tạo tài khoản giảng viên {username}."


def main() -> int:
    use_utf8_output()

    parser = argparse.ArgumentParser(
        description="Nạp dữ liệu mẫu cho nền tảng học tập theo project."
    )
    parser.add_argument("--admin-email", default="admin@example.com")
    parser.add_argument("--admin-username", default="admin")
    parser.add_argument(
        "--admin-password",
        default=None,
        help="Bỏ trống thì không tạo tài khoản giảng viên.",
    )
    args = parser.parse_args()

    init_db()

    try:
        with session_scope() as db:
            report = load_seed(db)
    except SeedError as error:
        print(f"Dữ liệu mẫu không hợp lệ: {error}")
        return 1

    for line in report.as_lines():
        print(line)

    if args.admin_password:
        print(_create_admin(args.admin_email, args.admin_username, args.admin_password))

    print("Đã nạp xong dữ liệu mẫu.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
