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
chặn, và mọi dữ liệu đều phải lấy từ backend. Mỗi trang khai báo
`<link rel="modulepreload">` cho mọi module của mình, để trình duyệt tải chúng
song song thay vì phát hiện từng `import` nối đuôi nhau.

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
├─ anh/                ba logo (cùng bản nhỏ và biểu tượng thẻ của logo Khoa), logo mờ làm nền, bốn ảnh chân dung, ba tệp của khung video và năm tệp của video hướng dẫn
├─ css/style.css       toàn bộ kiểu trình bày, biến màu đặt trong :root
├─ lam-video-mo-dau.sh dựng ba tệp của khung video từ một đoạn video bất kỳ
├─ quay-video-huong-dan.mjs quay lại video hướng dẫn từ giao diện đang chạy
└─ js/
   ├─ goc.js           suy ra đường dẫn gốc của giao diện
   ├─ api.js           gọi backend, giữ token, dựng chuỗi truy vấn, đọc câu báo lỗi
   ├─ giao-dien.js     tiện ích dùng chung: chọn phần tử, đổi dữ liệu thành chữ, biểu tượng, bảng trượt
   ├─ su-kien.js       năm sự kiện mà các phần của trang gửi cho nhau
   ├─ tien-do.js       bài nộp của người đang đăng nhập
   ├─ kho.js           trang chủ: số liệu tổng quan, mục lục level, vài project mỗi level
   ├─ trang-kho.js     trang kho project: bộ lọc, phân trang, địa chỉ chia sẻ được
   ├─ project.js       bảng chi tiết project, gợi ý theo tầng, người phụ trách, nộp bài
   ├─ tai-khoan.js     khu tài khoản ở đầu trang, bảng tài khoản, đăng xuất
   ├─ hop-tai-khoan.js hộp đăng nhập và đăng ký: tabs, câu nhắc sống, thẻ xem trước
   ├─ cham-bai.js      bảng chấm bài của tài khoản giảng viên
   ├─ lo-trinh.js      lộ trình nghề nghiệp: tab ba lộ trình, hình leo level, thẻ của ga đang chọn
   ├─ giang-vien.js    mục giảng viên phụ trách: thẻ có ảnh chân dung, huy hiệu số track và hàng track nối sang kho
   ├─ xep-hang.js      bảng xếp hạng
   ├─ khung-video.js   quyết định khi nào video trong khung của phần mở đầu được phát
   ├─ chu-thich-video.js dòng chú thích dưới khung video: một project thật, bấm mở bảng chi tiết
   ├─ ba-buoc.js       hình minh hoạ của ba bước ở trang chủ, dựng từ project mà phần mở đầu giới thiệu
   ├─ video-huong-dan.js ô xem video hướng dẫn ở đầu mục Ba bước, và hộp chiếu video đó
   ├─ keu-goi.js       mục kêu gọi cuối trang chủ: tuyến level thu nhỏ và thẻ một project, theo phiên đăng nhập
   ├─ chan-trang.js    cột số liệu ở chân trang của cả hai trang
   ├─ o-tim.js         ô tìm project ở đầu trang của cả hai trang: hộp gợi ý, phím tắt, thu gọn
   ├─ app.js           điểm khởi động của trang chủ
   └─ app-kho.js       điểm khởi động của trang kho project
```

Mỗi tệp trong `js/` phụ trách đúng một phần của trang. Chỉ `api.js` biết địa
chỉ của backend, nên khi backend đổi đường dẫn thì chỉ phải sửa một tệp.

## 3. Cách các phần nói chuyện với nhau

Luồng dữ liệu đi một chiều: `app.js` gọi các phần, các phần gọi `api.js`.

Có hai chỗ cần đi ngược chiều: bảng chi tiết project cần mở hộp đăng nhập, còn
bảng tài khoản lại cần mở bảng chi tiết project. Nếu hai tệp gọi thẳng vào nhau
thì sinh ra phụ thuộc vòng, nên chúng gửi cho nhau các sự kiện khai báo trong
`su-kien.js`. Cả hai trang đều nghe bốn sự kiện đầu, mỗi trang xử lý theo phần
danh sách của mình; sự kiện thứ năm chỉ có ở trang chủ:

| Sự kiện | Ai phát | Việc xảy ra sau đó |
|---|---|---|
| `can-dang-nhap` | bảng chi tiết project, kèm `{ project }` đang xem | mở hộp đăng nhập, thẻ xem trước là project đó, tiêu đề đọc cho trình đọc màn hình nêu tên project |
| `phien-thay-doi` | phần tài khoản | vẽ lại khu tài khoản, tải lại tiến độ, vẽ lại danh sách project, dấu tiến độ trên hình leo của lộ trình và mục kêu gọi cuối trang |
| `tien-do-thay-doi` | lúc nộp bài và lúc chấm bài | tải lại tiến độ, vẽ lại danh sách project, dấu tiến độ trên hình leo, phần bài nộp và mục kêu gọi cuối trang |
| `tien-do-da-nap` | `napTienDo` trong `tai-khoan.js`, khi lượt tải tiến độ về với số liệu khác lần trước (điểm, số project, trạng thái từng bài nộp), tức bài vừa được chấm ở nơi khác | vẽ lại danh sách project, hình leo, phần bài nộp, mục kêu gọi và bảng xếp hạng từ dữ liệu đã có, không gọi thêm API. Tiến độ được tải lại mỗi khi người dùng quay lại thẻ (`visibilitychange`), nên kết quả chấm hiện ra mà không phải tải lại trang; bài có `reviewed_at` mới hơn mốc đã xem (lưu trong `localStorage` theo username) thì có một dòng thông báo "Có kết quả chấm: …" |
| `kho-da-nap` | `kho.js`, sau khi tải xong số liệu và vài project mỗi level | `chu-thich-video.js` vẽ dòng chú thích, `ba-buoc.js` vẽ hình minh hoạ của ba bước, `giang-vien.js` giữ lại danh sách track để vẽ hàng track của từng giảng viên, `keu-goi.js` giữ lại số liệu kho để vẽ mục kêu gọi sau khi tiến độ cũng đã về, đều từ chính dữ liệu ấy, không gọi lại những lượt vừa gọi |

## 4. Mỗi phần giao diện gọi endpoint nào

Giao diện dùng 20 trong số 24 endpoint của backend.

| Phần giao diện | Endpoint |
|---|---|
| Số liệu ở phần mở đầu, mục lục sáu level, thẻ lọc của trang kho project, cột số liệu ở chân trang của cả hai trang | `GET /stats`, một lượt cho cả trang khi lượt đầu thành công: `api.js` giữ lại lời hứa của lượt gọi đầu; lượt đầu (của ô tìm, gọi trước khi khôi phục phiên) lỗi thì bỏ lời hứa, nên chân trang và kho, vẫn chung một lượt, gọi lại lần hai |
| Vài project mỗi level ở trang chủ, và danh sách đầy đủ ở trang kho project | `GET /projects` |
| Nút chọn giúp một project | `GET /projects/random`; chưa đăng nhập thì gửi `level=0&level=1`, đã đăng nhập thì gửi kèm token để backend chỉ chọn project vừa sức (chưa xong, đã mở khoá, không cao quá một level); trúng lại project vừa chọn thì gọi thêm một lần |
| Bảng chi tiết project, và danh sách sản phẩm phải nộp trong hình minh hoạ bước hai của ba bước | `GET /projects/{slug}` |
| Gợi ý mở dần theo tầng | `GET /projects/{slug}/hints` |
| Nộp bài | `POST /projects/{slug}/submissions` |
| Hộp đăng nhập và đăng ký | `POST /auth/login`, `POST /auth/register` |
| Khôi phục phiên khi mở lại trang | `GET /auth/me` |
| Bảng tài khoản, và mục kêu gọi cuối trang chủ khi đã đăng nhập | `GET /me/progress`, `GET /me/submissions`, `GET /me/recommendations`; mục kêu gọi đọc lại ba phản hồi này từ `tai-khoan.js`, không gọi thêm |
| Lộ trình nghề nghiệp | `GET /roadmaps` khi mở trang; `GET /roadmaps/{slug}` cho cả ba lộ trình, một lượt, khi mục sắp cuộn tới |
| Mục giảng viên phụ trách | `GET /mentors`; track, người phụ trách và số project của từng track lấy từ `GET /stats` qua sự kiện `kho-da-nap` |
| Ảnh đại diện trong bảng tài khoản | `PUT /me/avatar`, `DELETE /me/avatar` |
| Bảng xếp hạng | `GET /leaderboard` |
| Bảng chấm bài | `GET /submissions`, `PATCH /submissions/{submission_id}/review` |

Bốn endpoint còn lại chưa được dùng, mỗi cái vì một lý do khác nhau.
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

### Biểu tượng là một bộ ký hiệu SVG đặt ở đầu trang

Mọi biểu tượng, gồm dấu tích, dấu đóng, mũi tên, kính lúp, dấu
mở liên kết ngoài, dấu cảnh báo, bốn biểu tượng badge, và các biểu tượng của từng
mục trong bảng chi tiết project (tài liệu, mục tiêu, thẻ skill, tầng gợi ý, nộp
bài, người, nguồn dữ liệu, ổ khoá, đồng hồ), nằm trong một thẻ
`<svg>` ẩn ở đầu thân trang, mỗi biểu tượng là một `<symbol>`. Bốn biểu tượng
badge ứng với bốn loại điều kiện cấp badge; hàm `bieuTuongBadge` trong
`js/tai-khoan.js` chọn biểu tượng theo slug của badge, nên ký tự emoji mà backend
lưu cho mỗi badge không còn hiện trên giao diện. Chỗ nào cần thì đặt `<svg class="bt"><use href="#bt-tich"/></svg>`,
hoặc gọi hàm `bieuTuong('tich')` trong JavaScript. Nhờ vậy cả trang dùng chung
một nét vẽ 1,75 điểm ảnh và biểu tượng tự lấy cỡ theo chữ nơi nó đứng. Không
dùng ký tự unicode như ✓ hay → thay cho biểu tượng, vì mỗi phông chữ vẽ những
ký tự đó một kiểu và chúng không cùng nét với nhau.

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
| Đăng ký | `loiCuaMauDangKy` trong `js/hop-tai-khoan.js` | ô còn trống được báo là trống ("Cần nhập thư điện tử.") và mọi ô trống cùng được đánh dấu, không chỉ ô đầu; thư điện tử đúng dạng tên@miền.đuôi (cùng mức khắt khe với backend, để "a@b" không lọt qua rồi nhận câu tiếng Anh của backend), username đúng tập ký tự, mật khẩu từ 8 đến 64 ký tự và không quá 72 byte; trả về cả tên ô sai để ô đó được đánh dấu và nhận tiêu điểm |
| Nộp bài | `loiCuaDuongDan` trong `js/project.js` | đường dẫn đầy đủ, chỉ nhận http và https, không quá 512 ký tự; ô sai được đánh dấu `aria-invalid`, nối với câu lỗi qua `aria-describedby` và nhận tiêu điểm, như biểu mẫu đăng ký |
| Chấm bài | `docKetQua` trong `js/cham-bai.js` | phải chọn một kết quả; điểm là đúng một tới ba chữ số từ 0 tới 100 hoặc để trống (ô số nhận cả "1e2" và "1.0", nên không dựa vào `Number()`); kết quả cần sửa lại hay chưa đạt phải kèm nhận xét, backend cũng từ chối nếu thiếu |

Trường hợp hay gặp nhất là trình duyệt tự điền thư điện tử vào ô username, nên ô
đó đặt `autocomplete="off"`, có chữ gợi ý dạng `ví dụ: sinhvien01`, và câu chú dẫn
nói thẳng rằng thư điện tử không dùng làm username được. Chữ gợi ý cố ý chọn một
tên chung chung: một chữ gợi ý trông giống tên người thật dễ bị đọc nhầm thành
tài khoản đang đăng nhập, chứ không phải một ô còn trống. Username cũng được hạ chữ
thường trước khi gửi, giống hệt việc backend làm, để người gõ chữ hoa không bị
báo lỗi oan.

Giới hạn 512 ký tự của đường dẫn và khoảng 0 tới 100 của điểm lấy đúng theo ràng
buộc của backend. Danh sách đầy đủ nằm ở mục 10 của
[`../backend/README.md`](../backend/README.md).

### Hộp tài khoản là một tấm thẻ xem trước

Hộp đăng nhập và đăng ký nằm trong `js/hop-tai-khoan.js`, dùng chung cho hai
trang. Trên màn hình từ 760 điểm ảnh, hộp chia hai nửa. Nửa phải là tiêu đề, hai
nút chọn chế độ và biểu mẫu. Nửa trái mang trọn dải chuyển dọc của mẫu slide,
xanh chàm ở mép trên xuống xanh da trời ở đáy như tấm bên trái của trang 6 trong
mẫu, cùng một lớp rất mờ (16%) ảnh chờ của khung video (lớp này tắt hẳn ở chế
độ tương phản cao, vì trình duyệt giữ ảnh nền `url()` ở chế độ ấy), trên đó là
một tấm thẻ trắng vẽ đúng thứ người dùng sắp có:

| Tình huống | Tấm thẻ |
|---|---|
| Đăng nhập | số project, level, track, skill và số project của từng level, lấy từ `/stats` |
| Đăng ký | điền dần theo họ tên và username đang gõ, username chỉ hiện khi đúng quy tắc; chữ cái đầu cùng kiểu với thẻ ở đầu trang; level đầu tiên của `/stats` tô đặc trên hàng ga, dòng chân "Tài khoản mới bắt đầu từ level 0, Nhập môn." |
| Mở từ nút đăng nhập trong bảng project | tên project, level của nó trên hàng ga, số điểm tích luỹ khi bài đạt |

Nửa trái chỉ có tấm thẻ, không kèm danh sách lợi ích của tài khoản hay đoạn chữ
nào khác; xem mục "Trang không có đoạn chữ giải thích cách dùng" bên dưới.

Mọi con số trên thẻ lấy từ API, số và đơn vị nối bằng dấu cách không ngắt dòng.
`/stats` lỗi thì thẻ không vẽ hàng ga và bỏ mọi dòng cần `/stats`: thẻ đăng nhập
chỉ còn câu "Project xếp theo level, từ dễ đến khó", thẻ đăng ký chỉ còn tên, thẻ
project còn tên, level và điểm tích luỹ lấy từ chính project.

Tấm thẻ nằm trong một khối bọc căn giữa nửa trái theo chiều dọc. Mẫu đăng ký cao
hơn mẫu đăng nhập khoảng 250 điểm ảnh; neo khối ở mép trên thì phần cao thêm dồn
thành một khoảng trống dưới đáy nửa trái, căn giữa thì chia đều lên trên và xuống
dưới. Mỗi khi nửa trái đổi chiều cao, `truotKhoiThe` (gọi từ một `ResizeObserver`)
cho khối trượt từ chỗ cũ tới chỗ mới trong 320 mili giây thay vì nhảy; người bật
giảm chuyển động thấy khối đứng ngay ở chỗ mới. Chuyển động gắn vào khối bọc chứ
không vào tấm thẻ, vì tấm thẻ có hoạt ảnh hiện dần riêng mỗi lần đổi mặt. Từ 780
điểm ảnh trở lên, tấm thẻ đăng nhập và tấm thẻ đăng ký cao bằng nhau, 219 điểm ảnh,
nên khi đổi chế độ chỉ vị trí của khối đổi; từ 760 tới 779, dòng số liệu của thẻ
đăng nhập xuống hai dòng và thẻ ấy cao hơn 23 điểm ảnh.

Tiêu đề nhìn thấy chỉ đổi theo chế độ: "Đăng nhập tài khoản" hay "Tạo tài khoản
mới". Mở từ bảng project thì tên và level của project đi vào tiêu đề qua một vế ẩn
dành cho trình đọc màn hình: "Đăng nhập tài khoản để nộp bài cho project “…”, level
0, Nhập môn." Tên project dài mà hiện ra thì tiêu đề thêm dòng và hai nút chọn chế
độ nhảy mỗi lần đổi chế độ.

Hộp neo mép trên chứ không căn giữa, để hai nút chọn chế độ đứng yên khi mẫu đăng
ký làm hộp cao thêm. Mép trên đứng ngay dưới đầu trang khi phần màn hình bên dưới
còn đủ chỗ cho mẫu đăng nhập; màn hình quá thấp thì hộp nhích lên, tối thiểu cách
mép 16 điểm ảnh. Hẹp hơn 760 điểm ảnh, nửa trái thu thành một dải chỉ còn dòng đầu
của thẻ, cao như nhau ở mọi chế độ; hẹp hơn 760 mà thấp hơn 500 điểm ảnh, như điện
thoại xoay ngang hay trang phóng to 200 tới 400 phần trăm, thì dải này ẩn đi để
nhường chỗ cho biểu mẫu. Từ 560 trở xuống, hộp thành tấm trượt lên từ đáy màn hình,
rộng hết bề ngang và cao cố định tới ngay dưới đầu trang ở cả hai chế độ, mẫu dài
hơn thì cuộn bên trong; màn hình điện thoại thấp hơn 600 điểm ảnh thì tấm phủ kín.
Mẫu ngắn hơn tấm thì nút gửi nằm sát đáy tấm, khối ghi nhớ đi liền phía trên
nút; câu báo lỗi ở ngay dưới ô mật khẩu ở cả hai mẫu, trong phần bàn phím ảo
không che, và được cuộn vào tầm nhìn khi hiện.

Phần biểu mẫu:

| Việc | Cách làm |
|---|---|
| Hai nút chọn chế độ | mẫu tabs của WAI-ARIA APG: mũi tên, Home, End đổi chế độ và giữ tiêu điểm trên nút; bấm chuột hay bấm lối "Chưa có tài khoản? Tạo tài khoản" thì tiêu điểm vào ô trống đầu tiên |
| Mang chữ sang chế độ kia | sang đăng ký: định danh có @ điền vào ô thư điện tử, định danh đúng mẫu username điền vào ô username; sang đăng nhập: thư điện tử có @, không thì username đúng quy tắc, điền vào ô định danh. Chỉ điền khi ô đích còn trống. Công tắc ghi nhớ đi theo cả hai chiều |
| Câu nhắc sống | username: đúng quy tắc, có @ (kèm gợi ý phần trước @ nếu dùng được), ký tự không nhận, báo trước chữ hoa sẽ lưu thành chữ thường; mật khẩu: "N/64 ký tự", báo lỗi khi quá 64 ký tự (trình quản lý mật khẩu vượt qua được `maxlength`), số chỗ trên 72 khi có chữ có dấu. Câu "chưa đủ dài" chỉ đỏ sau khi rời ô. Câu nhắc dài thêm dòng lúc gõ thì vùng cuộn đi theo |
| Mật khẩu | nút hiện mật khẩu trong ô theo mẫu nút bật tắt của APG: nhãn luôn là "Hiện mật khẩu", trạng thái nằm ở `aria-pressed`, biểu tượng đổi theo. Con trỏ giữ nguyên chỗ khi đổi kiểu ô, trừ khi người dùng đã gõ thêm trong khung hình đó, như nhấn Enter rồi gõ tiếp ngay. Mật khẩu được che lại trước khi gửi. Câu báo Caps Lock đọc từ `getModifierState` |
| Gửi mẫu đăng ký sai | câu lỗi hiện ở vùng `role="alert"`, ô sai nhận tiêu điểm; ô thư điện tử mang `aria-invalid` tới khi được gõ lại |
| Đang gửi | nút đổi chữ thành "Đang đăng nhập…" hay "Đang tạo tài khoản…", mang `aria-busy` và `aria-disabled` chứ không `disabled`: khoá hẳn nút đang có tiêu điểm thì tiêu điểm rơi ra ngoài hộp. Gửi thêm lần nữa trong lúc chờ bị bỏ qua. Câu lỗi của API hiện nguyên văn kèm biểu tượng |
| Đóng hộp lúc đang chờ | mỗi lần mở hộp là một lượt, đếm bằng `tt.lanMo`. Trả lời muộn của lượt trước vẫn lưu phiên nếu đăng nhập được, nhưng không đổi nút, không hiện câu lỗi, không đóng hay dọn mẫu của lượt đang mở |
| Sau khi vào | hộp đóng lại trả tiêu điểm về nút đã mở nó, rồi chính nút đó bị vẽ lại. `veKhuTaiKhoan` trong `js/tai-khoan.js` và `veLaiBangDangMo` trong `js/project.js` giữ tiêu điểm khi vẽ lại phần đang chứa nó: mở từ đầu trang thì tiêu điểm sang thẻ người dùng, mở từ bảng project thì vào điều khiển đầu tiên của phần nộp bài. Đăng xuất cũng vậy, tiêu điểm sang nút "Đăng nhập" mới |
| Ghi nhớ | ô đánh dấu tên `ghi_nho` mang vai trò `switch`, kèm một câu giải thích |

Mỗi lần mở, hộp dọn sạch chữ đã gõ, câu nhắc, nút còn đang báo bận, ô bị đánh dấu
sai, mật khẩu đang hiện, câu Caps Lock và project của lần mở trước.

Về trợ năng: hộp gắn `aria-labelledby` vào tiêu đề đang hiện; tấm thẻ chỉ lặp lại
điều đã có ở nửa phải nên đặt `aria-hidden`, người dùng trình đọc màn hình không
phải nghe lại từng chữ vừa gõ, còn tên và level của project được đọc qua vế ẩn
trong tiêu đề. Câu nhắc nối vào ô bằng `aria-describedby` và nói trạng thái bằng biểu
tượng cùng chữ, ô sai mang `aria-invalid`. Vùng báo Caps Lock là `role="status"`,
chỉ ghi lại khi trạng thái đổi. Nhấn Tab tới một ô sát mép dưới vùng cuộn thì
`scroll-margin-block` chừa chỗ cho vòng tiêu điểm và câu nhắc hai dòng bên dưới ô.
Người bật giảm chuyển động không thấy vạch, núm công tắc hay khối thẻ trượt, thẻ
chỉ mờ dần. Ở chế độ tương phản cao, vạch dưới nút đang chọn và công tắc vẽ bằng
màu hệ thống, nút gửi có viền, ô nhập đang có tiêu điểm có viền ngoài hai điểm ảnh
(ở chế độ thường viền ngoài ấy trong suốt). Ô nhập chữ cỡ 17 điểm ảnh để Safari
trên iPhone không phóng to trang.

Tương phản đo trên điểm ảnh nét chữ thật của 36 kiểu chữ và vị trí chữ trong hộp:
ở 1440 cả hai chế độ và ngữ cảnh project, và dải thẻ ở 600 và 390. Không còn chữ
nào đứng thẳng trên dải chuyển, mọi chữ nằm trên nền trắng của hộp hay của thẻ.
Thấp nhất 5,32:1, là chữ xám phụ trên nền trắng như nút "Đóng" và câu dưới công tắc
ghi nhớ. Viền điều khiển thấp nhất là viền ô nhập và rãnh công tắc, 3,40:1; vạch
dưới nút chế độ đang chọn và vòng tiêu điểm 5,33:1.

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
Ô tìm đầu trang đợi 250 mili giây kể từ phím cuối cùng rồi mới gọi (ô lọc của
trang kho chờ 300), nên một từ khoá chỉ tốn một lượt.

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

### Giao diện không viết cứng đường dẫn gốc

Nền tảng chạy được ở hai chỗ: ngay tại gốc tên miền khi phát triển, và dưới một
tiền tố khi đứng sau máy chủ trung gian, ví dụ `https://ptitai.org/projects/`.
Nếu viết cứng dấu gạch chéo đầu vào mọi đường dẫn thì bản chạy dưới tiền tố sẽ
gọi nhầm ra gốc tên miền và hỏng hết.

Module `js/goc.js` suy ra gốc từ chính địa chỉ của nó, không lấy từ một biến cấu
hình nào:

```javascript
export const GOC = new URL('../', import.meta.url).pathname;
```

Trình duyệt đặt địa chỉ đầy đủ của mỗi module vào `import.meta.url`, mà tệp này
nằm trong thư mục `js` ngay dưới gốc, nên lùi lại một cấp là ra gốc. Cách này
không cần khai báo gì và không thể lệch với nơi tệp thật sự nằm.

Ba chỗ dùng tới nó:

| Chỗ dùng | Đường dẫn được dựng |
|---|---|
| `js/api.js` | gốc của API |
| `js/giao-dien.js` | đường dẫn tới ảnh đại diện |
| `js/kho.js` | liên kết từ trang chủ sang trang kho project |

Hai trang HTML thì dùng đường dẫn tương đối: `./` trỏ về trang chủ, `kho.html`
trỏ sang trang kho project. Đường dẫn tương đối chỉ giải đúng khi địa chỉ của
trang chủ kết thúc bằng dấu gạch chéo, nên backend chuyển `/index.html` về `./`
và nginx chuyển `/projects` về `/projects/`.

### Phiên đăng nhập mặc định chỉ sống trong một thẻ

Token được lưu dưới khoá `nen-tang-project:token`, nhưng nằm ở kho nào là do
người dùng quyết định qua công tắc "Ghi nhớ đăng nhập trên máy này" ở cuối cả hai
biểu mẫu đăng nhập và đăng ký.

| Công tắc | Kho lưu | Phiên sống tới khi nào |
|---|---|---|
| tắt, mặc định | `sessionStorage` | đóng thẻ trình duyệt là hết |
| bật | `localStorage` | qua cả những lần tắt trình duyệt, tối đa 7 ngày theo hạn của token |

Mặc định là không ghi nhớ, vì phần lớn người học mở nền tảng trên máy phòng thực
hành hoặc máy dùng chung. Một phiên còn nguyên sau khi họ đứng dậy khỏi máy là
điều không nên có, và người dùng cũng khó hiểu vì sao mở trang lên đã thấy mình
đăng nhập sẵn mà không nhớ đã làm việc đó lúc nào.

Hàm `dat` trong `js/api.js` ghi token vào một kho thì đồng thời dọn kho còn lại,
nên hai token của hai lần đăng nhập khác nhau không bao giờ cùng tồn tại rồi
tranh nhau lúc mở trang. Lúc khôi phục phiên, kho của thẻ được đọc trước vì nó
mới hơn kho lâu dài.

Việc đồng bộ phiên giữa các thẻ đang mở chỉ áp dụng cho phiên có bật công tắc ghi nhớ,
vì sự kiện `storage` của trình duyệt chỉ bắn cho `localStorage`. Đó là điều đúng:
một phiên vốn chỉ sống trong một thẻ thì không có lý do gì lan sang thẻ bên cạnh.

### Có token rồi vẫn hỏi lại backend

Chỉ có token thì chưa đủ, vì nó có thể đã hết hạn, nên lúc mở trang giao diện gọi
`GET /auth/me` một lần: gọi được thì mới coi là đã đăng nhập.

Token chỉ bị xoá khi backend trả về lỗi 401, tức là chính backend nói token
không dùng được nữa. Máy chủ tạm thời không gọi được thì token vẫn nằm nguyên
trong máy, để lần mở trang sau người dùng còn vào lại được mà không phải gõ mật
khẩu. Khi một lệnh gọi đang đăng nhập nhận về lỗi 401, giao diện báo một câu
ngắn rồi đưa cả trang về trạng thái chưa đăng nhập, thay vì tiếp tục hiển thị
tên người dùng trong khi mọi thứ đã hỏng. Câu báo ở cả dòng thông báo lẫn trong
thẻ đang thao tác là câu của giao diện, "Phiên đăng nhập đã hết hạn. Đăng nhập
lại rồi tiếp tục.", không phải câu kỹ thuật nói về token của backend.

### Giấu nút chỉ để đỡ rối mắt, không phải để phân quyền

Nút mở bảng chấm bài chỉ hiện với tài khoản giảng viên. Phần chặn thật nằm ở
backend: `GET /submissions` và `PATCH /submissions/{submission_id}/review` trả về lỗi 403
cho mọi tài khoản không có quyền giảng viên, bất kể giao diện hiển thị gì.

### Đầu trang là thanh công cụ có ô tìm ở giữa

Đầu trang của cả hai trang xếp ba cụm trên một hàng: tên ba đơn vị bên trái, ô
tìm project ở giữa, thanh điều hướng cùng khu tài khoản bên phải. Hai cụm hai
bên cùng giãn `flex: 1 1 0` và không co dưới bề ngang tự nhiên, nên ô tìm đứng
đúng trục giữa trang mỗi khi hai bên còn đủ chỗ, và lệch dần sang bên hẹp hơn
khi một bên cần nhiều chỗ.

Ba cụm cần nhiều chỗ hơn cột nội dung 1084 điểm ảnh: khi giảng viên đăng nhập,
riêng tên đơn vị, thanh điều hướng và khu tài khoản đã gần kín cột đó. Vì vậy
đầu trang không đứng trong cột nội dung mà trải theo bề ngang màn hình như thanh
công cụ của một ứng dụng, chỉ chặn ở 1600 điểm ảnh (`.khung-dau`).

Ô tìm là một biểu mẫu GET gửi sang `kho.html?q=...`, nên không có JavaScript thì
gõ rồi nhấn Enter vẫn ra trang kho đã lọc. `js/o-tim.js` làm phần còn lại theo
mẫu combobox có hộp gợi ý dạng danh sách của WAI-ARIA APG:

| Việc | Cách làm |
|---|---|
| Câu gợi ý trong ô | "Tìm trong N project", N đọc từ `/stats`; API chưa trả lời hay lỗi thì ô chỉ ghi "Tìm project" |
| Phím tắt | phím `/` ở bất cứ đâu, trừ khi đang gõ vào một ô khác, đang mở bảng trượt hay hộp đăng nhập; ô trống và chưa có tiêu điểm thì hiện một phím nhỏ in dấu `/`, chỉ trên thiết bị có con trỏ |
| Ô còn trống | hộp hiện sáu level xếp thành tuyến dọc nhỏ, cùng dạng ga đánh số với tuyến sáu ga; chọn một level là sang `kho.html?level=...` |
| Gõ từ khoá | chờ 250 ms sau phím cuối rồi gọi `/projects?q=...&page_size=5`; hộp hiện tối đa năm project với tên, level, track, số giờ, nhãn trạng thái bài nộp nếu đã đăng nhập, và dòng cuối "Xem cả N project khớp trong kho" |
| Phần khớp | tô đậm theo đúng cách backend so khớp, tức chữ thường không dấu; từ khoá chỉ có trong tóm tắt thì thêm một dòng trích quanh chỗ khớp |
| Bàn phím | mũi tên lên xuống trỏ dòng qua `aria-activedescendant`, tiêu điểm luôn ở ô nhập; Enter trên một project mở bảng chi tiết, Enter khi chưa trỏ dòng nào sang `kho.html?q=...`; Esc lần lượt đóng hộp, xoá chữ, đóng lớp phủ |
| Trạng thái | đang tìm (chỉ hiện khi lượt gọi chậm hơn 120 ms, để không chớp), không có kết quả kèm lối sang kho, lỗi mạng bằng chữ đỏ và biểu tượng; phản hồi về muộn của lượt cũ bị bỏ |

Không có một ngưỡng bề ngang cố định nào đúng cho mọi trường hợp, vì khu tài
khoản rộng hẹp theo vai và độ dài tên, còn thanh điều hướng của trang chủ dài hơn
của trang kho. Hàm `doChoTrong` đo thẳng tên đơn vị, thanh điều hướng và khu tài
khoản, rồi chọn một trong ba cách xếp: một hàng với ô tìm rộng ít nhất 236 điểm
ảnh; một hàng với ô tìm thu thành nút biểu tượng (lớp `tim-gon`); hoặc thanh điều
hướng xuống hàng riêng (lớp `hai-hang`), khi đó hàng trên có thể lại đủ chỗ cho ô
tìm đầy đủ. Ba khối được đo không co giãn, nên đổi cách xếp không làm chúng đổi bề
ngang và phép đo không tự dao động. Bấm nút biểu tượng hay nhấn `/` thì ô tìm phủ
lên cả đầu trang, kèm nút Đóng. Không có JavaScript thì nút biểu tượng là một liên
kết sang trang kho.

Chật hơn nữa thì từng thứ lần lượt nhường chỗ, theo thứ tự từ ít tiếc nhất tới
tiếc nhất. Dưới 900 điểm ảnh, dòng số liệu trong thẻ người dùng biến mất và tên
Trung tâm bớt một cỡ chữ. Dưới 860, hai dòng phụ được giấu khỏi mắt nhưng vẫn
nằm trong cây trợ năng, nên trình đọc màn hình còn đọc đủ tên ba đơn vị. Dưới
810, hai logo phụ ẩn đi và tên Trung tâm xuống hai dòng. Dưới 640, hàng trên là
tên, nút tìm và khu tài khoản, hàng dưới là thanh điều hướng; nút "Đăng xuất" ở
đầu trang ẩn đi vì chỉ cách ô tài khoản 6 điểm ảnh, và bảng tài khoản có nút của
riêng nó ở cuối. Dưới 480, thẻ người dùng chỉ còn ảnh hoặc chữ cái đầu, tên vẫn
nằm trong nút cho trình đọc màn hình.

Tài khoản giảng viên là người chấm, không phải người học: thẻ ghi "Giảng viên"
thay cho số project và điểm, nút "Chấm bài" ghi kèm số bài đang chờ, và bảng tài
khoản của họ thay lưới số liệu học viên cùng phần đề xuất bằng số bài đang chờ
chấm. Bảng tài khoản của người học có thêm ô "bài cần sửa lại", đếm theo project.

Dòng project ở bề ngang dưới 860 điểm ảnh xếp thành hai dòng: tên, rồi level ·
track · giờ cỡ chữ nhỏ bên dưới (khối `.hang-meta`, tan vào lưới ở bề ngang
thường), chữ "Xem chi tiết" nhường chỗ cho mũi tên. Ô đầu mỗi dòng mang nhãn
trạng thái (`role="img"` và `title`): chưa đăng nhập, chưa làm, chờ chấm, cần
sửa lại, chưa đạt, đã đạt, hoặc còn khoá kèm tên project tiên quyết, khi ấy ô
mang biểu tượng khoá; danh sách của backend kèm sẵn tiên quyết nên không phải mở
chi tiết. Trang kho dưới 640 gấp chip level, chip track và ô giờ vào một dòng
"Bộ lọc" có số điều kiện đang chọn, mở sẵn khi đang lọc; tới trang bằng liên kết
đã lọc sẵn thì cuộn tới dòng đếm kết quả, và dòng ấy có `scroll-margin-top` bằng
chiều cao đầu trang dính để chạm số trang không bị che.

### Bảng trượt và hộp thoại ghi mốc lịch sử

Trên điện thoại, nút Back là cách đóng tự nhiên nhất, và không có mốc lịch sử thì
nó thoát hẳn khỏi trang. `ghiMocMo` và `xoaMocMo` trong `js/giao-dien.js` giữ
một chồng các lớp đang mở (bảng trượt, hộp đăng nhập, hộp video): mở một lớp là
`history.pushState` cùng địa chỉ với khoá `lopMo`, Back lấy mốc đi và lớp trên
cùng đóng lại; đóng bằng cách khác (Escape, nút Đóng, bấm ra nền) thì lùi lịch
sử một bước và bỏ qua sự kiện `popstate` do chính mình gây ra. Đổi từ bảng này
sang bảng khác không thêm mốc. Trang kho ghi bộ lọc vào lịch sử cùng địa chỉ, nên
trình nghe `popstate` của nó bỏ qua những lượt mà chuỗi truy vấn không đổi.

Mở một project từ bảng tài khoản hay bảng chấm bài rồi đóng bảng project thì bảng
kia mở lại đúng vị trí cuộn cũ, thay vì mất hẳn; phiên kết thúc thì ý định mở
lại này bị bỏ.

### Bảng trượt khoá phần trang phía sau

Ba bảng trượt là hộp thoại theo đúng nghĩa trợ năng: `role="dialog"`,
`aria-modal="true"`, và tên lấy từ tiêu đề `h2` của bảng qua `aria-labelledby`;
bảng project ghép thêm tên project vào tên đó khi nội dung đã vẽ xong. Hai trang
cũng có một mốc `main` bao trọn phần nội dung giữa đầu trang và chân trang, và
một liên kết "Bỏ qua tới nội dung" chỉ hiện khi nhận tiêu điểm bàn phím.

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
Phần tử ấy có thể đã bị thay: khu tài khoản được vẽ lại mỗi lần tải tiến độ, ngay
sau khi bảng tài khoản mở ra. Khi đó tiêu điểm về nút chính của khu tài khoản
mới, chứ không rơi ra `body`.

### Bảng chi tiết project mở đầu bằng một dải xanh

Đầu bảng là một dải xanh chàm chạy sát mép bảng, cùng cách làm với các dải xanh
của trang chủ: hàng nhãn level và nút Đóng có sẵn trong HTML, rồi tới khối do
`js/project.js` vẽ gồm tuyến sáu level thu nhỏ với ga của project được tô, tên
project và ba thẻ track, giờ, điểm tích luỹ mang biểu tượng của chính khái niệm
ấy. Hai phần chung một màu xanh chàm đặc nên nối liền không thấy mối; lớp ảnh mờ
màn hình mã lệnh chỉ nằm ở khối dưới và mờ dần lên trên. Tuyến level lấy danh
sách level từ số liệu tổng quan mà `js/api.js` đã giữ sẵn sau lượt gọi đầu,
không gọi thêm; số liệu ấy lỗi thì bảng bỏ tuyến, không đoán số level. Đo trên
điểm ảnh nét chữ: chữ trắng trên dải 5,33:1, tên project trên chỗ có ảnh mờ thấp
nhất 4,64:1, nhãn level 4,60:1.

Mỗi mục bên dưới là một `<h4>` có biểu tượng. Sản phẩm phải nộp là hàng ô đánh
dấu cùng ô với hình bước hai của mục Ba bước: ô trống viền xám, project đã hoàn
thành thì ô tích xanh. Thử thách nâng cao dùng ngôi sao của badge điểm. Project
tiên quyết vẽ thành một tuyến ngắn, mỗi project một ga là nút mở project đó, ga
cuối là chính project đang xem; ga đã hoàn thành có chấm xanh lá, đường vẽ dần
khi bảng hiện. Ba tầng gợi ý hiện sẵn dạng khoá với vạch giữ chỗ, mở tới đâu hàng
ấy thay bằng nội dung, nên còn bao nhiêu tầng thấy ngay từ đầu; backend không có
tầng nào thì các hàng khoá còn lại bỏ đi. Các mục hiện lần lượt từ trên xuống mỗi
lần bảng vẽ, cách nhau 40 mili giây; bật giảm chuyển động thì hiện ngay. Tương
phản cao: dải có viền dưới, ga và ô đánh dấu vẽ bằng màu hệ thống, ảnh mờ tắt.

### Bài nộp gõ dở được giữ lại

Nhận xét đang gõ ở bảng chấm bài cũng vậy: `js/cham-bai.js` ghi kết quả, điểm và
nhận xét của từng thẻ vào `sessionStorage` theo mã bài nộp mỗi lần gõ, điền lại
khi bảng vẽ lại và xoá khi chấm xong. Phiên hết hạn giữa chừng thì bảng đóng,
người chấm đăng nhập lại, mở lại bảng và thấy nguyên nhận xét.

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

Thoát theo cách nào cũng dọn như nhau: hàm `donSauThoat` trong `js/tai-khoan.js`
đóng bảng tài khoản hay bảng chấm bài nếu đang mở và xoá nội dung của cả hai, và
được gọi ở cả ba lối ra, bấm "Đăng xuất", đăng xuất ở thẻ khác, và backend từ chối
token giữa chừng. Không có bước này thì thẻ kia vẫn hiện tên, thư điện tử và hàng
đợi chấm bài của người vừa rời đi.

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
không có hai bài của cùng một project. Bài bị trả về hay chưa đạt thì hai ô đường
dẫn điền sẵn từ bài trước còn ghi chú để trống, nút ghi "Nộp lại". Các trường
hợp còn lại thì mở biểu mẫu trống với nút "Nộp bài".

Phần bài nộp liệt kê bài tiêu biểu trước, rồi mọi lần chấm trước đó của cùng
project với nhãn "Lần chấm trước", mốc thời gian, điểm và nhận xét
(`lichSuBaiNopCua` trong `js/tien-do.js`). Nộp lại sau "Cần sửa lại" thì nhận xét
của người chấm vẫn còn đó trong lúc chờ. Dòng "Bài nộp gần đây" của bảng tài
khoản mang mã bài nộp, bấm vào thì bảng project cuộn tới đúng bài ấy. Project
còn khoá có một dòng báo ngay dưới dải xanh, mỗi tên project tiên quyết là một
nút mở project đó; mở project tiên quyết từ trong bảng thì bảng mới có nút "Quay
lại" project vừa xem.

### Trang không có đoạn chữ giải thích cách dùng

Người vào nền tảng đã biết mình đến để chọn project, làm và nộp bài, nên trang
không có câu dẫn giới thiệu mục, đoạn tả từng bước, danh sách lợi ích của tài khoản
hay câu nói một phần hoạt động ra sao. Chữ còn lại trên trang thuộc một trong mấy
loại: tiêu đề và nhãn; quy tắc của ô nhập, như câu nhắc username và mật khẩu; câu
báo trạng thái, như đang tải, trống, lỗi, chưa đăng nhập hay project chưa mở khoá;
câu cảnh báo có hệ quả, như câu dưới công tắc ghi nhớ đăng nhập; câu số liệu ghép từ
con số của API; nội dung lấy từ backend; và đoạn tả video hướng dẫn, chỉ trình đọc
màn hình đọc được, thay cho hình ảnh của video không tiếng. Câu trạng thái chỉ nói trạng thái, không
kèm lời giải thích cách phần đó chọn dữ liệu: bảng tài khoản ghi "Chưa có badge nào."
chứ không kể thêm bốn điều kiện cấp badge.

## 6. Bảng màu, chữ, bố cục và chuyển động

Giao diện đi theo chuẩn chung của các nền tảng học tập có bài tập được chấm, lấy
Exercism và Linear làm mốc cho phần danh sách, Coursera cho vẻ trang trọng của
một cơ sở đào tạo, Kaggle cho bảng xếp hạng. Mẫu số chung của cả bốn là nền
trắng, một màu nhấn, danh sách dày mà dễ đọc, số xếp thẳng cột. Trên nền đó,
sáu level được nối thành một tuyến chạy xuyên suốt trang, và tuyến này là mô típ
bố cục lẫn chuyển động duy nhất được dựng chủ ý. Phần mở đầu có một khung video
dòng lệnh đang chạy, mô tả ở mục riêng bên dưới.

### Màu

Màu đặt trong `:root` của `css/style.css` và lấy từ mẫu slide của Trung tâm Đào
tạo chuyên sâu AI, tệp `[PTIT-CAAITE] TEMPLATE TÀI LIỆU`. Đo trên ảnh dựng của
bảy trang mẫu thì có hai màu chính đi cùng nhau thành một dải chuyển dọc: xanh
chàm `#5154F5` ở mép trên và xanh da trời `#3CA7DE` ở mép dưới, qua ba mốc cách
đều `#4C69EF`, `#467EE9`, `#4192E4`; các ô nội dung của trang sáng dùng một màu
xám nhạt `#F2F4F6`. Trang web lấy đúng dải năm mốc ấy (`--truong-doc`) và màu
xám ấy. Xanh chàm là màu nhấn: liên kết, nút, ga trên tuyến, viền tiêu điểm,
vùng chọn chữ; hai sắc kèm theo là xanh chàm đậm `#3B3ED8` cho trạng thái rê
chuột và xanh chàm rất nhạt `#EEEEFE` cho nền nhấn nhẹ. Xám nhạt `#F2F4F6` là nền
2 của trang. Ba trạng thái bài nộp có ba màu riêng, mỗi màu kèm một nền nhạt để
làm nhãn: đạt màu xanh lá `#1B7A4B`, chờ chấm màu vàng đất `#8A5A00`, chưa đạt
và cần sửa lại màu đỏ `#B3261E`.

Màu của Trung tâm không chỉ làm điểm nhấn mà sở hữu hẳn hai vùng, theo cách gọi
của skill thiết kế là chiến lược màu cam kết: phần mở đầu và phần kêu gọi cuối
trang là hai khối xanh chàm, trang mở ra và khép lại bằng màu đó; dải đầu của
trang kho project cũng cùng màu để hai trang nhận ra nhau. Cả trang lặp lại nhịp
của bảy trang mẫu, trang xanh xen trang sáng. Đọc từ trên xuống: phần mở đầu
xanh, Ba bước trắng, Kho project theo level nền sáng kiểu mẫu, Lộ trình trắng,
Bảng xếp hạng nền sáng kiểu mẫu, Giảng viên trắng, Kêu gọi xanh, chân trang
trắng; đầu trang và chân trang luôn trắng.

**Khối xanh.** Mẫu đặt chữ trắng lên mọi chỗ của dải, trang web thì không được:
trắng chỉ đạt 3,9:1 ở mốc giữa và 2,7:1 ở mép dưới, chữ phụ `#ECEDFF` đã xuống
3,9:1 ngay ở mốc thứ hai. Nên dải chỉ lộ ở vùng không có chữ, theo hai cách, và
cả hai đều không tạo mép cắt dọc giữa khối:

| Khối | Cách vẽ | Chỗ dải lộ ra |
|---|---|---|
| Phần mở đầu, mọi bề ngang | chữ trải hết bề ngang (tuyến sáu level chạy suốt khung) nên xanh chàm đặc từ mép trên xuống hết tuyến, rồi dải năm mốc nén vào một dải đáy cao 150 điểm ảnh (`--troi-day`, 120 từ 900 trở xuống) nằm trọn trong lề dưới của khối, xem `--truong-day`; hộp nút của ga cuối tuyến kết thúc 8 điểm ảnh trên đầu dải; khối cao 657 điểm ảnh ở 1440, 600 ở 1024, 916 ở 390 (trước là 563, 493 và 824) | dải đáy, từ mép trái tới mép phải, xanh chàm ở đầu dải xuống xanh da trời ở mép dưới, như mép dưới của trang 2 và 7 |
| Kêu gọi, trên 900 | tấm xanh chàm đặc áp sát mép trái, che cột chữ, mờ dần trong 52 điểm ảnh ngay trước mép trái của thẻ (mép ấy cách mép nội dung 62% bề ngang nội dung, `--le-khung` và `--long-khung`) | cột thẻ, trọn dải từ xanh chàm xuống xanh da trời, thẻ trắng nổi trên đó như ảnh cạnh tấm xanh chàm ở trang 6 |
| Kêu gọi, 900 trở xuống | mảnh ngang che khối chữ, cao 340 (đủ cho tuyến hai dòng nhãn khi đã đăng nhập ở 320), mờ dần tới 400 | quanh và dưới thẻ |
| Dải đầu trang kho, trên 760 | tấm áp sát mép trái, che tới 570 điểm ảnh sau mép nội dung (câu số liệu 66ch đo được 545), mờ dần tới 660 | nửa phải, dải nén vào chiều cao 166 điểm ảnh của dải đầu |
| Dải đầu trang kho, 760 trở xuống | xanh chàm phẳng | không có, câu số liệu chạm mép phải |
| Bục xếp hạng, nửa trái hộp tài khoản | không có tấm che, mọi chữ nằm trên thẻ trắng | trọn khối |

Trước đó phần mở đầu che bằng một tấm dọc rộng bằng khung nội dung, dải chỉ lộ ở
hai lề ngoài: ở 1101 tới 1212 không lộ gì, ở 1280 tới 1440 chỉ còn hai mẩu ở
hai góc dưới, ở 1920 khối đọc như một hộp xanh chàm nổi trên dải; cách nén dải
vào đáy bỏ hẳn ba mức bề ngang và mọi mép dọc. Phần lộ của dải luôn bắt đầu bằng
đúng màu của tấm ở mép trên, nên hai lớp nối vào nhau không thấy vết. Lớp ảnh mờ
của khung video trên bục, mục kêu gọi và hộp tài khoản vẫn còn nhưng tan dần về
đáy (mục kêu gọi) hay giảm còn 16% (hộp tài khoản), để đầu xanh da trời sạch như
ở mẫu; cả ba lớp tắt hẳn ở chế độ tương phản cao.

Đo bằng cách tìm màu nền thật sau từng nét chữ ở 390, 600, 768, 900, 901, 1024,
1100, 1101, 1440 và 1920 điểm ảnh (`do-net-chu-rong.mjs`, 90 phép đo cho tiêu
đề, câu số liệu, nhãn ga đầu và ga cuối của phần mở đầu, nhãn ga và tiêu đề của
mục kêu gọi, tiêu đề và câu số liệu của dải đầu trang kho): mọi nét chữ đều đứng
trên xanh chàm đặc `#5154F5`, chữ trắng 5,33:1, chữ phụ 4,60:1, không nét nào
rơi vào dải. Bộ `kt-nen-template.mjs` còn lấy mẫu màu nền ở các điểm mốc của
từng khối ở 1440, 1024, 768 và 390 và chấm rằng mọi điểm đều nằm trên đường nối
năm mốc của mẫu (lệch tối đa 14 trên thang 255, nơi có lớp ảnh mờ thì 30 tới
40), dưới chữ là xanh chàm đặc, và mỗi khối lộ tới đầu xanh da trời: ở phần mở
đầu, ba điểm đáy (trái, giữa, phải) đo được `#3CA3DE` tới `#3DA4DF`, còn điểm
ngay dưới hộp tuyến, điểm sát mép phải ngang hàng tuyến và hai góc trên đều là
`#5154F5`; nền ở bốn mép quanh hộp của sáu nút ga (chỗ vòng tiêu điểm trắng
đứng) đạt 5,33:1 với trắng ở cả bốn bề ngang, vì nút ga rộng hết cột và vòng
của nó không được rơi vào dải. Ở mục kêu gọi và dải đầu trang kho, góc trên và
góc dưới bên trái đều là `#5154F5`, tấm áp sát mép trái.

Trên khối, chữ chính màu trắng, chữ phụ màu xanh chàm rất nhạt `#ECEDFF` pha từ
chính màu nền chứ không dùng xám, nút chính đảo màu thành nền trắng chữ xanh
chàm, vùng chọn chữ tô xanh chàm đậm. Tuyến sáu level trên khối này vẽ bằng màu
trắng.

**Mục sáng.** Giữa các khối xanh, các mục xen kẽ nền trắng `#FFFFFF` và nền của
trang sáng trong mẫu (trang 1, 4 và 5), dựng bằng các lớp nền chồng nhau trong
biến `--nen-sang`, kể từ dưới lên: giấy gần trắng `#F7F9FE` (`--sang`); một
quầng xanh trời `#7FB6EB` (`--troi-mo`) ở góc trên bên trái, rộng 1100 × 760
điểm ảnh, đặc ở góc, 78% ở bán kính 0,2, 44% ở 0,4, tan hết ở 0,8; một tấm
trắng 85% (`--man-trang`) là một nửa mặt phẳng có mép chéo 128 độ, mép mờ dần
trong 110 điểm ảnh và nằm ngay trước cột chữ (vị trí tính từ lề ngoài khung
`--le-khung-vw`: ở 1440 tấm đặc hẳn từ đường nối điểm cách mép trái 290 trên
mép trên với điểm cách mép trên 370 trên mép trái, ở 390 từ 130 xuống 166), nên quầng trời bị
cắt thành một góc chéo như ở trang 4 của mẫu và phần quầng còn lại dưới tấm chỉ
còn 15% sức; tấm là nửa mặt phẳng chứ không phải một hộp nên không có mép cắt
thẳng nào ở giữa mục (bản trước dùng một hộp 1100 × 640 và để lại một vệt ngang
6/255 ở hàng 640); một quầng xanh ngọc `#B2E8F9` (`--ngoc-mo`) pha lục nhạt
`#C8EFD6` (`--la-mo`) ở góc trên bên phải, 560 × 420, đặt trên tấm trắng; và
logo của Trung tâm làm mờ ở góc trên bên phải, cắt bởi mép (`anh/logo-mo.webp`,
dựng từ `logo-trung-tam-ai.png` phóng lên 720 điểm ảnh, làm nhoè bán kính 5 và
giảm còn 50% độ đục, 40 kB; bản trước nhoè bán kính 10 ở 30% trộn với quầng
ngọc thành xám lục, bản này giữ được xanh chàm và xanh ngọc của chính logo). Ba
màu quầng đo trên ảnh dựng của mẫu. Mục Kho project theo level cao vài màn hình
(3000 điểm ảnh ở 1440) nên có thêm một quầng trời ở góc dưới bên trái
(`--quang-troi-duoi`, 760 × 420, 70% ở góc), chỗ không có chữ vì mục lục dính ở
đầu mục và từ 860 trở xuống góc ấy chỉ có thẻ trắng của level cuối.

Quầng đo bằng điểm ảnh chứ không theo phần trăm, để mục cao 3000 điểm ảnh không
kéo quầng xuống dưới chữ: chữ phụ xám `#646B7E` trên giấy `#F7F9FE` chỉ đạt
4,5:1 khi quầng trời còn dưới 17% và viền điều khiển 3:1 khi quầng còn dưới 10%.
Chữ phụ gần góc quầng nhất là nhãn "Sáu level" của mục lục, cách góc 178 và 158
điểm ảnh ở 1440, 16 và 176 ở 320; nhờ tấm trắng, quầng ở đó chỉ còn khoảng 10%:
đo tại nét chữ ở 23 bề ngang từ 320 tới 1440, nhãn ấy thấp nhất 4,81:1 (ở 320,
nền `#EBF5FB`), ở 1440 là 4,94:1. Vùng danh sách của trang kho, nơi bộ lọc đứng
ngay dưới mép trên và trải hết bề ngang, dùng bản quầng chỉ rộng bằng lề ngoài
khung trên đáy trắng (`--nen-sang-hep`): ở 1440 lề ấy rộng 178 điểm ảnh, ở điện
thoại gần như không còn.

Logo mờ chỉ nằm sau nền, sau tấm trắng đục ("Tiến độ của bạn", thẻ danh sách xếp
hạng, các dòng project) hay sau khối xanh, không bao giờ sau chữ đứng thẳng trên
nền hay sau điều khiển đứng thẳng trên nền; và chỗ nào chỉ lộ được một mẩu dưới
250 điểm ảnh thì bỏ logo, vì một mẩu không đọc ra logo. Ở Kho project theo
level, chữ đứng thẳng trên nền gần logo nhất là dòng mô tả của level 0, nét chữ
bắt đầu 198 điểm ảnh dưới mép trên và kết thúc 1035 điểm ảnh từ mép trái ở 1440:
từ 1420 trở lên logo rộng 520 điểm ảnh, lấn ra ngoài mép phải 190 và mép trên
120, phần thấy được rộng 330 và cao 293; hẹp hơn 1420 mục này không có logo (bản
trước đẩy logo lên để lộ 153 điểm ảnh dưới cùng, chỉ là một vệt). Bảng xếp hạng
chỉ có tiêu đề ngắn đứng thẳng trên nền nên giữ cỡ đầy đủ tới 641; từ 640 trở
xuống không có logo (bản trước lộ 100 điểm ảnh của một bản 300). Trang kho không
có logo ở bề ngang nào (lề ngoài rộng nhất 178 ở 1440, 418 ở 1920, bản trước lộ
130). `kt-nen-template.mjs` tính hộp của lớp logo từ background-position và -size
rồi chấm rằng nó lộ ít nhất 250 điểm ảnh và không giao với hộp của dòng chữ nào
đứng thẳng trên nền hay của điều khiển nào đứng thẳng trên nền, ở 12 bề ngang từ
320 tới 1440, cả hai trang. Tương phản cao tắt logo; các quầng là dải chuyển nên
trình duyệt tự bỏ. Hộp danh sách và bảng xếp hạng nằm trên nền sáng thì có nền
trắng và bóng đổ để nổi lên; ga trên tuyến dọc và vòng của mục lục tô trắng,
không tô xám. Dòng đang tải, dòng trống và dòng lỗi của hai mục sáng (khi API
hỏng hay chưa có sinh viên nào) thay cho cả danh sách hay bục, tức đứng ngay chỗ
có quầng và logo: câu lỗi đỏ đo trên logo chỉ còn 3,95:1 và câu trống xám
4,41:1, nên ba dòng ấy đứng trên một tấm trắng như ô "Tiến độ của bạn";
`kt-nen-template.mjs` trả 500 và mảng rỗng cho API rồi đo tại nét chữ ở 1440,
900, 641, 390 và 320: câu lỗi 6,54:1, câu trống 5,32:1.

Tương phản chữ của mọi mục sau khi đổi nền, đo trên điểm ảnh nét chữ ở 1440,
1024, 768 và 390 bằng `kt-nen-template.mjs` (322 phép đo cho khách, 16 phép đo
thêm khi đã đăng nhập), mức thấp nhất của từng mục: phần mở đầu 4,60:1 (chữ phụ
xanh nhạt trên xanh chàm đặc), Ba bước 4,64:1 (chữ phụ xám trên nền nhấn nhẹ),
Kho project theo level 4,88:1 (nhãn "Sáu level" cạnh quầng trời ở 768, nền `#EFF6FC`), Lộ
trình 5,32:1, Bảng xếp hạng 4,95:1 (username trên thẻ trắng), Giảng viên 5,32:1,
Kêu gọi 4,60:1, chân trang 5,32:1, dải đầu trang kho 4,60:1, danh sách trang kho
5,27:1. Không mục nào dưới 4,5:1; tiêu đề lớn đo theo ngưỡng 3:1 đều từ 5,33:1.

Ba mức chữ trên nền sáng: chính `#151A28`, thân `#3B4255`, phụ `#646B7E`. Ba
mươi sáu cặp màu chữ và nền đã được đo; trong những cặp có dùng thật, cặp thấp
nhất là chữ phụ trên khối xanh chàm và số đếm trong nhãn lọc đang chọn, cùng
một màu `#ECEDFF` trên xanh chàm, đạt 4,60:1, rồi tới chữ phụ và liên kết trên
nền nhấn nhẹ, 4,64:1 và 4,65:1, đều trên mức 4,5:1 mà chữ nhỏ cần; chữ trắng
trên xanh chàm đạt 5,33:1, trên xanh chàm đậm 7,33:1.

Viền có hai mức. Đường kẻ và vật trang trí dùng `#DDE0E8` và `#C9CDD8`. Viền
của điều khiển, tức ô nhập, ô đánh dấu, nhãn lọc, nút viền và nút phân trang,
dùng `#808CA1`, đạt 3,4:1 trên nền trắng, vì với những thứ đó viền là dấu hiệu
duy nhất cho biết ranh giới. Điều khiển đứng thẳng trên nền chỉ có ở trang kho
(bộ lọc), nên vùng danh sách của trang kho giữ đáy trắng chứ không dùng giấy
`#F7F9FE`: đo trên điểm ảnh, viền bo tròn của nhãn lọc có điểm khử răng cưa chỉ
đạt 3,06:1 trên trắng và tụt còn 2,90:1 trên giấy; hai quầng ở trang kho không
chạm tới điều khiển nào. Nút viền trên khối xanh
chàm dùng trắng 80%, đạt 4,0:1 trên xanh chàm đặc; nút chỉ đứng trên xanh chàm
đặc, kể cả khi phần mở đầu ngắn lại vì chưa tải được số liệu (dải đáy tính từ
mép dưới nên khối ngắn hay dài thì phần trên tuyến vẫn là xanh chàm đặc). Lúc rê chuột,
nền của nút ấy sẫm lại một bậc (`rgba(20, 22, 90, .16)`) chứ không sáng lên:
trắng 14% phủ lên xanh chàm kéo chữ trắng xuống 4,1:1, còn lớp sẫm đưa lên 6,4:1.

### Chữ

Chữ dùng Times New Roman theo yêu cầu của người đặt hàng, với Liberation Serif
làm bản thay thế trên Linux vì hai mặt chữ này có cùng số đo. Mặt chữ này chỉ
có hai độ đậm thật là 400 và 700, nên cả tệp kiểu chỉ dùng hai độ đó. Chữ x của
Times thấp hơn mặt chữ không chân, nên mọi cỡ chữ đặt lớn hơn khoảng một điểm
ảnh so với cùng bố cục dùng chữ không chân: thân trang 17 điểm ảnh, chữ phụ từ
13,5 tới 15,5. Tiêu đề không giãn chữ âm, vì chữ có chân giãn âm sẽ dính chân
vào nhau. Mọi con số bật `font-variant-numeric: tabular-nums` nên xếp thẳng cột
kể cả khi không nằm trong bảng.

Những bề mặt do trình duyệt vẽ cũng mang bảng màu của trang: vùng chọn chữ, con
trỏ nhập, thanh cuộn, viền tiêu điểm, khoảng cách gạch chân của liên kết.

### Bố cục: tuyến sáu level

Sáu level là sáu ga trên một tuyến, và tuyến này xuất hiện ở sáu chỗ với cùng
một ngữ pháp là vòng tròn có số hiệu nối bằng đường thẳng:

| Chỗ | Hình dạng |
|---|---|
| Phần mở đầu | tuyến nằm ngang, sáu ga, dưới mỗi ga là tên, số project và thanh dài theo tỷ lệ so với level đông nhất |
| Ba bước | ba ga nối bằng nét đứt, vì đây là trình tự chứ chưa phải tuyến; khi cuộn tới, một vạch theo dải màu của mẫu slide chạy đè lên nét đứt từ ga này sang ga kế |
| Kho project theo level | tuyến dựng đứng ở mép trái cột nội dung, mỗi level là một ga nằm đúng trên đường, mỗi dòng project có một nhánh ngắn nối vào đường; mục lục bên trái là bản thu nhỏ với ga nhỏ |
| Lộ trình nghề nghiệp | trục dọc là sáu vòng tròn level đánh số nối bằng một đường; mỗi project là một ga trên đường leo bậc thang, ngang theo thứ tự bước, cao theo level; từ 640 điểm ảnh trở xuống hình dựng đứng, mỗi bước một hàng |
| Mục kêu gọi cuối trang | tuyến thu nhỏ trên khối xanh chàm, sáu ga chia đều bề ngang cột chữ; ga đặc là level xuất phát hay level có project đã hoàn thành, ga có vòng ngoài là level của project đề xuất; luôn nằm ngang, ở điện thoại chỉ giấu tên level |
| Chân trang | sáu ga nhỏ nối bằng một đường kẻ mảnh làm đường phân cách trước dòng bản quyền; chỉ để nhìn, ẩn với trình đọc màn hình |

Ở bề ngang hẹp, tuyến ở phần mở đầu dựng đứng và ba bước xếp dọc, cùng ngữ
pháp.

Đầu trang xếp ba đơn vị theo đúng thứ bậc, đọc từ đơn vị làm ra nền tảng này
tới cơ quan chủ quản xa nhất: Trung tâm Đào tạo chuyên sâu AI là dòng chính, rồi
Khoa Trí tuệ nhân tạo, rồi Học viện Công nghệ Bưu chính Viễn thông. Ba logo bên
trái cũng nhỏ dần theo đúng nhịp đó, 32 rồi 25 rồi 21 điểm ảnh. Đầu trang co lại
một chút khi trang đã cuộn khỏi đỉnh.

Bảng xếp hạng đọc được bằng mắt trước khi đọc số: ba người dẫn đầu đứng trên
một bục có phần chân cao theo tỷ lệ điểm, các dòng còn lại có thanh điểm mờ dài
theo cùng tỷ lệ, xem mục Bảng xếp hạng bên dưới.

### Chuyển động

Chuyển động chia hai lớp. Lớp thứ nhất là khoảnh khắc được dựng chủ ý, và cả
trang có ba: tuyến sáu level, ba bước, và hình leo của lộ trình nghề nghiệp (xem hai
mục riêng bên dưới). Khi dữ liệu về, đường tuyến ở phần mở đầu vẽ
từ trái sang phải, từng ga hiện lên đúng lúc đường chạy tới, rồi thanh số project
dài ra. Ở phần kho, thân tuyến màu xám có sẵn suốt cột, còn đoạn xanh của từng
level vẽ dần khi level đó vào khung nhìn nhờ `animation-timeline: view()`, và vẽ
xong trước khi người đọc tới các dòng của nó, nên nhánh nối từ tuyến vào mỗi
dòng luôn có thân. Các dòng project trượt ra từ đường khi tới khung nhìn, ga của
level đang xem tô đặc. Trình duyệt chưa có hoạt ảnh theo cuộn thì thấy đường vẽ
sẵn, theo `@supports`.

Lớp thứ hai là phản hồi: mỗi thao tác được xác nhận bằng một chuyển động ngắn,
từ 100 tới 400 mili giây, đường cong giảm tốc `cubic-bezier(.16, 1, .3, 1)`.

| Thao tác | Phản hồi |
|---|---|
| Bấm bất kỳ nút nào | nút ấn xuống 3 phần trăm rồi nhả |
| Bấm một dòng project | tên project bay từ dòng lên tiêu đề của bảng chi tiết, nhờ View Transitions; không có thì bảng trượt vào như thường; các mục của bảng hiện lần lượt cách nhau 40 mili giây, tuyến tiên quyết vẽ dần. Thân bảng được vẽ trước khi gọi chuyển cảnh, chuyển cảnh chỉ chuyển tên chuyển cảnh lên tiêu đề, và `chuyenCanh` bỏ chuyển cảnh nếu trình duyệt hoãn quá 300 mili giây: bảng không bao giờ đứng ở trạng thái chỉ có tiêu đề mà thân trống |
| Đổi bộ lọc ở trang kho | dòng còn lại trượt tới vị trí mới, dòng mới hiện dần, nhờ Web Animations |
| Chọn một ga trên hình leo | đường gióng và nhãn "Bước N" dời sang ga mới trong 0,3 giây, chấm của ga phóng to |
| Rê chuột qua một ga | nhãn tên project hiện dần trong 0,15 giây |
| Bảng xếp hạng cuộn vào tầm nhìn | ba cột trồi lên từ mép dưới của trường xanh tới đúng bề cao, ô đánh dấu project hiện lần lượt, các dòng hiện nối tiếp và thanh điểm dài ra; chỉ một lần |
| Mục giảng viên cuộn vào tầm nhìn | khung ảnh chân dung mở từ dưới lên trong 0,9 giây, ảnh thu từ 1,06 về cỡ thật, huy hiệu hiện dần khi khung mở tới góc trên, bốn thẻ lệch nhau 0,12 giây; từng thẻ chỉ mở khi ảnh của nó đã về; chỉ một lần |
| Mục kêu gọi cuối trang cuộn vào tầm nhìn | đường tuyến vẽ từ ga 0 sang phải trong 1,1 giây, ga đặc sáng lên lần lượt cách nhau 0,17 giây đúng lúc đường tới, thẻ project nhấc lên 10 điểm ảnh và hiện dần; chỉ một lần, vẽ lại sau khi đăng nhập hay có bài được chấm không chạy lại |
| Rê chuột lên một liên kết ở chân trang | gạch chân, chữ xanh chàm đậm; chân trang không có chuyển động nào khác |
| Rê chuột lên một thẻ giảng viên, hay tiêu điểm vào một nhãn track của thẻ | ảnh phóng 3 phần trăm trong khung, ở bốn cột tấm tên nhấc lên 3 điểm ảnh; giới thiệu và hàng nhãn đứng yên |
| Project chuyển sang đã hoàn thành | dấu tích tự vẽ nét, ô đánh dấu loé một vòng |
| Nộp bài xong | ô trạng thái nở nhẹ từ trong ra |
| Chấm bài xong | bài trượt sang phải rồi khép lại, những bài còn lại dồn lên. Lưu là hai bước: bấm "Lưu kết quả chấm" thì một dòng tóm tắt điều sắp lưu hiện ra và nút đổi thành "Xác nhận", bấm lần nữa mới gửi; sửa bất kỳ ô nào là về bước đầu; Enter trong ô điểm không gửi mà chuyển sang ô nhận xét. Giảng viên khác đã chấm trước (409) thì thẻ báo rồi tự gỡ |
| Mở hộp đăng nhập | hộp hiện từ nhỏ tới lớn, nền tối dần, nhờ `@starting-style`; trên điện thoại hộp trượt lên từ đáy |
| Mở hộp video hướng dẫn | hộp hiện từ nhỏ tới lớn, nền tối dần, cùng cách với hộp đăng nhập |
| Đổi giữa đăng nhập và đăng ký | vạch dưới nút chế độ đang chọn trượt sang, mặt thẻ xem trước hiện dần, khối thẻ ở nửa trái trượt tới giữa |

Trạng thái rê chuột chỉ khai báo trong `@media (hover: hover)`, vì trên màn
hình chạm, phần tử vừa chạm sẽ giữ trạng thái rê chuột mãi nếu không giới hạn.

Trên thiết bị chạm, mọi mục bấm được cao ít nhất 40 điểm ảnh: nút, nhãn lọc, mục
điều hướng, nút đóng, nút trang; liên kết chữ nằm trong dòng văn bản thì nới vùng
bấm bằng lề âm để bố cục không đổi. Trên thiết bị chạm và màn hình hẹp, mọi ô
chữ, ô chọn và ô nhiều dòng dùng cỡ chữ 16 điểm ảnh, vì iOS Safari phóng to cả
trang khi chạm vào ô nhỏ hơn. Khi in, đầu trang, ô tìm, khu tài khoản, các
bảng trượt và khung video bị bỏ, phần mở đầu về chữ đen trên nền trắng và mỗi
liên kết ra ngoài in kèm địa chỉ. Ở chế độ tương phản cao, thông báo có viền và
ba thanh tiến độ (ga, mục lục, track) vẽ bằng màu hệ thống.

Người dùng bật chế độ giảm chuyển động của hệ điều hành thì mọi thứ hiện sẵn ở
trạng thái cuối, không chuyển cảnh, không trượt; các đổi màu và mờ dần vẫn giữ
vì chúng báo trạng thái chứ không phải trang trí. Hàm `giamChuyenDong` trong
`js/giao-dien.js` là chỗ JavaScript kiểm tra điều đó trước khi gọi View
Transitions hay Web Animations.

### Khung video của phần mở đầu

Trên màn hình rộng hơn 1100 điểm ảnh, phần mở đầu chia hai cột: chữ bên trái;
bên phải là một khung video và ngay dưới khung, ngoài khung, một dòng chú thích
lấy từ dữ liệu thật. Video dài 10 giây, quay cận cảnh màn hình một máy tính
đang chạy dòng lệnh. Hình ảnh lấy từ chính việc mà người học làm trên nền tảng
này: viết mã, chạy thử, rồi nộp bài. Cách đặt ảnh cạnh khối chữ cũng là cách mẫu
slide của Trung tâm dùng ở trang có ảnh.

Cột phải kéo cao bằng khối chữ: mép trên khung thẳng với đầu nét chữ của tiêu
đề, mép dưới dòng chú thích thẳng với mép dưới hàng nút. Khung lấy hết phần cao
còn lại, nên nó cao theo khối chữ ở mọi bề ngang thay vì theo một tỷ lệ cố định.

Đoạn dẫn dưới tiêu đề chỉ còn một câu số liệu, "Kho hiện có 200 project thuộc 11
track, rèn 37 skill.", thay cho đoạn bốn dòng giải thích cách nền tảng vận hành ở
bản trước. Khối chữ vì thế thấp đi, và khung theo khối chữ mà bẹt lại. Để khung
không bẹt quá, câu số liệu lớn hơn chữ thân một bậc (18 tới 21 điểm ảnh) và hai
khoảng quanh nó giãn theo bề ngang: dưới tiêu đề 18 tới 26, trước hàng nút 26 tới
38 điểm ảnh. Đo 326 bề ngang, từng điểm ảnh từ 1101 tới 1300 rồi cách 10 điểm ảnh
tới 2560: khung rộng 385 tới 413 và cao 182 tới 200 điểm ảnh (bản có đoạn dẫn bốn
dòng: cao 253 tới 272, bề ngang gấp 1,51 tới 1,58 lần bề cao), bề ngang gấp 2,06
tới 2,11 lần bề cao; phần mở đầu cao 518 tới 563 điểm ảnh, trước là 588 tới 635.
Hàng của khung có sàn 150 điểm ảnh, thấp hơn mọi chiều cao đo được, nên sàn không
kéo cột phải cao quá khối chữ. Khung bo góc 12 điểm ảnh, viền trắng mờ một điểm ảnh và bóng
đổ pha từ xanh chàm. Lưới giữ chỗ cho cả cột, nên khung và dòng chú thích không
bao giờ đè lên chữ; khoảng cách từ nét chữ gần nhất của cột trái tới cột phải từ
64 tới 72 điểm ảnh, tiêu đề luôn giữ hai dòng, không có thanh cuộn ngang, đáy dòng
chú thích lệch đáy hàng nút 0 điểm ảnh.

Video được pha màu lúc dựng tệp chứ không lọc lúc chạy, theo ba mốc độ sáng: tối
là xanh chàm đậm `#3B3ED8`, sáng vừa là xanh da trời `#3C8CDC`, sáng nhất là
xanh da trời nhạt `#CDEEFA`. Bản trước dùng mốc tối `#1E218C`, khung khi đó là
một mảng sẫm hẳn giữa dải chuyển; với mốc mới khung chỉ sẫm hơn màu khối một bậc
và đọc như một màn hình sáng, nên kéo khung cao lên không thành một mảng tối lớn
hơn. Video cũng được làm mờ nhẹ (bộ lọc `gblur` độ lệch 1,4), để chữ trong cảnh
thành vân, và được phóng 1,2 lần rồi cắt neo ở 60% bề ngang và mép trên, để bỏ
mép màn hình và bàn tay người quay lọt vào góc dưới bên trái của nguồn. Ba tệp
trong `anh/`:

| Tệp | Kích thước | Dùng ở đâu |
|---|---|---|
| `video-mo-dau.webm` | 960 × 640, 10 giây, 497 kB | trình duyệt hiểu VP9 |
| `video-mo-dau.mp4` | 960 × 640, 10 giây, 745 kB | trình duyệt còn lại |
| `video-mo-dau.jpg` | 960 × 640, 22 kB | ảnh chờ, và là ảnh tĩnh khi video không phát |

Góc trên bên phải của khung có một nút tròn nhỏ để tạm dừng video. Video lặp
mười giây một vòng và chạy song song với chữ, nên theo tiêu chí 2.2.2 của WCAG
người xem phải dừng được nó. Nút là vòng tròn trắng 30 điểm ảnh, không có chữ,
chỉ có biểu tượng tạm dừng hai vạch màu xanh chàm đậm, đạt 7,33:1; tên của nút
cho trình đọc màn hình là "Tạm dừng video", đặt ở aria-label. Vòng tròn có viền
đặc `#14165A`. Hai màu bù cho nhau: nền trắng đạt 3:1 với mọi vùng video có độ
chói tới 0,30, viền sẫm đạt 3:1 với mọi vùng từ độ chói 0,144 trở lên, nên mép
nút rõ trên mọi khung hình, kể cả khi một dòng lệnh sáng chạy ngang qua; vòng
tiêu điểm là vòng xanh chàm đậm trên một quầng trắng. Nút nằm ngoài khung
`aria-hidden` và chỉ hiện khi video có thể phát: người bật giảm chuyển động,
đang tiết kiệm dữ liệu hay dùng chế độ màu cưỡng bức của hệ điều hành chỉ thấy
ảnh tĩnh nên không có nút. Bấm thì biểu tượng đổi sang hình tam giác phát và tên
nút đổi thành "Phát video", video đứng yên cho tới khi bấm lại, kể cả khi cuộn
đi rồi quay lại; trình duyệt từ chối tự phát thì nút cũng tự đổi sang biểu tượng
phát cho đúng điều đang thấy.

Dòng chú thích là một nút, hai dòng: tên project có gạch chân mờ và mũi tên, bên
dưới là câu "Dự kiến 3 giờ, ít giờ nhất trong 25 project của level Nhập môn."
Project được chọn là project ít giờ nhất của level thấp nhất; tên, số giờ, tên
level và số project đều lấy từ dữ liệu `kho.js` vừa tải cho trang chủ, qua sự
kiện `kho-da-nap`, không gọi API thêm. Bấm vào thì mở bảng chi tiết project như
khi bấm một dòng trong danh sách, tên project bay lên tiêu đề bảng, đóng bảng
thì tiêu điểm quay về nút. Câu chữ chỉ nói điều kho khẳng định được: không có
trạng thái, không có thanh tiến độ, không ngụ ý ai đang làm project đó, và dòng
chữ không tự đổi theo thời gian. Video không phải cảnh quay của project này nên
dòng chữ không phải `figcaption`. Cả hai dòng chữ trắng, kể cả câu số liệu, dù
chữ phụ trên khối vốn là xanh chàm rất nhạt: dòng chú thích nằm ngay dưới khung
video, trong vùng bóng đổ của khung, nên nền sau nét chữ sẫm và không đều; hai
dòng dùng màu có dự phòng cao hơn, thứ bậc giữa hai dòng đến từ cỡ chữ và gạch
chân của tên. Đo tại nét chữ ở 1101, 1180, 1280, 1440, 1920 và 2560, nền sau nét
chữ là `#4D50EC` tới `#4F52F1` (xanh chàm đặc phủ bóng của khung), chữ trắng
thấp nhất 5,51:1; xanh chàm rất nhạt ở đó chỉ còn dư 0,1 so với 4,5:1.

Câu so sánh dựa vào cách xếp 'level' của backend: level tăng dần, rồi số giờ
tăng dần, rồi mã project, nên project đầu tiên trong sáu bản ghi là project ít
giờ nhất của cả level, còn N là số project của level lấy từ số liệu tổng quan.
Mã có thêm hai phép thử để lùi về cách nói an toàn. Phép thứ nhất xem sáu bản
ghi có số giờ không giảm; nó không chứng minh được cách xếp, nhưng bắt được
trường hợp hay gặp nhất là ai đó đổi cách xếp, khi đó câu thành "Dự kiến 3 giờ,
thuộc level Nhập môn." thay vì lặng lẽ nói sai. Phép thứ hai: nếu project kế
tiếp có cùng số giờ, câu thành "một trong những project ít giờ nhất của level",
vì khi đó project này không phải project duy nhất. Dữ liệu hiện tại có trường
hợp đó ở level Cơ sở, nơi 11 project cùng 8 giờ; level Nhập môn thì project ít
giờ nhất là duy nhất, nên dòng chú thích hiện dùng câu so sánh.

Chỗ của dòng chú thích được giữ sẵn từ đầu, vì dữ liệu có thể về sau ảnh chờ của
video; không giữ thì khung đang hiện dần sẽ co lại một nhịp. Trong lúc giữ chỗ,
nút rỗng vô hình và nằm ngoài phím Tab lẫn trình đọc màn hình. Chỗ giữ chỉ vừa
một dòng tên và một dòng câu; tên hay câu dài hơn thì dòng chú thích cao thêm và
khung ngắn lại, nên khung và nút tạm dừng chỉ hiện khi dòng chú thích đã có chữ
hoặc đã bị ẩn, tức mọi thay đổi chiều cao xảy ra lúc khung còn vô hình; khung và
dòng chú thích cùng hiện dần trong 0,9 giây. API lỗi thì nút ẩn hẳn cùng các cụm
số liệu khác, hàng của nó thu về không, và khung giãn xuống ngang hàng nút; kho
không có project nào thì nút cũng ẩn. Khi `GET /stats` lỗi, tiêu đề và đoạn dẫn
cũng không giữ con số viết sẵn trong HTML: cụm "200 project" ẩn đi, tiêu đề còn
"Sáu level. Bắt đầu từ chỗ vừa sức."; đoạn dẫn chỉ có câu số liệu nên ẩn cả đoạn,
không để lại một đoạn rỗng, và tiêu đề nhận khoảng trước hàng nút; tuyến sáu ga ẩn
hẳn thay vì để lại một vạch trắng không có ga nào.

Từ 1100 điểm ảnh trở xuống, chữ cần cả bề ngang nên CSS ẩn cả cột phải, và
`js/khung-video.js` cũng không gán ảnh chờ, nên điện thoại không tải thêm byte
nào cho khung. Trên màn hình rộng, ảnh chờ được gán khi đã tải xong và khung
hiện dần trong 0,9 giây; video phát khi người dùng không bật giảm chuyển động và
trình duyệt không báo đang tiết kiệm dữ liệu, không đủ thì khung dừng ở ảnh chờ.
Video không tiếng, `preload="none"` nên chỉ tải khi được phát; đang phát mà khung
ra khỏi khung nhìn hoặc thẻ bị ẩn thì dừng, quay lại thì phát tiếp. Không có
JavaScript thì khung không hiện, cột phải để trống.

Vòng lặp liền mạch: đoạn video lấy từ giây thứ 2 tới giây 10 của nguồn, rồi nối
thêm hai giây cuối hoà dần vào hai giây đầu, nên khung hình cuối trùng khung hình
đầu và không thấy chỗ nối.

Thay bằng video của mình: đặt đoạn video vào máy có `ffmpeg`, chạy
`./lam-video-mo-dau.sh video-cua-ban.mp4 anh 0 10`, với hai số cuối là giây bắt
đầu và độ dài; ba tệp trong `anh/` được dựng lại với cùng ba mốc màu, cùng độ mờ
và cùng tỷ lệ 3:2. Nếu góc nguồn có vật thừa thì đặt thêm `PHONG`, `NEO_X`,
`NEO_Y` như ví dụ ở đầu tệp; muốn đổi mốc màu thì đặt `MAU_TOI`, `MAU_GIUA`,
`MAU_SANG` dạng `đỏ,lục,lam`. Video nên quay ngang, rộng từ 960 điểm ảnh, chuyển
động chậm, và liên quan tới việc học lập trình, ví dụ màn hình đang chạy chương
trình, bàn làm việc của sinh viên, hay phòng thí nghiệm của Trung tâm.

### Ba bước có hình minh hoạ dựng từ dữ liệu

Mỗi bước ở trang chủ chỉ có tên bước và một hình nhỏ đứng trên tên bước, như một
mảnh giao diện của nền tảng; mục không có câu dẫn hay đoạn giải thích từng bước.
Hình không phải ảnh vẽ sẵn mà là HTML dựng từ đúng project mà dòng chú thích ở
phần mở đầu giới thiệu, nên ví dụ không lệch khỏi kho được:

| Bước | Hình | Dữ liệu |
|---|---|---|
| Chọn một project | sáu ga level, ga của project được tô; project đó cùng project đứng sau nó trong danh sách của level, kèm track và số giờ | `kho-da-nap` |
| Làm rồi nộp bài | tối đa ba sản phẩm phải nộp, rồi hàng gợi ý tầng 1 mở, tầng 2 và 3 khoá | `GET /projects/{slug}`, gọi khi mục sắp cuộn tới |
| Nhận điểm và đi tiếp | nhãn "Đạt", số điểm tích luỹ của project, hàng badge có nhãn và ba biểu tượng | `kho-da-nap` |

Mọi project trong kho đều có đủ ba tầng gợi ý, và backend cộng đúng
`reward_points` rồi xét badge ngay khi bài được chấm đạt, nên hình không nói gì
backend không làm. Điều duy nhất không có trong dữ liệu là nhãn "Đạt". Bản trước
có một dòng dưới ba bước ghi rõ đó là ví dụ; dòng ấy đã bỏ, nên hình bước ba tự giữ
cho mình chung chung: nhãn "Kết quả chấm", không có tên project, không có tên
người, không xưng "bạn", và hàng badge chỉ có nhãn "Badge" cùng ba biểu tượng, không
nói ai được badge nào. Hình cho thấy một bài đạt trông ra sao chứ không nói gì về người đang
xem. Ba hình mang `aria-hidden`: trình tự ba bước nằm ở ba tên bước, dữ liệu trong
hình có đủ ở danh sách project và bảng chi tiết, còn hình bước ba mà được đọc to
thì người nghe chỉ nhận "Đạt" cùng một số điểm, không có khung hình nào cho biết
đó là hình minh hoạ.

Ba bước là một lưới mà mỗi bước dùng chung hàng của lưới cha qua `subgrid`, nên
ba hình cao bằng nhau và ba tên bước thẳng hàng. Trước khi dữ liệu về, mỗi hình
là một ô xám giữ chỗ cao cỡ hình thật để trang không xô xuống. API tổng quan lỗi
thì ba hình ẩn theo `data-can-so-lieu`, tên ba bước vẫn còn; chỉ lượt gọi chi tiết
lỗi thì hình bước hai bỏ danh sách, giữ hàng gợi ý.

Khi từng bước cuộn vào tầm nhìn, ga chuyển từ viền sang tô đặc, vạch nối chạy
sang ga kế, hình hiện lên, rồi bước hai đánh dấu lần lượt từng sản phẩm. Một bước
lộ từ 35% trở lên là tính vào tầm nhìn. Việc theo dõi chỉ bắt đầu sau khi số liệu
kho đã về hoặc đã lỗi: trước lúc ấy tuyến sáu level ở phần mở đầu chưa có ga, phần
mở đầu thấp hơn, và ở khung nhìn 1440 × 900 ba bước lộ khoảng 40%, nên chuyển động
sẽ chạy ngay lúc mở trang rồi bị tuyến có ga đẩy xuống khỏi màn hình. Trên màn hình
rộng ba bước vào tầm nhìn cùng lúc nên lùi nhau 0,35 giây theo thứ tự; xếp dọc thì
bước nào tự chạy khi cuộn tới bước ấy. Chuyển động theo đúng trình tự
ba bước mô tả và chỉ chạy một lần. Không có IntersectionObserver hay bật giảm
chuyển động thì mọi thứ ở trạng thái cuối ngay từ đầu. Cặp màu chữ có độ tương
phản thấp nhất trong hình là xám phụ trên nền xanh chàm nhạt, 4,64:1; nhãn "Đạt" 4,71:1.

Cùng hàng với tiêu đề "Ba bước", sát mép phải, là ô xem video hướng dẫn; từ 640
điểm ảnh trở xuống ô xuống dưới tiêu đề và trải hết bề ngang. Ô cao gấp ba tiêu đề
nên tiêu đề căn giữa theo chiều cao của ô, như ô tiến độ cạnh tiêu đề mục kho
project. Cả ô là một nút: một tấm thẻ trắng bo 12 điểm ảnh có bóng đổ như ba hình
minh hoạ, bên trong là ảnh chờ 16:9 rộng 220 điểm ảnh (hẹp thì 42% bề ngang ô) có
vòng tròn phát, cạnh ảnh là nhãn "Video hướng dẫn" và thời lượng "0:50". Tên cho
trình đọc màn hình là "Xem video hướng dẫn, 50 giây", chứa nguyên nhãn nhìn thấy, và
nút mang `aria-haspopup="dialog"`. Viền ô dùng mức điều khiển, 3,4:1, vì cả tấm
thẻ là nút. Vòng phát xanh chàm viền trắng nổi được trên cả ảnh chờ tối lẫn ảnh chờ
sáng, và ảnh có một đường mép rất mờ để ảnh chờ trắng không tan vào thẻ. Rê chuột
thì viền và bóng đậm lên, nhãn sang xanh chàm đậm, vòng phát sẫm lại và phóng nhẹ;
người bật giảm chuyển động không thấy phóng. Đo trên điểm ảnh nét chữ: nhãn
12,77:1, thời lượng 5,32:1, nhãn lúc rê chuột 5,75:1.

Bấm ô, hay nhấn Enter hoặc phím cách khi ô có tiêu điểm, thì một hộp thoại modal
mở ra: tiêu đề "Video hướng dẫn" và nút Đóng ở dải trên, trình phát của trình duyệt
trải hết bề ngang bên dưới. Phụ đề tiếng Việt có sẵn nhưng tắt, vì mỗi câu phụ đề chỉ
là tên bước đã in trên hình; người xem bật được ở thanh điều khiển. Câu phụ đề đặt ở
góc dưới bên trái, đè lên nhãn bước in trên hình, nên khi bật cũng không che dòng
thông báo của trang hiện ở giữa phía dưới khung hình. Video phát vì người xem vừa
bấm; trang không tự phát video này ở đâu cả. Trình duyệt vẫn từ chối phát thì tiêu
điểm vào video, một lần nhấn phím cách là phát được; không tệp nào tải được thì
hộp hiện dòng báo lỗi đỏ như các vùng dữ liệu khác, và lần mở sau video chọn nguồn
lại từ đầu. Hộp rộng tối đa 960 điểm ảnh, nhưng không rộng quá mức để khung 16:9
cộng dải tiêu đề vừa chiều cao màn hình, nên điện thoại xoay ngang vẫn thấy trọn
khung hình; điện thoại dựng đứng thì hộp chừa 8 điểm ảnh mỗi bên. Màn hình thấp dưới
240 điểm ảnh, như trang phóng to 400%, thì hộp lấy đủ bề ngang để tiêu đề và nút Đóng
giữ một dòng, còn khung trình phát giới hạn theo chiều cao, video thu vào giữa khung.
Khung trình phát giữ tỷ lệ bằng CSS nên hộp không đổi cỡ khi video về. Video quay giao
diện máy tính, nên trên điện thoại dựng đứng khung hình chỉ bằng khoảng 0,3 lần bản
gốc và chữ trên hình không đọc được, nên trên thiết bị chạm dưới 640 điểm ảnh,
video phát xong lượt `play()` là được đưa lên toàn màn hình (`requestFullscreen`,
hay `webkitEnterFullscreen` của iOS); trình duyệt từ chối thì video vẫn chạy
trong hộp.
Trình đọc màn hình đọc một đoạn tả nội dung video, gắn vào video bằng
`aria-describedby`: đoạn ấy nằm trong hộp, dùng lớp `an-khoi-mat` nên không hiện trên
trang, vì video không có tiếng và phụ đề chỉ có tên ba bước. Đóng bằng nút Đóng, phím
Escape hay bấm ra nền tối đều dừng video, tua về đầu và trả tiêu điểm về ô; ấn chuột
trong hộp rồi nhả ngoài hộp, như khi kéo thanh tua, thì hộp không đóng. Bấm đúp vào ô
thì lượt bấm thứ hai rơi vào hộp vừa mở; lượt ấy bị bỏ qua, để nó không đóng hộp khi
trúng nền tối và không dừng video khi trúng trình phát.

Trước khi bấm, trang chỉ tải ảnh thu nhỏ của ô, và ảnh ấy tải lười. Ảnh trong ô có
`srcset` gồm bản rộng 440 điểm ảnh, 17 kB, và bản 1280 × 720, 113 kB; ô hiện rộng 220
điểm ảnh nên màn hình thường và màn hình dày điểm ảnh gấp đôi chỉ tải bản nhỏ. Video
để `preload="none"`; ảnh chờ của trình phát, là bản 1280 × 720 ghi ở thuộc tính `src`
của ảnh trong ô, và phụ đề chỉ được nạp lúc mở hộp, vì ghi sẵn
thuộc tính `poster`, hay `default` trên thẻ `track`, thì trình duyệt tải tệp ngay khi
mở trang. Chỗ của ảnh giữ sẵn theo tỷ lệ nên ảnh về không làm trang xô. Tệp và
cách thay nằm ở mục 8.

### Lộ trình nghề nghiệp là hình leo level

Level các bước trong một lộ trình không tăng đều: AI Engineer lên level 2 rồi về
level 1 trước khi lên level 3, GenAI Engineer hai lần quay xuống. Danh sách chữ giấu
điều ấy, nên mỗi lộ trình được vẽ thành một hình leo, mỗi lần một lộ trình:

| Phần | Hình dạng | Dữ liệu |
|---|---|---|
| Tab | ba tab theo mẫu tabs của WAI-ARIA APG, vạch xanh chàm trượt theo tab đang chọn; dưới tên là đường leo thu nhỏ của chính lộ trình, cùng thang level, để so dáng ba lộ trình | `GET /roadmaps`, `GET /roadmaps/{slug}` |
| Dải số liệu | mô tả của lộ trình; số project, tổng giờ dự kiến, tổng điểm tích luỹ, level cao nhất, số track, số project có trong lộ trình khác; đã đăng nhập thì thêm "Đã xong N/M" | cộng và đếm từ các bước; hai tổng mang chữ "Tổng" để không đọc nhầm thành điểm hay giờ của người đang đăng nhập |
| Hình leo | trục dọc là sáu vòng tròn level nối bằng một đường, level cao nhất của lộ trình tô đặc; trục ngang là thứ tự bước; đường bậc thang qua các ga, vùng dưới đường tô dải chuyển xanh chàm sang xanh da trời rất nhạt; ga đang chọn có đường gióng xuống đáy và nhãn "Bước N" | các bước |
| Thẻ của ga đang chọn | "Bước N/M" và nhãn trạng thái bài nộp, tên project, level, track, giờ, điểm tích luỹ, ghi chú của bước, nút tên các lộ trình khác có cùng project, nút "Mở project" | bước và project |

Đường chỉ có đoạn ngang và đoạn dọc, vì level là bậc rời: không có đoạn xiên đi qua
một mức không có thật. Ba lộ trình dùng chung một thang từ level 0 tới level cao nhất
có trong cả ba, nên dáng của chúng so được với nhau. Nút tên lộ trình khác trong thẻ
chuyển sang đúng project ấy bên lộ trình kia.

Danh sách lộ trình tải lúc mở trang để vẽ tab. Chi tiết cả ba lộ trình tải một lượt khi
mục sắp cuộn tới, bằng hàm `khiSapToi` trong `js/giao-dien.js` (hình bước hai của ba bước
dùng chung hàm này), vì số project chung chỉ tính được khi đã có đủ ba; đổi tab không gọi
API nữa. Danh sách lỗi thì cả mục là một dòng lỗi. Chi tiết tải bằng `Promise.allSettled`:
lộ trình nào lỗi thì chọn tab ấy thấy dòng lỗi, các lộ trình còn lại vẫn vẽ, và số project
chung chỉ hiện khi đủ cả ba.

Mỗi ga là một nút trong một danh sách có thứ tự. Tên nút gồm tên project, level và trạng
thái bài nộp; nút đang chọn mang `aria-current` và `aria-describedby` trỏ tới số bước,
dòng track, giờ, điểm và ghi chú trong thẻ (tên và level đã có trong tên nút, các nút
trong thẻ không mô tả ga). Ga
đang chọn là điểm dừng Tab duy nhất của danh sách, bốn phím mũi tên đi sang ga kề và dừng
ở hai đầu, Home và End về ga đầu, ga cuối; tab đổi bằng hai phím mũi tên ngang, xoay vòng.
Rê chuột qua một ga khác hiện tên project trong một nhãn nhỏ mang `aria-hidden`, để lướt
dọc đường leo. Nút của ga rộng bằng khoảng cách hai ga, tối đa 40 điểm ảnh, cao 40.

Khi đã đăng nhập, ga có bài đạt tô đặc xanh lá kèm dấu tích, ga có bài chờ chấm là vòng
vàng đất có chấm giữa, bài chưa đạt hay cần sửa là vòng đỏ có chấm giữa. Đoạn đường từ ga
đầu tới ga đạt liên tiếp xa nhất vẽ xanh lá dày 4 điểm ảnh, gấp đôi đường thường, để hai
đường không chỉ khác nhau ở màu. Ga chọn sẵn là bước đầu tiên chưa đạt. Dấu vẽ lại theo
`phien-thay-doi` và `tien-do-thay-doi`; ga người dùng đã tự chọn, hay đã mở project từ
thẻ, được giữ nguyên.

Hình cao cố định, 400 điểm ảnh từ 1024 trở lên và 340 ở bề ngang vừa. Thẻ rộng 340, đứng
thẳng với vùng vẽ: mép trên ở đường kẻ level cao nhất, mép dưới ở đường kẻ level 0, nút
"Mở project" đi liền sau nội dung và phần trống dồn về đáy; ghi chú dài nhất hiện có cũng
vừa, nên chọn ga khác thì hình, thẻ và mục bên dưới đều đứng yên. Từ 1023 điểm ảnh
trở xuống thẻ nằm dưới hình, cao ít nhất bằng nội dung dài nhất; dưới 800 điểm ảnh mô tả
giữ chỗ hai dòng và dải số liệu xếp ba cột, để đổi tab hình không nhảy. Từ 640 trở xuống
hình dựng đứng: mỗi bước một hàng cao ít nhất 44 điểm ảnh, chấm nằm ở cột level của nó
trong một làn mỗi level một cột, đoạn nối rẽ ngang từ cột của ga trước, tên project cạnh
chấm, thẻ mở ngay dưới hàng đang chọn trên nền xanh chàm nhạt. Chạm một hàng nằm dưới thẻ
đang mở thì trang cuộn bù đúng phần thẻ vừa rời đi, nên hàng vừa chạm đứng yên dưới ngón
tay; chọn bằng phím thì hàng mới cùng thẻ của nó được cuộn vào tầm nhìn, cách đầu trang
dính một khoảng như các mục.

Lần đầu cuộn tới, đường mở dần từ trái sang phải trong 0,7 giây và ga hiện lên lúc đường
chạy tới, đúng thứ tự đi của lộ trình. Đổi tab thì đường uốn sang dáng của lộ trình mới
bằng chuyển tiếp CSS của thuộc tính `d`, ga trượt từ chỗ của ga cùng thứ tự bên lộ trình
cũ bằng Web Animations, cả hai trong 0,5 giây; đường luôn được đệm cho đủ số điểm của lộ
trình dài nhất nên trình duyệt nội suy được. Giảm chuyển động thì hình hiện sẵn và đổi
ngay; chỉ còn đổi màu.

Đo trên điểm ảnh bằng `kt-lo-trinh`: chữ thấp nhất 4,64:1, là chữ phụ trên nền xanh chàm
nhạt của hàng đang chọn ở điện thoại; trên màn hình rộng thấp nhất là nhãn "Đạt", 4,71:1.
Đồ hoạ: đường leo 5,33:1 trên nền trắng và 4,57:1 trên vùng tô, đoạn đã đi 5,34:1, ga đạt
5,42:1, ga chờ chấm 5,93:1, vòng ngoài của ga đang chọn 4,70:1 trên vùng tô, đường leo thu
nhỏ trong tab 3,40:1, vạch tab 3,36:1 so với viền dưới tab. Đường gióng dùng mức viền điều
khiển đậm, 4,93:1 trên vùng tô, vì mức thường chỉ 2,8:1 ở đó; viền nút trong hàng đang chọn
ở điện thoại cũng dùng mức đậm, 4,87:1, vì mức thường chỉ 2,96:1 trên nền xanh chàm nhạt.
Đường vẽ với `shape-rendering: crispEdges`: chỉ có đoạn ngang, dọc, kể cả lúc đang uốn,
nên nét phủ trọn điểm ảnh và không nhạt đi ở toạ độ lẻ. Ở chế độ tương phản cao, vùng tô
bỏ đi, đường và ga vẽ bằng màu hệ thống, đoạn đã đi và level cao nhất dùng Highlight.

### Bảng xếp hạng là một bục trong trường xanh

Ba người dẫn đầu đứng trên một bục đặt trong trường xanh của Trung tâm: bục
vẽ trọn dải chuyển dọc của mẫu slide, xanh chàm ở mép trên, xanh da trời lộ ở
hai bên chân bục, không cần tấm che vì không có chữ nào đứng thẳng trên trường;
trên đó là lớp ảnh mờ của phần mở đầu như nửa trái của hộp tài khoản và mục kêu
gọi cuối trang; lớp này là ảnh chờ `video-mo-dau.jpg` 22 kB, tải ở mọi bề
ngang, và là byte duy nhất điện thoại tải thêm cho ảnh của phần mở đầu. Mỗi người một cột: ảnh
đại diện hoặc chữ cái đầu, số hạng trong vòng tròn đánh số ở góc ảnh cùng ngữ
pháp với ga level, tên, username, điểm tích luỹ với biểu tượng ngôi sao của
badge điểm, số project đã hoàn thành với biểu tượng danh sách của badge project.
Phần bục dưới chân cao 44 điểm ảnh cộng 100 điểm ảnh nhân tỷ lệ điểm so với
người đứng đầu (80 trên điện thoại), nên hạng 1 luôn cao nhất và chênh lệch điểm
nhìn ra ngay. Trên bục là hàng ô đánh dấu, mỗi ô một project đã hoàn thành, cùng
ô đánh dấu với hình bước hai của mục Ba bước, tối đa 10 ô rồi ghi phần dư. Trong
DOM ba cột theo hạng 1, 2, 3 để trình đọc màn hình đọc đúng thứ tự; CSS xếp hạng
1 ra giữa. Mọi chữ nằm trên thẻ trắng và bục xanh chàm nhạt, không có chữ trên
trường xanh, nên đầu xanh da trời của dải không phải tránh.

Từ hạng 4 là một danh sách có thứ tự bắt đầu ở 4, mỗi dòng có hạng, ảnh, tên,
username, số project và số điểm với cùng hai biểu tượng; sau mỗi dòng là thanh
điểm mờ dài theo tỷ lệ so với người đứng đầu. Người bằng điểm và bằng số project
với người đứng ngay trên thì ghi cùng hạng với dấu bằng phía trước ("=5"), vị trí
vẫn theo hạng của backend. Dòng của người đang đăng nhập có
nhãn "bạn" và nền xanh chàm nhạt. Người đang đăng nhập là sinh viên mà bảng đã đủ
10 người và không có họ thì dưới bảng có một dòng số điểm của họ, lấy từ phiên,
là số mà lượt tải tiến độ vừa cập nhật; giảng viên không được xếp hạng nên không
có dòng này. Trên 900 điểm ảnh bục và danh sách đứng cạnh nhau, danh sách dài hơn
thì bục kéo cao bằng; hẹp hơn thì xếp dọc, và từ 560 trở xuống danh sách bỏ cột
project. Bảng ít hơn ba người thì bục có bấy nhiêu cột; không ai có điểm thì mọi
bục cao bằng nhau ở mức thấp nhất.

Khi bảng cuộn vào tầm nhìn, ba cột trồi lên từ mép dưới của trường xanh tới đúng
bề cao của mình, lệch nhau 0,12 giây, rồi các ô đánh dấu hiện lần lượt, các dòng
hiện nối tiếp và thanh điểm dài ra. Cột dịch bằng translate và trường xanh cắt
phần thừa, nên bề cao của khối không đổi và trang không xô. Chuyển động chỉ chạy
một lần: lớp đánh dấu gắn lên khung ngoài, các lần vẽ lại sau khi đăng nhập hay
có bài được chấm không dựng lại. Bật giảm chuyển động thì bảng ở sẵn trạng thái
cuối. Đo trên điểm ảnh nét chữ ở 1440 và 390, chữ có tương phản thấp nhất là
xám phụ trên nền xanh chàm nhạt của dòng "bạn", 4,64:1.

### Giảng viên phụ trách là bốn thẻ nối sang kho

Mỗi giảng viên một thẻ trong bốn cột: ảnh chân dung 4:5, tấm tên chồm lên 26 điểm
ảnh của mép dưới ảnh và chừa một dải ảnh 24 điểm ảnh bên phải, cùng cách chồng lớp
với ảnh đại diện trên thẻ của bục xếp hạng; dưới tấm là chức vụ màu xanh chàm và
giới thiệu, đều là chữ của `GET /mentors`; tên là `h3` để nhảy được từ người này
sang người kia bằng tiêu đề, như tên project trên trang kho. Ở góc trên bên trái
của ảnh là huy hiệu số track người ấy phụ trách, trên một tấm trắng đặc, với biểu
tượng track của badge track; dưới giới thiệu là hàng nhãn track, mỗi nhãn có cùng
biểu tượng, tên track và số project của track, và là liên kết
`kho.html?track=<slug>` mở trang kho lọc theo đúng track ấy, nơi nhãn lọc tương
ứng đang chọn với cùng con số. Hàng nhãn là danh sách có nhãn "Track do <tên> phụ
trách"; huy hiệu ẩn với trình đọc màn hình, vì số mục của danh sách ấy đã là số
track và đọc "3 track" trước khi đọc tên thì không rõ của ai. Track, người
phụ trách và số project lấy từ `by_track` của `GET /stats`, giữ lại từ sự kiện
`kho-da-nap`, nên mục không gọi thêm lượt nào ngoài `GET /mentors`. Backend gán
người phụ trách theo track, còn ai chấm bài nào không nằm trong dữ liệu, nên thẻ
không nói gì về việc chấm. Người không phụ trách track nào thì không có huy hiệu và
hàng nhãn, thay vì một huy hiệu ghi 0. Cạnh tiêu đề, sát mép phải, là dòng số liệu
"4 giảng viên · 11 track · 200 project" ghép từ ba con số của hai lượt gọi; số liệu
kho lỗi thì thẻ không có huy hiệu và hàng nhãn, dòng chỉ còn số giảng viên; lượt
gọi giảng viên lỗi thì cả mục là dòng báo lỗi và dòng số liệu ẩn. Thẻ không đóng
khung: mục vẫn trắng nền phẳng như trước, mép của ảnh là mép của thẻ.

Trên 900 điểm ảnh là bốn cột ảnh dọc. Từ 900 trở xuống thẻ nằm ngang: ảnh bên
trái rộng tối đa 128 điểm ảnh với huy hiệu dời xuống góc dưới vì khuôn mặt chiếm
gần hết ảnh hẹp, tên, chức vụ và giới thiệu bên phải, hàng nhãn dưới ảnh trải hết
bề ngang thẻ, mỗi nhãn cao tối thiểu 40 điểm ảnh làm mục tiêu chạm; từ 641 tới 900
là hai cột thẻ ngang, từ 640 trở xuống một cột, và chỉ từ 481 tới 640 cột chữ cạnh
ảnh đủ rộng để hàng nhãn đứng cạnh chữ. Hai cột ảnh dọc trải hết bề ngang thì mỗi
ảnh rộng tới 400 điểm ảnh, mục cao gấp đôi bề ngang 901 và ảnh nguồn nhỏ nhất, 717
điểm ảnh, bị phóng 1,7 lần trên màn hình 2x; thẻ ngang thì mục ở 900 cao 643 điểm
ảnh so với 652 ở 901 và ảnh không bị phóng. Bốn ảnh trải hết bề ngang điện thoại
thì mục cao gấp ba màn hình.

Khi lưới cuộn vào tầm nhìn, khung ảnh mở từ dưới lên bằng `clip-path` trong 0,9
giây, ảnh thu từ 1,06 về cỡ thật trong 1,2 giây, huy hiệu hiện dần khi khung đã mở
tới góc trên, bốn thẻ lệch nhau 0,12 giây; chữ bên dưới không chuyển động. Hai
chuyển động là hoạt ảnh chứ không phải chuyển tiếp, để không làm chậm phóng ảnh lúc
rê chuột sau đó; hoạt ảnh chỉ điền trạng thái đầu trong lúc chờ, xong thì trả thuộc
tính về cho quy tắc thường. Chỉ chạy một lần: lưới chỉ được theo dõi sau khi thẻ đã
vẽ, vì trước đó lưới chỉ có dòng đang tải, lộ 20% là chuyện dễ xảy ra mà chưa có
thẻ nào để đánh dấu; khi lưới lộ ra, lớp đánh dấu gắn lên từng thẻ lúc ảnh của thẻ
đã về, vì ảnh tải lười và nhảy tới mục bằng liên kết đầu trang trên mạng chậm thì
lúc lưới lộ ra ảnh chưa có, mở khung lúc ấy chỉ lộ ô trống rồi ảnh bật ra sau. Rê
chuột lên thẻ hay tiêu điểm vào một nhãn thì ảnh phóng 3 phần trăm trong khung và,
ở bốn cột, tấm tên nhấc lên 3 điểm ảnh; giới thiệu và hàng nhãn đứng yên nên không
có gì rời khỏi tay người dùng. Bật giảm chuyển động thì ảnh ở sẵn trạng thái cuối
và rê chuột không phóng. Tương phản cao thì khung ảnh, huy hiệu và nhãn có viền, tấm
tên đứng dưới ảnh thay vì chồm lên. Đo trên điểm ảnh nét chữ ở 1440 và 390, 20 phép
đo, thấp nhất là số project trên nhãn lúc rê chuột, xám phụ trên nền xanh chàm nhạt,
4,64:1; tên track trên nhãn 5,33:1, chức vụ 5,33:1, huy hiệu trên ảnh 17,35:1.

### Mục kêu gọi cuối trang là một điểm xuất phát cụ thể

Khối xanh chàm thứ hai của trang không còn là một câu khẩu hiệu đứng cạnh một
cái nút. Cột trái là tiêu đề, tuyến sáu level thu nhỏ và nút chính; cột phải là
một thẻ trắng ghi đúng một project, cùng cỡ chữ, bóng đổ và đường đứt như cuống
vé với tấm thẻ của hộp tài khoản, bốn số liệu của project mang biểu tượng của
chính khái niệm ấy: level, track, giờ dự kiến (biểu tượng đồng hồ `bt-gio`,
thêm cho mục này) và điểm tích luỹ. Nền là dải chuyển dọc của mẫu slide với tấm
xanh chàm áp sát mép trái của khối, che cột chữ, mờ dần ngay trước mép trái của
thẻ, nên cột thẻ lộ trọn dải từ xanh chàm xuống xanh da trời và thẻ trắng nổi
trên đó như ảnh cạnh tấm xanh chàm ở trang 6 của mẫu (bảng ở mục 6). Lớp ảnh mờ của khung video phủ lên
khối như ở bục xếp hạng, nhưng che bằng hai mặt nạ giao nhau để chỉ hiện ở nửa
phải, sau và quanh thẻ, nơi không có chữ nào trên trường, và tan dần về đáy để
15% dưới cùng, nơi dải đã sang xanh da trời, sạch như ở mẫu; ảnh đặt sát mép
phải và phóng 150% để phần có dòng lệnh của ảnh rơi đúng vào vùng ấy.

Chưa đăng nhập: tiêu đề "Bắt đầu từ project đầu tiên", ga của level xuất phát tô
đặc kèm số project của level, thẻ là project mà phần mở đầu giới thiệu, chọn bằng
chính hàm `chonProject` của `chu-thich-video.js`, nên dòng chú thích dưới khung
video, ba bước và mục này cùng nói về một project; nút chính "Tạo tài khoản" mở
mẫu đăng ký, nút viền "Xem project" trên thẻ mở bảng chi tiết và đóng bảng thì
tiêu điểm về lại nút. Đã đăng nhập: tiêu đề "Đi tiếp từ chỗ bạn đang đứng", ga
nào có project đã hoàn thành thì tô đặc, dưới mỗi ga là "đã xong/tổng" của level
(trình đọc màn hình nghe "8 trên 25 project"), ga của project đề xuất có vòng
ngoài, rồi dòng "Đã xong 8/200 project · 820 điểm tích luỹ"; thẻ là project đứng
đầu `GET /me/recommendations` với câu lý do backend trả về làm dòng chữ duy nhất,
nút "Mở project" đầy màu trên thẻ là việc chính, còn nút "Mở tài khoản của tôi"
lùi về kiểu viền. Hai id `#keu-goi-tieu-de` và `#nut-keu-goi` cùng cách gắn sự
kiện của nút giữ nguyên từ bản trước.

Mục không gọi API: số liệu kho lấy từ sự kiện `kho-da-nap`, tiến độ và đề xuất
đọc từ hai hàm `tomTatTienDo` và `deXuatCuaToi` của `tai-khoan.js`, là ba phản
hồi bảng tài khoản đã tải, xoá khi đăng xuất. Sự kiện `kho-da-nap` chỉ được giữ
dữ liệu lại; `app.js` gọi `keuGoi.ve()` sau khi kho và tiến độ đều đã về, nên mục
đổi trọn một lần chứ không đổi tiêu đề trước rồi thẻ theo sau, kể cả khi mở lại
trang với phiên đã lưu (tiến độ về sau kho). Chưa đăng nhập mà số liệu kho lỗi,
hay đã đăng nhập mà lượt tải tiến độ lỗi, thì tuyến và thẻ ẩn hẳn, mục chỉ còn
tiêu đề và nút như bản trước; có tiến độ mà danh sách đề xuất rỗng thì chỉ thẻ
ẩn. Trong lúc chờ, tuyến và thẻ là hai khối vô hình cao cỡ khối thật, để chân
trang không nhảy; đã khôi phục phiên (lớp `da-dang-nhap` trên body có trước khi
kho về) thì hai khối cao cỡ khối của người đã đăng nhập, thêm dòng số liệu và câu
lý do một dòng, nên bề cao mục chỉ đổi nếu câu lý do dài hai dòng.

Chuyển động chạy một lần khi mục cuộn vào tầm nhìn, chỉ theo dõi khi đã có tuyến
hay thẻ để vẽ; các chuyển tiếp chỉ khai báo cùng lớp `da-hien`, để trạng thái
chờ được đặt tức thì thay vì chạy ngược lúc mở trang. Bật giảm chuyển động thì
mọi thứ hiện sẵn; tương phản cao thì ảnh mờ tắt, đường và ga vẽ bằng màu hệ
thống, ga đặc dùng Highlight như ga đã đạt trên hình leo, ga đề xuất giữ viền
CanvasText dưới vòng ngoài, các ga đứng sẵn ở màu cuối thay vì sáng lên, thẻ và
nút có viền.
Trên 900 điểm ảnh hai cột, từ 900 trở xuống thẻ xuống dưới cột chữ, tấm che
thành mảnh ngang che khối chữ ở trên và mặt nạ đổi hướng để ảnh mờ dồn về phần
dưới, vẫn tan ở đáy; bốn số liệu trên thẻ xếp hai cột khi mỗi cột đủ 150
điểm ảnh cho dòng dài nhất của kho, không thì một cột (thẻ hẹp ở 901–1010 điểm
ảnh); từ 480 trở xuống tên level giấu khỏi mắt, dưới ga chỉ còn con số, nhãn
"25 project" rộng hơn cột 48 điểm ảnh của ga đầu thì tràn vào trong tuyến chứ
không lấn ra lề. Chuyển động chạy khi 30% mục lộ ra, hay khi mục đã choán quá
nửa khung nhìn, để khung nhìn thấp hơn mục (phóng to 400%) vẫn hiện được. Đo
trên điểm ảnh nét chữ ở 1440 và 390, tại đúng chỗ chữ đứng trên tấm che của dải
chuyển, 57 phép đo cho cả mục này lẫn chân trang, thấp nhất là chữ phụ
trên xanh chàm, 4,60:1; chữ trắng 5,33:1, nút viền lúc rê chuột 6,40:1, chữ
trên thẻ từ 10,02:1.

### Chân trang lặng hơn khối xanh trên nó

Chân trang nền trắng phẳng, chữ phụ, không bóng đổ, không chuyển động. Hàng đầu
là ba logo và tên ba đơn vị như ở đầu trang, cao 34, 27 và 23 điểm ảnh, luôn đủ ba
logo và ba dòng vì ở đây có chỗ; cụm này không phải liên kết, vì cụm ở đầu trang
dính đã là liên kết về trang chủ. Ba cột: "Nền
tảng" với năm liên kết tới kho project, lộ trình, bảng xếp hạng, giảng viên và
video hướng dẫn (ở trang chủ liên kết ấy mở hộp video của mục Ba bước, đóng hộp
thì tiêu điểm về liên kết; không có JavaScript hay ở trang kho project thì là neo
tới mục Ba bước); "Số liệu" với năm con số của `GET /stats` là project, level,
track, skill và lộ trình, mỗi con số một biểu tượng của khái niệm ấy, hai biểu
tượng thêm cho chân trang là `bt-skill` (nhãn, vì skill hiện thành nhãn trong bảng
chi tiết) và `bt-lo-trinh` (bậc thang, hình dáng của đường leo); "Liên hệ" với hai
địa chỉ, mỗi địa chỉ một biểu tượng vị trí `bt-dia-diem`, biểu tượng chung duy
nhất của trang. Dưới ba cột là tuyến sáu ga nhỏ làm đường phân cách, rồi dòng bản
quyền với ba đơn vị. Hai trang có cùng một khối chân trang, chỉ khác địa chỉ liên
kết; ở trang kho project chân trang có một đường kẻ trên vì mục trước nền trắng.
Cột số liệu chờ bằng một khoảng cao năm dòng; `GET /stats` lỗi thì cả cột ẩn, hai
cột kia giữ nguyên. Trên 900 điểm ảnh ba cột, từ 900 trở xuống liên kết và số liệu
đứng cạnh nhau, hai địa chỉ xuống hàng riêng. Chữ thấp nhất đo được là chữ phụ
trên nền trắng, 5,32:1.

### Ba trạng thái của một vùng dữ liệu

Mỗi vùng lấy dữ liệu từ backend có ba trạng thái và ba dáng vẻ khác nhau, để
lỗi mạng không trông y hệt đang tải:

| Trạng thái | Hàm | Dáng vẻ |
|---|---|---|
| đang tải hoặc trống | `dongTrong` | một dòng chữ xám |
| lỗi | `dongLoi` | dòng chữ đỏ, biểu tượng cảnh báo, câu hướng dẫn tải lại trang |
| có dữ liệu | hàm vẽ của từng phần | nội dung thật |

Câu hướng dẫn chỉ được thêm khi câu báo lỗi từ backend chưa nói tới việc tải lại
trang, để không nhắc hai lần. Mọi vùng, kể cả bảng xếp hạng, mở đầu bằng dòng
đang tải viết sẵn trong HTML; ở trang chủ, level nào mà lượt gọi riêng của nó
hỏng thì hiện dòng lỗi của level đó, không nói "chưa có project nào". Danh sách
của trang kho giữ sẵn chiều cao một trang 20 dòng trong lúc tải, để chân trang
không vẽ vào giữa màn hình rồi bị đẩy xuống khi danh sách về.

### Hai chi tiết đầu trang

Đầu trang dính có nền trắng đặc, không dùng kính mờ, vì kính mờ là mặc định của
thể loại chứ không phải lựa chọn của thế giới hình ảnh này. Viền dưới của nó chỉ
hiện khi trang đã cuộn, nên lúc chưa cuộn thì đầu trang trắng chạm thẳng vào
khối xanh của phần mở đầu.

Chiều cao đầu trang không cố định, vì nó xuống hai rồi ba hàng khi bề ngang
hẹp. Hàm `theoDoiChieuCaoDauTrang` trong `js/giao-dien.js` ghi chiều cao thật
vào biến `--cao-dau-trang` bằng `ResizeObserver`; khoảng cách chừa lại khi nhảy
tới một mục bằng liên kết neo và vị trí dính của mục lục sáu level ở cột trái
đều đọc biến đó. Nhờ vậy tiêu đề mục và mục lục không bao giờ chui xuống dưới
đầu trang ở bất kỳ bề ngang hay vai người dùng nào. Dưới 360 điểm ảnh bề ngang
hoặc 500 điểm ảnh chiều cao (trang phóng to 400% chẳng hạn) đầu trang cao bằng
nửa màn hình trở lên, nên nó không dính nữa mà cuộn đi cùng trang, và biến trên
bằng 0. Từ 361 tới 372 điểm ảnh thanh điều hướng đã dùng cỡ chữ gọn, để bốn mục
không rơi xuống hai hàng.

Mở trang chủ bằng một địa chỉ có neo, ví dụ liên kết "Bảng xếp hạng" từ trang
kho, thì trình duyệt cuộn tới mục ngay lúc HTML vừa nạp, khi các mục phía trên
còn là dòng "Đang tải…"; nội dung vẽ xong thì mục đã trôi xa. `js/app.js` cuộn
lại tới neo sau khi kho nạp xong và một lần nữa sau khi lộ trình, bảng xếp hạng
và giảng viên nạp xong, trừ khi người dùng đã tự cuộn đi.

Đầu trang co lại 12 điểm ảnh khi trang đã cuộn khỏi đỉnh, và việc đó dùng hai
ngưỡng: bật khi cuộn quá 32 điểm ảnh, tắt khi về dưới 8. Nếu chỉ có một ngưỡng
thì ở ngay quanh ngưỡng đó, đầu trang co lại làm trang ngắn đi, vị trí cuộn tụt
xuống dưới ngưỡng, đầu trang nở ra, vị trí cuộn lại vượt ngưỡng, và cứ thế rung
liên tục. Hàm `danhDauDaCuon` trong `js/giao-dien.js` giữ hai ngưỡng đó.

Vài thứ cố ý không có, vì chúng là dấu hiệu quen thuộc của trang do máy dựng:
nhãn nhỏ viết hoa giãn chữ đặt trên tiêu đề, số thứ tự 01/02/03 làm trang trí,
vòng tròn tiến độ, thẻ lồng trong thẻ, viền màu dày bên trái thẻ, chữ đổ màu
chuyển sắc, hiệu ứng hiện dần giống hệt nhau ở mọi mục, số đếm lên, dải chữ
chạy, vùng sáng theo con trỏ. Ba bước ở trang chủ vẫn đánh số, nhưng bằng bộ
đếm của một danh sách có thứ tự thật, vì ở đó con số mang nghĩa.

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

Giảng viên gắn với track chứ không với từng project. Backend gán mỗi track một
người phụ trách, nên bảng chi tiết project ghi người phụ trách theo track, và mục
giảng viên phụ trách ở cuối trang liệt kê các track của từng người, nối sang trang
kho; nguồn của tên, chức vụ và ảnh ghi ở mục 9.

## 8. Ảnh và video

Mười tệp ảnh, ba tệp của khung video và năm tệp của video hướng dẫn nằm trong
`anh/`. Mười tệp ảnh tổng cộng khoảng 680 kB, trong đó các trang chỉ nạp khoảng
490 kB vì bản gốc của logo Khoa không còn được nạp; ba tệp của khung video cộng lại
1,23 MB, mô tả ở mục 6; năm tệp của video hướng dẫn cộng lại 5,53 MB, mô tả ngay
dưới bảng ảnh.

| Tệp | Kích thước gốc | Dùng ở đâu |
|---|---|---|
| `logo-khoa-ai.png` | 415 × 418, 185 kB | bản gốc, không trang nào nạp; hai bản nhỏ dưới đây dựng từ nó |
| `logo-khoa-ai-96.png` | 96 × 97, 4 kB | đầu trang và chân trang, nơi logo chỉ cao 25 tới 27 điểm ảnh |
| `favicon-48.png` | 48 × 48, 2 kB | biểu tượng trên thanh thẻ của trình duyệt |
| `logo-hoc-vien.png` | 50 × 60 | đầu trang và chân trang, cạnh logo Khoa Trí tuệ nhân tạo |
| `logo-trung-tam-ai.png` | 294 × 230 | đầu trang và chân trang, đứng đầu cụm ba logo |
| `logo-mo.webp` | 792 × 629, 40 kB | logo mờ làm nền ở góc trên bên phải của hai mục sáng (Kho project theo level từ 1420, Bảng xếp hạng từ 641); dựng từ `logo-trung-tam-ai.png` phóng lên 720 điểm ảnh, làm nhoè bán kính 5 và giảm còn 50% độ đục, xem mục 6 |
| `pham-van-cuong.jpg` | 969 × 1024 | mục giảng viên phụ trách |
| `tran-tien-cong.jpg` | 990 × 990 | mục giảng viên phụ trách |
| `do-thanh-ha.jpg` | 717 × 599 | mục giảng viên phụ trách |
| `vu-hoai-nam.jpg` | 1024 × 1021 | mục giảng viên phụ trách |

Ảnh được tải về và lưu trong kho mã nguồn chứ không nhúng đường dẫn từ trang
ngoài. Cách này giữ cho trang chạy được cả khi không có mạng, không phụ thuộc
vào việc trang nguồn còn giữ tệp ở đúng địa chỉ cũ, và không gửi thông tin người
xem sang máy chủ khác.

Video trong khung của phần mở đầu là bản dựng lại từ đoạn "Coding technology"
trên Coverr (coverr.co, 11,5 giây, 1920 × 1080, quay cận cảnh màn hình đang chạy
dòng lệnh). Giấy phép của Coverr cho phép dùng miễn phí cho mục đích thương mại
lẫn phi thương mại, được sửa đổi, không cần ghi công. Đây là video tạm trong lúc
chờ video quay tại phòng thí nghiệm của Học viện; cách thay mô tả ở mục 6.

Video hướng dẫn ở mục Ba bước gồm năm tệp tên bắt đầu bằng `video-huong-dan`. Video quay
chính giao diện này, dài 50,9 giây: một sinh viên tìm và mở project "Đổi tên hàng
loạt file ảnh", đọc bối cảnh và sản phẩm phải nộp, mở gợi ý tầng 1, đăng nhập rồi
nộp đường dẫn mã nguồn; một giảng viên chấm bài "Đạt"; sinh viên mở tài khoản xem
điểm tích luỹ và badge, rồi mở project được đề xuất tiếp theo. Mỗi đoạn có một nhãn
nhỏ ở góc dưới bên trái, trùng tên ba bước trên trang chủ. Tài khoản sinh viên và
giảng viên trên hình là tài khoản hư cấu; phần người phụ trách project trên hình là
hồ sơ công khai, cũng có ở mục giảng viên phụ trách của trang chủ.

| Tệp | Kích thước | Dùng ở đâu |
|---|---|---|
| `video-huong-dan.webm` | 1280 × 720, 50,9 giây, VP9, 2,64 MB | trình duyệt hiểu VP9, nguồn đứng trước |
| `video-huong-dan.mp4` | 1280 × 720, 50,9 giây, H.264, 2,76 MB | trình duyệt còn lại |
| `video-huong-dan.jpg` | 1280 × 720, 112 kB | ảnh chờ của trình phát, và của ô trên màn hình dày điểm ảnh từ gấp ba |
| `video-huong-dan-nho.jpg` | 440 × 248, 17 kB | ảnh thu nhỏ của ô |
| `video-huong-dan.vtt` | ba dòng, 284 byte | phụ đề tiếng Việt, mỗi bước một dòng, đặt đè lên nhãn trên hình |

Video không có tiếng. Thay video là chép đè năm tệp trên bằng bản mới cùng tên,
cùng định dạng, tỷ lệ 16:9; không phải sửa JavaScript hay CSS. Chỉ thời lượng phải
sửa tay, ở ba chỗ trong nút `#o-xem-video` của `index.html`: chữ `0:50`, thuộc tính
`datetime="PT50S"` và `aria-label="Xem video hướng dẫn, 50 giây"`. Thời lượng ghi
tay vì đọc từ tệp thì phải tải video trước khi người xem bấm. Số giây bỏ phần lẻ,
vì thanh điều khiển của Chromium cũng hiện tệp 50,93 giây là 0:50; ô và trình phát
nhờ vậy ghi cùng một số. Video mới có nội dung khác thì sửa cả đoạn tả video
`#hop-video-mo-ta` trong `index.html`. Tệp phụ đề là WebVTT mã UTF-8, dòng đầu là
`WEBVTT`, mốc thời gian nằm trong độ dài video, mỗi mốc kèm
`line:-1 position:1% align:start` để câu nằm ở góc dưới bên trái. Dựng bốn tệp hình
từ một đoạn quay màn hình bằng `ffmpeg`, với mức nén như bản hiện tại:

```sh
LOC="scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p"
ffmpeg -i nguon.mp4 -an -vf "$LOC" -c:v libx264 -preset veryslow -tune stillimage -crf 26 -g 60 -movflags +faststart anh/video-huong-dan.mp4
ffmpeg -i nguon.mp4 -an -vf "$LOC" -c:v libvpx-vp9 -b:v 0 -crf 34 -deadline good -cpu-used 1 -row-mt 1 -g 60 anh/video-huong-dan.webm
ffmpeg -ss 6 -i nguon.mp4 -frames:v 1 -vf "$LOC" anh-cho.png
ffmpeg -i anh-cho.png -vf format=yuvj420p -q:v 3 anh/video-huong-dan.jpg
ffmpeg -i anh-cho.png -vf "scale=440:-2:flags=lanczos,format=yuvj420p" -q:v 4 anh/video-huong-dan-nho.jpg
```

Ảnh chờ là khung hình khoảng một giây sau lúc bảng project mở, ở bản hiện tại là giây
thứ 6. Lấy khung ấy từ nguồn chưa nén thay vì từ tệp mp4 để chữ nét hơn; ảnh vượt 120
kB thì tăng `-q:v` từng bậc cho tới khi dưới mức ấy.

Tệp `quay-video-huong-dan.mjs` quay lại cả video từ giao diện đang chạy, trên một cơ
sở dữ liệu mẫu mới tinh, rồi dựng đủ năm tệp theo đúng các mức trên. Cách chuẩn bị máy
chủ, cài Playwright và chạy ghi ở đầu tệp; giao diện đổi thì sửa phần kịch bản ở cuối
tệp.

Bốn ảnh chân dung có tỷ lệ khác nhau, từ 717 × 599 tới 969 × 1024. Khung ảnh giữ
chung một tỷ lệ 4:5 và cắt bớt phần thừa bằng `object-fit: cover`, với điểm neo
đặt hơi cao hơn giữa khung vì khuôn mặt trong cả bốn ảnh đều nằm ở nửa trên. Tỷ
lệ đặt bằng CSS nên chỗ của ảnh có sẵn trước khi ảnh về; ảnh tải lười vì mục nằm
cuối trang.

Ba logo hiển thị ở ba chiều cao khác nhau, 32 rồi 25 rồi 21 điểm ảnh ở đầu trang
và 34 rồi 27 rồi 23 ở chân trang, đúng theo thứ bậc của ba đơn vị. Logo Học viện
chỉ có bản 50 × 60 điểm ảnh nên đứng cuối ở cỡ nhỏ nhất cũng là vừa, phóng to là
vỡ nét. Chiều cao bằng nhau không có nghĩa là bề ngang bằng nhau: logo Trung tâm
nằm ngang nên ở 32 điểm ảnh chiều cao thì rộng 41, còn logo Học viện đứng nên chỉ
rộng 18. Dưới 810 điểm ảnh, hai logo phụ ở đầu trang được ẩn đi để nhường chỗ cho
khu tài khoản; chân trang thì luôn đủ ba logo và tên ba đơn vị. Ảnh ở chân trang
tải lười vì nằm cuối trang.

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

Toàn bộ nội dung project, level, track, skill, badge, giảng viên và lộ trình nằm
trong bảy tệp JSON tại `../backend/app/seed/`, không nằm trong thư mục này. Tên
sáu level cũng nằm trong đó, ở tệp `levels.json`, nên đổi tên level là sửa một
chỗ duy nhất.
