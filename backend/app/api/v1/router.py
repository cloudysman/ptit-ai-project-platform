"""Gom mọi router của phiên bản v1 vào một điểm duy nhất."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, leaderboard, me, projects, stats, submissions, taxonomy

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(stats.router)
api_router.include_router(taxonomy.router)
api_router.include_router(projects.router)
api_router.include_router(submissions.router)
api_router.include_router(me.router)
api_router.include_router(leaderboard.router)
