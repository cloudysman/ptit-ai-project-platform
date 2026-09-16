/* Những mảnh giao diện dùng lại ở nhiều nơi: tìm phần tử, đổi dữ liệu thành
   chữ tiếng Việt, mở và đóng bảng trượt, hiện câu thông báo ngắn. */

import { duongDan } from './goc.js';

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

/**
 * Một biểu tượng SVG lấy từ bộ ký hiệu đặt ở đầu thân trang.
 *
 * Mọi biểu tượng trong trang đều đi qua đây, nên cả trang dùng chung một nét vẽ
 * và một cỡ. Tên là phần sau tiền tố bt- của ký hiệu, ví dụ 'tich', 'dong'.
 */
export const bieuTuong = (ten) => `<svg class="bt" aria-hidden="true"><use href="#bt-${ten}"/></svg>`;

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

/** Người dùng có bật giảm chuyển động trong hệ điều hành hay không. */
export const giamChuyenDong = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Chạy việc một lần khi phần tử sắp cuộn tới, hoặc chạy ngay nếu trình duyệt không
 * theo dõi được.
 *
 * Dùng cho những lượt gọi API chỉ phục vụ một mục ở xa phía dưới: người không cuộn
 * tới mục ấy thì không tốn lượt gọi nào. Lề 400 điểm ảnh cho dữ liệu kịp về trước
 * khi mục lộ ra.
 */
export function khiSapToi(phanTu, viec) {
  if (!('IntersectionObserver' in window)) {
    viec();
    return;
  }
  const quan = new IntersectionObserver(
    ([muc]) => {
      if (!muc.isIntersecting) return;
      quan.disconnect();
      viec();
    },
    { rootMargin: '0px 0px 400px 0px' }
  );
  quan.observe(phanTu);
}

/**
 * Chạy một lần đổi giao diện trong một chuyển cảnh, nếu trình duyệt có View
 * Transitions và người dùng không giảm chuyển động. Không có thì đổi ngay.
 *
 * Trả về lời hứa hoàn thành khi chuyển cảnh xong, để nơi gọi dọn những gì chỉ
 * cần trong lúc chuyển cảnh, ví dụ tên chuyển cảnh gắn tạm lên một phần tử.
 */
export function chuyenCanh(doi) {
  if (typeof document.startViewTransition !== 'function' || giamChuyenDong()) {
    doi();
    return Promise.resolve();
  }
  const chuyen = document.startViewTransition(doi);
  // Trình duyệt đôi khi hoãn việc gọi hàm đổi giao diện tới vài giây trong lúc
  // trang đứng yên ở khung hình cũ. Quá 300 mili giây mà chưa gọi thì bỏ chuyển
  // cảnh: hàm đổi chạy ngay, chỉ mất hiệu ứng ở lượt đó.
  const canhGac = setTimeout(() => chuyen.skipTransition(), 300);
  const thoiGac = () => clearTimeout(canhGac);
  chuyen.updateCallbackDone.then(thoiGac, thoiGac);
  return chuyen.finished.catch(() => {});
}

/** Đường dẫn tới ảnh đại diện, rỗng nếu người dùng chưa tải ảnh nào. */
export const duongDanAnh = (tenTep) => (tenTep ? duongDan(`anh-dai-dien/${tenTep}`) : '');

/**
 * Hai chữ cái đại diện cho một người dùng.
 *
 * Lấy chữ đầu của từ đầu và từ cuối trong tên hiển thị, ví dụ "Trần Tiến Công"
 * thành TC. Tên chỉ có một từ thì lấy hai chữ cái đầu của từ đó. Dùng ở khu tài
 * khoản và ở bảng xếp hạng, những chỗ người dùng chưa tải ảnh nào lên.
 */
export function chuCaiDau(ten) {
  const tu = String(ten ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tu.length === 0) return '?';
  if (tu.length === 1) return tu[0].slice(0, 2).toUpperCase();
  return (tu[0][0] + tu[tu.length - 1][0]).toUpperCase();
}

/* Lịch sử trình duyệt cho những lớp phủ: bảng trượt, hộp đăng nhập, hộp video.

   Trên điện thoại, nút Back là cách đóng tự nhiên nhất, và không có mốc lịch sử
   thì nó thoát hẳn khỏi trang. Mỗi lớp mở ra ghi một mốc; Back lấy mốc đó đi và
   lớp trên cùng đóng lại. Đóng bằng cách khác (Escape, nút Đóng, bấm ra nền) thì
   lùi lịch sử một bước để mốc không nằm lại: nếu không, Back tiếp theo chỉ xoá
   mốc thừa mà không thấy gì đổi. Lượt lùi tự gây ra được đếm để bỏ qua sự kiện
   popstate của chính nó. */

// Hàm đóng của từng lớp đang mở, lớp mở sau nằm cuối.
const cacLopMo = [];
let soLanTuLui = 0;

/**
 * Ghi mốc lịch sử cho một lớp vừa mở. Tham số là hàm đóng lớp đó; hàm được gọi
 * khi người dùng bấm Back, và phải chịu được việc mốc đã không còn (xoaMocMo với
 * cùng hàm sẽ không lùi lịch sử nữa).
 */
export function ghiMocMo(dong) {
  if (cacLopMo.includes(dong)) return;
  cacLopMo.push(dong);
  // Chỉ thêm khoá riêng vào trạng thái hiện có, phần khác của trang (bộ lọc kho)
  // cũng ghi trạng thái vào lịch sử.
  history.pushState({ ...(history.state ?? {}), lopMo: cacLopMo.length }, '', location.href);
}

/** Bỏ mốc của một lớp vừa đóng bằng cách khác Back. */
export function xoaMocMo(dong) {
  const viTri = cacLopMo.lastIndexOf(dong);
  if (viTri < 0) return;
  const laTrenCung = viTri === cacLopMo.length - 1;
  cacLopMo.splice(viTri, 1);
  if (laTrenCung && history.state?.lopMo === viTri + 1) {
    soLanTuLui += 1;
    history.back();
  }
}

window.addEventListener('popstate', () => {
  if (soLanTuLui > 0) {
    soLanTuLui -= 1;
    return;
  }
  const dong = cacLopMo.pop();
  if (dong) dong();
});

/* Bảng trượt bên phải. Cả trang chỉ mở một bảng tại một thời điểm, nên phần
   quản lý lớp nền và phím Escape gom về đây thay vì lặp ở từng bảng. */

let bangDangMo = null;
// Phần tử đang được bấm lúc bảng mở ra, để đóng bảng thì trả tiêu điểm về đó.
let noiTraTieuDiem = null;
// Bảng tài khoản hay bảng chấm bài bị bảng project thay chỗ, cùng vị trí cuộn
// của nó: đóng bảng project thì bảng kia mở lại đúng chỗ đang đọc, thay vì mất hẳn.
let bangTruoc = null;

const dongBangTheoLichSu = () => dongBang({ tuLichSu: true });

/** Bỏ ý định mở lại bảng trước; gọi khi phiên kết thúc và bảng đó không còn nội dung. */
export function quenBangTruoc() {
  bangTruoc = null;
}

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

export function moBang(maBang, { cuonToi = 0 } = {}) {
  // Mở một bảng khác từ trong bảng đang mở thì tiêu điểm vẫn phải quay về đúng
  // chỗ đã mở bảng đầu tiên, chứ không rơi vào một phần tử vừa bị đóng.
  const doiBang = bangDangMo !== null;
  if (doiBang) {
    bangTruoc =
      maBang === 'bang-project' && bangDangMo.id !== 'bang-project'
        ? { id: bangDangMo.id, cuon: bangDangMo.scrollTop }
        : null;
    dongBang({ traTieuDiem: false, giuMoc: true });
  } else {
    noiTraTieuDiem = document.activeElement;
  }

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
  bang.scrollTop = cuonToi;
  bangDangMo = bang;
  ghiMocMo(dongBangTheoLichSu);
  // Người dùng bàn phím phải vào được ngay nội dung vừa mở, thay vì tiếp tục đi
  // qua phần trang đang bị lớp nền che.
  bang.querySelector('[data-dong]')?.focus();
}

/**
 * Đóng bảng đang mở.
 *
 * giuMoc: đang đổi sang bảng khác, mốc lịch sử của lớp bảng giữ nguyên.
 * tuLichSu: đóng vì người dùng bấm Back, mốc đã bị lấy đi nên không lùi thêm.
 */
export function dongBang({ traTieuDiem = true, giuMoc = false, tuLichSu = false } = {}) {
  if (!bangDangMo) return;
  bangDangMo.classList.remove('dang-mo');
  bangDangMo.setAttribute('aria-hidden', 'true');
  bangDangMo.inert = true;
  $('#lop-nen').classList.remove('dang-mo');
  document.body.classList.remove('khoa-cuon');
  catPhanTrangPhiaSau(null);
  bangDangMo = null;

  if (!giuMoc && bangTruoc) {
    // Bảng tài khoản mở lại ngay tại chỗ. Đóng bằng Escape thì mốc của lớp bảng
    // vẫn còn và ghiMocMo bỏ qua lớp đã có; đóng bằng Back thì mốc đã mất và
    // moBang ghi mốc mới.
    const quayVe = bangTruoc;
    bangTruoc = null;
    const noiTra = noiTraTieuDiem;
    moBang(quayVe.id, { cuonToi: quayVe.cuon });
    noiTraTieuDiem = noiTra;
    return;
  }
  if (!giuMoc && !tuLichSu) xoaMocMo(dongBangTheoLichSu);
  if (traTieuDiem) {
    // Nút đã mở bảng có thể không còn trong trang: khu tài khoản được vẽ lại mỗi
    // lần tải tiến độ, ngay sau khi bảng tài khoản mở ra. Khi đó tiêu điểm về nút
    // chính của khu tài khoản mới, thay vì rơi ra body.
    const dich = noiTraTieuDiem?.isConnected
      ? noiTraTieuDiem
      : document.querySelector('#khu-tai-khoan [data-mo-tai-khoan], #khu-tai-khoan [data-mo-dang-nhap]');
    dich?.focus();
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

/** Một dòng chữ cho vùng chưa có dữ liệu hoặc đang chờ dữ liệu. */
export const dongTrong = (noiDung) => `<p class="dang-tai">${chu(noiDung)}</p>`;

/**
 * Một dòng báo lỗi cho vùng không tải được dữ liệu.
 *
 * Khác dòng trống ở màu và biểu tượng, để lỗi mạng không trông y hệt đang tải,
 * và luôn kèm một câu nói phải làm gì tiếp.
 */
export function dongLoi(noiDung) {
  // Câu báo lỗi từ lớp gọi API đôi khi đã nói "tải lại trang", không nhắc hai lần.
  const huong = /tải lại/i.test(noiDung) ? '' : ' Tải lại trang rồi thử lại.';
  return `<p class="dang-tai loi">${bieuTuong('loi')}<span>${chu(noiDung)}${huong}</span></p>`;
}

/**
 * Ghi chiều cao thật của đầu trang vào một biến CSS.
 *
 * Đầu trang dính xuống hai rồi ba hàng khi bề ngang hẹp, nên chiều cao của nó
 * không phải hằng số. Khoảng cách chừa lại khi nhảy tới một mục bằng liên kết
 * neo đọc biến này, nhờ vậy tiêu đề mục không bao giờ chui xuống dưới đầu trang.
 */
/**
 * Đánh dấu trang đã cuộn khỏi đỉnh, để đầu trang co lại một chút.
 *
 * Hai ngưỡng khác nhau cho bật và tắt. Đầu trang co lại làm trang ngắn đi 12
 * điểm ảnh; nếu chỉ có một ngưỡng thì ở ngay quanh ngưỡng đó, co lại kéo vị trí
 * cuộn tụt xuống dưới ngưỡng, đầu trang nở ra, vị trí cuộn lại vượt ngưỡng, và
 * cứ thế rung liên tục.
 */
export function danhDauDaCuon() {
  const daCuon = document.body.classList.contains('da-cuon');
  document.body.classList.toggle('da-cuon', window.scrollY > (daCuon ? 8 : 32));
}

export function theoDoiChieuCaoDauTrang() {
  const dauTrang = $('.dau-trang');
  if (dauTrang === null) return;
  // Màn hình rất hẹp hoặc rất thấp thì đầu trang không còn dính (xem tệp kiểu),
  // nên không có gì che nội dung và biến này phải bằng 0.
  const ghi = () => {
    const dinh = getComputedStyle(dauTrang).position === 'sticky';
    document.documentElement.style.setProperty('--cao-dau-trang', `${dinh ? dauTrang.offsetHeight : 0}px`);
  };
  ghi();
  if ('ResizeObserver' in window) new ResizeObserver(ghi).observe(dauTrang);
  window.addEventListener('resize', ghi);
}
