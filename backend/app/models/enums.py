"""Các tập giá trị cố định dùng chung cho model và schema."""

from __future__ import annotations

from enum import StrEnum


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
    - POINTS_REACHED: tích luỹ đủ số điểm.
    """

    PROJECT_COUNT = "project_count"
    TRACK_COUNT = "track_count"
    LEVEL_REACHED = "level_reached"
    POINTS_REACHED = "points_reached"


class ProjectSort(StrEnum):
    """Cách sắp xếp danh sách project. Dấu trừ ở đầu nghĩa là sắp giảm dần."""

    LEVEL = "level"
    LEVEL_DESC = "-level"
    HOURS = "hours"
    HOURS_DESC = "-hours"
    POINTS = "points"
    POINTS_DESC = "-points"
    NEWEST = "newest"
    TITLE = "title"
