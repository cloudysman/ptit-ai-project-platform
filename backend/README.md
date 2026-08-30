# Nền tảng học tập theo project — backend

Backend của nền tảng học tập theo project, dành cho sinh viên.

Mỗi project có một level từ 0 đến 5, thuộc một track chuyên môn, rèn một số skill
và có thể yêu cầu hoàn thành trước một số project tiên quyết. Người dùng nộp bài,
được chấm, nhận điểm tích luỹ và badge, rồi được đề xuất project tiếp theo dựa
trên tiến độ của chính mình.

Tài liệu này gọi mỗi khái niệm bằng đúng một tên từ đầu đến cuối: project, level,
track, skill, bài nộp, badge, điểm tích luỹ, lộ trình, gợi ý, đề xuất, cơ sở dữ
liệu,
chương trình nạp dữ liệu mẫu. Hai từ dễ lẫn được dùng tách bạch: gợi ý là lời
mách nước cho một project, chia làm ba tầng; đề xuất là project mà hệ thống
khuyên người dùng nên làm tiếp.

## 1. Yêu cầu môi trường

Python 3.12 trở lên. Bản đã dùng để chạy và kiểm thử là Python 3.12.5.

Không cần cài thêm phần mềm nào khác. Cơ sở dữ liệu mặc định là SQLite, chỉ là
một file nằm trong thư mục `data/`.

Toàn bộ thư viện được cài vào `.venv` ngay trong thư mục backend, nên không đụng
tới Python toàn cục và không ảnh hưởng tới các project khác trong máy.

| File | Nội dung |
|---|---|
| `requirements.txt` | thư viện cần để chạy |
| `requirements-dev.txt` | thêm công cụ kiểm thử và kiểm tra chất lượng mã nguồn |

Các phiên bản dưới đây đã được ghim và đã chạy qua toàn bộ bộ kiểm thử:

| Thư viện | Phiên bản | Dùng để |
|---|---|---|
| fastapi | 0.141.1 | dựng API |
| uvicorn | 0.52.4 | chạy máy chủ |
| SQLAlchemy | 2.0.52 | mô tả bảng và sinh câu lệnh truy vấn |
| pydantic | 2.13.5 | kiểm tra dữ liệu vào và định dạng dữ liệu ra |
| pydantic-settings | 2.15.0 | đọc cấu hình từ file `.env` |
| email-validator | 2.3.0 | kiểm tra thư điện tử lúc đăng ký |
| PyJWT | 2.13.0 | phát hành và đọc token |
| bcrypt | 5.0.0 | băm mật khẩu |
| pytest | 9.1.1 | chạy kiểm thử |
| httpx | 0.28.1 | gọi API trong kiểm thử |
| ruff | 0.16.5 | kiểm tra và định dạng mã nguồn |

## 2. Cài đặt

Mở PowerShell tại thư mục `backend` rồi chạy bốn lệnh sau:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

Lệnh cuối in ra một khoá ngẫu nhiên. Mở file `.env` rồi đặt khoá đó vào biến
`SECRET_KEY`. Backend từ chối khởi động nếu `SECRET_KEY` vẫn là khoá mặc định
trong `.env.example` hoặc ngắn hơn 32 byte, vì thuật toán ký HS256 cần khoá dài
ít nhất bằng đó. Riêng khi `DEBUG=true` thì chương trình chỉ cảnh báo rồi chạy
tiếp, để người mới tải mã nguồn về vẫn thử được ngay.

## 3. Nạp dữ liệu mẫu

```powershell
.\.venv\Scripts\python.exe -m app.seed --admin-password "matkhau-quan-tri"
```

Lệnh này tạo bảng rồi nạp 6 level, 4 giảng viên, 11 track, 37 skill, 12 badge,
200 project và 3 lộ trình. Chạy lại nhiều lần vẫn cho cùng kết quả: bản ghi đã có thì cập nhật,
chưa có thì tạo mới, không bao giờ tạo bản sao.

Tham số `--admin-password` tạo tài khoản giảng viên tên `admin` để có người chấm
bài ngay từ đầu. Bỏ tham số này thì không tài khoản nào được tạo.

## 4. Chạy backend

```powershell
.\dev.cmd run
```

`dev.cmd` là lớp bao ngoài của `dev.ps1`. Windows mặc định chặn chạy file `.ps1`
cục bộ nên gọi qua `dev.cmd` để không phải đổi cài đặt của máy. Các lệnh khác:
`dev.cmd seed`, `dev.cmd test`, `dev.cmd lint`, `dev.cmd format`.

Hoặc gọi trực tiếp:

```powershell
.\.venv\Scripts\python.exe -m app --reload
```

Cả hai cách đều đọc địa chỉ và cổng từ file `.env`, nên sửa `HOST` hoặc `PORT`
trong đó là đủ. Tham số `--reload` cho máy chủ tự khởi động lại mỗi khi mã nguồn
thay đổi, chỉ nên dùng khi đang phát triển.

Với cấu hình mặc định:

| Địa chỉ | Nội dung |
|---|---|
| `http://127.0.0.1:8421/` | giao diện web, phục vụ từ thư mục `../frontend` |
| `http://127.0.0.1:8421/api/v1` | gốc của API |
| `http://127.0.0.1:8421/docs` | tài liệu API tự sinh, mở thẳng từ trình duyệt |
| `http://127.0.0.1:8421/health` | kiểm tra backend còn sống |

Cổng 8421 được chọn vì các cổng thông dụng như 8000, 8080 và 5000 hay bị project
khác chiếm.

## 5. Kiểm thử

```powershell
.\dev.cmd test
```

84 bài kiểm thử, chạy trên một file cơ sở dữ liệu tạm nên không đụng vào dữ liệu
thật trong `data/`. Bộ kiểm thử chia theo năm nhóm việc:

| File | Số bài | Phạm vi |
|---|---|---|
| `tests/test_auth.py` | 19 | đăng ký, đăng nhập, chuẩn hoá username và tên hiển thị, giới hạn mật khẩu và thư điện tử, ảnh đại diện, chặn dò mật khẩu |
| `tests/test_catalog.py` | 22 | lọc, tìm kiếm không dấu, sắp xếp theo bảng chữ cái tiếng Việt, gợi ý theo tầng, project chưa xuất bản, số liệu tổng quan, khoảng thời gian đảo ngược và trần số giờ |
| `tests/test_progress.py` | 22 | nộp bài, chấm bài, điểm tích luỹ, badge, đề xuất, bảng xếp hạng, danh sách bài nộp và quy tắc không tự chấm bài |
| `tests/test_api_contract.py` | 14 | cấu trúc lỗi, múi giờ, giới hạn phân trang, thư mục tĩnh và route của API, tiêu đề bộ nhớ đệm |
| `tests/test_seed.py` | 7 | số bản ghi, tính lặp lại được, độ phủ level và track, đồ thị tiên quyết, khuôn của bảy file dữ liệu |

Kiểm tra chất lượng mã nguồn và định dạng lại mã nguồn:

```powershell
.\dev.cmd lint
.\dev.cmd format
```

## 6. Cấu trúc thư mục

```
backend/
├─ app/
│  ├─ core/           cấu hình, bảo mật và luồng ra chuẩn
│  ├─ db/             lớp cơ sở của model, kiểu thời gian, engine và session
│  ├─ models/         bảng trong cơ sở dữ liệu
│  ├─ schemas/        cấu trúc dữ liệu vào và ra của API
│  ├─ services/       nghiệp vụ, không phụ thuộc vào FastAPI
│  ├─ api/            định nghĩa endpoint
│  ├─ seed/           dữ liệu mẫu dạng JSON và chương trình nạp
│  ├─ main.py         khởi tạo ứng dụng và gắn thư mục frontend
│  └─ __main__.py     điểm khởi động máy chủ
├─ tests/             kiểm thử
├─ data/              file cơ sở dữ liệu SQLite
└─ .venv/             môi trường Python riêng của backend
```

Bốn tầng tách rời nhau theo một chiều: `api` gọi `services`, `services` gọi
`models`, `schemas` chỉ mô tả dữ liệu. Nhờ vậy toàn bộ nghiệp vụ trong `services`
kiểm thử được mà không cần dựng máy chủ web, và khi đổi framework thì chỉ phải
viết lại tầng `api`.

## 7. Mô hình dữ liệu

| Bảng | Vai trò |
|---|---|
| `level` | 6 mức độ khó, đánh số 0 đến 5 |
| `mentor` | giảng viên phụ trách, mỗi track một người |
| `track` | 11 nhóm chuyên môn, mỗi track trỏ tới một giảng viên |
| `skill` | kỹ năng mà project rèn luyện |
| `project` | đơn vị học tập trung tâm |
| `project_skill` | project cần những skill nào |
| `project_prerequisite` | project nào phải hoàn thành trước project nào |
| `hint` | gợi ý, chia làm 3 tầng |
| `roadmap`, `roadmap_step` | lộ trình nghề nghiệp là một chuỗi project có thứ tự |
| `user` | tài khoản người dùng, kèm ảnh đại diện và cờ giảng viên |
| `submission` | bài nộp cho một project |
| `badge`, `user_badge` | badge và badge đã cấp cho người dùng |

Mỗi project mang đủ thông tin mà bản phác thảo ban đầu yêu cầu: bối cảnh thực
tế, mục tiêu học tập, skill cần có, thời gian dự kiến, project tiên quyết, nguồn
dữ liệu, sản phẩm phải nộp, thử thách nâng cao và gợi ý theo tầng.

## 8. Danh sách API

Tất cả đường dẫn dưới đây đứng sau tiền tố `/api/v1`, tổng cộng 24 endpoint.

### Tài khoản

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/auth/register` | đăng ký, trả về token luôn |
| POST | `/auth/login` | đăng nhập bằng thư điện tử hoặc username |
| GET | `/auth/me` | đọc tài khoản đang đăng nhập |
| PUT | `/me/avatar` | tải ảnh đại diện lên |
| DELETE | `/me/avatar` | bỏ ảnh đại diện |

### Kho project

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/stats` | số liệu tổng quan: tổng số project, số skill, số lộ trình, số project theo từng level và từng track |
| GET | `/levels` | 6 level |
| GET | `/tracks` | 11 track |
| GET | `/mentors` | 4 giảng viên phụ trách |
| GET | `/skills` | toàn bộ skill, dùng cho bộ lọc |
| GET | `/projects` | danh sách project, có lọc, tìm kiếm, sắp xếp, phân trang |
| GET | `/projects/random` | chọn ngẫu nhiên một project |
| GET | `/projects/{slug}` | chi tiết một project |
| GET | `/projects/{slug}/hints` | gợi ý, cắt theo tầng |
| GET | `/roadmaps` | danh sách lộ trình |
| GET | `/roadmaps/{slug}` | lộ trình kèm toàn bộ project theo thứ tự |

### Tiến độ

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/projects/{slug}/submissions` | nộp bài |
| GET | `/submissions` | danh sách bài nộp của mọi người dùng, chỉ tài khoản giảng viên |
| PATCH | `/submissions/{submission_id}/review` | chấm bài, chỉ tài khoản giảng viên |
| GET | `/me/progress` | tổng hợp tiến độ |
| GET | `/me/submissions` | bài nộp của chính mình |
| GET | `/me/badges` | badge đã đạt |
| GET | `/me/recommendations` | đề xuất project tiếp theo |
| GET | `/leaderboard` | bảng xếp hạng theo điểm tích luỹ |

### Bộ lọc của `/projects`

| Tham số | Ý nghĩa |
|---|---|
| `level` | lọc theo level, nhận nhiều giá trị: `level=0&level=1` |
| `track` | lọc theo slug của track, nhận nhiều giá trị |
| `skill` | lọc theo slug của skill, nhận nhiều giá trị |
| `min_hours`, `max_hours` | khoảng thời gian dự kiến |
| `q` | từ khoá tìm trong tiêu đề và tóm tắt |
| `sort` | `level`, `-level`, `hours`, `-hours`, `points`, `-points`, `newest`, `title` |
| `page`, `page_size` | phân trang, mặc định 20 và tối đa 100 bản ghi mỗi trang |

Dấu trừ ở đầu giá trị `sort` nghĩa là sắp giảm dần. Tám giá trị này được khai báo
thành một kiểu liệt kê, nên chúng vừa là danh sách kiểm tra đầu vào, vừa là danh
sách hiện trong tài liệu API tự sinh, không thể lệch nhau.

Ví dụ: `/api/v1/projects?level=0&level=1&track=data-science&max_hours=10&sort=hours`

## 9. Quy tắc nghiệp vụ

### Cộng điểm tích luỹ

Bài nộp ở trạng thái chờ chấm không cộng điểm. Khi bài nộp được duyệt, người
dùng nhận đúng số điểm ghi trong cột `reward_points` của project. Mỗi project chỉ
cộng điểm một lần: sau khi đã có một bài nộp được duyệt thì không nộp lại project
đó được nữa, và nếu hai bài của cùng project cùng được duyệt thì bài thứ hai
được ghi nhận là đạt nhưng phần điểm bằng không.

### Nộp lại một project

Bài nộp còn đang chờ chấm thì sửa được: lần nộp sau ghi đè nội dung của bài đang
chờ và đẩy nó xuống cuối hàng đợi, chứ không sinh thêm bản ghi. Khi đó
`POST /projects/{slug}/submissions` trả về mã 200 thay vì 201, và bài nộp trả về
giữ nguyên `id` cũ. Người học dán nhầm đường dẫn thường nộp lại ngay, mà mỗi lần
như vậy đẻ ra một bản ghi thì hàng đợi của giảng viên đầy những bài trùng nhau
của cùng một người, cùng một project.

Bài đã có kết quả thì khác: bài bị trả về hay chưa đạt được nộp lại thành một bài
mới, còn project đã đạt thì không nhận thêm bài nộp nào nữa.

### Ai được chấm bài

Chấm bài là việc của giảng viên. Cột `is_mentor` trong bảng `user` quyết định
điều đó: tài khoản không có cờ này gọi vào `GET /submissions` hay
`PATCH /submissions/{submission_id}/review` đều nhận lỗi 403.

Giảng viên cũng không tự chấm bài của chính mình được. Nếu người chấm và người
nộp là cùng một tài khoản thì backend trả về lỗi 403 kèm câu nói rõ bài đó phải
do một giảng viên khác chấm. Thiếu chốt chặn này thì một tài khoản giảng viên có
thể nộp bài rồi tự duyệt cho mình, và số điểm tích luỹ mất hết ý nghĩa. Màn hình
chấm bài trên giao diện cũng lọc sẵn bài của chính người đang chấm ra khỏi danh
sách, nhưng đó chỉ là phần cho đỡ rối mắt, chốt chặn thật nằm ở backend.

### Chỉ một người chấm được một bài

Trạng thái bài nộp không được gán trong Python rồi mới lưu, mà đổi bằng một câu
lệnh `UPDATE` mang sẵn điều kiện "đang chờ chấm". Cơ sở dữ liệu vì thế là nơi
phân xử: hai giảng viên bấm lưu cùng lúc thì đúng một câu lệnh đổi được bản ghi,
người thứ hai nhận lỗi 409 thay vì thấy kết quả của mình biến mất không dấu vết.

Điểm tích luỹ cũng được cộng ngay trong cơ sở dữ liệu, bằng `total_points =
total_points + n`. Nếu đọc tổng điểm ra Python, cộng rồi ghi lại thì hai lượt
chấm chạy song song cùng đọc một con số cũ, và lượt ghi sau xoá mất phần điểm
của lượt trước.

### Chặn dò mật khẩu

Sai quá tám lần trong năm phút thì cặp tên đăng nhập và địa chỉ máy gọi bị tạm
dừng năm phút, kể cả khi lần thử tiếp theo dùng đúng mật khẩu. Không có chốt này
thì một chương trình dò mật khẩu thử được khoảng năm lần mỗi giây mà không gặp
trở ngại nào. Bộ đếm nằm trong bộ nhớ của tiến trình, xem
`app/services/chan_doan_mat_khau.py`; chạy nhiều tiến trình song song thì phải
chuyển phần này sang một kho dùng chung.

### Bảng xếp hạng

Bảng xếp hạng chỉ gồm sinh viên. Giảng viên là người chấm bài, để họ đứng chung
bảng với người mình chấm thì bảng mất ý nghĩa.

### Cấp badge

Badge được xét ngay trong cùng giao dịch với lúc cộng điểm, nên điểm tích luỹ và
badge không bao giờ lệch nhau. Có bốn loại điều kiện: đủ số project bất kỳ, đủ số
project trong một track, đạt tới một level, và đạt tới một mức điểm.

### Project tiên quyết

Project nào có tiên quyết thì phải hoàn thành hết những project đó trước rồi mới
nộp bài được. Gọi tên vào `POST /projects/{slug}/submissions` khi chưa đủ điều
kiện sẽ nhận lỗi 409 kèm danh sách project còn thiếu. Nếu không chặn thì hai chữ
tiên quyết chỉ còn là lời khuyên, và người học vẫn nhảy thẳng vào bài khó rồi tắc.

### Đề xuất project tiếp theo

Chỉ những project đã mở khoá mới được đề xuất, nghĩa là mọi project tiên quyết
của nó đều đã được duyệt. Điểm ưu tiên tính theo bốn thành phần:

1. Khoảng cách tới level nên làm tiếp. Người dùng chỉ được đẩy lên level cao hơn
   sau khi đã hoàn thành ít nhất 2 project ở level cao nhất hiện có.
2. Track mà người dùng đã hoàn thành nhiều project nhất được cộng điểm; track
   chưa đụng tới được cộng ít hơn, để danh sách đề xuất không bó hẹp vào một hướng.
3. Project ngắn, từ 8 giờ trở xuống, được cộng thêm, hợp để xen kẽ.
4. Project mở khoá được càng nhiều project khác thì càng đáng làm sớm.

Mỗi đề xuất kèm một câu lý do để giao diện giải thích cho người dùng.

## 10. Kiểm tra dữ liệu

Dữ liệu vào hệ thống qua ba đường, và mỗi đường có một lớp kiểm tra riêng.

### Dữ liệu người dùng gửi lên API

Pydantic kiểm tra ngay trước khi bất cứ dòng nghiệp vụ nào chạy. Sai thì trả về
mã 422 kèm câu tiếng Việt, không có gì được ghi xuống cơ sở dữ liệu.

| Trường | Ràng buộc |
|---|---|
| `email` | đúng khuôn thư điện tử, tối đa 255 ký tự, hạ chữ thường trước khi lưu |
| `username` | 3 tới 50 ký tự, chỉ chữ thường, chữ số và dấu gạch dưới, hạ chữ thường trước khi lưu |
| `display_name` | tối đa 100 ký tự, cắt khoảng trắng hai đầu, rỗng thì lấy username |
| `password` | 8 tới 64 ký tự và tối đa 72 byte sau khi mã hoá UTF-8 |
| `identifier` | 3 tới 255 ký tự, cắt khoảng trắng hai đầu |
| `repo_url`, `demo_url` | đúng khuôn đường dẫn, chỉ nhận http và https, tối đa 512 ký tự |
| `note` | tối đa 2000 ký tự, cắt khoảng trắng hai đầu |
| `feedback` | tối đa 4000 ký tự, cắt khoảng trắng hai đầu |
| `score` | số nguyên từ 0 tới 100, hoặc để trống |
| `status` khi chấm bài | đạt, chưa đạt hoặc cần sửa lại; không nhận lại trạng thái chờ chấm |
| `level` | số nguyên từ 0 tới 5 |
| `project_type`, `sort` | phải nằm trong danh sách kiểu liệt kê đã khai báo |
| `min_hours`, `max_hours` | số nguyên từ 1 trở lên, và giá trị tối thiểu không được lớn hơn giá trị tối đa |
| `q` | 1 tới 100 ký tự; ký tự đại diện của LIKE được thoát nên gõ dấu phần trăm là tìm đúng dấu phần trăm |
| `page`, `page_size` | trang từ 1 trở lên, mỗi trang tối đa 100 bản ghi |
| `max_tier` | số nguyên từ 1 tới 3 |
| `limit` | bảng xếp hạng 1 tới 100, phần đề xuất 1 tới 50 |

Ba giới hạn độ dài đáng nói riêng: `email`, `repo_url` và `demo_url` được chặn
đúng bằng độ rộng cột trong cơ sở dữ liệu. SQLite không cưỡng chế độ rộng cột,
nên nếu chỉ khai báo `String(512)` ở model thì một chuỗi dài gấp bốn lần vẫn ghi
được, và chỉ hỏng vào ngày đổi sang MySQL hoặc PostgreSQL.

Thân request không phải JSON cũng có câu báo riêng, vì lỗi loại này mang theo vị
trí ký tự chứ không mang tên trường.

### Dữ liệu mẫu trong bảy file JSON

`kiem_tra_khuon` trong `app/seed/loader.py` chạy ngay lúc đọc file, trước khi ghi
bất cứ thứ gì. Nó xét ba điều: dữ liệu phải là danh sách các đối tượng, mỗi đối
tượng phải đủ trường bắt buộc, và khoá của chúng không được trùng nhau. Sau đó
chương trình kiểm tra tiếp phần tham chiếu và phần số liệu: track, skill, level
và project tiên quyết phải tồn tại; `estimated_hours` phải lớn hơn 0; `reward_points`
không được âm. Bất kỳ lỗi nào cũng dừng cả lần nạp và nói rõ file nào, phần tử
thứ mấy, sai ở đâu.

Bộ kiểm thử còn xét hai tính chất mà file JSON không tự nói ra: đồ thị tiên quyết
không có chu trình, và project tiên quyết không nằm ở level cao hơn project phụ
thuộc nó. Có chu trình thì cả nhóm project trong đó vĩnh viễn không mở khoá.

### Ràng buộc ở tầng cơ sở dữ liệu

Lớp cuối cùng nằm trong chính lược đồ, phòng khi có ai ghi thẳng vào cơ sở dữ
liệu mà không đi qua API: `estimated_hours > 0`, `reward_points >= 0`, `total_points >= 0`,
`score` từ 0 tới 100, tầng gợi ý từ 1 tới 3, một project không được là tiên quyết
của chính nó, cùng các ràng buộc duy nhất trên slug và trên cặp khoá của bảng
nối. Khoá ngoại được bật tường minh vì SQLite mặc định bỏ qua chúng.

### Kiểm tra ở phía giao diện

Giao diện kiểm tra lại ba biểu mẫu trước khi gửi: đăng ký, nộp bài và chấm bài.
Đây không phải lớp bảo vệ, backend vẫn chặn đủ, mà là để nói cho người dùng biết
sai chỗ nào và sửa thế nào. Chi tiết nằm ở mục 5 của
[`../frontend/README.md`](../frontend/README.md).

## 11. Thêm project mới

Toàn bộ nội dung nằm trong bảy file JSON tại `app/seed/`, tách hẳn khỏi mã nguồn:
`levels.json`, `mentors.json`, `tracks.json`, `skills.json`, `badges.json`,
`projects.json`, `roadmaps.json`.

Thêm project mới chỉ cần thêm một phần tử vào `projects.json` rồi chạy lại
`python -m app.seed`. Chương trình nạp dữ liệu mẫu kiểm tra mọi tham chiếu trước
khi ghi: nếu một project trỏ tới track, skill hoặc project tiên quyết không tồn
tại thì toàn bộ lần nạp bị huỷ và cơ sở dữ liệu giữ nguyên trạng thái cũ, thay vì
nạp được một nửa.

200 project hiện có phủ cả 6 level và cả 11 track, nối với nhau thành một đồ thị
tiên quyết không có chu trình. Số project của từng level lần lượt là 25, 35, 43,
44, 30 và 23; của từng track thì từ 14 tới 23. Khi thêm project mới, giữ nguyên
nguyên tắc project tiên quyết không được ở level cao hơn project phụ thuộc nó.

## 12. Cách backend ghép với frontend

Backend phục vụ luôn thư mục `../frontend`. Chạy `dev.cmd run` rồi mở
`http://127.0.0.1:8421` là thấy giao diện; API vẫn nằm ở `/api/v1` và tài liệu
API vẫn ở `/docs`.

Ba thư mục tài nguyên của giao diện được gắn riêng: `/anh`, `/css` và `/js`.
Chỉ ba thư mục đó ra ngoài, nên những tệp nằm cạnh `index.html`, ví dụ
`README.md`, không bị phục vụ.
Đường dẫn tới thư mục đó nằm trong biến `FRONTEND_DIR`, mặc định là `../frontend`.
Để trống biến này thì backend chỉ phục vụ API và địa chỉ gốc chuyển hướng sang
trang tài liệu API. Không tìm thấy thư mục thì backend vẫn khởi động bình thường,
chỉ ghi một dòng nhật ký.

Vì giao diện và API cùng một origin nên trình duyệt không phải kiểm tra CORS, và
giao diện gọi API bằng đường dẫn tương đối `/api/v1`, đổi cổng cũng không phải
sửa mã nguồn.

Khi cần chạy giao diện trên một cổng riêng thì hai bên khác origin, lúc đó danh
sách origin được phép gọi API khai báo trong biến `CORS_ORIGINS` của `.env`, ngăn
cách bằng dấu phẩy. Mặc định đã mở sẵn bảy origin của máy cục bộ: cổng 5500,
8080 và 5173 với cả hai tên `127.0.0.1` và `localhost`, cùng `localhost:3000`.

Xác thực bằng tiêu đề `Authorization: Bearer <access_token>`. Token lấy từ
`/auth/register` hoặc `/auth/login`, kèm trường `expires_in` cho biết token còn
hiệu lực bao nhiêu giây, để frontend biết lúc nào cần đăng nhập lại mà không phải
tự giải mã token.

Mọi API trả về danh sách dài đều dùng chung một cấu trúc phân trang:

```json
{"items": [], "total": 0, "page": 1, "page_size": 20, "pages": 0}
```

Mọi lỗi đều trả về trường `detail` là một câu tiếng Việt, hiển thị thẳng cho
người dùng được:

```json
{"detail": "Không tìm thấy project."}
```

Riêng lỗi 422 do dữ liệu gửi lên sai có thêm trường `errors` liệt kê từng trường
hỏng, dành cho lập trình viên khi gỡ lỗi:

```json
{
  "detail": "Dữ liệu không hợp lệ ở: mật khẩu, thư điện tử.",
  "errors": [
    {"field": "email", "message": "value is not a valid email address: ..."},
    {"field": "password", "message": "String should have at least 8 characters"}
  ]
}
```

Hai trường này gọi tên chỗ sai theo hai cách khác nhau, có chủ đích. Câu trong
`detail` dành cho người dùng nên dùng đúng chữ ghi trên giao diện, tra trong
bảng `_TEN_TRUONG` của `app/main.py`; danh sách `errors` dành cho người phát
triển nên giữ nguyên tên trường thật để lần ra chỗ sai trong mã nguồn.

Mọi mốc thời gian trả về đều theo UTC và luôn kèm hậu tố `Z`, ví dụ
`2026-08-29T10:15:50.488268Z`. Frontend chỉ cần đổi sang giờ địa phương lúc hiển
thị, không phải đoán múi giờ.

Cách giao diện dùng từng endpoint được ghi trong
[`../frontend/README.md`](../frontend/README.md).

## 13. Các quyết định kỹ thuật và lý do

### Chọn SQLite thay vì MySQL hay PostgreSQL

Máy đang có sẵn một máy chủ MySQL chạy ở cổng 3306 phục vụ việc khác. Dùng chung
máy chủ đó có nguy cơ đụng vào dữ liệu của project khác. SQLite chỉ là một file
trong thư mục `data/`, không chiếm cổng, không cần cài thêm gì, và xoá đi là
sạch. Với quy mô vài trăm project và vài nghìn người dùng thì SQLite thừa sức đáp
ứng.

Mã nguồn viết qua SQLAlchemy nên khi cần đổi sang MySQL hoặc PostgreSQL chỉ phải
sửa một dòng `DATABASE_URL` trong `.env` và cài thêm trình điều khiển tương ứng.

### Bỏ trường quy mô của project

Ban đầu mỗi project có thêm một trường quy mô, nhận một trong năm giá trị micro,
standard, product, advanced và research. Đối chiếu với dữ liệu thật thì trường
này gần như là hàm của level: toàn bộ project level 0 mang giá trị micro, level 1
và 2 mang standard, level 3 và 4 mang product, level 5 mang research. Nó không
nói thêm điều gì mà level chưa nói, nên đã được bỏ khỏi model, khỏi bộ lọc và
khỏi giao diện.

### Ảnh đại diện chỉ lưu tên tệp trong cơ sở dữ liệu

Bảng `user` giữ cột `avatar` chứa tên tệp, ví dụ `12.jpg`, còn tệp ảnh nằm trong
`data/anh-dai-dien/`. Lưu dữ liệu nhị phân thẳng vào bảng sẽ làm mọi truy vấn
đọc người dùng nặng lên, kể cả những truy vấn không cần ảnh. Tên tệp lấy theo mã
người dùng nên mỗi người chỉ có đúng một ảnh, và ảnh cũ ở định dạng khác được xoá
đi khi tải ảnh mới.

Tệp gửi lên được xét ba lớp: loại nội dung phải là JPEG, PNG hoặc WebP; dung
lượng không quá 2 MB; và vài byte đầu của tệp phải khớp định dạng đã khai báo,
để một tệp bất kỳ đổi tên thành `.jpg` không lọt qua được.

### Hàm lower của SQLite được thay bằng bản của Python

Hàm `lower` dựng sẵn của SQLite chỉ hạ được 26 chữ cái không dấu. Với nó, tiêu
đề "Ứng dụng trắc nghiệm chạy trên dòng lệnh" giữ nguyên chữ Ứ, nên người gõ
"ứng dụng" vào ô tìm kiếm không ra kết quả nào. Mỗi khi mở một kết nối SQLite,
`app/db/session.py` đăng ký lại `lower` bằng hàm hạ chữ của Python, vốn theo
đúng quy tắc Unicode. MySQL và PostgreSQL đã xử lý đúng phần này nên chỉ SQLite
mới cần thay.

### Tìm kiếm và sắp xếp bỏ qua dấu tiếng Việt

Cùng chỗ đăng ký lại `lower`, `app/db/session.py` đăng ký thêm một hàm riêng tên
`bo_dau`, dựng trên `unicodedata` của Python: chuỗi được tách thành chữ cái gốc
và dấu phụ theo dạng chuẩn NFD, mọi dấu phụ bị bỏ, riêng chữ đ được thay bằng d
vì trong bảng mã nó là một chữ cái riêng chứ không phải chữ d mang dấu.

Hàm này phục vụ hai việc. Thứ nhất, ô tìm kiếm so khớp trên chuỗi đã bỏ dấu ở cả
hai phía, nên gõ "nhan dang" vẫn ra project tên "Nhận dạng chữ số viết tay" —
điều đáng kể với người gõ nhanh và với bàn phím không có bộ gõ tiếng Việt. Thứ
hai, cách sắp xếp theo tên project cũng dùng khoá đã bỏ dấu; nếu so sánh thẳng
trên chuỗi gốc thì thứ tự đi theo vị trí ký tự trong bảng mã Unicode, và mọi tên
bắt đầu bằng chữ có dấu bị đẩy xuống sau chữ Z.

### Ảnh đại diện đổi tên tệp theo mỗi lần tải lên

Tên tệp gồm mã người dùng và một chuỗi ngẫu nhiên, ví dụ `12-a1b2c3d4.jpg`. Nếu
tên chỉ theo mã người dùng thì ảnh mới trùng địa chỉ với ảnh cũ, trình duyệt lấy
lại bản trong bộ nhớ đệm, và người dùng đổi ảnh xong vẫn thấy ảnh cũ cho tới khi
tải lại trang. Tệp cũ được xoá ngay sau khi tệp mới ghi xong nên mỗi người vẫn
chỉ chiếm đúng một tệp trên đĩa.

Phần kiểm tra định dạng xét cả chữ ký nằm trong tệp chứ không tin phần mở rộng.
Riêng WebP phải xét thêm bốn byte ở vị trí thứ chín: bốn byte đầu của nó là
`RIFF`, thứ mà tệp âm thanh WAV và video AVI cũng có.

### Bốn tuỳ chọn SQLite được bật khi mở kết nối

Khai báo trong `app/db/session.py`: bật kiểm tra khoá ngoại vì SQLite mặc định bỏ
qua, bật chế độ WAL để đọc song song với ghi, đặt mức đồng bộ vừa phải để giảm số
lần ghi đĩa, và đặt thời gian chờ 5 giây thay vì báo lỗi ngay khi cơ sở dữ liệu
đang bận.

### Mọi cột thời gian dùng chung một kiểu tự quy về UTC

SQLite không có kiểu thời gian riêng nên phần múi giờ bị mất khi ghi xuống đĩa.
Nếu để nguyên, API trả về chuỗi không có hậu tố `Z`, và frontend sẽ hiểu đó là
giờ địa phương rồi hiển thị lệch bảy giờ. Lớp `UtcDateTime` trong
`app/db/base.py` quy giá trị về UTC lúc ghi và gắn lại UTC lúc đọc, nên sai lệch
này không xảy ra ở bất kỳ cột thời gian nào.

### Backend phục vụ luôn frontend thay vì chạy hai máy chủ

Cách thường gặp là một máy chủ cho API và một máy chủ tĩnh cho giao diện. Với
project này thì cách đó tốn công hơn phần lợi: phải chạy hai lệnh, phải khai báo
CORS, và phải viết địa chỉ đầy đủ của API vào mã nguồn giao diện rồi sửa lại mỗi
lần đổi cổng. Giao diện ở đây chỉ là tệp tĩnh, không có bước dịch mã, nên gắn
thẳng vào cùng một ứng dụng là đủ. Khi nào cần tách, chỉ việc để trống biến
`FRONTEND_DIR`.

### Endpoint viết theo kiểu đồng bộ

FastAPI chạy các endpoint đồng bộ trên một nhóm luồng riêng nên vòng lặp sự kiện
không bao giờ bị chặn. Với một cơ sở dữ liệu dạng file như SQLite, cách này nhanh
hơn và dễ đọc hơn so với viết bất đồng bộ.

### Tránh truy vấn lặp và tránh đọc thừa cột

Các quan hệ hay dùng của `project` được nạp sẵn bằng một truy vấn phụ duy nhất
cho cả trang kết quả, thay vì mỗi project một truy vấn.

Ở chiều ngược lại, chỗ nào chỉ cần vài cột thì chỉ đọc đúng vài cột đó. Danh sách
bài nộp lấy `id`, `slug` và `title` của project, nhờ vậy một trang 20 bài nộp
giảm từ 7 truy vấn xuống còn 4, đồng thời không phải đọc các cột văn bản dài của
project. Phép tính điểm ưu tiên của phần đề xuất đọc 5 cột của cả kho project
rồi mới nạp đối tượng đầy đủ cho đúng những project lọt vào danh sách trả về;
cách này tốn thêm một truy vấn nhỏ, đổi lại khối lượng dữ liệu đọc không còn
tăng theo kích thước kho project, nên khi kho lên tới 200 project thì phần tiết
kiệm mới rõ.

Bảng xếp hạng đếm số project hoàn thành bằng một phép gộp có điều kiện ngay trong
truy vấn chính, nên chỉ tốn đúng một lần đọc cơ sở dữ liệu.

### Lưu sẵn điểm tích luỹ trong bảng `user`

Cột `total_points` được cộng dồn ngay lúc chấm bài. Nhờ vậy bảng xếp hạng chỉ
phải đọc một cột đã có chỉ mục, thay vì cộng lại toàn bộ bài nộp của mọi người
mỗi lần mở trang.

### Điểm ưu tiên của phần đề xuất được tính trong bộ nhớ

Tập project chỉ vài trăm bản ghi nên nạp một lần rồi tính điểm bằng Python nhanh
hơn và dễ sửa hơn nhiều so với dựng một câu lệnh SQL phức tạp cho công thức tính
điểm.

### Gợi ý theo tầng bị cắt ở phía backend

Endpoint `/projects/{slug}/hints` chỉ trả về gợi ý tới đúng tầng được yêu cầu,
nên người dùng không thể xem hết gợi ý bằng cách sửa giao diện.

### Mật khẩu băm bằng bcrypt, giới hạn 72 byte được kiểm tra tường minh

bcrypt chỉ xử lý 72 byte đầu. Nếu không kiểm tra, một mật khẩu dài sẽ bị cắt âm
thầm. Giới hạn tính theo byte chứ không theo ký tự, vì một ký tự tiếng Việt có
dấu chiếm tới ba byte.

### Thư điện tử chỉ được kiểm tra lúc đăng ký, không kiểm tra lại lúc đọc ra

Nếu kiểm tra ở cả hai chiều thì khi quy tắc kiểm tra thay đổi, những bản ghi cũ
trong cơ sở dữ liệu sẽ làm API hỏng. Bộ kiểm thử có một bài riêng cho tình huống
này.

### Luồng ra chuẩn được chuyển sang UTF-8 ngay đầu mỗi điểm khởi động

Cửa sổ dòng lệnh của Windows mặc định dùng một bảng mã không có chữ tiếng Việt.
Nếu không chuyển bảng mã, chương trình nạp dữ liệu mẫu dừng giữa chừng vì lỗi mã
hoá ngay khi in dòng thống kê đầu tiên.

## 14. Việc còn lại

Chưa có công cụ migration. Hiện tại bảng được tạo bằng `create_all`, đủ cho giai
đoạn đầu. Khi lược đồ bắt đầu thay đổi thường xuyên thì nên thêm Alembic để không
phải xoá cơ sở dữ liệu mỗi lần sửa.

Chấm bài đang do người làm. Phần chấm tự động có thể thêm sau vào
`app/services/progress.py` mà không phải sửa tầng API.

Chưa có giới hạn số lần gọi API. Khi mở ra ngoài mạng cục bộ thì nên thêm.

Nội dung project mới chỉ có tiếng Việt. Bản giao diện đầu tiên có nút chuyển ngữ
Việt – Anh nhưng đã bỏ, vì chữ tĩnh dịch được còn nội dung project thì không. Muốn có
tiếng Anh thật thì thêm cột tiếng Anh cho các trường văn bản của bảng `project`,
rồi cho API nhận một tham số ngôn ngữ.

Bảng chấm bài mới lọc theo trạng thái. Khi số bài nộp tăng lên thì nên cho
`GET /submissions` lọc thêm theo project và theo người nộp.
