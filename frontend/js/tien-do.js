/* Bài nộp của người đang đăng nhập, giữ ở một chỗ để cả danh sách project lẫn
   bảng chi tiết project cùng đọc một nguồn. */

import { phien } from './api.js';
import { NHAN_TRANG_THAI } from './giao-dien.js';

// slug project ánh xạ sang bài nộp tiêu biểu của project đó.
const baiNopTheoSlug = new Map();
// slug project ánh xạ sang mọi bài nộp của project đó, bài mới trước. Bảng chi
// tiết cần cả những lần chấm trước: nộp lại sau "Cần sửa lại" mà nhận xét của
// người chấm biến mất thì người học không còn biết mình phải sửa gì.
const cacBaiNopTheoSlug = new Map();

/**
 * Nhận danh sách bài nộp mới nhất từ backend.
 *
 * Một project có thể có nhiều bài nộp, vì người dùng được nộp lại khi bài trước
 * bị trả về. Bài đã được chấm đạt là bài quyết định trạng thái của project, nên
 * nó được giữ lại; khi chưa có bài nào đạt thì lấy bài nộp gần đây nhất. Danh
 * sách backend trả về đã xếp bài mới trước, nên bài đầu tiên gặp là bài mới nhất.
 */
export function dat(danhSach) {
  baiNopTheoSlug.clear();
  cacBaiNopTheoSlug.clear();
  for (const bai of danhSach) {
    const daCo = baiNopTheoSlug.get(bai.project.slug);
    const nenThay = !daCo || (daCo.status !== 'accepted' && bai.status === 'accepted');
    if (nenThay) baiNopTheoSlug.set(bai.project.slug, bai);
    if (!cacBaiNopTheoSlug.has(bai.project.slug)) cacBaiNopTheoSlug.set(bai.project.slug, []);
    cacBaiNopTheoSlug.get(bai.project.slug).push(bai);
  }
}

/** Những bài nộp đã chấm trước bài tiêu biểu của project, bài mới trước. */
export function lichSuBaiNopCua(slug) {
  const tieuBieu = baiNopTheoSlug.get(slug);
  if (!tieuBieu) return [];
  return (cacBaiNopTheoSlug.get(slug) ?? []).filter(
    (bai) => bai.id !== tieuBieu.id && bai.status !== 'pending'
  );
}

/* Số project đã hoàn thành trên tổng số project của từng level, do backend tính.
   Trang chủ chỉ tải sáu project mỗi level nên không tự đếm được con số này. */
let theoLevel = new Map();

export function datTheoLevel(danhSach) {
  theoLevel = new Map(danhSach.map((mot) => [mot.level.id, mot]));
}

/** Tiến độ của một level, hoặc null khi chưa có số liệu. */
export const tienDoLevel = (maLevel) => theoLevel.get(maLevel) ?? null;

export function xoa() {
  baiNopTheoSlug.clear();
  cacBaiNopTheoSlug.clear();
  theoLevel = new Map();
}

export const baiNopCua = (slug) => baiNopTheoSlug.get(slug) ?? null;

export const trangThaiCua = (slug) => baiNopTheoSlug.get(slug)?.status ?? null;

export const daHoanThanh = (slug) => trangThaiCua(slug) === 'accepted';

/**
 * Nhãn của ô đầu hàng project, theo trạng thái của người đang đăng nhập.
 *
 * Ô trông như một ô đánh dấu nhưng không tick được, nên phải nói nó là gì: chưa
 * làm, chờ chấm, cần sửa lại, chưa đạt, đã đạt; hoặc còn khoá vì project tiên
 * quyết chưa xong. Chưa đăng nhập thì ô chỉ giữ chỗ cho trạng thái ấy.
 */
export function oTrangThai(project) {
  if (!phien.daDangNhap) return { khoa: false, nhan: 'Chưa đăng nhập' };
  const trangThaiBai = trangThaiCua(project.slug);
  if (trangThaiBai) return { khoa: false, nhan: NHAN_TRANG_THAI[trangThaiBai] };
  const conThieu = (project.prerequisites ?? []).filter((mot) => !daHoanThanh(mot.slug));
  if (conThieu.length > 0) {
    return {
      khoa: true,
      nhan: `Chưa mở khoá · hoàn thành trước: ${conThieu.map((mot) => mot.title).join(', ')}`,
    };
  }
  return { khoa: false, nhan: 'Chưa làm' };
}
