/* Bài nộp của người đang đăng nhập, giữ ở một chỗ để cả danh sách project lẫn
   bảng chi tiết project cùng đọc một nguồn. */

// slug project ánh xạ sang bài nộp tiêu biểu của project đó.
const baiNopTheoSlug = new Map();

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
  for (const bai of danhSach) {
    const daCo = baiNopTheoSlug.get(bai.project.slug);
    const nenThay = !daCo || (daCo.status !== 'accepted' && bai.status === 'accepted');
    if (nenThay) baiNopTheoSlug.set(bai.project.slug, bai);
  }
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
  theoLevel = new Map();
}

export const baiNopCua = (slug) => baiNopTheoSlug.get(slug) ?? null;

export const trangThaiCua = (slug) => baiNopTheoSlug.get(slug)?.status ?? null;

export const daHoanThanh = (slug) => trangThaiCua(slug) === 'accepted';

export const demDaHoanThanh = () =>
  [...baiNopTheoSlug.values()].filter((bai) => bai.status === 'accepted').length;
