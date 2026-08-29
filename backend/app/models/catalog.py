"""Model của phần catalog: level, track, skill, project, gợi ý và lộ trình."""

from __future__ import annotations

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import ProjectType

# Một project cần nhiều skill, một skill xuất hiện ở nhiều project.
project_skill = Table(
    "project_skill",
    Base.metadata,
    Column("project_id", ForeignKey("project.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", ForeignKey("skill.id", ondelete="CASCADE"), primary_key=True),
)

# Quan hệ tiên quyết giữa hai project. Cột prerequisite_id trỏ tới project phải
# hoàn thành trước, cột project_id trỏ tới project được mở khoá sau đó.
project_prerequisite = Table(
    "project_prerequisite",
    Base.metadata,
    Column("project_id", ForeignKey("project.id", ondelete="CASCADE"), primary_key=True),
    Column("prerequisite_id", ForeignKey("project.id", ondelete="CASCADE"), primary_key=True),
    CheckConstraint("project_id <> prerequisite_id", name="no_self_prerequisite"),
)


class Level(Base):
    """Mức độ khó, đánh số từ 0 đến 5 và dùng luôn số này làm khoá chính."""

    __tablename__ = "level"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    slug: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    projects: Mapped[list[Project]] = relationship(back_populates="level")


class Track(Base):
    """Nhóm chuyên môn của project, ví dụ Computer Vision hay Deployment."""

    __tablename__ = "track"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(96), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    projects: Mapped[list[Project]] = relationship(back_populates="track")


class Skill(Base):
    """Một kỹ năng cụ thể mà project rèn luyện, ví dụ pandas hay Docker."""

    __tablename__ = "skill"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(96), nullable=False)

    projects: Mapped[list[Project]] = relationship(secondary=project_skill, back_populates="skills")


class Project(Base, TimestampMixin):
    """Đơn vị học tập trung tâm của nền tảng."""

    __tablename__ = "project"
    __table_args__ = (
        # Hai chỉ mục ghép phục vụ đúng các bộ lọc hay dùng nhất trên trang danh sách.
        Index("ix_project_level_track", "level_id", "track_id"),
        Index("ix_project_published_level", "is_published", "level_id"),
        CheckConstraint("estimated_hours > 0", name="positive_estimated_hours"),
        CheckConstraint("xp_reward >= 0", name="non_negative_xp_reward"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # Tóm tắt một hai câu, dùng cho thẻ project trên trang danh sách.
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Bối cảnh thực tế: project này giải quyết vấn đề gì ngoài đời.
    context: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Mục tiêu học tập: làm xong thì người dùng nắm được điều gì.
    objective: Mapped[str] = mapped_column(Text, nullable=False, default="")

    level_id: Mapped[int] = mapped_column(
        ForeignKey("level.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    track_id: Mapped[int] = mapped_column(
        ForeignKey("track.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    project_type: Mapped[ProjectType] = mapped_column(
        Enum(ProjectType, native_enum=False, length=16, validate_strings=True),
        nullable=False,
        default=ProjectType.STANDARD,
        index=True,
    )

    estimated_hours: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    xp_reward: Mapped[int] = mapped_column(Integer, nullable=False, default=100)

    dataset_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Hai cột dưới đây là danh sách chuỗi. Dùng JSON vì chúng chỉ được đọc kèm
    # theo project và không bao giờ phải lọc theo từng phần tử.
    deliverables: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    bonus_challenges: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    # lazy="selectin" nạp sẵn các quan hệ này bằng một truy vấn phụ duy nhất cho
    # cả trang kết quả, thay vì mỗi project một truy vấn.
    level: Mapped[Level] = relationship(back_populates="projects", lazy="selectin")
    track: Mapped[Track] = relationship(back_populates="projects", lazy="selectin")
    skills: Mapped[list[Skill]] = relationship(
        secondary=project_skill, back_populates="projects", lazy="selectin"
    )
    hints: Mapped[list[Hint]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Hint.tier",
    )
    prerequisites: Mapped[list[Project]] = relationship(
        secondary=project_prerequisite,
        primaryjoin=lambda: Project.id == project_prerequisite.c.project_id,
        secondaryjoin=lambda: Project.id == project_prerequisite.c.prerequisite_id,
        backref="unlocks",
    )


class Hint(Base):
    """Gợi ý theo tầng của AI Mentor.

    Tầng càng cao thì gợi ý càng cụ thể. Cách chia tầng giữ cho người dùng phải
    tự nghĩ trước thay vì đọc ngay lời giải.
    """

    __tablename__ = "hint"
    __table_args__ = (
        UniqueConstraint("project_id", "tier"),
        CheckConstraint("tier BETWEEN 1 AND 3", name="tier_between_1_and_3"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("project.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tier: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    project: Mapped[Project] = relationship(back_populates="hints")


class Roadmap(Base):
    """Lộ trình nghề nghiệp, là một chuỗi project được sắp xếp sẵn."""

    __tablename__ = "roadmap"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(96), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    steps: Mapped[list[RoadmapStep]] = relationship(
        back_populates="roadmap",
        cascade="all, delete-orphan",
        order_by="RoadmapStep.order_index",
    )


class RoadmapStep(Base):
    """Một bước trong lộ trình, trỏ tới đúng một project."""

    __tablename__ = "roadmap_step"
    __table_args__ = (UniqueConstraint("roadmap_id", "order_index"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    roadmap_id: Mapped[int] = mapped_column(
        ForeignKey("roadmap.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("project.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")

    roadmap: Mapped[Roadmap] = relationship(back_populates="steps")
    project: Mapped[Project] = relationship(lazy="selectin")
