"""Schema của phần catalog."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class LevelRead(ORMModel):
    id: int = Field(description="Số hiệu level, từ 0 đến 5.")
    slug: str
    name: str
    description: str


class MentorRead(ORMModel):
    """Giảng viên phụ trách một track."""

    id: int
    slug: str
    name: str
    title: str
    bio: str
    photo: str = Field(description="Tên tệp ảnh chân dung trong thư mục anh của frontend.")
    order_index: int


class TrackRead(ORMModel):
    id: int
    slug: str
    name: str
    description: str
    order_index: int
    mentor: MentorRead | None = None


class SkillRead(ORMModel):
    id: int
    slug: str
    name: str


class HintRead(ORMModel):
    tier: int = Field(description="Tầng gợi ý, càng cao càng cụ thể.")
    content: str


class ProjectSummary(ORMModel):
    """Bản rút gọn của project, dùng cho trang danh sách."""

    id: int
    slug: str
    title: str
    summary: str
    estimated_hours: int
    reward_points: int
    level: LevelRead
    track: TrackRead
    skills: list[SkillRead]


class ProjectRef(ORMModel):
    """Tham chiếu gọn tới một project.

    Dùng khi liệt kê project tiên quyết và khi liệt kê bài nộp. Số điểm tích luỹ
    đi kèm để màn hình chấm bài nói được cho người chấm biết bài này cộng bao
    nhiêu điểm, mà không phải gọi thêm một lượt lấy chi tiết project.
    """

    id: int
    slug: str
    title: str
    reward_points: int


class ProjectDetail(ProjectSummary):
    """Bản đầy đủ của project, dùng cho trang chi tiết."""

    context: str
    objective: str
    dataset_url: str | None
    deliverables: list[str]
    bonus_challenges: list[str]
    prerequisites: list[ProjectRef]


class RoadmapStepRead(ORMModel):
    order_index: int
    note: str
    project: ProjectSummary


class RoadmapSummary(ORMModel):
    id: int
    slug: str
    name: str
    description: str


class RoadmapDetail(RoadmapSummary):
    steps: list[RoadmapStepRead]


class RecommendedProject(ORMModel):
    """Một project được đề xuất kèm lý do, để frontend giải thích cho người dùng."""

    project: ProjectSummary
    score: float = Field(description="Điểm ưu tiên, càng cao càng nên làm trước.")
    reason: str


class LevelCount(BaseModel):
    """Số project đã xuất bản của một level."""

    level: LevelRead
    projects: int


class TrackCount(BaseModel):
    """Số project đã xuất bản của một track."""

    track: TrackRead
    projects: int


class CatalogStats(BaseModel):
    """Số liệu tổng quan của kho project.

    Frontend cần đúng những con số này ngay khi mở trang: tổng số project, số
    project của từng level cho cột mục lục, và số project của từng track cho bộ
    lọc. Gom vào một endpoint để trang chủ chỉ phải gọi API một lần thay vì gọi
    riêng cho từng level.
    """

    projects: int = Field(description="Tổng số project đã xuất bản.")
    skills: int
    roadmaps: int
    by_level: list[LevelCount]
    by_track: list[TrackCount]
