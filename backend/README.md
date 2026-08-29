# Project 200 — Backend

Backend của Project 200, nền tảng học tập theo project cho sinh viên.

Mỗi **project** có một **level** từ 0 đến 5, thuộc một **track** chuyên môn, rèn một số
**skill** và có thể yêu cầu hoàn thành trước một số **project tiên quyết**. Người dùng
nộp **bài nộp**, được chấm, nhận **XP** và **badge**, rồi được gợi ý project tiếp theo
dựa trên tiến độ của chính mình.

## 1. Yêu cầu môi trường

- Python 3.12 trở lên. Máy đang dùng Python 3.14.3.
- Không cần cài thêm phần mềm nào khác. Cơ sở dữ liệu mặc định là SQLite, chỉ là một
  file nằm trong thư mục `data/`.

`requirements.txt` chỉ gồm thư viện cần để chạy, `requirements-dev.txt` gồm thêm công
cụ kiểm thử và kiểm tra chất lượng mã nguồn.

Toàn bộ thư viện được cài vào `.venv` ngay trong thư mục project, nên không đụng tới
Python toàn cục và không ảnh hưởng tới các project khác trong máy.

## 2. Cài đặt

```powershell
cd C:\Users\ADMIN\source\repos\project200\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Sau đó mở `.env` và đặt `SECRET_KEY` bằng một khoá ngẫu nhiên:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

Backend từ chối khởi động nếu `SECRET_KEY` vẫn là khoá mặc định hoặc ngắn hơn 32 byte.

## 3. Nạp dữ liệu mẫu

```powershell
.\.venv\Scripts\python.exe -m app.seed --admin-password "matkhau-quan-tri"
```

Lệnh này tạo bảng, nạp 6 level, 11 track, 37 skill, 12 badge, 36 project và 3 lộ trình.
Chạy lại nhiều lần vẫn cho cùng kết quả: bản ghi đã có thì cập nhật, chưa có thì tạo
mới, không bao giờ tạo bản sao. Tham số `--admin-password` tạo tài khoản quản trị
`admin` để có người chấm bài ngay từ đầu; bỏ tham số này thì không tạo tài khoản nào.

## 4. Chạy backend

```powershell
.\dev.cmd run
```

`dev.cmd` là lớp bao ngoài của `dev.ps1`. Windows mặc định chặn chạy file `.ps1` cục bộ
nên gọi qua `dev.cmd` để không phải đổi cài đặt của máy. Các lệnh khác: `dev.cmd seed`,
`dev.cmd test`, `dev.cmd lint`, `dev.cmd format`.

Hoặc gọi trực tiếp:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8421 --reload
```

- API: `http://127.0.0.1:8421/api/v1`
- Tài liệu API tự sinh: `http://127.0.0.1:8421/docs`
- Kiểm tra còn sống: `http://127.0.0.1:8421/health`

Cổng 8421 được chọn vì các cổng thông dụng như 8000, 8080 và 5000 hay bị project khác
chiếm. Đổi cổng bằng biến `PORT` trong `.env`.

## 5. Kiểm thử

```powershell
.\dev.cmd test
```

31 bài kiểm thử, chạy trên một file cơ sở dữ liệu tạm nên không đụng vào dữ liệu thật
trong `data/`.

Kiểm tra chất lượng mã nguồn:

```powershell
.\dev.cmd lint
```

## 6. Cấu trúc thư mục

```
backend/
├─ app/
│  ├─ core/           cấu hình và bảo mật
│  ├─ db/             lớp cơ sở của model, engine và session
│  ├─ models/         bảng trong cơ sở dữ liệu
│  ├─ schemas/        cấu trúc dữ liệu vào và ra của API
│  ├─ services/       nghiệp vụ, không phụ thuộc vào FastAPI
│  ├─ api/            định nghĩa endpoint
│  ├─ seed/           dữ liệu mẫu dạng JSON và chương trình nạp
│  └─ main.py         khởi tạo ứng dụng
├─ tests/             kiểm thử
├─ data/              file cơ sở dữ liệu SQLite
└─ .venv/             môi trường Python riêng của project
```

Bốn tầng tách rời nhau theo một chiều: `api` gọi `services`, `services` gọi `models`,
`schemas` chỉ mô tả dữ liệu. Nhờ vậy toàn bộ nghiệp vụ trong `services` kiểm thử được
mà không cần dựng máy chủ web, và khi đổi framework thì chỉ phải viết lại tầng `api`.

## 7. Mô hình dữ liệu

| Bảng | Vai trò |
|---|---|
| `level` | 6 mức độ khó, đánh số 0 đến 5 |
| `track` | 11 nhóm chuyên môn |
| `skill` | kỹ năng mà project rèn luyện |
| `project` | đơn vị học tập trung tâm |
| `project_skill` | project cần những skill nào |
| `project_prerequisite` | project nào phải hoàn thành trước project nào |
| `hint` | gợi ý của AI Mentor, chia làm 3 tầng |
| `roadmap`, `roadmap_step` | lộ trình nghề nghiệp là một chuỗi project có thứ tự |
| `user` | tài khoản người dùng |
| `submission` | bài nộp cho một project |
| `badge`, `user_badge` | badge và badge đã cấp cho người dùng |

Mỗi project mang đủ thông tin mà bản brainstorm ban đầu yêu cầu: bối cảnh thực tế,
mục tiêu học tập, skill cần có, thời gian dự kiến, project tiên quyết, nguồn dữ liệu,
sản phẩm phải nộp, thử thách nâng cao và gợi ý theo tầng.

## 8. Danh sách API

Tất cả đường dẫn dưới đây đứng sau tiền tố `/api/v1`.

### Tài khoản

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/auth/register` | Đăng ký, trả về token luôn |
| POST | `/auth/login` | Đăng nhập bằng email hoặc username |
| GET | `/auth/me` | Đọc tài khoản đang đăng nhập |

### Catalog

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/levels` | 6 level |
| GET | `/tracks` | 11 track |
| GET | `/skills` | Toàn bộ skill, dùng cho bộ lọc |
| GET | `/projects` | Danh sách project, có lọc, tìm kiếm, sắp xếp, phân trang |
| GET | `/projects/random` | Chọn ngẫu nhiên một project |
| GET | `/projects/{slug}` | Chi tiết một project |
| GET | `/projects/{slug}/hints` | Gợi ý, cắt theo tầng |
| GET | `/roadmaps` | Danh sách lộ trình |
| GET | `/roadmaps/{slug}` | Lộ trình kèm toàn bộ project theo thứ tự |

### Tiến độ

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/projects/{slug}/submissions` | Nộp bài |
| PATCH | `/submissions/{id}/review` | Chấm bài, chỉ tài khoản quản trị |
| GET | `/me/progress` | Tổng hợp tiến độ |
| GET | `/me/submissions` | Bài nộp của chính mình |
| GET | `/me/badges` | Badge đã đạt |
| GET | `/me/recommendations` | Gợi ý project tiếp theo |
| GET | `/leaderboard` | Bảng xếp hạng theo XP |

### Bộ lọc của `/projects`

| Tham số | Ý nghĩa |
|---|---|
| `level` | Lọc theo level, nhận nhiều giá trị: `level=0&level=1` |
| `track` | Lọc theo slug của track, nhận nhiều giá trị |
| `skill` | Lọc theo slug của skill, nhận nhiều giá trị |
| `project_type` | `micro`, `standard`, `product`, `advanced`, `research` |
| `min_hours`, `max_hours` | Khoảng thời gian dự kiến |
| `q` | Từ khoá tìm trong tiêu đề và tóm tắt |
| `sort` | `level`, `-level`, `hours`, `-hours`, `xp`, `-xp`, `newest`, `title` |
| `page`, `page_size` | Phân trang, mặc định 20 bản ghi mỗi trang |

Ví dụ: `/api/v1/projects?level=0&level=1&track=data-science&max_hours=10&sort=hours`

## 9. Quy tắc nghiệp vụ

**XP.** Bài nộp ở trạng thái chờ chấm không cộng XP. Khi bài nộp được duyệt, người dùng
nhận đúng số XP ghi trong `xp_reward` của project. Mỗi project chỉ cộng XP một lần: sau
khi đã có một bài nộp được duyệt thì không nộp lại project đó được nữa.

**Badge.** Badge được xét ngay trong cùng giao dịch với lúc cộng XP, nên XP và badge
không bao giờ lệch nhau. Có bốn loại điều kiện: đủ số project bất kỳ, đủ số project
trong một track, đạt tới một level, và đạt tới một mức XP.

**Gợi ý project tiếp theo.** Chỉ những project đã mở khoá mới được gợi ý, nghĩa là mọi
project tiên quyết của nó đều đã được duyệt. Điểm ưu tiên tính theo bốn thành phần:

1. Khoảng cách tới level nên làm tiếp. Người dùng chỉ được đẩy lên level cao hơn sau
   khi đã hoàn thành ít nhất 2 project ở level cao nhất hiện có.
2. Track mà người dùng đã hoàn thành nhiều project nhất được cộng điểm; track chưa đụng
   tới được cộng ít hơn, để danh sách gợi ý không bó hẹp vào một hướng.
3. Project ngắn dưới 8 giờ được cộng thêm, hợp để xen kẽ.
4. Project mở khoá được càng nhiều project khác thì càng đáng làm sớm.

Mỗi gợi ý kèm một câu lý do để giao diện giải thích cho người dùng.

## 10. Mở rộng lên 200 project

Toàn bộ nội dung nằm trong sáu file JSON tại `app/seed/`, tách hẳn khỏi mã nguồn:
`levels.json`, `tracks.json`, `skills.json`, `badges.json`, `projects.json`,
`roadmaps.json`.

Thêm project mới chỉ cần thêm một phần tử vào `projects.json` rồi chạy lại
`python -m app.seed`. Chương trình nạp kiểm tra mọi tham chiếu trước khi ghi: nếu một
project trỏ tới track, skill hoặc project tiên quyết không tồn tại thì toàn bộ lần nạp
bị huỷ và cơ sở dữ liệu giữ nguyên trạng thái cũ, thay vì nạp được một nửa.

36 project hiện có là bộ khung: chúng phủ cả 6 level, cả 11 track, và nối với nhau
thành một đồ thị tiên quyết không có chu trình. Khi thêm project mới, giữ nguyên
nguyên tắc project tiên quyết không được ở level cao hơn project phụ thuộc nó.

## 11. Bàn giao cho frontend

- Địa chỉ gốc của API: `http://127.0.0.1:8421/api/v1`. Đặt vào một biến môi trường của
  frontend, đừng viết thẳng vào mã nguồn.
- Xác thực bằng tiêu đề `Authorization: Bearer <access_token>`. Token lấy từ
  `/auth/register` hoặc `/auth/login`, kèm trường `expires_in` cho biết còn bao nhiêu
  giây, để frontend biết lúc nào cần đăng nhập lại mà không phải tự giải mã token.
- Danh sách origin được phép gọi API khai báo trong biến `CORS_ORIGINS` của `.env`,
  ngăn cách bằng dấu phẩy. Mặc định đã mở sẵn cổng 5173 và 3000 của máy cục bộ.
- Mọi API trả về danh sách dài đều dùng chung một cấu trúc phân trang:
  `{"items": [...], "total": 0, "page": 1, "page_size": 20, "pages": 0}`.
- Lỗi trả về theo cấu trúc `{"detail": "câu thông báo"}` với thông báo bằng tiếng Việt,
  hiển thị thẳng cho người dùng được.
- **Font chữ của toàn bộ giao diện là Times New Roman.** Backend không quyết định phần
  này, ghi lại ở đây để không bỏ sót khi dựng frontend.

## 12. Các quyết định kỹ thuật và lý do

**SQLite thay vì MySQL hay PostgreSQL.** Máy đang có sẵn một máy chủ MySQL chạy ở cổng
3306 phục vụ việc khác. Dùng chung máy chủ đó có nguy cơ đụng vào dữ liệu của project
khác. SQLite chỉ là một file trong thư mục `data/`, không chiếm cổng, không cần cài
thêm gì, và xoá đi là sạch. Với quy mô vài trăm project và vài nghìn người dùng thì
SQLite thừa sức đáp ứng.

Mã nguồn viết qua SQLAlchemy nên khi cần đổi sang MySQL hoặc PostgreSQL chỉ phải sửa
một dòng `DATABASE_URL` trong `.env` và cài thêm trình điều khiển tương ứng.

**Bốn tuỳ chọn SQLite được bật khi mở kết nối** trong `app/db/session.py`: bật kiểm
tra khoá ngoại vì SQLite mặc định bỏ qua, bật chế độ WAL để đọc song song với ghi, đặt
mức đồng bộ vừa phải để giảm số lần ghi đĩa, và đặt thời gian chờ 5 giây thay vì báo
lỗi ngay khi cơ sở dữ liệu đang bận.

**Endpoint viết theo kiểu đồng bộ.** FastAPI chạy các endpoint đồng bộ trên một nhóm
luồng riêng nên vòng lặp sự kiện không bao giờ bị chặn. Với một cơ sở dữ liệu dạng file
như SQLite, cách này nhanh hơn và dễ đọc hơn so với viết bất đồng bộ.

**Tránh truy vấn lặp.** Các quan hệ hay dùng của `project` được nạp sẵn bằng một truy
vấn phụ duy nhất cho cả trang kết quả, thay vì mỗi project một truy vấn. Bảng xếp hạng
đếm số project hoàn thành bằng một phép gộp có điều kiện ngay trong truy vấn chính, nên
chỉ tốn đúng một lần đọc cơ sở dữ liệu.

**Lưu sẵn tổng XP trong bảng `user`.** Cột `total_xp` được cộng dồn ngay lúc chấm bài.
Nhờ vậy bảng xếp hạng chỉ phải đọc một cột đã có chỉ mục, thay vì cộng lại toàn bộ bài
nộp của mọi người mỗi lần mở trang.

**Gợi ý tính trong bộ nhớ.** Tập project chỉ vài trăm bản ghi nên nạp một lần rồi tính
điểm bằng Python nhanh hơn và dễ sửa hơn nhiều so với dựng một câu lệnh SQL phức tạp
cho công thức tính điểm.

**Gợi ý bị cắt ở phía backend.** API `/projects/{slug}/hints` chỉ trả về gợi ý tới đúng
tầng được yêu cầu, nên người dùng không thể xem hết gợi ý bằng cách sửa giao diện.

**Mật khẩu băm bằng bcrypt, giới hạn 72 byte được kiểm tra tường minh.** bcrypt chỉ xử
lý 72 byte đầu. Nếu không kiểm tra, một mật khẩu dài sẽ bị cắt âm thầm. Giới hạn tính
theo byte chứ không theo ký tự, vì một ký tự tiếng Việt có dấu chiếm tới ba byte.

**Email chỉ được kiểm tra lúc đăng ký, không kiểm tra lại lúc đọc ra.** Nếu kiểm tra ở
cả hai chiều thì khi quy tắc kiểm tra email thay đổi, những bản ghi cũ trong cơ sở dữ
liệu sẽ làm API hỏng. Bộ kiểm thử có một bài riêng cho tình huống này.

## 13. Việc còn lại

- Chưa có công cụ migration. Hiện tại bảng được tạo bằng `create_all`, đủ cho giai đoạn
  đầu. Khi lược đồ bắt đầu thay đổi thường xuyên thì nên thêm Alembic để không phải xoá
  cơ sở dữ liệu mỗi lần sửa.
- Chấm bài đang do người làm. Phần AI Mentor chấm tự động có thể thêm sau vào
  `app/services/progress.py` mà không phải sửa tầng API.
- Chưa có giới hạn số lần gọi API. Khi mở ra ngoài mạng cục bộ thì nên thêm.
