# Nền tảng học tập theo project — frontend

Giao diện web của nền tảng học tập theo project, viết bằng HTML, CSS và JavaScript thuần. Không
dùng thư viện ngoài, không có bước dịch mã, không cần cài gói phụ thuộc.

Toàn bộ nội dung hiển thị trên trang đều lấy từ backend qua API. Trong thư mục
này không còn tệp dữ liệu viết sẵn nào.

Tài liệu này gọi mỗi khái niệm bằng đúng một tên từ đầu đến cuối, trùng với tên
mà backend dùng: project, level, track, skill, bài nộp, badge, điểm tích luỹ, lộ trình,
gợi ý, đề xuất, cơ sở dữ liệu.

## 1. Cách chạy

Backend phục vụ luôn thư mục này, nên chỉ cần chạy backend rồi mở
`http://127.0.0.1:8421` cho trang chủ, hoặc `http://127.0.0.1:8421/kho.html` cho
trang kho project. Cách cài đặt và chạy backend nằm trong
[`../backend/README.md`](../backend/README.md).

Mở thẳng tệp `index.html` bằng trình duyệt thì trang không chạy được, vì hai lý
do: mã nguồn dùng module của JavaScript nên giao thức `file://` bị trình duyệt
chặn, và mọi dữ liệu đều phải lấy từ backend.

Muốn chạy giao diện trên một cổng riêng, chẳng hạn để sửa giao diện mà không
khởi động lại backend, thì mở một máy chủ tĩnh tại thư mục này:

```powershell
python -m http.server 5500
```

Khi đó giao diện nằm ở `http://127.0.0.1:5500` còn backend vẫn ở cổng 8421. Hai
địa chỉ khác cổng nghĩa là khác origin, nên phải sửa hằng `GOC_API` trong
`js/api.js` thành `http://127.0.0.1:8421/api/v1`. Cổng 5500 đã có sẵn trong biến
`CORS_ORIGINS` của backend, cùng với các cổng 8080, 5173 và 3000.

## 2. Cấu trúc tệp

```
frontend/
├─ index.html          trang chủ: khung trang và toàn bộ chữ tĩnh
├─ kho.html            trang kho project: bộ lọc đầy đủ và phân trang
├─ anh/                ba logo và bốn ảnh chân dung
├─ css/style.css       toàn bộ kiểu trình bày, biến màu đặt trong :root
└─ js/
   ├─ api.js           gọi backend, giữ token, dựng chuỗi truy vấn, đọc câu báo lỗi
   ├─ giao-dien.js     tiện ích dùng chung: chọn phần tử, đổi dữ liệu thành chữ, bảng trượt, hiện dần
   ├─ su-kien.js       ba sự kiện mà các phần của trang gửi cho nhau
   ├─ tien-do.js       bài nộp của người đang đăng nhập
   ├─ kho.js           trang chủ: số liệu tổng quan, mục lục level, vài project mỗi level
   ├─ trang-kho.js     trang kho project: bộ lọc, phân trang, địa chỉ chia sẻ được
   ├─ project.js       bảng chi tiết project, gợi ý theo tầng, người phụ trách, nộp bài
   ├─ tai-khoan.js     đăng nhập, đăng ký, bảng tài khoản
   ├─ cham-bai.js      bảng chấm bài của tài khoản giảng viên
   ├─ lo-trinh.js      lộ trình nghề nghiệp
   ├─ giang-vien.js    mục nhân sự
   ├─ app.js           điểm khởi động của trang chủ
   └─ app-kho.js       điểm khởi động của trang kho project
```

Mỗi tệp trong `js/` phụ trách đúng một phần của trang. Chỉ `api.js` biết địa
chỉ của backend, nên khi backend đổi đường dẫn thì chỉ phải sửa một tệp.

## 3. Cách các phần nói chuyện với nhau

Luồng dữ liệu đi một chiều: `app.js` gọi các phần, các phần gọi `api.js`.

Có hai chỗ cần đi ngược chiều: bảng chi tiết project cần mở hộp đăng nhập, còn
bảng tài khoản lại cần mở bảng chi tiết project. Nếu hai tệp gọi thẳng vào nhau
thì sinh ra phụ thuộc vòng, nên chúng gửi cho nhau ba sự kiện khai báo trong
`su-kien.js`. Cả hai trang đều nghe ba sự kiện này, mỗi trang xử lý theo phần
danh sách của mình:

| Sự kiện | Ai phát | Việc xảy ra sau đó |
|---|---|---|
| `can-dang-nhap` | bảng chi tiết project | mở hộp đăng nhập |
| `phien-thay-doi` | phần tài khoản | vẽ lại khu tài khoản, tải lại tiến độ, vẽ lại danh sách project |
| `tien-do-thay-doi` | lúc nộp bài và lúc chấm bài | tải lại tiến độ, vẽ lại danh sách project và phần bài nộp |

## 4. Mỗi phần giao diện gọi endpoint nào

Giao diện dùng 20 trong số 24 endpoint của backend.

| Phần giao diện | Endpoint |
|---|---|
| Số liệu ở phần mở đầu, mục lục sáu level, thẻ lọc của trang kho project | `GET /stats` |
| Vài project mỗi level ở trang chủ, và danh sách đầy đủ ở trang kho project | `GET /projects` |
| Nút chọn giúp một project | `GET /projects/random` |
| Bảng chi tiết project | `GET /projects/{slug}` |
| Gợi ý mở dần theo tầng | `GET /projects/{slug}/hints` |
| Nộp bài | `POST /projects/{slug}/submissions` |
| Hộp đăng nhập và đăng ký | `POST /auth/login`, `POST /auth/register` |
| Khôi phục phiên khi mở lại trang | `GET /auth/me` |
| Bảng tài khoản | `GET /me/progress`, `GET /me/submissions`, `GET /me/recommendations` |
| Lộ trình nghề nghiệp | `GET /roadmaps`, `GET /roadmaps/{slug}` |
| Mục nhân sự | `GET /mentors` |
| Ảnh đại diện trong bảng tài khoản | `PUT /me/avatar`, `DELETE /me/avatar` |
| Bảng xếp hạng | `GET /leaderboard` |
| Bảng chấm bài | `GET /submissions`, `PATCH /submissions/{submission_id}/review` |

Ba endpoint còn lại chưa được dùng, mỗi cái vì một lý do khác nhau.
`GET /levels` và `GET /tracks` trả về đúng phần dữ liệu đã nằm sẵn trong phản
hồi của `GET /stats`, mà `GET /stats` còn kèm số project của từng level và từng
track, nên giao diện gọi một lần thay vì gọi ba lần. `GET /skills` sẽ cần tới
khi thêm bộ lọc theo skill; hiện giao diện chỉ hiển thị tổng số skill, con số
này cũng lấy từ `GET /stats`. `GET /me/badges` trả về danh sách badge của người
đang đăng nhập, nhưng danh sách đó đã nằm trong phản hồi của `GET /me/progress`
nên bảng tài khoản không phải gọi thêm.

Ngoài 24 endpoint đứng sau `/api/v1`, backend còn một endpoint `GET /health`
dành cho công cụ giám sát chứ không dành cho trình duyệt.

## 5. Vài quyết định và lý do

### Địa chỉ backend là đường dẫn tương đối

Hằng `GOC_API` trong `js/api.js` bằng `/api/v1`. Vì backend phục vụ luôn giao
diện nên hai bên cùng một origin: trình duyệt không phải kiểm tra CORS, và đổi
cổng của backend cũng không phải sửa mã nguồn của giao diện.

### Hai trang, hai cách tải dữ liệu

Kho có 200 project nên không trang nào tải cả kho về một lúc.

Trang chủ giới thiệu sáu level, mỗi level lấy đúng sáu project bằng một lượt gọi
riêng. Sáu lượt gọi chạy song song, mỗi lượt trả về sáu bản ghi, nên trang chủ
luôn chỉ tải 36 bản ghi dù kho có 200 hay 2000 project. Dưới mỗi level là một
liên kết sang trang kho project, mang sẵn bộ lọc level tương ứng.

Trang kho project lo phần tìm kiếm. Mỗi lần đổi bộ lọc là một lượt gọi với đúng
tham số lọc, phân trang và sắp xếp, mỗi trang 20 bản ghi. Bộ lọc được ghi vào
địa chỉ trang, ví dụ `kho.html?level=0&track=data-science`, nên một kết quả lọc
có thể gửi cho người khác hoặc lưu lại xem sau.

Cách chia này giữ cho khối lượng dữ liệu tải về không tăng theo kích thước kho.
Hai trang dùng chung phần tài khoản, bảng chi tiết project và bảng chấm bài; chỉ
phần danh sách là khác nhau, nằm ở `js/kho.js` và `js/trang-kho.js`.

### Chỉ vẽ kết quả của lượt gọi mới nhất

Đổi bộ lọc nhanh tay thì nhiều lượt gọi cùng chạy, và phản hồi không chắc về
đúng thứ tự đã gửi. Ba chỗ có thể gặp chuyện này đều đánh số lượt gọi rồi so lại
lúc có kết quả: danh sách project trong `js/trang-kho.js`, bảng chi tiết project
và phần gợi ý trong `js/project.js`. Phản hồi của lượt cũ bị bỏ đi thay vì vẽ đè
lên kết quả đúng.

Phần tiến độ trong `js/tai-khoan.js` cũng làm tương tự, nhưng so theo tài khoản
chứ không theo số lượt: nếu người dùng đã đăng xuất hoặc đã đổi tài khoản trong
lúc chờ, dữ liệu vừa về sẽ không được ghi ra màn hình.

### Hiện dần bằng IntersectionObserver

Phần lớn nội dung được dựng sau khi gọi API, và mỗi lần đổi bộ lọc là một lần
dựng lại. Nếu chỉ quét một lượt lúc mở trang thì những phần dựng sau giữ nguyên
độ mờ bằng không, nghĩa là biến mất khỏi màn hình. Vì vậy phần hiện dần dùng
`IntersectionObserver`: sau mỗi lần vẽ, nơi vẽ gọi `theoDoiHienDan` để đăng ký
những phần tử vừa thêm.

### Thuộc tính hidden được đặt lại trong tệp kiểu

Trình duyệt chỉ đặt `display: none` cho `[hidden]` ở bảng kiểu mặc định của
mình, nên bất kỳ quy tắc `display` nào viết trong `css/style.css` cũng thắng nó.
Vì `.mau` có `display: flex`, biểu mẫu đăng nhập và biểu mẫu đăng ký từng cùng
hiện một lúc dù JavaScript đã đặt `hidden` cho một trong hai. Dòng
`[hidden] { display: none !important; }` ở đầu tệp kiểu trả lại cho `hidden`
đúng nghĩa "ẩn hẳn", và mọi chỗ khác trong trang cũng dùng lại được thuộc tính
này mà không sợ lặp lại lỗi cũ.

### Kiểm tra ba biểu mẫu ngay tại trình duyệt

Backend vẫn là chốt chặn thật, nhưng câu lỗi của nó chỉ nêu chỗ sai nằm ở trường
nào: "Dữ liệu không hợp lệ ở: username." Người dùng đọc câu đó vẫn chưa biết phải
sửa thế nào. Vì vậy cả ba biểu mẫu đều kiểm tra trước khi gửi, và câu báo lỗi nói
rõ cách sửa.

| Biểu mẫu | Hàm kiểm tra | Xét những gì |
|---|---|---|
| Đăng ký | `loiCuaMauDangKy` trong `js/tai-khoan.js` | thư điện tử có dấu @, username đúng tập ký tự, mật khẩu từ 8 ký tự |
| Nộp bài | `loiCuaDuongDan` trong `js/project.js` | đường dẫn đầy đủ, chỉ nhận http và https, không quá 512 ký tự |
| Chấm bài | `chamMotBai` trong `js/cham-bai.js` | điểm là số nguyên từ 0 tới 100, hoặc để trống |

Trường hợp hay gặp nhất là trình duyệt tự điền thư điện tử vào ô username, nên ô
đó đặt `autocomplete="off"`, có chữ gợi ý dạng `vidu: congtt`, và câu chú dẫn nói
thẳng rằng thư điện tử không dùng làm username được. Username cũng được hạ chữ
thường trước khi gửi, giống hệt việc backend làm, để người gõ chữ hoa không bị
báo lỗi oan.

Giới hạn 512 ký tự của đường dẫn và khoảng 0 tới 100 của điểm lấy đúng theo ràng
buộc của backend. Danh sách đầy đủ nằm ở mục 10 của
[`../backend/README.md`](../backend/README.md).

### Mã lỗi của máy chủ được đổi thành câu nói

Phần lớn lỗi từ backend đã kèm sẵn một câu tiếng Việt trong trường `detail`, và
giao diện hiển thị thẳng câu đó. Nhưng có những lỗi không đi qua tầng ứng dụng
nên không có câu nào kèm theo, ví dụ máy chủ web trả về 502 hay một lỗi 500 chưa
kịp xử lý. Trước đây giao diện hiện ra đúng con số: "Máy chủ trả về lỗi 500." —
người đọc không biết đó là lỗi của mình hay của hệ thống, cũng không biết nên làm
gì tiếp. Bảng `CAU_THAY_MA_LOI` trong `js/api.js` đổi mỗi nhóm mã thành một câu
nói rõ chuyện gì vừa xảy ra và bước tiếp theo nên làm, còn mọi mã từ 500 trở lên
đều quy về một câu chung nói rằng lỗi nằm ở phía máy chủ.

### Ô tìm kiếm chờ người dùng gõ xong

Mỗi lần gõ một phím mà gọi API ngay thì một từ khoá năm chữ tạo ra năm lượt gọi.
Ô tìm kiếm đợi 300 mili giây kể từ phím cuối cùng rồi mới gọi, nên một từ khoá
chỉ tốn một lượt.

### Bộ lọc của trang kho tự sửa những giá trị vô nghĩa

Địa chỉ của trang kho mang theo toàn bộ bộ lọc, nên một đường dẫn chép cho bạn bè
mở ra đúng danh sách mình đang xem. Mặt trái là ai cũng sửa được địa chỉ đó, và
một tham số gõ sai sẽ đi thẳng xuống máy chủ rồi quay về dưới dạng câu báo lỗi
kỹ thuật. Vì vậy `docTuDiaChi` trong `js/trang-kho.js` lọc lại mọi tham số trước
khi dùng: cách sắp xếp phải nằm trong bảy giá trị của ô "Sắp xếp", số giờ phải là
số nguyên từ 1 đến 1000, số trang phải là số nguyên dương, từ khoá bị cắt ở một
trăm ký tự. Level và track lạ được bỏ sau khi số liệu tổng quan tải xong, kèm một
câu nói cho người dùng biết điều kiện nào vừa bị bỏ.

Ba tình huống nữa được xử lý ngay tại trang thay vì gọi máy chủ: số giờ ngoài
khoảng được kéo về mép gần nhất và ô hiện lại con số đã chỉnh; hai ô giờ nghịch
nhau thì hiện câu nhắc chứ không tải danh sách; số trang lớn hơn số trang thật
thì lùi về trang cuối. Mỗi lần đổi bộ lọc cũng thêm một mốc vào lịch sử trình
duyệt, nhờ đó nút quay lại hoàn tác đúng một bước lọc thay vì nhảy ra khỏi trang.

### Mọi chuỗi đi vào trang đều được đổi ký tự đặc biệt

Nội dung project do người soạn dữ liệu mẫu viết, còn ghi chú và đường dẫn của bài nộp do
người dùng nhập. Hàm `chu` trong `js/giao-dien.js` đổi năm ký tự đặc biệt của
HTML thành thực thể tương ứng. Mọi chuỗi ghép vào `innerHTML` đều đi qua hàm này.

### Token giữ trong localStorage, nhưng vẫn hỏi lại backend

Token được lưu dưới khoá `nen-tang-project:token` để người dùng không phải đăng nhập
lại sau mỗi lần đóng trình duyệt. Chỉ có token thì chưa đủ, vì nó có thể đã hết
hạn, nên lúc mở trang giao diện gọi `GET /auth/me` một lần: gọi được thì mới coi
là đã đăng nhập.

Token chỉ bị xoá khi backend trả về lỗi 401, tức là chính backend nói token
không dùng được nữa. Máy chủ tạm thời không gọi được thì token vẫn nằm nguyên
trong máy, để lần mở trang sau người dùng còn vào lại được mà không phải gõ mật
khẩu. Khi một lệnh gọi đang đăng nhập nhận về lỗi 401, giao diện báo một câu
ngắn rồi đưa cả trang về trạng thái chưa đăng nhập, thay vì tiếp tục hiển thị
tên người dùng trong khi mọi thứ đã hỏng.

### Giấu nút chỉ để đỡ rối mắt, không phải để phân quyền

Nút mở bảng chấm bài chỉ hiện với tài khoản giảng viên. Phần chặn thật nằm ở
backend: `GET /submissions` và `PATCH /submissions/{submission_id}/review` trả về lỗi 403
cho mọi tài khoản không có quyền giảng viên, bất kể giao diện hiển thị gì.

### Đầu trang xuống hàng thay vì bóp chữ

Đầu trang xếp ba khối trên một hàng: cụm ba logo kèm tên đơn vị, thanh điều
hướng, và khu tài khoản. Chỗ hẹp thì flexbox bóp khối nào bóp được, mà chữ thì
luôn bóp được, nên kết quả là "Kho project" gãy thành hai dòng và tên người dùng
vỡ ba dòng. Vì vậy mọi chữ ở đầu trang đều đặt `white-space: nowrap`: khi không
còn bóp được nữa, flexbox buộc phải cho cả thanh điều hướng xuống hàng riêng,
đúng thứ ta muốn.

Ngưỡng xuống hàng phụ thuộc việc đã đăng nhập hay chưa, vì khu tài khoản lúc đã
đăng nhập rộng gấp ba lần nút đăng nhập. Phần tài khoản gắn lớp `da-dang-nhap`
lên thẻ `body` mỗi lần phiên thay đổi, và tệp kiểu dùng lớp đó để chọn ngưỡng:
1140 điểm ảnh khi đã đăng nhập, 940 khi chưa. Dưới 768 điểm ảnh thì hai logo phụ
và dòng số liệu trong thẻ người dùng cùng nhường chỗ, để cụm chữ và thẻ vẫn nằm
chung một hàng.

### Bảng trượt khoá phần trang phía sau

Bảng trượt che gần hết màn hình nhưng vẫn nằm chung một trang với phần nội dung
bên dưới, nên khi mở bảng có ba thứ phải xử lý. Trang nền được khoá cuộn bằng
lớp `khoa-cuon` trên `body`, nếu không thì lăn chuột ở khoảng ngoài bảng làm
trang chạy phía sau lớp tối trong khi thứ người dùng đang đọc đứng yên; chính
bảng thì đặt `overscroll-behavior: contain` để cuộn hết nội dung là dừng, không
đẩy tiếp trang nền. Mọi phần tử con của `body` nằm ngoài bảng được đặt `inert`,
nếu không thì chỉ ba lần nhấn Tab là tiêu điểm đã ra tới liên kết ở đầu trang,
chỗ mà chuột bấm không tới được vì lớp tối chắn ngang. Cuối cùng, mở một project
khác từ trong bảng đang mở thì nơi trả tiêu điểm vẫn giữ nguyên phần tử ngoài
trang đã mở bảng lần đầu, để lúc đóng hẳn người dùng quay về đúng chỗ đang đọc.

### Bài nộp gõ dở được giữ lại

Đóng bảng chi tiết là toàn bộ biểu mẫu bị gỡ khỏi trang, nên chữ đang gõ mất
theo. Một cú bấm nhầm ra vùng tối hay một lần nhấn Esc là mất công viết, mà
không có câu hỏi lại nào. Vì vậy nội dung ba ô của biểu mẫu nộp bài được ghi vào
lưu trữ cục bộ theo từng project ngay khi người dùng gõ, và điền lại khi mở bảng
lần sau, kèm một dòng nói rõ đây là chữ đang gõ dở lần trước. Bản nháp bị xoá
ngay sau khi bài được nộp thành công.

### Phiên đăng nhập dùng chung giữa các thẻ

Trang nghe sự kiện `storage` của lưu trữ cục bộ, thứ chỉ bắn sang những thẻ khác
chứ không bắn tại thẻ vừa gây ra thay đổi. Nhờ đó đăng xuất ở một thẻ là mọi thẻ
còn lại cũng thoát theo. Trên máy dùng chung ở phòng máy, không có phần này thì
sinh viên bấm đăng xuất rồi đứng dậy sẽ tưởng đã thoát, trong khi thẻ còn lại
vẫn mở nguyên tài khoản của mình.

### Mốc thời gian ghép tay thay vì để trình duyệt tự xếp

Backend trả về thời gian theo UTC. Giao diện đổi sang giờ địa phương rồi ghép
theo thứ tự ngày trước giờ sau, vì cách xếp mặc định của tiếng Việt đặt giờ lên
trước và câu "nộp lúc 18:54 29/08/2026" rất khó đọc.

### Năm trạng thái của phần nộp bài

Chưa đăng nhập thì hiện nút đăng nhập. Project còn tiên quyết chưa hoàn thành
thì không mở biểu mẫu, mà nói rõ còn thiếu project nào, vì backend cũng từ chối
nhận bài trong trường hợp đó. Đã có bài nộp được chấm đạt thì cũng không mở, vì
backend từ chối nhận thêm bài cho project đã hoàn thành. Đang chờ chấm thì biểu
mẫu vẫn mở, hai ô đường dẫn và ô ghi chú được điền sẵn nội dung đã gửi, nút ghi
"Cập nhật bài đang chờ": bản mới thay hẳn bản cũ nên hàng đợi của người chấm
không có hai bài của cùng một project. Các trường hợp còn lại thì mở biểu mẫu
trống, và nếu người dùng từng nộp thì nút ghi "Nộp lại" thay cho "Nộp bài".

## 6. Bảng màu, chữ và hiệu ứng

Màu đặt trong `:root` của `css/style.css`: đỏ `#A21C2B`, vàng đồng `#E0A03A`,
giấy ngà `#FBF9F5`, mực `#16130F`, thêm màu xanh `#2F6B4F` cho trạng thái bài
nộp đã đạt. Sáu level dùng ba màu để phân biệt ba chặng: level 0 tới 2 màu đỏ,
level 3 và 4 màu vàng đồng, level 5 màu mực.

Vàng đồng đủ đậm khi làm nền hoặc khi nằm trên nền tối, nhưng làm màu chữ trên
nền giấy thì chỉ đạt tỷ lệ tương phản 2,2:1, dưới mức 4,5:1 mà chữ nhỏ cần. Vì
vậy có thêm biến `--vang-chu` bằng `#8F5E0C` dành riêng cho chữ, đạt 5,3:1 trên
nền giấy và 4,9:1 trên nền giấy nhạt. Bốn màu chữ còn lại đều vượt 4,5:1 trên
nền tương ứng.

Chữ dùng Times New Roman cho mọi cấp tiêu đề, phân biệt bằng độ đậm, chữ nghiêng,
cỡ chữ và màu.

Đầu trang đặt tên khoa làm dòng chính, tên Học viện và tên Trung tâm Đào tạo
chuyên sâu AI làm hai dòng phụ, cạnh ba logo. Tên khoa được viết hoa bằng
`text-transform` của CSS chứ không viết hoa sẵn trong HTML, để phần chữ trong mã
nguồn vẫn đúng chính tả tiếng Việt và trình đọc màn hình vẫn đọc đúng. Tên hệ
thống chuyển xuống làm nhãn của phần mở đầu.

Hiệu ứng gồm: vạch tiến độ cuộn ở đầu trang, đường lộ trình tự nét dần khi tải,
sáu điểm nút nhấp nháy lệch pha, nội dung hiện dần theo cuộn, bốn số liệu đếm
lên, dải track chạy ngang, vùng sáng đi theo con trỏ, và ba bảng trượt vào từ
bên phải. Người dùng bật chế độ giảm chuyển động của hệ điều hành thì mọi hiệu
ứng tự tắt, theo `@media (prefers-reduced-motion: reduce)`.

## 7. Khác biệt so với bản giao diện đầu tiên

Bản đầu tiên là một trang tĩnh với 36 project mẫu viết sẵn trong `js/data.js`,
tiến độ lưu trong `localStorage`, và có nút chuyển ngữ Việt – Anh.

| Phần | Bản đầu tiên | Bản hiện tại |
|---|---|---|
| Nguồn dữ liệu | `js/data.js` | backend |
| Tên sáu level | viết sẵn trong trang | vẫn sáu tên đó, nhưng lấy từ backend |
| Cách nhóm chuyên môn | tám lĩnh vực | mười một track của backend |
| Ảnh | bốn ô giữ chỗ, chưa có logo | ba logo và bốn ảnh chân dung, lưu trong `anh/` |
| Số trang | một trang | trang chủ và trang kho project |
| Người phụ trách | ghi thẳng trong dữ liệu mẫu | lấy từ backend, mỗi track một giảng viên |
| Tiến độ | đánh dấu tay, lưu trong `localStorage` | nộp bài, được chấm, cộng điểm tích luỹ, lưu trên máy chủ |
| Tài khoản | nút đăng nhập chưa có tác dụng | đăng ký, đăng nhập, phiên khôi phục được |
| Số liệu ở trang chủ | 182 project dự kiến, 28/34/42/36/24/18 project mỗi level | số đếm thật từ `GET /stats` |

Ba thay đổi đáng chú ý:

Số liệu được sửa cho đúng. Con số 182 project và số project của từng level trong
bản đầu tiên là dự kiến, không phải số thật. Giao diện lấy mọi con số từ
`GET /stats` nên chúng luôn khớp với cơ sở dữ liệu, kể cả sau này kho có thêm
hay bớt project. Sáu tên level thì giữ nguyên
như bản đầu tiên: Nhập môn, Cơ sở, Vận dụng, Nâng cao, Thực chiến, Nghiên cứu.
Hai bậc cuối đổi chỗ cho nhau so với bản đầu tiên, vì project ở level 4 là đóng
gói và triển khai, còn project ở level 5 là nghiên cứu và đánh giá.

Nút chuyển ngữ Việt – Anh bị bỏ. Chữ tĩnh trong trang có bản tiếng Anh, nhưng
nội dung project trong cơ sở dữ liệu chỉ có tiếng Việt. Giữ nút chuyển ngữ thì
người bấm sang tiếng Anh vẫn gặp toàn bộ nội dung project bằng tiếng Việt. Muốn có
tiếng Anh thật thì phải thêm cột tiếng Anh vào bảng `project` của backend trước.

Phần giảng viên hướng dẫn từng project bị bỏ. Cơ sở dữ liệu không có khái niệm
giảng viên, nên bảng chi tiết project không hiển thị thông tin này nữa. Mục giới
thiệu nhân sự ở cuối trang vẫn giữ, kèm ghi chú về nguồn.

## 8. Ảnh

Bảy tệp ảnh nằm trong `anh/`, tổng cộng khoảng 640 kB.

| Tệp | Kích thước gốc | Dùng ở đâu |
|---|---|---|
| `logo-khoa-ai.png` | 415 × 418 | đầu trang, và làm biểu tượng trên thanh thẻ của trình duyệt |
| `logo-hoc-vien.png` | 50 × 60 | đầu trang, cạnh logo Khoa Trí tuệ nhân tạo |
| `logo-trung-tam-ai.png` | 294 × 230 | đầu trang, cạnh logo Học viện |
| `pham-van-cuong.jpg` | 969 × 1024 | mục nhân sự |
| `tran-tien-cong.jpg` | 990 × 990 | mục nhân sự |
| `do-thanh-ha.jpg` | 717 × 599 | mục nhân sự |
| `vu-hoai-nam.jpg` | 1024 × 1021 | mục nhân sự |

Ảnh được tải về và lưu trong kho mã nguồn chứ không nhúng đường dẫn từ trang
ngoài. Cách này giữ cho trang chạy được cả khi không có mạng, không phụ thuộc
vào việc trang nguồn còn giữ tệp ở đúng địa chỉ cũ, và không gửi thông tin người
xem sang máy chủ khác.

Bốn ảnh chân dung có tỷ lệ khác nhau, từ 717 × 599 tới 969 × 1024. Khung ảnh giữ
chung một tỷ lệ 3:4 và cắt bớt phần thừa bằng `object-fit: cover`, với điểm neo
đặt hơi cao hơn giữa khung vì khuôn mặt trong cả bốn ảnh đều nằm ở nửa trên.

Logo Học viện chỉ có bản 50 × 60 điểm ảnh nên để nguyên cỡ nhỏ, phóng to là vỡ
nét. Logo Trung tâm hiển thị ở cùng chiều cao ba mươi điểm ảnh, còn logo Khoa
đứng trước ở cỡ lớn hơn vì đây là trang của Khoa. Hai logo phụ không bằng bề
ngang nhau: logo Học viện đứng nên rộng 25 điểm ảnh, logo Trung tâm nằm ngang
nên rộng 38. Dưới 768 điểm ảnh, hai logo phụ được ẩn đi để nhường chỗ cho khu
tài khoản; tên ba đơn vị khi đó vẫn đọc được ở chân trang.

Bản gốc của logo Trung tâm là ảnh JPEG vuông 1080 × 1080, logo nằm giữa một nền
trắng có lớp chuyển màu xanh rất nhạt ở các góc. Tệp trong kho được dựng lại qua
ba bước. Trước hết cắt sát nét, lấy đúng vùng x 274–815 và y 324–745 rồi chừa
năm điểm ảnh mỗi bên, nhờ vậy ba logo ở đầu trang cách nhau đều nhau thay vì
logo cuối trông thưa hơn. Sau đó thu về 294 × 230, cỡ vẫn dư gấp hai lần rưỡi
cho màn hình dày điểm ảnh gấp ba mà nhẹ hơn bản đầy đủ một nửa; phép thu nhỏ làm
khi ảnh còn nền trắng, chứ không làm sau khi đã có kênh trong suốt, để không để
lại viền tối quanh nét. Cuối cùng mới tách nền: điểm ảnh càng khác trắng thì
càng nhiều mực, từ một mức nhất định trở lên coi như phủ kín và giữ nguyên màu
gốc, dưới mức đó là viền chống răng cưa nên độ phủ giảm dần và phần trắng đã
trộn vào được chia ngược ra. Nhờ cách này logo đặt lên nền nào cũng đúng màu,
không riêng nền giấy ngà của trang.

## 9. Nguồn nội dung

Tên, chức vụ và ảnh chân dung của giảng viên, cùng logo Khoa và logo Học viện,
lấy từ trang của Khoa Trí tuệ nhân tạo, `https://ai.ptit.edu.vn`. Logo Trung tâm
Đào tạo chuyên sâu AI lấy từ ảnh do Trung tâm công bố, đã cắt và tách nền như
mục 8 mô tả.

Địa chỉ trụ sở và cơ sở đào tạo lấy từ trang thông tin của Học viện.

Toàn bộ nội dung project, level, track, skill, badge và lộ trình nằm trong sáu
tệp JSON tại `../backend/app/seed/`, không nằm trong thư mục này. Tên sáu level
cũng nằm trong đó, ở tệp `levels.json`, nên đổi tên level là sửa một chỗ duy nhất.
