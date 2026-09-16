/* Dòng chú thích ngay dưới khung video của phần mở đầu.

   Khung video chỉ là hình: dòng lệnh chạy trên màn hình, không nói gì về kho.
   Dòng chữ bên dưới, nằm ngoài khung, mới là chỗ mang nội dung: tên project ít
   giờ nhất của level thấp nhất, số giờ dự kiến của nó, và level ấy có bao nhiêu
   project. Cả dòng là một nút, bấm thì mở bảng chi tiết của project đó, giống
   một dòng trong danh sách project ở phía dưới trang.

   Câu chữ chỉ nói điều kho project khẳng định được: không có trạng thái, không
   có thanh tiến độ, không ngụ ý có ai đang làm project này. Video cũng không
   phải cảnh quay của project này, nên dòng chữ không phải figcaption của khung
   mà là một nút đứng cạnh nó.

   Dữ liệu lấy từ sự kiện KHO_DA_NAP của js/kho.js, không gọi API lần nữa. Trong
   lúc chờ, nút rỗng chỉ giữ chỗ: lớp dang-cho làm nó vô hình, tabindex -1 và
   aria-hidden đưa nó ra khỏi phím Tab và trình đọc màn hình. API lỗi thì js/kho.js
   ẩn hẳn nút cùng các cụm số liệu khác mang data-can-so-lieu; kho không có
   project nào thì tệp này ẩn nút. Không bao giờ hiện một dòng rỗng hay một dòng
   đang tải. */

import { $, bieuTuong, chu, so, soGio } from './giao-dien.js';
import { moProject } from './project.js';
import { SU_KIEN, nghe } from './su-kien.js';

/**
 * Chọn project để giới thiệu: project ít giờ nhất của level thấp nhất có project.
 *
 * Trang chủ tải sáu project mỗi level theo cách xếp 'level' của backend: level
 * tăng dần, rồi số giờ tăng dần, rồi mã project. Nhờ cách xếp đó, project đầu
 * tiên là project ít giờ nhất của cả level; câu "ít giờ nhất trong N project"
 * dựa vào điều này, với N là số project của level lấy từ số liệu tổng quan. Hàm
 * trả thêm hai cờ để câu chữ lùi về cách nói an toàn hơn:
 *
 * - daXepTheoGio: sáu bản ghi có số giờ không giảm. Đây là phép thử thô, không
 *   chứng minh được cách xếp, nhưng bắt được trường hợp hay gặp nhất là ai đó
 *   đổi cách xếp khiến số giờ không còn tăng dần; khi đó câu chữ bỏ phần so sánh.
 * - dongHang: có project khác trong sáu bản ghi cùng số giờ nhỏ nhất. Khi đó
 *   project này chỉ là một trong những project ít giờ nhất.
 */
export function chonProject({ thongKe, theoLevel }) {
  const cacLevel = [...thongKe.by_level].sort((a, b) => a.level.id - b.level.id);
  for (const mot of cacLevel) {
    const nhom = theoLevel.get(mot.level.id) ?? [];
    if (nhom.length === 0) continue;
    const daXepTheoGio = nhom.every((p, i) => i === 0 || p.estimated_hours >= nhom[i - 1].estimated_hours);
    const project = nhom[0];
    const dongHang = nhom.slice(1).some((p) => p.estimated_hours === project.estimated_hours);
    return { project, level: mot.level, soProjectCuaLevel: mot.projects, daXepTheoGio, dongHang };
  }
  return null;
}

/** Câu số liệu dưới tên project. */
function cauSoLieu({ project, level, soProjectCuaLevel, daXepTheoGio, dongHang }) {
  const gio = soGio(project.estimated_hours);
  if (!daXepTheoGio || soProjectCuaLevel <= 1) return `Dự kiến ${gio}, thuộc level ${level.name}.`;
  if (dongHang) return `Dự kiến ${gio}, một trong những project ít giờ nhất của level ${level.name}.`;
  return `Dự kiến ${gio}, ít giờ nhất trong ${so(soProjectCuaLevel)} project của level ${level.name}.`;
}

export function khoiTao() {
  const nut = $('#chu-thich-video');
  if (nut === null) return;

  nghe(SU_KIEN.KHO_DA_NAP, (duLieu) => {
    const chon = duLieu ? chonProject(duLieu) : null;
    if (chon === null) {
      nut.hidden = true;
      return;
    }
    const { project } = chon;
    // Viết "ít giờ nhất" chứ không viết "ít nhất": đứng ngay sau "3 giờ", chữ
    // "ít nhất" dễ bị đọc thành "tối thiểu 3 giờ".
    const cau = cauSoLieu(chon);

    nut.dataset.slug = project.slug;
    // Dấu cách giữa hai dòng không hiện ra (khoảng trắng giữa hai phần tử con của
    // flex bị bỏ qua khi xếp chữ) nhưng giữ cho tên trợ năng của nút không dính
    // "ảnhDự" ở trình duyệt nào không tự chèn dấu cách giữa hai khối.
    nut.innerHTML =
      `<span class="chu-thich-ten"><span>${chu(project.title)}</span>${bieuTuong('mui-ten')}</span> ` +
      `<span class="chu-thich-mo">${chu(cau)}</span>`;
    nut.classList.remove('dang-cho');
    nut.removeAttribute('tabindex');
    nut.removeAttribute('aria-hidden');
  });

  // Truyền chính nút làm nguồn, để tên project bay từ dòng chú thích lên tiêu
  // đề bảng như khi bấm một dòng trong danh sách, và đóng bảng thì tiêu điểm
  // quay về nút này. project.js gắn tên chuyển cảnh lên cả khối .chu-thich-ten
  // chứ không lên span tên bên trong: span là chữ nội dòng, tên dài xuống dòng
  // thì nó bị cắt thành hai mảnh và trình duyệt bỏ luôn cả chuyển cảnh.
  nut.addEventListener('click', () => {
    if (nut.dataset.slug) moProject(nut.dataset.slug, nut);
  });
}
