/* Ba bước ở trang chủ, mỗi bước là một tên bước đứng dưới một hình minh hoạ nhỏ
   dựng từ dữ liệu thật.

   Hình không phải ảnh chụp màn hình vẽ sẵn mà là vài dòng HTML lấy từ đúng
   project mà phần mở đầu đang giới thiệu: bước một là kho với sáu level và hai
   project đầu của level ấy, bước hai là các sản phẩm phải nộp và ba tầng gợi ý
   của project, bước ba là kết quả chấm với số điểm tích luỹ project này mang
   lại. Ví dụ không lệch khỏi kho được vì nó lấy từ chính kho.

   Điều duy nhất không có trong dữ liệu là trạng thái "Đạt" ở bước ba. Hình bước
   ba vì vậy chỉ vẽ một kết quả chấm chung chung: nhãn "Kết quả chấm", không có tên
   project, không có tên người, không xưng "bạn", và hàng badge chỉ có nhãn cùng ba
   biểu tượng chứ không nói ai được badge nào. Nó cho thấy một bài đạt trông ra sao,
   không nói gì về người đang xem.

   Ba hình đều aria-hidden. Trình tự ba bước nằm ở ba tên bước; dữ liệu trong hình
   có đủ ở danh sách project và bảng chi tiết. Hình bước ba mà được đọc to thì
   trình đọc màn hình nói "Đạt" cùng một số điểm tích luỹ, không có khung hình nào
   cho người nghe biết đó chỉ là hình minh hoạ.

   Chuyển động chạy một lần khi từng bước cuộn vào tầm nhìn: ga sáng lên, đoạn
   nối chạy sang ga kế, hình hiện ra, bước hai đánh dấu lần lượt từng sản phẩm.
   Thứ tự ấy đúng là trình tự ba bước mô tả, nên chuyển động mang nghĩa chứ không
   chỉ để trang trí. Không có IntersectionObserver hoặc người dùng bật giảm chuyển
   động thì mọi thứ hiện sẵn.

   Số liệu lấy từ sự kiện KHO_DA_NAP như dòng chú thích ở phần mở đầu. Riêng danh
   sách sản phẩm phải nộp cần một lượt gọi chi tiết project, nên lượt ấy chỉ chạy
   khi mục sắp cuộn tới. API tổng quan lỗi thì js/kho.js ẩn cả ba hình nhờ
   data-can-so-lieu; chỉ lượt gọi chi tiết lỗi thì hình bước hai bỏ danh sách sản
   phẩm và giữ hàng gợi ý. */

import { apiCatalog } from './api.js';
import { chonProject } from './chu-thich-video.js';
import { $, $$, NHAN_TRANG_THAI, bieuTuong, chu, giamChuyenDong, khiSapToi, so, soGio } from './giao-dien.js';
import { SU_KIEN, nghe } from './su-kien.js';

/** Số sản phẩm phải nộp hiện trong hình bước hai; project nào nhiều hơn thì bớt. */
const SO_SAN_PHAM = 3;
/** Số tầng gợi ý. Mọi project trong kho đều có đủ ba tầng, backend mở dần từng tầng. */
const SO_TANG_GOI_Y = 3;

const nhanHinh = (noiDung) => `<span class="hinh-nhan">${chu(noiDung)}</span>`;

function veHinhChon({ project, level }, cacLevel, nhom) {
  const cacO = cacLevel
    .map((mot) => `<span class="hinh-o${mot.level.id === level.id ? ' la-chon' : ''}">${mot.level.id}</span>`)
    .join('');
  // Hai project đầu của level: project được giới thiệu đứng đầu và được chọn,
  // project thứ hai cho thấy đây là một danh sách chứ không phải một thẻ lẻ.
  const cacDong = [project, ...nhom.filter((p) => p.slug !== project.slug).slice(0, 1)]
    .map(
      (p, i) =>
        `<span class="hinh-dong${i === 0 ? ' la-chon' : ''}">` +
        `<span class="hinh-dong-ten">${chu(p.title)}</span>` +
        `<span class="hinh-dong-phu">${chu(p.track.name)} · ${chu(soGio(p.estimated_hours))}</span>` +
        '</span>'
    )
    .join('');
  return nhanHinh(`Kho project, level ${level.name}`) + `<span class="hinh-level">${cacO}</span>` + cacDong;
}

function hangGoiY() {
  const cacTang = Array.from({ length: SO_TANG_GOI_Y }, (_, i) =>
    i === 0
      ? '<span class="hinh-tang la-mo">Tầng 1</span>'
      : `<span class="hinh-tang">${bieuTuong('khoa')}Tầng ${i + 1}</span>`
  ).join('');
  return `<span class="hinh-goi-y"><span class="hinh-goi-y-nhan">Gợi ý</span>${cacTang}</span>`;
}

/** Hình bước hai. sanPham là null khi chưa có chi tiết, mảng rỗng khi lượt gọi lỗi. */
function veHinhNop(sanPham) {
  let danhSach;
  if (sanPham === null) {
    danhSach = Array.from({ length: SO_SAN_PHAM }, () => '<span class="hinh-sp"><span class="hinh-cho"></span></span>').join('');
  } else {
    danhSach = sanPham
      .slice(0, SO_SAN_PHAM)
      .map(
        (mot, i) =>
          `<span class="hinh-sp" style="--j:${i}"><span class="o-tich">${bieuTuong('tich')}</span>` +
          `<span class="hinh-sp-chu">${chu(mot)}</span></span>`
      )
      .join('');
  }
  return nhanHinh('Sản phẩm phải nộp') + (danhSach ? `<span class="hinh-ds">${danhSach}</span>` : '') + hangGoiY();
}

function veHinhCham(project) {
  return (
    nhanHinh('Kết quả chấm') +
    '<span class="hinh-ket">' +
    `<span class="hinh-dat">${bieuTuong('tich')}${NHAN_TRANG_THAI.accepted}</span>` +
    `<span class="hinh-diem">+${so(project.reward_points)}</span>` +
    '<span class="hinh-don">điểm tích luỹ</span>' +
    '</span>' +
    '<span class="hinh-badge"><span class="hinh-badge-nhan">Badge</span>' +
    ['badge-project', 'badge-level', 'badge-diem'].map((ten) => `<span class="hinh-badge-o">${bieuTuong(ten)}</span>`).join('') +
    '</span>'
  );
}

function datHinh(hinh, noiDung) {
  hinh.innerHTML = noiDung;
  hinh.classList.remove('dang-cho');
}

async function napSanPham(hinh, slug) {
  try {
    const chiTiet = await apiCatalog.chiTietProject(slug);
    datHinh(hinh, veHinhNop(chiTiet.deliverables ?? []));
  } catch {
    datHinh(hinh, veHinhNop([]));
  }
}

/**
 * Cho từng bước hiện ra khi cuộn tới. Lớp co-chuyen-dong chỉ được gắn khi chuyển
 * động thật sự chạy, nên trang không có JavaScript hay bật giảm chuyển động vẫn
 * thấy trạng thái cuối: ga đã sáng, đoạn nối đã chạy xong.
 *
 * js/app.js gọi hàm này sau khi kho.nap() xong, dù thành công hay lỗi, chứ không
 * gọi lúc khởi tạo. Trước khi số liệu về, tuyến sáu level ở phần mở đầu chưa có ga
 * nên phần mở đầu thấp hơn: ở khung nhìn 1440 × 900 ba bước khi ấy lộ hơn 35% và
 * chuyển động chạy luôn lúc mở trang, rồi tuyến có ga đẩy ba bước xuống dưới mép màn
 * hình, người xem không bao giờ thấy chuyển động.
 */
export function theoDoiHienRa() {
  const muc = $('#ba-buoc');
  if (muc === null || !muc.classList.contains('co-chuyen-dong')) return;
  const quan = new IntersectionObserver(
    (cacMuc) => {
      for (const mot of cacMuc) {
        if (!mot.isIntersecting) continue;
        mot.target.classList.add('da-hien');
        quan.unobserve(mot.target);
      }
    },
    { threshold: 0.35 }
  );
  $$('.buoc', muc).forEach((buoc) => quan.observe(buoc));
}

export function khoiTao() {
  const muc = $('#ba-buoc');
  if (muc === null) return;
  const hinhChon = $('#hinh-chon');
  const hinhNop = $('#hinh-nop');
  const hinhCham = $('#hinh-cham');

  if (giamChuyenDong() || !('IntersectionObserver' in window)) {
    $$('.buoc', muc).forEach((buoc) => buoc.classList.add('da-hien'));
  } else {
    muc.classList.add('co-chuyen-dong');
  }

  nghe(SU_KIEN.KHO_DA_NAP, (duLieu) => {
    const chon = duLieu ? chonProject(duLieu) : null;
    if (chon === null) {
      for (const o of [hinhChon, hinhNop, hinhCham]) o.hidden = true;
      return;
    }
    const { project, level } = chon;
    const cacLevel = [...duLieu.thongKe.by_level].sort((a, b) => a.level.id - b.level.id);

    datHinh(hinhChon, veHinhChon(chon, cacLevel, duLieu.theoLevel.get(level.id) ?? []));
    datHinh(hinhNop, veHinhNop(null));
    datHinh(hinhCham, veHinhCham(project));
    khiSapToi(hinhNop, () => napSanPham(hinhNop, project.slug));
  });
}
