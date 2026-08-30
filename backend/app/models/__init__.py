"""Gom mọi model vào một chỗ để metadata luôn đầy đủ khi tạo bảng."""

from app.models.catalog import (
    Hint,
    Level,
    Mentor,
    Project,
    Roadmap,
    RoadmapStep,
    Skill,
    Track,
    project_prerequisite,
    project_skill,
)
from app.models.enums import BadgeRule, ProjectSort, SubmissionStatus
from app.models.progress import Badge, Submission, UserBadge
from app.models.user import User

__all__ = [
    "Badge",
    "BadgeRule",
    "Hint",
    "Level",
    "Mentor",
    "Project",
    "ProjectSort",
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
