"""Gom mọi model vào một chỗ để metadata luôn đầy đủ khi tạo bảng."""

from app.models.catalog import (
    Hint,
    Level,
    Project,
    Roadmap,
    RoadmapStep,
    Skill,
    Track,
    project_prerequisite,
    project_skill,
)
from app.models.enums import BadgeRule, ProjectType, SubmissionStatus
from app.models.progress import Badge, Submission, UserBadge
from app.models.user import User

__all__ = [
    "Badge",
    "BadgeRule",
    "Hint",
    "Level",
    "Project",
    "ProjectType",
    "Roadmap",
    "RoadmapStep",
    "Skill",
    "Submission",
    "SubmissionStatus",
    "Track",
    "User",
    "UserBadge",
    "project_prerequisite",
    "project_skill",
]
