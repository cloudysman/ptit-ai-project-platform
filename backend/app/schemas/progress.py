"""Schema của phần tiến độ: bài nộp, badge, tiến độ và bảng xếp hạng."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl

from app.models.enums import SubmissionStatus
from app.schemas.catalog import ProjectRef, TrackRead
from app.schemas.common import ORMModel


class SubmissionCreate(BaseModel):
    repo_url: HttpUrl = Field(description="Đường dẫn tới mã nguồn của bài nộp.")
    demo_url: HttpUrl | None = Field(default=None, description="Đường dẫn tới bản chạy thử.")
    note: str = Field(default="", max_length=2000)


class SubmissionReview(BaseModel):
    """Kết quả chấm một bài nộp."""

    status: SubmissionStatus
    score: int | None = Field(default=None, ge=0, le=100)
    feedback: str = Field(default="", max_length=4000)


class SubmissionRead(ORMModel):
    id: int
    project: ProjectRef
    repo_url: str
    demo_url: str | None
    note: str
    status: SubmissionStatus
    score: int | None
    feedback: str
    awarded_xp: int
    submitted_at: datetime
    reviewed_at: datetime | None


class BadgeRead(ORMModel):
    id: int
    slug: str
    name: str
    description: str
    icon: str


class UserBadgeRead(ORMModel):
    badge: BadgeRead
    awarded_at: datetime


class TrackProgress(ORMModel):
    """Số project đã hoàn thành trên tổng số project của một track."""

    track: TrackRead
    completed: int
    total: int


class ProgressSummary(BaseModel):
    """Bức tranh tiến độ tổng thể của một người dùng."""

    total_xp: int
    completed_projects: int
    pending_submissions: int
    highest_level: int = Field(description="Level cao nhất người dùng đã hoàn thành.")
    by_track: list[TrackProgress]
    badges: list[UserBadgeRead]


class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    display_name: str
    total_xp: int
    completed_projects: int
