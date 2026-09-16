"""Endpoint dành riêng cho người dùng đang đăng nhập."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, Response, status

# Biểu mẫu đọc bằng request.form() trả về lớp UploadFile của Starlette, không
# phải lớp con cùng tên của FastAPI, nên kiểm tra kiểu phải theo lớp gốc.
from starlette.datastructures import UploadFile

from app.api.deps import CurrentUser, DbSession, Paging
from app.core.config import settings
from app.models.enums import SubmissionStatus
from app.schemas.auth import UserRead
from app.schemas.catalog import ProjectSummary, RecommendedProject
from app.schemas.common import Page
from app.schemas.progress import ProgressSummary, SubmissionRead, UserBadgeRead
from app.services import avatar as avatar_service
from app.services import badges as badge_service
from app.services import progress as progress_service
from app.services import recommendation as recommendation_service

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/progress", response_model=ProgressSummary)
def read_progress(user: CurrentUser, db: DbSession) -> ProgressSummary:
    """Tổng hợp tiến độ: điểm tích luỹ, số project đã hoàn thành, tiến độ theo track và badge."""
    return progress_service.summarize(db, user)


@router.get("/submissions", response_model=Page[SubmissionRead])
def list_submissions(
    user: CurrentUser,
    db: DbSession,
    paging: Paging,
    status: Annotated[SubmissionStatus | None, Query(description="Lọc theo trạng thái.")] = None,
) -> Page[SubmissionRead]:
    """Danh sách bài nộp của chính người dùng đang đăng nhập."""
    items, total = progress_service.list_submissions(db, user.id, paging, status)
    return Page[SubmissionRead].create(
        [SubmissionRead.model_validate(item) for item in items], total, paging
    )


@router.get("/badges", response_model=list[UserBadgeRead])
def list_badges(user: CurrentUser, db: DbSession) -> list[UserBadgeRead]:
    """Danh sách badge người dùng đã đạt được."""
    return [UserBadgeRead.model_validate(item) for item in badge_service.list_user_badges(db, user)]


@router.get("/recommendations", response_model=list[RecommendedProject])
def list_recommendations(
    user: CurrentUser,
    db: DbSession,
    limit: Annotated[int | None, Query(ge=1, le=50, description="Số project muốn nhận.")] = None,
) -> list[RecommendedProject]:
    """Đề xuất project nên làm tiếp, đã lọc bỏ project chưa mở khoá."""
    effective_limit = limit or settings.recommendation_limit
    items = recommendation_service.recommend(db, user, effective_limit)
    return [
        RecommendedProject(
            project=ProjectSummary.model_validate(item.project),
            score=item.score,
            reason=item.reason,
        )
        for item in items
    ]


def _loi_anh_qua_lon() -> HTTPException:
    gioi_han = settings.max_avatar_bytes // (1024 * 1024)
    return HTTPException(
        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        detail=f"Ảnh vượt quá {gioi_han} MB.",
    )


# Phần dôi cho tiêu đề và ranh giới của thân multipart, ngoài chính tệp ảnh.
_DOI_MULTIPART = 4096


@router.put(
    "/avatar",
    response_model=UserRead,
    # Tệp được đọc bằng tay bên trong hàm (xem ghi chú ở đó), nên phần mô tả
    # thân request cho trang tài liệu phải khai báo riêng.
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["file"],
                        "properties": {
                            "file": {
                                "type": "string",
                                "format": "binary",
                                "description": "Ảnh đại diện, định dạng JPEG, PNG hoặc WebP.",
                            }
                        },
                    }
                }
            },
        }
    },
)
async def upload_avatar(request: Request, user: CurrentUser, db: DbSession) -> UserRead:
    """Tải lên ảnh đại diện của chính người dùng đang đăng nhập.

    Mỗi người chỉ giữ một ảnh: tải lên lần nữa là thay ảnh cũ.
    """
    # Từ chối ngay theo Content-Length khi thân request rõ ràng vượt giới hạn,
    # thay vì nhận trọn cả thân rồi mới đo: máy chủ trung gian cho phép thân tới
    # 100 MB, và mỗi lần tải một tệp cỡ đó là backend phải giữ nó trong bộ nhớ.
    # Khai báo tệp như một tham số thì FastAPI đọc xong thân trước khi vào hàm,
    # nên phần đọc biểu mẫu phải nằm sau bước kiểm tra này.
    do_dai = request.headers.get("content-length", "")
    if do_dai.isdigit() and int(do_dai) > settings.max_avatar_bytes + _DOI_MULTIPART:
        raise _loi_anh_qua_lon()

    bieu_mau = await request.form()
    file = bieu_mau.get("file")
    if not isinstance(file, UploadFile):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Còn thiếu tệp ảnh.",
        )

    noi_dung = await file.read()
    try:
        avatar_service.luu(db, user, noi_dung, file.content_type)
    except avatar_service.AnhQuaLon:
        raise _loi_anh_qua_lon() from None
    except avatar_service.AnhKhongHopLe:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Chỉ nhận ảnh định dạng JPEG, PNG hoặc WebP.",
        ) from None

    return UserRead.model_validate(user)


@router.delete("/avatar", status_code=status.HTTP_204_NO_CONTENT)
def delete_avatar(user: CurrentUser, db: DbSession) -> Response:
    """Bỏ ảnh đại diện, đưa người dùng về lại hai chữ cái đầu tên."""
    avatar_service.xoa(db, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
