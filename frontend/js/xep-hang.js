/* Bảng xếp hạng theo điểm tích luỹ. */

import { LoiApi, apiTienDo, phien } from './api.js';
import { $, chu, dongTrong, duongDanAnh, so, theoDoiHienDan } from './giao-dien.js';

const SO_NGUOI = 10;

/** Hai chữ cái đại diện, dùng khi người dùng chưa tải ảnh nào lên. */
function chuCaiDau(ten) {
  const tu = ten.trim().split(/\s+/).filter(Boolean);
  if (tu.length === 0) return '?';
  if (tu.length === 1) return tu[0].slice(0, 2).toUpperCase();
  return (tu[0][0] + tu[tu.length - 1][0]).toUpperCase();
}

/**
 * Một dòng của bảng xếp hạng.
 *
 * Số project đã hoàn thành nằm ngay dưới tên chứ không đứng thành một cột
 * riêng, để hai con số của cùng một người đọc liền mạch thay vì cách nhau một
 * khoảng trống rộng. Dòng của chính người đang đăng nhập được đánh dấu bằng một
 * vạch dọc bên trái và chữ "bạn", nhẹ hơn cách tô nền cả dòng.
 */
function veMotHang(dong) {
  const laToi = phien.daDangNhap && dong.username === phien.nguoiDung.username;
  const ten = dong.display_name || dong.username;
  const soProject = dong.completed_projects;

  return (
    `<div class="xep-hang-hang${laToi ? ' la-toi' : ''}${dong.rank <= 3 ? ' dan-dau' : ''}">` +
    `<span class="xep-hang-so">${dong.rank}</span>` +
    (dong.avatar
      ? `<img class="xep-hang-anh" src="${chu(duongDanAnh(dong.avatar))}" width="40" height="40" alt="">`
      : `<span class="xep-hang-anh xep-hang-chu-cai">${chu(chuCaiDau(ten))}</span>`) +
    '<span class="xep-hang-nguoi">' +
    `<span class="xep-hang-ten">${chu(ten)}` +
    (laToi ? '<i class="xep-hang-ban">bạn</i>' : '') +
    '</span>' +
    `<span class="xep-hang-project">${soProject === 0 ? 'chưa hoàn thành project nào' : `${soProject} project đã hoàn thành`}</span>` +
    '</span>' +
    '<span class="xep-hang-diem">' +
    `<b>${so(dong.total_points)}</b><i>điểm</i>` +
    '</span>' +
    '</div>'
  );
}

export async function nap() {
  const o = $('#xep-hang-o');
  try {
    const danhSach = await apiTienDo.bangXepHang(SO_NGUOI);
    o.innerHTML =
      danhSach.length > 0
        ? danhSach.map(veMotHang).join('')
        : dongTrong('Chưa có tài khoản nào trên hệ thống nên bảng xếp hạng còn trống.');
    theoDoiHienDan();
  } catch (loi) {
    o.innerHTML = dongTrong(loi instanceof LoiApi ? loi.message : 'Không tải được bảng xếp hạng.');
  }
}
