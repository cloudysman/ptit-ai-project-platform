/* Mục nhân sự: danh sách giảng viên phụ trách, lấy từ backend. */

import { LoiApi, apiCatalog } from './api.js';
import { $, chu, dongTrong, theoDoiHienDan } from './giao-dien.js';

function veMotNguoi(nguoi) {
  return (
    '<div class="hien-dan">' +
    `<img class="o-anh" src="anh/${chu(nguoi.photo)}" width="480" height="640" loading="lazy" alt="Ảnh chân dung ${chu(nguoi.name)}">` +
    `<p class="nguoi-ten">${chu(nguoi.name)}</p>` +
    `<p class="nguoi-chuc">${chu(nguoi.title)}</p>` +
    `<p class="nguoi-mo">${chu(nguoi.bio)}</p>` +
    '</div>'
  );
}

export async function nap() {
  const o = $('#nhan-su-luoi');
  try {
    const danhSach = await apiCatalog.danhSachGiangVien();
    o.innerHTML =
      danhSach.length > 0
        ? danhSach.map(veMotNguoi).join('')
        : dongTrong('Chưa có thông tin giảng viên.');
    theoDoiHienDan();
  } catch (loi) {
    o.innerHTML = dongTrong(
      loi instanceof LoiApi ? loi.message : 'Không tải được danh sách giảng viên.'
    );
  }
}
