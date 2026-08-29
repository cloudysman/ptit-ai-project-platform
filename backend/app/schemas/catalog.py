"""Schema của phần catalog."""

from __future__ import annotations

from pydantic import Field

from app.models.enums import ProjectType
from app.schemas.common import ORMModel


class LevelRead(ORMModel):
    id: int = Field(description="Số hiệu level, từ 0 đến 5.")
    slug: str
    name: str
    description: str


class TrackRead(ORMModel):
    id: int
    slug: str
    name: str
    description: str
    order_index: int


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
    project_type: ProjectType
    estimated_hours: int
    xp_reward: int
    level: LevelRead
    track: TrackRead
    skills: list[SkillRead]


class ProjectRef(ORMModel):
    """Tham chiếu tối giản tới một project, dùng khi liệt kê project tiên quyết."""

    id: int
    slug: str
    title: str


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
    """Một project được gợi ý kèm lý do, để frontend giải thích cho người dùng."""

    project: ProjectSummary
    score: float = Field(description="Điểm ưu tiên, càng cao càng nên làm trước.")
    reason: str
