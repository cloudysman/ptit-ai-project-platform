# Nền tảng học tập theo project

Nền tảng học tập theo project cho sinh viên. Mỗi project có một level từ 0 đến 5,
thuộc một track chuyên môn, rèn một số skill và có thể yêu cầu hoàn thành trước
một số project tiên quyết. Người dùng nộp bài, được chấm, nhận điểm tích luỹ và
badge, rồi được đề xuất project tiếp theo dựa trên tiến độ của chính mình.

Hệ thống gồm hai phần chạy chung trên một cổng: backend viết bằng FastAPI và
giao diện web viết bằng HTML, CSS, JavaScript thuần. Giao diện có hai trang:
trang chủ giới thiệu sáu level cùng vài project mỗi level, còn trang kho project
lo phần lọc và tìm kiếm trong toàn bộ 200 project.

## Cấu trúc

| Thư mục | Nội dung | Tình trạng |
|---|---|---|
| [`backend/`](backend/) | API viết bằng FastAPI và SQLAlchemy, dùng SQLite | 24 endpoint, 84 bài kiểm thử đều đạt |
| [`frontend/`](frontend/) | giao diện web hai trang, không dùng thư viện ngoài | dùng 20 trong 24 endpoint, không còn dữ liệu viết sẵn |

Backend phục vụ luôn thư mục `frontend`, nên chỉ cần chạy một lệnh là có cả giao
diện lẫn API. Chi tiết cách ghép nằm ở mục 12 của
[`backend/README.md`](backend/README.md), cách hệ thống kiểm tra dữ liệu nằm ở
mục 10 của cùng tài liệu đó, còn cách giao diện dùng từng endpoint nằm ở mục 4
của [`frontend/README.md`](frontend/README.md).

## Chạy nhanh

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

Lệnh cuối in ra một khoá ngẫu nhiên. Mở file `.env` rồi đặt khoá đó vào biến
`SECRET_KEY`. Bước này không bỏ qua được: backend từ chối khởi động khi khoá vẫn
là giá trị mặc định, nên hai lệnh dưới đây sẽ dừng ngay nếu chưa đặt khoá.

```powershell
.\.venv\Scripts\python.exe -m app.seed --admin-password "matkhau-quan-tri"
.\dev.cmd run
```

Lệnh đầu nạp 6 level, 4 giảng viên, 11 track, 37 skill, 12 badge, 200 project,
3 lộ trình và tạo một tài khoản giảng viên tên `admin` để có người chấm bài.

| Địa chỉ | Nội dung |
|---|---|
| `http://127.0.0.1:8421/` | trang chủ, giới thiệu sáu level và vài project mỗi level |
| `http://127.0.0.1:8421/kho.html` | kho project, lọc theo level, track, quy mô và thời gian |
| `http://127.0.0.1:8421/docs` | tài liệu API tự sinh, thử được từng endpoint |

## Thử một vòng

1. Mở `http://127.0.0.1:8421`, bấm Đăng nhập rồi chuyển sang Đăng ký để tạo một
   tài khoản sinh viên.
2. Mở trang kho project, lọc lấy level 0, chọn một project rồi đọc bối cảnh và
   phần sản phẩm phải nộp. Mở gợi ý nếu cần, rồi nộp đường dẫn tới mã nguồn.
3. Đăng xuất, đăng nhập lại bằng tài khoản giảng viên `admin` và mật khẩu đã đặt
   ở lệnh nạp dữ liệu. Bấm Chấm bài, chọn kết quả rồi lưu. Phải đổi tài khoản vì
   hệ thống không cho ai tự chấm bài của chính mình.
4. Đăng nhập lại bằng tài khoản sinh viên. Điểm tích luỹ đã được cộng, badge đầu tiên đã
   được cấp, project vừa làm hiện dấu đã hoàn thành, và phần đề xuất đổi theo.

## Ba tài liệu

| File | Nội dung |
|---|---|
| [`backend/README.md`](backend/README.md) | cài đặt, cách chạy, mô hình dữ liệu, danh sách 24 endpoint, quy tắc nghiệp vụ, cách kiểm tra dữ liệu, các quyết định kỹ thuật |
| [`frontend/README.md`](frontend/README.md) | cấu trúc giao diện, phần nào gọi endpoint nào, các quyết định về giao diện |
| README này | cái nhìn chung và cách chạy nhanh |
