"""Endpoint số liệu tổng quan của kho project."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.catalog import CatalogStats
from app.services import catalog as catalog_service

router = APIRouter(tags=["stats"])


@router.get("/stats", response_model=CatalogStats)
def read_stats(db: DbSession) -> CatalogStats:
    """Tổng số project, số skill, số lộ trình và số project theo từng level, từng track."""
    return catalog_service.summarize_catalog(db)
