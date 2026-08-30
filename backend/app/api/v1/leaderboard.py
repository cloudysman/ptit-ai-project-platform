"""Endpoint bảng xếp hạng."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import DbSession
from app.schemas.progress import LeaderboardEntry
from app.services import progress as progress_service

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def read_leaderboard(
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100, description="Số người muốn xem.")] = 20,
) -> list[LeaderboardEntry]:
    """Bảng xếp hạng theo điểm tích luỹ, người nhiều điểm nhất đứng đầu."""
    return progress_service.leaderboard(db, limit)
