"""Schema của phần tiến độ: bài nộp, badge, tiến độ và bảng xếp hạng."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

from app.models.enums import SubmissionStatus
from app.schemas.catalog import LevelRead, ProjectRef, TrackRead
from app.schemas.common import ORMModel

# Độ rộng của hai cột đường dẫn trong bảng submission. SQLite không cưỡng chế
# độ rộng cột, nên giới hạn phải đặt ở đây thì mới có tác dụng thật.
MAX_URL_LENGTH = 512


class SubmissionCreate(BaseModel):
    repo_url: HttpUrl = Field(
        max_length=MAX_URL_LENGTH, description="Đường dẫn tới mã nguồn của bài nộp."
    )
    demo_url: HttpUrl | None = Field(
        default=None, max_length=MAX_URL_LENGTH, description="Đường dẫn tới bản chạy thử."
    )
    note: str = Field(default="", max_length=2000)

    @field_validator("note")
    @classmethod
    def strip_note(cls, value: str) -> str:
        """Cắt khoảng trắng hai đầu để ghi chú rỗng không thành một chuỗi dấu cách."""
        return value.strip()


class SubmissionReview(BaseModel):
    """Kết quả chấm một bài nộp."""

    status: SubmissionStatus
    score: int | None = Field(default=None, ge=0, le=100)
    feedback: str = Field(default="", max_length=4000)

    @field_validator("score", mode="before")
    @classmethod
    def reject_bool_score(cls, value: object) -> object:
        """Chặn true/false: Pydantic coi bool là một dạng của int nên chúng lọt qua thành 1/0.

        Chỉ chặn đúng bool; chuỗi số như "90" vẫn được đọc như trước.
        """
        if isinstance(value, bool):
            raise ValueError("Điểm bài nộp phải là số nguyên, không phải đúng/sai.")
        return value

    @field_validator("feedback")
    @classmethod
    def strip_feedback(cls, value: str) -> str:
        """Cắt khoảng trắng hai đầu, cùng lý do với ghi chú của bài nộp."""
        return value.strip()

    @field_validator("status")
    @classmethod
    def check_status(cls, value: SubmissionStatus) -> SubmissionStatus:
        """Chặn việc chấm bài mà lại đặt về trạng thái chờ chấm.

        Backend chỉ cho chấm một bài đúng một lần. Nếu người chấm gửi lên trạng
        thái chờ chấm thì bài nộp coi như chưa được chấm và lại chấm được lần
        nữa, làm rỗng ý nghĩa của chốt chặn đó.
        """
        if value is SubmissionStatus.PENDING:
            raise ValueError("Kết quả chấm phải là đạt, chưa đạt hoặc cần sửa lại.")
        return value

    @model_validator(mode="after")
    def require_feedback_when_not_accepted(self) -> SubmissionReview:
        """Bài bị trả về hay chưa đạt phải kèm nhận xét.

        Người nộp chỉ thấy một nhãn đỏ nếu không có nhận xét, và không biết phải
        sửa gì để nộp lại. Bài đạt thì nhận xét vẫn tuỳ ý.
        """
        if self.status is not SubmissionStatus.ACCEPTED and not self.feedback:
            raise ValueError("Cần ghi nhận xét khi kết quả là cần sửa lại hoặc chưa đạt.")
        return self


class SubmissionProjectRef(ProjectRef):
    """Project của một bài nộp, kèm level và track để màn hình chấm bài nêu ngữ cảnh."""

    level: LevelRead
    track: TrackRead


class SubmissionRead(ORMModel):
    id: int
    project: SubmissionProjectRef
    repo_url: str
    demo_url: str | None
    note: str
    status: SubmissionStatus
    score: int | None
    feedback: str
    awarded_points: int
    submitted_at: datetime
    reviewed_at: datetime | None


class SubmissionAuthor(ORMModel):
    """Người nộp bài, kèm trong danh sách dành cho tài khoản giảng viên."""

    id: int
    username: str
    display_name: str


class PreviousReview(BaseModel):
    """Lần chấm gần nhất trước đó của cùng người nộp cho cùng project."""

    status: SubmissionStatus
    feedback: str
    reviewed_at: datetime | None


class SubmissionWithAuthor(SubmissionRead):
    """Bài nộp kèm người nộp. Chỉ tài khoản giảng viên mới đọc được cấu trúc này.

    Hai trường cuối do tầng dịch vụ gắn thêm khi liệt kê: bài nộp lại phải khác
    bài nộp lần đầu trong hàng đợi, và người chấm cần thấy mình (hoặc đồng nghiệp)
    đã yêu cầu sửa gì ở lần trước.
    """

    user: SubmissionAuthor
    attempt: int = Field(default=1, description="Lần nộp thứ mấy của người này cho project này.")
    previous_review: PreviousReview | None = None


class BadgeRead(ORMModel):
    id: int
    slug: str
    name: str
    description: str
    icon: str


class ReviewResult(BaseModel):
    """Kết quả chấm bài, kèm các badge vừa được cấp cho người dùng."""

    submission: SubmissionRead
    awarded_badges: list[BadgeRead]


class UserBadgeRead(ORMModel):
    badge: BadgeRead
    awarded_at: datetime


class TrackProgress(ORMModel):
    """Số project đã hoàn thành trên tổng số project của một track."""

    track: TrackRead
    completed: int
    total: int


class LevelProgress(ORMModel):
    """Số project đã hoàn thành trên tổng số project của một level."""

    level: LevelRead
    completed: int
    total: int


class ProgressSummary(BaseModel):
    """Bức tranh tiến độ tổng thể của một người dùng."""

    total_points: int
    completed_projects: int
    pending_submissions: int
    highest_level: int = Field(description="Level cao nhất người dùng đã hoàn thành.")
    by_level: list[LevelProgress]
    by_track: list[TrackProgress]
    badges: list[UserBadgeRead]


class LeaderboardEntry(BaseModel):
    """Một dòng của bảng xếp hạng."""

    rank: int
    username: str
    display_name: str
    avatar: str
    total_points: int
    completed_projects: int
