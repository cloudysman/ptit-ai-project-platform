"""Tạo và xoá bộ tài khoản dùng để trình bày nền tảng.

Nền tảng chặn việc tự chấm bài của mình, nên muốn xem trọn vòng nộp bài và chấm
bài thì phải có ít nhất hai tài khoản khác nhau. Chương trình này dựng sẵn một
bộ tài khoản đủ để đi hết mọi màn hình mà không phải tự đăng ký từng cái.

Cách dùng:
    python -m app.tai_khoan_demo tao       tạo bộ tài khoản kèm dữ liệu mẫu
    python -m app.tai_khoan_demo liet-ke   liệt kê tài khoản đang có
    python -m app.tai_khoan_demo xoa       xoá bộ tài khoản này và dữ liệu của nó

Cả bộ dùng chung một mật khẩu công khai, nên bộ này chỉ dành cho máy phát triển
và máy chủ trình bày. Khi DEBUG=false, lệnh tao từ chối chạy trừ khi kèm cờ
--toi-hieu-day-la-db-that, để không ai vô tình đưa các tài khoản giảng viên có
mật khẩu công khai lên cơ sở dữ liệu thật.

Lệnh tao và lệnh xoa chỉ đụng tới đúng những tài khoản ghi trong bảng bên dưới.
Tài khoản do người khác tự đăng ký không bị ảnh hưởng: nếu một username trong
bảng đã thuộc về một tài khoản thật (thư điện tử khác với thư điện tử của bộ) thì
tài khoản đó được giữ nguyên và bỏ qua, kèm một dòng cảnh báo.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.console import use_utf8_output
from app.core.security import hash_password
from app.db.base import utcnow
from app.db.session import SessionFactory, init_db, session_scope
from app.models.catalog import Project
from app.models.enums import SubmissionStatus
from app.models.progress import Submission, UserBadge
from app.models.user import User
from app.services import badges as badge_service


@dataclass(frozen=True, slots=True)
class TaiKhoanDemo:
    """Một tài khoản trong bộ trình bày."""

    username: str
    display_name: str
    is_mentor: bool
    # Số project được đánh dấu đã hoàn thành sẵn cho tài khoản này.
    so_project_da_xong: int = 0
    # Số bài nộp để lại ở trạng thái chờ chấm, dành cho người thử chấm bài.
    so_bai_cho_cham: int = 0

    @property
    def email(self) -> str:
        """Thư điện tử theo đúng quy ước của Học viện.

        Giảng viên dùng tên miền ptit.edu.vn, sinh viên dùng stu.ptit.edu.vn.
        Ô đăng nhập nhận cả username lẫn thư điện tử nên cả hai cách đều vào được.
        """
        duoi = "ptit.edu.vn" if self.is_mentor else "stu.ptit.edu.vn"
        return f"{self.username}@{duoi}"


# Cả bộ dùng chung một mật khẩu cho dễ nhớ khi trình bày. Đây là tài khoản mẫu
# chứ không phải tài khoản thật, và lệnh xoa gỡ sạch được chúng khi không cần nữa.
MAT_KHAU_CHUNG = "matkhau12345"

BO_TAI_KHOAN: tuple[TaiKhoanDemo, ...] = (
    # Bốn tài khoản giảng viên. Chấm bài cần ít nhất hai người khác nhau, vì nền
    # tảng không cho ai tự chấm bài của chính mình. Tài khoản admin do lệnh nạp
    # dữ liệu mẫu tạo ra với mật khẩu riêng cố ý không nằm trong bộ này: nếu
    # nằm trong bộ thì mỗi lần chạy tao, mật khẩu quản trị lại bị đặt về mật
    # khẩu công khai.
    TaiKhoanDemo("congtt", "Cong Tran", is_mentor=True),
    TaiKhoanDemo("giangvien1", "Giảng viên 1", is_mentor=True),
    TaiKhoanDemo("giangvien2", "Giảng viên 2", is_mentor=True),
    TaiKhoanDemo("giangvien3", "Giảng viên 3", is_mentor=True),
    # Bảy tài khoản sinh viên, tiến độ giảm dần để bảng xếp hạng có thứ hạng thật
    # chứ không phải một danh sách toàn số không.
    TaiKhoanDemo("ngocanh", "Trần Ngọc Anh", is_mentor=False, so_project_da_xong=8),
    TaiKhoanDemo("minhduc", "Lê Minh Đức", is_mentor=False, so_project_da_xong=5),
    TaiKhoanDemo("thuhien", "Phạm Thu Hiền", is_mentor=False, so_project_da_xong=4),
    TaiKhoanDemo("quanghuy", "Nguyễn Quang Huy", is_mentor=False, so_project_da_xong=3),
    TaiKhoanDemo("khanhlinh", "Vũ Khánh Linh", is_mentor=False, so_project_da_xong=2),
    TaiKhoanDemo("tuananh", "Đỗ Tuấn Anh", is_mentor=False, so_project_da_xong=1),
    # Tài khoản cuối chưa có điểm, và có sẵn hai bài chờ chấm để màn hình chấm
    # bài không trống khi người thử mở nó ra lần đầu.
    TaiKhoanDemo("sinhvien", "Nguyễn Văn Nam", is_mentor=False, so_bai_cho_cham=2),
)

# Bốn giảng viên đứng tên người chấm cho các bài đã đạt.
TEN_NGUOI_CHAM = ("congtt", "giangvien1", "giangvien2", "giangvien3")

# Cờ bắt buộc phải kèm khi chạy tao trên một cơ sở dữ liệu không ở chế độ gỡ lỗi.
CO_DB_THAT = "--toi-hieu-day-la-db-that"


def _project_khong_can_tien_quyet(db: Session, so_luong: int) -> list[Project]:
    """Chọn vài project dễ nhất mà không đòi hoàn thành project nào trước.

    Bài nộp cho project còn tiên quyết sẽ bị chặn, nên dữ liệu mẫu chỉ dùng
    những project đã mở khoá sẵn.
    """
    ket_qua: list[Project] = []
    danh_sach = db.scalars(
        select(Project)
        .where(Project.is_published.is_(True))
        .order_by(Project.level_id, Project.estimated_hours, Project.id)
    ).all()

    for project in danh_sach:
        if project.prerequisites:
            continue
        ket_qua.append(project)
        if len(ket_qua) >= so_luong:
            break
    return ket_qua


def _tao_mot_tai_khoan(db: Session, mau: TaiKhoanDemo) -> User | None:
    """Tạo tài khoản, hoặc đặt lại mật khẩu nếu tài khoản đã có.

    Trả về None khi username đã thuộc về một tài khoản thật, tức một tài khoản
    có thư điện tử khác với thư điện tử của bộ. Ghi đè lên nó nghĩa là đổi mật
    khẩu của người khác thành mật khẩu công khai và xoá sạch bài nộp của họ.
    """
    user = db.scalar(select(User).where(User.username == mau.username))
    if user is None:
        user = User(username=mau.username, email=mau.email)
        db.add(user)
    elif user.email.strip().lower() != mau.email:
        return None
    user.display_name = mau.display_name
    user.hashed_password = hash_password(MAT_KHAU_CHUNG)
    user.is_mentor = mau.is_mentor
    user.is_active = True
    user.total_points = 0
    db.flush()
    return user


def tao(db: Session) -> list[str]:
    """Dựng cả bộ tài khoản kèm bài nộp và điểm tích luỹ đi theo.

    Username nào đã thuộc về tài khoản thật thì được bỏ qua và báo lại trong
    danh sách trả về, phần còn lại của bộ vẫn được dựng bình thường.
    """
    tai_khoan: dict[str, User] = {}
    bo_qua: list[str] = []
    for mau in BO_TAI_KHOAN:
        user = _tao_mot_tai_khoan(db, mau)
        if user is None:
            bo_qua.append(mau.username)
        else:
            tai_khoan[mau.username] = user
    nguoi_cham = [tai_khoan[ten] for ten in TEN_NGUOI_CHAM if ten in tai_khoan]
    if not nguoi_cham:
        raise RuntimeError(
            "Mọi username giảng viên trong bộ đều đã thuộc về tài khoản thật, "
            "không có ai đứng tên chấm các bài mẫu."
        )

    can_bao_nhieu = max(mau.so_project_da_xong + mau.so_bai_cho_cham for mau in BO_TAI_KHOAN)
    kho = _project_khong_can_tien_quyet(db, can_bao_nhieu)
    if len(kho) < can_bao_nhieu:
        raise RuntimeError(
            f"Kho chỉ có {len(kho)} project không cần tiên quyết, cần {can_bao_nhieu}. "
            "Chạy nạp dữ liệu mẫu trước: python -m app.seed"
        )

    dong = [
        f"{ten:<12} BỎ QUA: username này đã thuộc về một tài khoản thật, giữ nguyên"
        for ten in bo_qua
    ]
    for chi_so_nguoi, mau in enumerate(BO_TAI_KHOAN):
        if mau.username not in tai_khoan:
            continue
        user = tai_khoan[mau.username]

        # Dọn dữ liệu cũ của chính tài khoản này, để chạy lại nhiều lần vẫn ra
        # đúng một kết quả thay vì cộng dồn thêm bài nộp mỗi lần.
        db.execute(delete(UserBadge).where(UserBadge.user_id == user.id))
        db.execute(delete(Submission).where(Submission.user_id == user.id))
        db.flush()

        for thu_tu in range(mau.so_project_da_xong):
            project = kho[thu_tu]
            # Người chấm xoay vòng qua bốn giảng viên, để danh sách bài nộp
            # không phải chỉ một người đứng tên toàn bộ.
            cham = nguoi_cham[(chi_so_nguoi + thu_tu) % len(nguoi_cham)]
            db.add(
                Submission(
                    user_id=user.id,
                    project_id=project.id,
                    repo_url=f"https://github.com/vi-du/{project.slug}",
                    note="Bài nộp mẫu, dùng để trình bày nền tảng.",
                    status=SubmissionStatus.ACCEPTED,
                    score=85 + (thu_tu % 3) * 5,
                    feedback="Bài làm đủ yêu cầu.",
                    awarded_points=project.reward_points,
                    reviewer_id=cham.id,
                    # Bài đã chấm thì phải có thời điểm chấm, giống bài chấm qua
                    # API; thiếu nó thì giao diện không hiện dòng "Chấm lúc".
                    reviewed_at=utcnow(),
                )
            )
            user.total_points += project.reward_points

        for thu_tu in range(mau.so_bai_cho_cham):
            project = kho[thu_tu]
            db.add(
                Submission(
                    user_id=user.id,
                    project_id=project.id,
                    repo_url=f"https://github.com/vi-du/{project.slug}",
                    note="Bài nộp mẫu đang chờ chấm.",
                    status=SubmissionStatus.PENDING,
                )
            )

        db.flush()
        if mau.so_project_da_xong:
            badge_service.evaluate(db, user)
            db.flush()

        vai = "giảng viên" if mau.is_mentor else "sinh viên"
        if mau.so_project_da_xong:
            trang_thai = f"{user.total_points} điểm, {mau.so_project_da_xong} project"
        elif mau.so_bai_cho_cham:
            trang_thai = f"{mau.so_bai_cho_cham} bài đang chờ chấm"
        else:
            trang_thai = "chưa có dữ liệu"
        dong.append(f"{mau.username:<12} {vai:<11} {mau.display_name:<20} {trang_thai}")

    return dong


def xoa(db: Session) -> int:
    """Xoá bộ tài khoản trình bày cùng toàn bộ dữ liệu đi theo chúng.

    Chỉ xoá đúng những tài khoản mang thư điện tử của bộ; một tài khoản thật
    trùng username thì không phải của bộ này và được giữ nguyên.
    """
    email = [mau.email for mau in BO_TAI_KHOAN]
    ids = list(db.scalars(select(User.id).where(func.lower(User.email).in_(email))).all())
    if not ids:
        return 0

    db.execute(delete(UserBadge).where(UserBadge.user_id.in_(ids)))
    db.execute(delete(Submission).where(Submission.user_id.in_(ids)))
    # Bài nộp của người khác có thể ghi nhận một tài khoản trong bộ này là người
    # chấm. Cột đó phải được gỡ trước, nếu không ràng buộc khoá ngoại chặn việc xoá.
    db.execute(
        Submission.__table__.update()
        .where(Submission.reviewer_id.in_(ids))
        .values(reviewer_id=None)
    )
    db.execute(delete(User).where(User.id.in_(ids)))
    return len(ids)


def liet_ke(db: Session) -> list[str]:
    """Liệt kê mọi tài khoản đang có, kèm số bài nộp của từng tài khoản."""
    dong: list[str] = []
    for user in db.scalars(select(User).order_by(User.id)).all():
        so_bai = db.scalar(select(func.count(Submission.id)).where(Submission.user_id == user.id))
        cho_cham = db.scalar(
            select(func.count(Submission.id)).where(
                Submission.user_id == user.id, Submission.status == SubmissionStatus.PENDING
            )
        )
        vai = "giảng viên" if user.is_mentor else "sinh viên"
        dong.append(
            f"{user.username:<14} {vai:<11} {user.total_points:>4} điểm  "
            f"{so_bai} bài nộp, {cho_cham} chờ chấm"
        )
    return dong


def main() -> int:
    use_utf8_output()

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("lenh", choices=("tao", "xoa", "liet-ke"))
    parser.add_argument(
        CO_DB_THAT,
        dest="db_that",
        action="store_true",
        help="Xác nhận tạo bộ tài khoản mật khẩu công khai khi DEBUG=false.",
    )
    args = parser.parse_args()

    if args.lenh == "tao" and not settings.debug and not args.db_that:
        print(
            "DEBUG=false: cơ sở dữ liệu này có thể là bản thật. Bộ tài khoản dùng mật "
            f"khẩu công khai, muốn tạo thì chạy lại kèm cờ {CO_DB_THAT}.",
            file=sys.stderr,
        )
        return 2

    init_db()

    if args.lenh == "liet-ke":
        with SessionFactory() as db:
            for dong in liet_ke(db):
                print(f"  {dong}")
        return 0

    with session_scope() as db:
        if args.lenh == "tao":
            for dong in tao(db):
                print(f"  {dong}")
            print("Đã dựng xong bộ tài khoản trình bày.")
        else:
            so = xoa(db)
            print(f"Đã xoá {so} tài khoản trình bày cùng dữ liệu đi theo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
