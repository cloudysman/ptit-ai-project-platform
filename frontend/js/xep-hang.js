/* Bảng xếp hạng theo điểm tích luỹ.

   Ba người dẫn đầu đứng trên một bục đặt trong trường xanh của Trung tâm: mỗi
   người một cột, phần bục dưới chân cao theo tỷ lệ điểm so với người đứng đầu,
   nên chênh lệch điểm nhìn ra ngay trước khi đọc số. Những người còn lại xếp
   thành hàng bên cạnh, mỗi hàng có một thanh điểm mờ dài theo cùng tỷ lệ.

   Bục và thanh điểm chỉ dựng lên khi mục cuộn vào tầm nhìn, và chỉ một lần: lần
   vẽ lại sau khi đăng nhập hay sau khi có bài được chấm không dựng lại, vì lúc ấy
   người xem đang nhìn vào bảng. Bật giảm chuyển động thì bảng hiện sẵn ở trạng
   thái cuối. Người đang đăng nhập có dòng của mình được đánh dấu; chưa vào nhóm
   dẫn đầu thì có một dòng số điểm của họ dưới bảng, lấy từ phiên hiện tại, là số
   mà lượt tải tiến độ vừa cập nhật trước khi bảng này vẽ lại. */

import { LoiApi, apiTienDo, phien } from './api.js';
import { $, bieuTuong, chu, chuCaiDau, dongLoi, dongTrong, duongDanAnh, giamChuyenDong, so, soDiem } from './giao-dien.js';

const SO_NGUOI = 10;
const SO_TREN_BUC = 3;

const laToi = (dong) => phien.daDangNhap && dong.username === phien.nguoiDung.username;

const tenCua = (dong) => dong.display_name || dong.username;

/** Tỷ lệ điểm so với người đứng đầu, làm bề cao bục và bề dài thanh điểm. */
const tiLeCua = (dong, diemCaoNhat) => (diemCaoNhat > 0 ? (dong.total_points / diemCaoNhat).toFixed(3) : '0');

function veAnh(dong, lop) {
  return dong.avatar
    ? `<img class="${lop}" src="${chu(duongDanAnh(dong.avatar))}" alt="" loading="lazy">`
    : `<span class="${lop} la-chu-cai">${chu(chuCaiDau(tenCua(dong)))}</span>`;
}

const nhanBan = (dong) => (laToi(dong) ? '<i class="xh-ban">bạn</i>' : '');

/** Số project đã hoàn thành vẽ thành hàng ô đánh dấu trên bục, tối đa SO_O_TICH ô; nhiều hơn thì ghi phần dư. */
const SO_O_TICH = 10;
function hangTich(dong) {
  const n = dong.completed_projects;
  if (n <= 0) return '';
  const cacO = Array.from({ length: Math.min(n, SO_O_TICH) }, (_, j) => `<span class="o-tich" style="--j:${j}">${bieuTuong('tich')}</span>`).join('');
  return `<span class="buc-tich" aria-hidden="true">${cacO}${n > SO_O_TICH ? `<span class="buc-tich-du">+${so(n - SO_O_TICH)}</span>` : ''}</span>`;
}

const diemCoBieuTuong = (dong, lop) => `<span class="${lop}">${bieuTuong('badge-diem')}${so(dong.total_points)}<small> điểm</small></span>`;

const projectCoBieuTuong = (dong, lop) => `<span class="${lop}">${bieuTuong('badge-project')}${so(dong.completed_projects)} project</span>`;

/**
 * Một cột trên bục. Thứ tự trong DOM theo hạng, còn vị trí trên bục do CSS xếp:
 * hạng 1 ở giữa. Số hạng nằm trong vòng tròn đánh số ở góc ảnh, cùng ngữ pháp
 * với ga level; hàng ô đánh dấu dưới chân là số project đã hoàn thành, cùng ô
 * đánh dấu với hình bước hai ở mục Ba bước.
 */
function veCot(dong, chiSo, diemCaoNhat) {
  return (
    `<li class="buc-cot hang-${dong.rank}${laToi(dong) ? ' la-toi' : ''}" style="--i:${chiSo};--ti-le:${tiLeCua(dong, diemCaoNhat)}">` +
    '<div class="buc-the">' +
    `<span class="buc-anh-khung">${veAnh(dong, 'buc-anh')}<span class="buc-hang">${dong.dongHang ? '=' : ''}${dong.hangHienThi}</span></span>` +
    `<span class="buc-ten"><span>${chu(tenCua(dong))}</span>${nhanBan(dong)}</span>` +
    `<span class="buc-user">${chu(dong.username)}</span>` +
    diemCoBieuTuong(dong, 'buc-diem') +
    projectCoBieuTuong(dong, 'buc-pj') +
    '</div>' +
    `<span class="buc-than">${hangTich(dong)}</span>` +
    '</li>'
  );
}

function veHang(dong, chiSo, diemCaoNhat) {
  return (
    `<li class="xh-hang${laToi(dong) ? ' la-toi' : ''}" style="--i:${chiSo};--ti-le:${tiLeCua(dong, diemCaoNhat)}">` +
    `<span class="xh-so">${dong.dongHang ? '=' : ''}${dong.hangHienThi}</span>` +
    veAnh(dong, 'xh-anh') +
    '<span class="xh-nguoi">' +
    `<span class="xh-ten"><span>${chu(tenCua(dong))}</span>${nhanBan(dong)}</span>` +
    `<span class="xh-user">${chu(dong.username)}</span>` +
    '</span>' +
    projectCoBieuTuong(dong, 'xh-pj') +
    diemCoBieuTuong(dong, 'xh-diem') +
    '</li>'
  );
}

/**
 * Dòng điểm của người đang đăng nhập khi họ không có mặt trong bảng.
 *
 * Bảng lấy tối đa SO_NGUOI người, nên vắng mặt khi bảng chưa đầy nghĩa là người
 * này không được xếp hạng: giảng viên là người chấm, backend không đưa vào bảng.
 * Khi ấy không có gì để nói. Bảng đầy mà vắng mặt thì họ đứng sau nhóm dẫn đầu.
 */
function veDongToi(danhSach) {
  if (!phien.daDangNhap || phien.laGiangVien) return '';
  if (danhSach.length < SO_NGUOI || danhSach.some(laToi)) return '';
  return `<p class="xh-toi">Bạn có ${soDiem(phien.nguoiDung.total_points)} tích luỹ, ngoài nhóm ${SO_NGUOI} người dẫn đầu.</p>`;
}

/**
 * Số hạng hiển thị: người bằng điểm và bằng số project với người đứng ngay trên
 * thì cùng hạng với người ấy, thay vì hơn kém nhau chỉ vì thứ tự tạo tài khoản.
 * Vị trí trên bục vẫn theo hạng của backend, chỉ con số ghi ra là đổi.
 */
function ganHangHienThi(danhSach) {
  let hangTruoc = null;
  return danhSach.map((dong, chiSo) => {
    const truoc = danhSach[chiSo - 1];
    const dongHang =
      truoc && truoc.total_points === dong.total_points && truoc.completed_projects === dong.completed_projects;
    hangTruoc = dongHang ? hangTruoc : dong.rank;
    return { ...dong, hangHienThi: hangTruoc, dongHang };
  });
}

function veBang(danhSachGoc) {
  const danhSach = ganHangHienThi(danhSachGoc);
  const diemCaoNhat = danhSach[0].total_points;
  const tren = danhSach.slice(0, SO_TREN_BUC);
  const duoi = danhSach.slice(SO_TREN_BUC);
  return (
    '<div class="xh-luoi">' +
    `<ol class="buc" aria-label="${tren.length === 1 ? 'Người dẫn đầu' : `${so(tren.length)} người dẫn đầu`}">` +
    tren.map((dong, chiSo) => veCot(dong, chiSo, diemCaoNhat)).join('') +
    '</ol>' +
    (duoi.length > 0
      ? `<ol class="xh-ds" start="${SO_TREN_BUC + 1}" aria-label="Từ hạng ${SO_TREN_BUC + 1} tới hạng ${danhSach.length}">` +
        duoi.map((dong, chiSo) => veHang(dong, chiSo, diemCaoNhat)).join('') +
        '</ol>'
      : '') +
    '</div>' +
    veDongToi(danhSach)
  );
}

export async function nap() {
  const o = $('#xep-hang-o');
  try {
    const danhSach = await apiTienDo.bangXepHang(SO_NGUOI);
    o.innerHTML = danhSach.length > 0 ? veBang(danhSach) : dongTrong('Chưa có sinh viên nào trên bảng xếp hạng.');
  } catch (loi) {
    o.innerHTML = dongLoi(loi instanceof LoiApi ? loi.message : 'Không tải được bảng xếp hạng.');
  }
}

/**
 * Bục và thanh điểm dựng lên khi bảng cuộn vào tầm nhìn, một lần cho cả trang.
 *
 * Lớp co-chuyen-dong chỉ gắn khi chuyển động thật sự chạy, nên không có
 * JavaScript hay bật giảm chuyển động thì bảng ở sẵn trạng thái cuối. Lớp
 * da-hien gắn lên khung ngoài, không phải nội dung, nên các lần vẽ lại nội dung
 * sau đó không dựng lại bục.
 */
export function khoiTao() {
  const o = $('#xep-hang-o');
  if (o === null) return;
  if (giamChuyenDong() || !('IntersectionObserver' in window)) return;
  o.classList.add('co-chuyen-dong');
  const quan = new IntersectionObserver(
    ([muc]) => {
      if (!muc.isIntersecting) return;
      quan.disconnect();
      o.classList.add('da-hien');
    },
    { threshold: 0.3 }
  );
  quan.observe(o);
}
