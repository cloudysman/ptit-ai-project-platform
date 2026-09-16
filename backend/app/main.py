"""Điểm khởi tạo ứng dụng FastAPI."""

from __future__ import annotations

import logging
import mimetypes
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import MalformedRangeHeader, RangeNotSatisfiable
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app import __version__
from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import init_db

logger = logging.getLogger(__name__)

DESCRIPTION = """
Backend của nền tảng học tập theo project, dành cho sinh viên.

Mỗi project có level từ 0 đến 5, thuộc một track chuyên môn và có thể yêu cầu
hoàn thành một số project tiên quyết. Người dùng nộp bài, được chấm, nhận điểm
tích luỹ và badge, rồi được đề xuất project tiếp theo dựa trên tiến độ của chính
mình.
"""

# Phần tử đầu tiên trong đường dẫn lỗi của Pydantic chỉ cho biết dữ liệu sai nằm
# ở phần nào của request chứ không phải tên trường, nên được lược bỏ khi dựng câu
# thông báo cho người dùng.
_LOCATION_PREFIXES = frozenset({"body", "query", "path", "header", "cookie"})

# Tên trường trong câu báo lỗi được viết bằng đúng chữ mà người dùng nhìn thấy
# trên giao diện. Câu "Dữ liệu không hợp lệ ở: min_hours." không giúp người dùng
# biết phải sửa ô nào, còn "số giờ tối thiểu" thì có.
_TEN_TRUONG = {
    "demo_url": "đường dẫn tới bản chạy thử",
    "display_name": "họ tên hiển thị",
    "email": "thư điện tử",
    "feedback": "nhận xét",
    "identifier": "thư điện tử hoặc username",
    "level": "level",
    "limit": "số lượng",
    "max_hours": "số giờ tối đa",
    "max_tier": "tầng gợi ý",
    "min_hours": "số giờ tối thiểu",
    "note": "ghi chú",
    "page": "số trang",
    "page_size": "số project mỗi trang",
    "password": "mật khẩu",
    "q": "từ khoá tìm kiếm",
    "repo_url": "đường dẫn tới mã nguồn",
    "score": "điểm bài nộp",
    "skill": "skill",
    "slug": "mã project",
    "sort": "cách sắp xếp",
    "status": "trạng thái",
    "tier": "tầng gợi ý",
    "track": "track",
    "username": "username",
}

# Starlette tự sinh hai câu tiếng Anh này cho địa chỉ không tồn tại và cho
# phương thức không được phép. Tài liệu bàn giao cam kết trường detail luôn là
# một câu tiếng Việt, nên hai câu đó được thay bằng bản tiếng Việt tương ứng.
_THONG_BAO_MAC_DINH = {
    "Not Found": "Không tìm thấy địa chỉ này.",
    "Method Not Allowed": "Phương thức này không dùng được cho địa chỉ đó.",
    "Missing boundary in multipart.": ("Không đọc được tệp gửi lên. Chọn lại ảnh rồi thử lại."),
    "There was an error parsing the body": (
        "Không đọc được dữ liệu gửi lên. Tệp có thể bị hỏng hoặc đứt giữa chừng, "
        "chọn lại rồi thử lại."
    ),
}

# Ba thư mục tài nguyên của frontend. Chỉ ba thư mục này được đưa ra ngoài, nên
# các file khác nằm cạnh index.html, ví dụ README.md, không bị phục vụ.
_THU_MUC_TINH = ("anh", "css", "js")

# Hai trang HTML của frontend, kèm đường dẫn tương ứng. Liệt kê tường minh thay
# vì gắn cả thư mục gốc, để không có file nào lọt ra ngoài ngoài ý muốn.
_TRANG_HTML = {"/": "index.html", "/kho.html": "kho.html"}

# Trang báo lỗi cho người gõ nhầm địa chỉ trên trình duyệt, ví dụ /kho thay vì
# /kho.html. Hai đường dẫn viết theo dạng tương đối, cùng lý do với các chuyển
# hướng ở cuối file: chúng phải đúng cả khi nền tảng nằm sau tiền tố /projects.
_TRANG_KHONG_TIM_THAY = (
    "<!doctype html><html lang=vi><meta charset=utf-8>"
    '<meta name=viewport content="width=device-width, initial-scale=1">'
    "<title>Không tìm thấy</title>"
    '<p style="font: 16px/1.6 system-ui, sans-serif; margin: 2rem">'
    "Không tìm thấy địa chỉ này. "
    '<a href="./">Trang chủ</a> · <a href="./kho.html">Kho project</a>'
)


# Tiêu đề bảo mật gắn vào mọi phản hồi. Trang có hộp đăng nhập nên không được
# cho trang khác nhúng vào khung (chống clickjacking); nosniff để trình duyệt
# không đoán lại loại tệp; Referrer-Policy để địa chỉ có tham số tìm kiếm không
# lọt sang trang khác. Chính sách nội dung (Content-Security-Policy) cố ý không
# đặt ở đây mà ở nginx, xem ten-mien.sh: trang tài liệu /docs cần một chính sách
# khác vì nạp Swagger UI từ CDN, và các bộ kiểm thử trình duyệt chạy thẳng vào
# cổng nội bộ phải đánh giá mã ngay trong trang, thứ mà script-src chặn.
_TIEU_DE_BAO_MAT = (
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"SAMEORIGIN"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
)


def _duong_dan_khong_tien_to(scope: Scope) -> str:
    """Đường dẫn của request sau khi cắt tiền tố mà máy chủ trung gian gắn vào, nếu có."""
    return scope["path"].removeprefix(scope.get("root_path", "")) or "/"


class TieuDeBaoMat:
    """Gắn bộ tiêu đề bảo mật vào mọi phản hồi HTTP."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def gui_kem_tieu_de(message: Message) -> None:
            if message["type"] == "http.response.start":
                message = {**message, "headers": [*message.get("headers", []), *_TIEU_DE_BAO_MAT]}
            await send(message)

        await self.app(scope, receive, gui_kem_tieu_de)


class HeadNhuGet:
    """Trả lời HEAD bằng đúng phần tiêu đề của phản hồi GET tương ứng.

    FastAPI không tự thêm HEAD cho route GET, nên công cụ giám sát dùng HEAD
    thấy mã 405 và báo nền tảng sập. Lớp này đổi phương thức thành GET trước
    khi vào ứng dụng rồi bỏ phần thân khi gửi ra, nên mọi địa chỉ GET, từ hai
    trang HTML tới từng endpoint API, đều nhận HEAD mà không phải khai báo thêm.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] != "HEAD":
            await self.app(scope, receive, send)
            return

        async def gui_khong_than(message: Message) -> None:
            if message["type"] == "http.response.body":
                message = {
                    "type": "http.response.body",
                    "body": b"",
                    "more_body": message.get("more_body", False),
                }
            await send(message)

        await self.app({**scope, "method": "GET"}, receive, gui_khong_than)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Chuẩn bị cơ sở dữ liệu khi ứng dụng khởi động."""
    init_db()
    logger.info("Đã sẵn sàng tại http://%s:%s", settings.host, settings.port)
    yield


app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description=DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
    # Tiền tố mà máy chủ trung gian gắn trước mọi địa chỉ. Trang tài liệu API
    # dùng nó để trỏ đúng tới file mô tả API; để trống thì mọi thứ giữ nguyên.
    root_path=settings.normalized_root_path,
)

# Nén phản hồi lớn. Trang danh sách project trả về nhiều văn bản nên phần tiết
# kiệm được là đáng kể.
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(TieuDeBaoMat)
# Đặt ngoài cùng, để phần nén và CORS vẫn thấy một request GET bình thường.
app.add_middleware(HeadNhuGet)

app.include_router(api_router, prefix=settings.api_prefix)


def _field_name(location: tuple[int | str, ...]) -> str:
    """Rút tên trường từ đường dẫn lỗi của Pydantic."""
    parts = list(location)
    if parts and parts[0] in _LOCATION_PREFIXES:
        parts = parts[1:]
    return ".".join(str(part) for part in parts) if parts else "dữ liệu gửi lên"


def _ten_de_hieu(ten_truong: str) -> str:
    """Tên trường viết theo cách người dùng gọi nó trên giao diện.

    Tham số nhận nhiều giá trị, ví dụ level, có đường dẫn lỗi kèm số thứ tự dạng
    "level.0". Người dùng không quan tâm giá trị thứ mấy sai, nên phần số đó
    được bỏ đi.
    """
    dau, _, cuoi = ten_truong.rpartition(".")
    if dau and cuoi.isdigit():
        ten_truong = dau
    return _TEN_TRUONG.get(ten_truong, ten_truong)


def _cau_cho_mot_loi(error: dict) -> str | None:
    """Viết một câu tiếng Việt cho những kiểu lỗi thường gặp nhất.

    Trả về None với các kiểu lỗi còn lại, khi đó câu thông báo chung được dùng.
    """
    ten = _ten_de_hieu(_field_name(error["loc"]))
    kieu = error.get("type", "")
    gioi_han = error.get("ctx", {})

    match kieu:
        # Câu do chính các validator của nền tảng viết ra, vốn đã bằng tiếng Việt.
        case "value_error":
            return str(error.get("msg", "")).removeprefix("Value error, ") or None
        case "missing":
            return f"Còn thiếu {ten}."
        case "string_too_short":
            return f"Phần {ten} phải có ít nhất {gioi_han.get('min_length')} ký tự."
        case "string_too_long":
            return f"Phần {ten} chỉ được dài tối đa {gioi_han.get('max_length')} ký tự."
        case "greater_than_equal":
            return f"Phần {ten} phải từ {gioi_han.get('ge')} trở lên."
        case "less_than_equal":
            return f"Phần {ten} không được lớn hơn {gioi_han.get('le')}."
        case "int_parsing" | "float_parsing":
            return f"Phần {ten} phải là một con số."
        case _:
            return None


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Đưa lỗi kiểm tra dữ liệu về cùng một cấu trúc với mọi lỗi khác.

    Mặc định FastAPI đặt vào trường detail một danh sách các đối tượng mô tả lỗi
    bằng tiếng Anh. Tài liệu bàn giao cho frontend lại cam kết detail luôn là một
    câu tiếng Việt hiển thị thẳng cho người dùng được, nên lỗi kiểm tra dữ liệu
    phải được viết lại theo đúng cam kết đó. Phần mô tả chi tiết vẫn giữ trong
    trường errors để phục vụ việc gỡ lỗi.
    """
    errors = exc.errors()

    # Thân request không phải JSON thì Pydantic báo lỗi kèm vị trí ký tự, và
    # đường dẫn lỗi trở thành một con số. Ghép con số đó vào câu thông báo chỉ
    # làm người đọc rối, nên trường hợp này có câu riêng.
    if all(error.get("type", "").startswith("json_") for error in errors):
        detail = "Dữ liệu gửi lên không phải JSON hợp lệ."
    elif len(errors) == 1 and (cau := _cau_cho_mot_loi(errors[0])):
        # Chỉ sai đúng một chỗ thì nói thẳng chỗ đó sai thế nào, thay vì bắt người
        # dùng tự đoán từ tên trường.
        detail = cau
    else:
        fields = sorted({_ten_de_hieu(_field_name(error["loc"])) for error in errors})
        detail = f"Dữ liệu không hợp lệ ở: {', '.join(fields)}."

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "detail": detail,
            "errors": [
                {"field": _field_name(error["loc"]), "message": error["msg"]} for error in errors
            ],
        },
    )


@app.exception_handler(StarletteHTTPException)
async def handle_http_error(request: Request, exc: StarletteHTTPException) -> Response:
    """Đưa mọi lỗi HTTP về cùng một cấu trúc, với câu thông báo bằng tiếng Việt.

    Riêng địa chỉ ngoài API mà trình duyệt không tìm thấy thì trả về một trang
    HTML nhỏ: người gõ nhầm /kho cần một đường về trang chủ, không cần JSON thô.
    """
    detail = exc.detail
    if isinstance(detail, str):
        detail = _THONG_BAO_MAC_DINH.get(detail, detail)

    la_trinh_duyet = "text/html" in request.headers.get("accept", "")
    duong_dan = _duong_dan_khong_tien_to(request.scope)
    if (
        exc.status_code == status.HTTP_404_NOT_FOUND
        and la_trinh_duyet
        and not duong_dan.startswith(settings.api_prefix)
    ):
        return HTMLResponse(_TRANG_KHONG_TIM_THAY, status_code=exc.status_code, headers=exc.headers)

    return JSONResponse(
        status_code=exc.status_code, content={"detail": detail}, headers=exc.headers
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
    """Lỗi bất ngờ cũng phải ra cùng cấu trúc và cùng tiếng Việt như mọi lỗi khác.

    Không có handler này thì Starlette trả về dòng chữ "Internal Server Error"
    dạng văn bản thường, và giao diện hiện nguyên dòng tiếng Anh đó cho người dùng.
    Chi tiết lỗi vẫn được ghi vào nhật ký để người vận hành xem.
    """
    logger.exception("Lỗi chưa xử lý: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Máy chủ gặp lỗi, thử lại sau."},
    )


@app.get("/health", tags=["system"], summary="Kiểm tra backend còn sống")
def health() -> dict[str, str]:
    """Endpoint để frontend hoặc công cụ giám sát kiểm tra nhanh."""
    return {"status": "ok", "version": __version__}


class TepTinhLuonHoiLai(StaticFiles):
    """Thư mục tĩnh yêu cầu trình duyệt hỏi lại máy chủ trước khi dùng bản đã lưu.

    Mặc định trình duyệt tự quyết định dùng lại bản cũ trong bao lâu. Khi mã
    nguồn giao diện đổi, người dùng dễ rơi vào cảnh một nửa số tệp là bản mới,
    một nửa là bản cũ, và trang hỏng theo cách rất khó hiểu. Tiêu đề no-cache
    giữ nguyên phần tiết kiệm băng thông, vì máy chủ vẫn trả về mã 304 khi tệp
    chưa đổi, nhưng bỏ hẳn khả năng dùng nhầm bản cũ.
    """

    def file_response(self, full_path, stat_result, scope, status_code: int = 200) -> Response:
        # Tiêu đề Range hỏng được Starlette báo bằng một dòng tiếng Anh dạng văn
        # bản thường, và chỉ báo lúc gửi phản hồi, tức sau khi handler lỗi đã
        # hết cơ hội can thiệp. Xét trước ở đây để lỗi đi qua handle_http_error
        # như mọi lỗi khác, thành JSON kèm câu tiếng Việt.
        khoang = dict(scope.get("headers", ())).get(b"range")
        if khoang:
            try:
                FileResponse._parse_range_header(khoang.decode("latin-1"), stat_result.st_size)
            except MalformedRangeHeader:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Khoảng byte yêu cầu không hợp lệ.",
                ) from None
            except RangeNotSatisfiable as loi:
                raise HTTPException(
                    status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                    detail="Khoảng byte yêu cầu nằm ngoài tệp.",
                    headers={"Content-Range": f"bytes */{loi.max_size}"},
                ) from None

        phan_hoi = super().file_response(full_path, stat_result, scope, status_code)
        phan_hoi.headers["Cache-Control"] = "no-cache"
        return phan_hoi


def _gan_trang(application: FastAPI, duong_dan: str, tep: Path) -> None:
    """Gắn một trang HTML vào một đường dẫn cố định.

    Trang được trả qua cùng lớp phục vụ tệp tĩnh, để hưởng phần xét
    If-None-Match và If-Modified-Since của Starlette: trang chưa đổi thì trả về
    304 thay vì gửi lại toàn bộ HTML mỗi lần mở. FileResponse gọi thẳng thì bỏ
    qua hai tiêu đề đó.
    """
    tep_tinh = TepTinhLuonHoiLai(directory=tep.parent)

    async def tra_trang(request: Request) -> Response:
        return await tep_tinh.get_response(tep.name, request.scope)

    application.add_api_route(duong_dan, tra_trang, include_in_schema=False)


def _serve_frontend(application: FastAPI) -> None:
    """Cho backend phục vụ luôn frontend, nếu tìm thấy thư mục frontend.

    Nhờ vậy cả hệ thống chạy bằng một lệnh và trên một cổng duy nhất: giao diện
    và API cùng một origin nên trình duyệt không phải kiểm tra CORS, và địa chỉ
    API mà giao diện gọi là đường dẫn tương đối, không phải sửa khi đổi cổng.

    Từng thư mục tài nguyên được gắn riêng thay vì gắn cả thư mục frontend vào
    địa chỉ gốc. Gắn vào địa chỉ gốc thì mọi đường dẫn chưa khớp route nào đều
    rơi vào thư mục tĩnh, và Starlette mất luôn khả năng tự chuyển hướng khi
    người gọi thêm dấu gạch chéo ở cuối, ví dụ /api/v1/projects/ sẽ thành lỗi
    404 thay vì được đưa về /api/v1/projects.
    """
    frontend_path = settings.frontend_path
    if frontend_path is None:
        logger.info("Không tìm thấy thư mục frontend, chỉ phục vụ API.")

        @application.get("/", include_in_schema=False)
        def root() -> RedirectResponse:
            """Đưa người mở địa chỉ gốc sang thẳng trang tài liệu API.

            Địa chỉ đích viết theo dạng tương đối để nó đúng ở cả hai kiểu triển
            khai. Viết "/docs" thì bản nằm sau máy chủ trung gian sẽ đẩy người
            dùng ra gốc tên miền, tức ra ngoài phạm vi của nền tảng.
            """
            return RedirectResponse(url="docs")

        return

    logger.info("Phục vụ frontend từ %s", frontend_path)

    for ten in _THU_MUC_TINH:
        thu_muc = frontend_path / ten
        if thu_muc.is_dir():
            application.mount(f"/{ten}", TepTinhLuonHoiLai(directory=thu_muc), name=ten)

    # Ảnh đại diện do người dùng tải lên nằm ngoài thư mục frontend, vì đó là dữ
    # liệu chạy thật chứ không phải một phần của mã nguồn giao diện.
    thu_muc_anh = settings.resolved_avatar_dir
    thu_muc_anh.mkdir(parents=True, exist_ok=True)
    # Bảng loại tệp của Windows không có sẵn WebP, nên nếu không khai báo thì ảnh
    # đại diện dạng .webp được trả về dưới loại chung application/octet-stream và
    # trình duyệt tải nó xuống thay vì hiển thị.
    mimetypes.add_type("image/webp", ".webp")
    application.mount("/anh-dai-dien", StaticFiles(directory=thu_muc_anh), name="anh-dai-dien")

    for duong_dan, ten_tep in _TRANG_HTML.items():
        _gan_trang(application, duong_dan, frontend_path / ten_tep)

    @application.get("/index.html", include_in_schema=False)
    def ve_trang_goc() -> RedirectResponse:
        """Đưa người gõ tay /index.html về địa chỉ gốc, để trang chủ chỉ có một địa chỉ.

        Cùng lý do với địa chỉ gốc ở trên: đích viết theo dạng tương đối, nên
        "./" từ /index.html ra đúng "/", còn từ /projects/index.html thì ra đúng
        "/projects/".
        """
        return RedirectResponse(url="./", status_code=status.HTTP_301_MOVED_PERMANENTLY)


_serve_frontend(app)
