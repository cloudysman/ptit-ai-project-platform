/* Những mảnh giao diện dùng lại ở nhiều nơi: tìm phần tử, đổi dữ liệu thành
   chữ tiếng Việt, mở và đóng bảng trượt, hiện câu thông báo ngắn. */

export const $ = (chonLoc, goc = document) => goc.querySelector(chonLoc);
export const $$ = (chonLoc, goc = document) => Array.from(goc.querySelectorAll(chonLoc));

/**
 * Đổi ký tự đặc biệt thành thực thể HTML.
 *
 * Nội dung project do người quản trị nhập, còn ghi chú và đường dẫn của bài nộp
 * do người dùng nhập. Mọi chuỗi đi vào innerHTML đều phải qua hàm này, nếu
 * không một dấu ngoặc nhọn trong ghi chú cũng đủ làm hỏng phần còn lại của trang.
 */
export function chu(gia) {
  return String(gia ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Số nguyên có dấu ngăn nhóm nghìn theo cách viết tiếng Việt. */
export const so = (gia) => Number(gia ?? 0).toLocaleString('vi-VN');

/**
 * Mốc thời gian từ backend luôn theo UTC, đổi sang giờ địa phương khi hiển thị.
 *
 * Thứ tự ngày trước giờ được ghép tay thay vì để trình duyệt tự chọn, vì cách
 * xếp mặc định của tiếng Việt đặt giờ lên trước và câu "nộp lúc 18:54
 * 29/08/2026" đọc rất khó.
 */
export function thoiGian(chuoiIso) {
  if (!chuoiIso) return '';
  const moc = new Date(chuoiIso);
  const hai = (gia) => String(gia).padStart(2, '0');
  return (
    `${hai(moc.getDate())}/${hai(moc.getMonth() + 1)}/${moc.getFullYear()} ` +
    `${hai(moc.getHours())}:${hai(moc.getMinutes())}`
  );
}

/** Nhãn tiếng Việt cho bốn trạng thái bài nộp của backend. */
export const NHAN_TRANG_THAI = {
  pending: 'Chờ chấm',
  accepted: 'Đạt',
  rejected: 'Chưa đạt',
  revision: 'Cần sửa lại',
};

/** Tên đầy đủ của một level, ví dụ: Level 2 · Think. */
export const tenLevel = (level) => `Level ${level.id} · ${level.name}`;

/** Số giờ dự kiến của một project. */
export const soGio = (gio) => `${gio} giờ`;

/** Số điểm tích luỹ, kèm đơn vị. */
export const soDiem = (diem) => `${so(diem)} điểm`;

/** Đường dẫn tới ảnh đại diện, rỗng nếu người dùng chưa tải ảnh nào. */
export const duongDanAnh = (tenTep) => (tenTep ? `/anh-dai-dien/${tenTep}` : '');

/* Bảng trượt bên phải. Cả trang chỉ mở một bảng tại một thời điểm, nên phần
   quản lý lớp nền và phím Escape gom về đây thay vì lặp ở từng bảng. */

let bangDangMo = null;
// Phần tử đang được bấm lúc bảng mở ra, để đóng bảng thì trả tiêu điểm về đó.
let noiTraTieuDiem = null;

/**
 * Cắt hay nối lại phần trang nằm sau lớp nền.
 *
 * Bảng trượt che gần hết màn hình, nhưng phần trang phía sau vẫn nằm trong thứ
 * tự nhấn phím Tab. Không cắt thì chỉ vài lần Tab là tiêu điểm đã ra tới liên
 * kết ở đầu trang, chỗ mà chuột bấm không tới được vì lớp nền chắn ngang.
 */
function catPhanTrangPhiaSau(bangMo) {
  for (const o of document.body.children) {
    if (o.id === 'thong-bao' || o.id === 'lop-nen' || o === bangMo) continue;
    if (o.classList.contains('bang') || o.tagName === 'DIALOG' || o.tagName === 'SCRIPT') continue;
    o.inert = bangMo !== null;
  }
}

export function moBang(maBang) {
  // Mở một bảng khác từ trong bảng đang mở thì tiêu điểm vẫn phải quay về đúng
  // chỗ đã mở bảng đầu tiên, chứ không rơi vào một phần tử vừa bị đóng.
  const doiBang = bangDangMo !== null;
  if (doiBang) dongBang({ traTieuDiem: false });
  else noiTraTieuDiem = document.activeElement;

  const bang = document.getElementById(maBang);
  bang.classList.add('dang-mo');
  bang.setAttribute('aria-hidden', 'false');
  // Bảng đóng vẫn nằm trong trang, chỉ bị đẩy ra ngoài màn hình. Thuộc tính
  // inert cắt nó khỏi thứ tự nhấn phím Tab và khỏi trình đọc màn hình, nếu
  // không người dùng bàn phím sẽ lạc vào một bảng đang không nhìn thấy.
  bang.inert = false;
  $('#lop-nen').classList.add('dang-mo');
  // Trang phía sau bị khoá cuộn, nếu không thì lăn chuột ở ngoài bảng làm trang
  // nền chạy trong khi thứ người dùng đang đọc đứng yên.
  document.body.classList.add('khoa-cuon');
  catPhanTrangPhiaSau(bang);
  bang.scrollTop = 0;
  bangDangMo = bang;
  // Người dùng bàn phím phải vào được ngay nội dung vừa mở, thay vì tiếp tục đi
  // qua phần trang đang bị lớp nền che.
  bang.querySelector('[data-dong]')?.focus();
}

export function dongBang({ traTieuDiem = true } = {}) {
  if (!bangDangMo) return;
  bangDangMo.classList.remove('dang-mo');
  bangDangMo.setAttribute('aria-hidden', 'true');
  bangDangMo.inert = true;
  $('#lop-nen').classList.remove('dang-mo');
  document.body.classList.remove('khoa-cuon');
  catPhanTrangPhiaSau(null);
  bangDangMo = null;
  if (traTieuDiem) {
    noiTraTieuDiem?.focus();
    noiTraTieuDiem = null;
  }
}

/** Đặt mọi bảng về trạng thái đóng ngay khi trang vừa mở. */
export function chuanBiCacBang() {
  $$('.bang').forEach((bang) => {
    bang.inert = true;
  });
}

/** Câu thông báo ngắn ở góc dưới, tự biến mất sau vài giây. */
export function thongBao(noiDung, loai = 'thuong') {
  const o = $('#thong-bao');
  const dong = document.createElement('p');
  dong.className = `thong-bao-dong ${loai}`;
  dong.textContent = noiDung;
  o.append(dong);
  setTimeout(() => dong.remove(), 5000);
}

/** Một dòng chữ nghiêng cho vùng chưa có dữ liệu hoặc đang chờ dữ liệu. */
export const dongTrong = (noiDung) => `<p class="dang-tai">${chu(noiDung)}</p>`;

/* Hiện dần theo cuộn.

   Phần lớn nội dung của trang được dựng sau khi gọi API, và mỗi lần đổi bộ lọc
   là một lần dựng lại. Nếu chỉ quét một lần lúc mở trang thì những phần dựng sau
   giữ nguyên độ mờ bằng không, nghĩa là biến mất khỏi màn hình. Vì vậy phần này
   dùng IntersectionObserver: mỗi lần vẽ xong, nơi vẽ gọi lại theoDoiHienDan để
   đăng ký những phần tử vừa thêm. */

let boQuanSat = null;

export function batDauHienDan() {
  if (!('IntersectionObserver' in window)) {
    // Trình duyệt quá cũ thì bỏ hiệu ứng, miễn là chữ vẫn đọc được.
    $$('.hien-dan').forEach((o) => o.classList.add('da-hien'));
    return;
  }

  boQuanSat = new IntersectionObserver(
    (cacMuc) => {
      for (const muc of cacMuc) {
        if (!muc.isIntersecting) continue;
        muc.target.classList.add('da-hien');
        boQuanSat.unobserve(muc.target);
      }
    },
    { rootMargin: '0px 0px -60px 0px' }
  );
  theoDoiHienDan();
}

/** Đăng ký những phần tử chờ hiện mà chưa được theo dõi. */
export function theoDoiHienDan() {
  if (boQuanSat === null) {
    $$('.hien-dan').forEach((o) => o.classList.add('da-hien'));
    return;
  }
  $$('.hien-dan:not(.da-hien)').forEach((o) => boQuanSat.observe(o));
}
