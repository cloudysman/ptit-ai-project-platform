"""Model phần tiến độ: bài nộp, badge và badge đã cấp cho người dùng."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UtcDateTime, utcnow
from app.models.enums import BadgeRule, SubmissionStatus

if TYPE_CHECKING:  # pragma: no cover - chỉ phục vụ công cụ kiểm tra kiểu
    from app.models.catalog import Project, Track
    from app.models.user import User


class Submission(Base):
    """Một lần người dùng nộp kết quả của một project.

    Người dùng được nộp lại nhiều lần cho cùng một project khi bài nộp trước bị
    trả về. Chỉ bài nộp đầu tiên được duyệt mới cộng điểm tích luỹ.
    """

    __tablename__ = "submission"
    __table_args__ = (
        # Chỉ mục ghép phục vụ hai truy vấn nóng nhất: danh sách bài nộp của một
        # người dùng và kiểm tra người dùng đã hoàn thành project nào.
        Index("ix_submission_user_project", "user_id", "project_id"),
        Index("ix_submission_user_status", "user_id", "status"),
        CheckConstraint("score IS NULL OR score BETWEEN 0 AND 100", name="score_between_0_and_100"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("project.id", ondelete="CASCADE"), nullable=False, index=True
    )

    repo_url: Mapped[str] = mapped_column(String(512), nullable=False)
    demo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")

    status: Mapped[SubmissionStatus] = mapped_column(
        Enum(SubmissionStatus, native_enum=False, length=16, validate_strings=True),
        nullable=False,
        default=SubmissionStatus.PENDING,
        index=True,
    )
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feedback: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Số điểm tích luỹ thực sự đã cộng cho người dùng nhờ bài nộp này.
    awarded_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    submitted_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=utcnow, nullable=False, index=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    reviewer_id: Mapped[int | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped[User] = relationship(back_populates="submissions", foreign_keys=[user_id])
    project: Mapped[Project] = relationship(lazy="selectin")


class Badge(Base):
    """Một badge và điều kiện để đạt được nó."""

    __tablename__ = "badge"
    __table_args__ = (CheckConstraint("rule_value > 0", name="positive_rule_value"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(96), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    icon: Mapped[str] = mapped_column(String(32), nullable=False, default="")

    rule: Mapped[BadgeRule] = mapped_column(
        Enum(BadgeRule, native_enum=False, length=24, validate_strings=True), nullable=False
    )
    rule_value: Mapped[int] = mapped_column(Integer, nullable=False)
    # Chỉ dùng khi rule là TRACK_COUNT, cho biết badge thuộc track nào.
    rule_track_id: Mapped[int | None] = mapped_column(
        ForeignKey("track.id", ondelete="CASCADE"), nullable=True
    )

    track: Mapped[Track | None] = relationship(lazy="selectin")


class UserBadge(Base):
    """Ghi nhận một badge đã được cấp cho một người dùng."""

    __tablename__ = "user_badge"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), primary_key=True
    )
    badge_id: Mapped[int] = mapped_column(
        ForeignKey("badge.id", ondelete="CASCADE"), primary_key=True
    )
    awarded_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, nullable=False)

    user: Mapped[User] = relationship(back_populates="badges")
    badge: Mapped[Badge] = relationship(lazy="selectin")
