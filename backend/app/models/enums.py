"""Các tập giá trị cố định dùng chung cho model và schema."""

from __future__ import annotations

from enum import StrEnum


class ProjectType(StrEnum):
    """Quy mô của một project, quyết định khối lượng công việc người dùng phải làm."""

    MICRO = "micro"
    STANDARD = "standard"
    PRODUCT = "product"
    ADVANCED = "advanced"
    RESEARCH = "research"


class SubmissionStatus(StrEnum):
    """Trạng thái của một bài nộp."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    REVISION = "revision"


class BadgeRule(StrEnum):
    """Điều kiện để cấp badge.

    - PROJECT_COUNT: hoàn thành đủ số project bất kỳ.
    - TRACK_COUNT: hoàn thành đủ số project trong một track cụ thể.
    - LEVEL_REACHED: hoàn thành ít nhất một project ở level yêu cầu.
    - XP_REACHED: tích luỹ đủ số XP.
    """

    PROJECT_COUNT = "project_count"
    TRACK_COUNT = "track_count"
    LEVEL_REACHED = "level_reached"
    XP_REACHED = "xp_reached"
