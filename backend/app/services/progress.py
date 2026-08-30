"""Nghiệp vụ tiến độ: nộp bài, chấm bài, tổng hợp tiến độ và bảng xếp hạng."""

from __future__ import annotations

from sqlalchemy import case, func, select, update
from sqlalchemy.orm import Session, selectinload

from app.db.base import utcnow
from app.models.catalog import Project
from app.models.enums import SubmissionStatus
from app.models.progress import Badge, Submission
from app.models.user import User
from app.schemas.catalog import LevelRead, TrackRead
from app.schemas.common import PageParams
from app.schemas.progress import (
    LeaderboardEntry,
    LevelProgress,
    ProgressSummary,
    SubmissionCreate,
    SubmissionReview,
    TrackProgress,
    UserBadgeRead,
)
from app.services import badges as badge_service
from app.services import catalog as catalog_service


class ProjectAlreadyCompleted(Exception):
    """Người dùng đã có bài nộp được duyệt cho project này."""


class SubmissionAlreadyReviewed(Exception):
    """Bài nộp đã được chấm rồi, không chấm lại."""


class KhongTuChamBai(Exception):
    """Người chấm và người nộp là cùng một tài khoản."""


class ChuaMoKhoa(Exception):
    """Còn project tiên quyết mà người dùng chưa hoàn thành."""

    def __init__(self, con_thieu: list[str]) -> None:
        super().__init__(", ".join(con_thieu))
        self.con_thieu = con_thieu


def completed_project_ids(db: Session, user_id: int) -> set[int]:
    """Tập id project mà người dùng đã có bài nộp được duyệt."""
    return set(
        db.scalars(
            select(Submission.project_id)
            .where(
                Submission.user_id == user_id,
                Submission.status == SubmissionStatus.ACCEPTED,
            )
            .distinct()
        ).all()
    )


def create_submission(
    db: Session, user: User, project: Project, payload: SubmissionCreate
) -> tuple[Submission, bool]:
    """Ghi nhận bài nộp cho một project, trả về bài nộp kèm cờ cho biết nó có mới không.

    Project tiên quyết phải hoàn thành trước. Không chặn ở đây thì hai chữ tiên
    quyết chỉ còn là lời khuyên, và người học vẫn nhảy thẳng vào bài khó rồi tắc.

    Nộp lại trong lúc bài trước còn đang chờ chấm thì thay nội dung bài đó chứ
    không sinh thêm bài mới. Người học sửa xong đường dẫn thường nộp lại ngay,
    và nếu mỗi lần như vậy đẻ ra một bản ghi thì hàng đợi của giảng viên đầy
    những bài trùng nhau của cùng một người, cùng một project.
    """
    con_thieu = [
        tien_quyet.title
        for tien_quyet in project.prerequisites
        if tien_quyet.id not in completed_project_ids(db, user.id)
    ]
    if con_thieu:
        raise ChuaMoKhoa(con_thieu)

    already_accepted = db.scalar(
        select(Submission.id).where(
            Submission.user_id == user.id,
            Submission.project_id == project.id,
            Submission.status == SubmissionStatus.ACCEPTED,
        )
    )
    if already_accepted:
        raise ProjectAlreadyCompleted

    dang_cho = db.scalar(
        select(Submission).where(
            Submission.user_id == user.id,
            Submission.project_id == project.id,
            Submission.status == SubmissionStatus.PENDING,
        )
    )
    la_bai_moi = dang_cho is None

    submission = dang_cho or Submission(
        user_id=user.id,
        project_id=project.id,
        status=SubmissionStatus.PENDING,
    )
    submission.repo_url = str(payload.repo_url)
    submission.demo_url = str(payload.demo_url) if payload.demo_url else None
    submission.note = payload.note
    if la_bai_moi:
        db.add(submission)
    else:
        # Bài được xếp lại vào cuối hàng đợi, vì nội dung của nó vừa thay đổi.
        submission.submitted_at = utcnow()

    db.commit()
    db.refresh(submission)
    return submission, la_bai_moi


def _da_duoc_cong_diem(db: Session, submission: Submission) -> bool:
    """Người dùng đã có một bài nộp khác được duyệt cho chính project này chưa.

    Người dùng nộp lại được khi bài trước bị trả về, nên một project có thể có
    nhiều bài nộp. Nếu hai bài cùng chờ chấm rồi cùng được duyệt thì điểm tích luỹ
    sẽ cộng hai lần cho một project, và tổng điểm lệch hẳn với số project đã hoàn
    thành.
    """
    return (
        db.scalar(
            select(Submission.id).where(
                Submission.user_id == submission.user_id,
                Submission.project_id == submission.project_id,
                Submission.status == SubmissionStatus.ACCEPTED,
                Submission.id != submission.id,
            )
        )
        is not None
    )


def review_submission(
    db: Session, submission: Submission, reviewer: User, payload: SubmissionReview
) -> tuple[Submission, list[Badge]]:
    """Chấm một bài nộp, cộng điểm tích luỹ nếu được duyệt và xét badge ngay sau đó.

    Trả về bài nộp đã cập nhật cùng danh sách badge vừa được cấp. Toàn bộ thay đổi
    nằm trong một giao dịch để điểm tích luỹ và badge không bao giờ lệch nhau.

    Người chấm không được là chính người nộp.

    Mỗi project chỉ cộng điểm đúng một lần. Bài nộp thứ hai của cùng project vẫn
    được ghi nhận là đạt, nhưng phần điểm của nó bằng không.
    """
    if submission.status is not SubmissionStatus.PENDING:
        raise SubmissionAlreadyReviewed

    # Giảng viên chấm bài của sinh viên, không ai tự chấm bài của mình. Nếu
    # không chặn ở đây thì một tài khoản giảng viên vẫn có thể nộp bài rồi tự
    # duyệt cho chính mình, và số điểm tích luỹ mất hết ý nghĩa.
    if submission.user_id == reviewer.id:
        raise KhongTuChamBai

    # Trạng thái được đổi bằng một câu lệnh có điều kiện thay vì gán rồi lưu:
    # điều kiện "đang chờ chấm" nằm ngay trong câu UPDATE nên cơ sở dữ liệu là
    # nơi phân xử. Hai giảng viên bấm lưu cùng lúc thì đúng một câu lệnh đổi được
    # bản ghi, người thứ hai nhận lỗi thay vì thấy kết quả của mình biến mất.
    ket_qua = db.execute(
        update(Submission)
        .where(Submission.id == submission.id, Submission.status == SubmissionStatus.PENDING)
        .values(
            status=payload.status,
            score=payload.score,
            feedback=payload.feedback,
            reviewed_at=utcnow(),
            reviewer_id=reviewer.id,
        )
    )
    if ket_qua.rowcount == 0:
        db.rollback()
        raise SubmissionAlreadyReviewed
    db.refresh(submission)

    awarded_badges: list[Badge] = []
    if payload.status is SubmissionStatus.ACCEPTED:
        if not _da_duoc_cong_diem(db, submission):
            diem = submission.project.reward_points
            submission.awarded_points = diem
            # Cộng dồn ngay trong cơ sở dữ liệu. Nếu đọc tổng điểm ra Python, cộng
            # rồi ghi lại thì hai lượt chấm chạy song song cùng đọc một con số cũ
            # và lượt ghi sau xoá mất phần điểm của lượt trước.
            db.execute(
                update(User)
                .where(User.id == submission.user_id)
                .values(total_points=User.total_points + diem)
            )
            db.refresh(submission.user)
        db.flush()
        awarded_badges = badge_service.evaluate(db, submission.user)

    db.commit()
    db.refresh(submission)
    return submission, awarded_badges


def list_submissions(
    db: Session, user_id: int, params: PageParams, status: SubmissionStatus | None = None
) -> tuple[list[Submission], int]:
    """Một trang bài nộp của người dùng, bài mới nộp đứng trước."""
    conditions = [Submission.user_id == user_id]
    if status is not None:
        conditions.append(Submission.status == status)

    total = db.scalar(select(func.count(Submission.id)).where(*conditions)) or 0
    if total == 0:
        return [], 0

    items = db.scalars(
        select(Submission)
        .where(*conditions)
        # Phản hồi chỉ cần bốn trường của project. Chỉ định đúng bốn cột đó và
        # chặn mọi quan hệ còn lại, nếu không mỗi trang bài nộp sẽ kéo theo cả
        # level, track và skill của từng project cùng những cột văn bản dài
        # không dùng tới.
        .options(
            selectinload(Submission.project)
            .load_only(Project.id, Project.slug, Project.title, Project.reward_points)
            .raiseload("*")
        )
        .order_by(Submission.submitted_at.desc(), Submission.id.desc())
        .offset(params.offset)
        .limit(params.page_size)
    ).all()
    return list(items), total


def list_all_submissions(
    db: Session, params: PageParams, status: SubmissionStatus | None = None
) -> tuple[list[Submission], int]:
    """Một trang bài nộp của mọi người dùng, phục vụ màn hình chấm bài.

    Bài nộp cũ đứng trước, vì người chấm nên xử lý theo thứ tự đã nộp. Ngoài bốn
    trường của project, danh sách này còn cần ba trường của người nộp, nên quan
    hệ người dùng cũng được nạp sẵn thay vì để mỗi dòng sinh một truy vấn riêng.
    """
    conditions = []
    if status is not None:
        conditions.append(Submission.status == status)

    total = db.scalar(select(func.count(Submission.id)).where(*conditions)) or 0
    if total == 0:
        return [], 0

    items = db.scalars(
        select(Submission)
        .where(*conditions)
        .options(
            selectinload(Submission.project)
            .load_only(Project.id, Project.slug, Project.title, Project.reward_points)
            .raiseload("*"),
            selectinload(Submission.user)
            .load_only(User.id, User.username, User.display_name)
            .raiseload("*"),
        )
        .order_by(Submission.submitted_at.asc(), Submission.id.asc())
        .offset(params.offset)
        .limit(params.page_size)
    ).all()
    return list(items), total


def summarize(db: Session, user: User) -> ProgressSummary:
    """Tổng hợp tiến độ của một người dùng cho trang hồ sơ."""
    stats = badge_service.collect_stats(db, user)
    pending = (
        db.scalar(
            select(func.count(Submission.id)).where(
                Submission.user_id == user.id,
                Submission.status == SubmissionStatus.PENDING,
            )
        )
        or 0
    )

    tong_theo_track = catalog_service.count_projects_by_track(db)
    tong_theo_level = catalog_service.count_projects_by_level(db)
    return ProgressSummary(
        total_points=user.total_points,
        completed_projects=stats.completed_projects,
        pending_submissions=pending,
        highest_level=stats.highest_level,
        by_level=[
            LevelProgress(
                level=LevelRead.model_validate(level),
                completed=stats.completed_by_level.get(level.id, 0),
                total=tong_theo_level.get(level.id, 0),
            )
            for level in catalog_service.list_levels(db)
        ],
        by_track=[
            TrackProgress(
                track=TrackRead.model_validate(track),
                completed=stats.completed_by_track.get(track.id, 0),
                total=tong_theo_track.get(track.id, 0),
            )
            for track in catalog_service.list_tracks(db)
        ],
        badges=[
            UserBadgeRead.model_validate(item) for item in badge_service.list_user_badges(db, user)
        ],
    )


def leaderboard(db: Session, limit: int = 20) -> list[LeaderboardEntry]:
    """Bảng xếp hạng theo điểm tích luỹ.

    Chỉ xếp hạng sinh viên. Giảng viên là người chấm bài, để họ đứng chung bảng
    với người mình chấm thì bảng mất ý nghĩa.

    Số project hoàn thành được đếm bằng một phép gộp có điều kiện trong cùng một
    truy vấn, nên bảng xếp hạng luôn tốn đúng một lần đọc cơ sở dữ liệu.
    """
    completed = func.count(
        func.distinct(case((Submission.status == SubmissionStatus.ACCEPTED, Submission.project_id)))
    )
    rows = db.execute(
        select(User.username, User.display_name, User.avatar, User.total_points, completed)
        .outerjoin(Submission, Submission.user_id == User.id)
        .where(User.is_active.is_(True), User.is_mentor.is_(False))
        .group_by(User.id)
        .order_by(User.total_points.desc(), User.id.asc())
        .limit(limit)
    ).all()

    return [
        LeaderboardEntry(
            rank=rank,
            username=username,
            display_name=display_name,
            avatar=avatar,
            total_points=total_points,
            completed_projects=completed_projects,
        )
        for rank, (
            username,
            display_name,
            avatar,
            total_points,
            completed_projects,
        ) in enumerate(rows, 1)
    ]
