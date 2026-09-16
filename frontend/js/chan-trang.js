/* Cột số liệu ở chân trang của cả hai trang: số project, level, track, skill và
   lộ trình của nền tảng, mỗi con số một biểu tượng của chính khái niệm ấy.

   Năm con số đều nằm trong phản hồi của GET /stats, mà phần kho của cả hai trang
   cũng cần ngay lúc mở: js/api.js giữ lại lời hứa của lượt gọi đầu, nên hai bên
   dùng chung một lượt. js/app.js và js/app-kho.js gọi phần này trước phần kho, để
   khi lượt ấy lỗi thì cả hai cùng nhận một lỗi thay vì chân trang gọi lại lần
   hai. Lỗi thì cả cột ẩn, hai cột còn lại giữ nguyên; các phần khác của trang đã
   báo lỗi ấy rồi, chân trang không nhắc lại. */

import { apiCatalog } from './api.js';
import { $, bieuTuong, so } from './giao-dien.js';

/** Năm con số theo thứ tự hiện, kèm biểu tượng và đơn vị. */
const CAC_SO = [
  ['badge-project', (tk) => tk.projects, 'project'],
  ['badge-level', (tk) => tk.by_level.length, 'level'],
  ['badge-track', (tk) => tk.by_track.length, 'track'],
  ['skill', (tk) => tk.skills, 'skill'],
  ['lo-trinh', (tk) => tk.roadmaps, 'lộ trình'],
];

export async function nap() {
  const cot = $('#chan-so-lieu');
  if (cot === null) return;
  try {
    const thongKe = await apiCatalog.thongKe();
    $('#chan-so').innerHTML = CAC_SO.map(
      ([bieu, lay, donVi]) => `<li>${bieuTuong(bieu)}<span><span class="chan-so-gia">${so(lay(thongKe))}</span> ${donVi}</span></li>`
    ).join('');
  } catch {
    cot.hidden = true;
  }
}
