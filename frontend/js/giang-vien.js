/* Mục giảng viên phụ trách: mỗi giảng viên một thẻ gồm ảnh chân dung, tên, chức
   vụ, giới thiệu và hàng track người ấy phụ trách.

   Backend gán người phụ trách cho từng track chứ không cho từng project (xem
   js/project.js), nên thẻ nối được sang kho: mỗi nhãn track là một liên kết mở
   trang kho project lọc theo track ấy, kèm số project của track. Ai chấm bài nào
   không nằm trong dữ liệu, nên thẻ không nói gì về việc chấm. Huy hiệu ở góc ảnh
   ghi số track người ấy phụ trách; dòng số liệu cạnh tiêu đề ghi số giảng viên,
   số track và số project của cả kho.

   Track và số project của từng track lấy từ sự kiện KHO_DA_NAP của js/kho.js,
   không gọi API lần nữa. js/app.js gọi nap() sau khi kho.nap() xong, nên lúc vẽ
   thẻ thì số liệu đã có hoặc đã lỗi. Số liệu lỗi thì thẻ không có huy hiệu và
   hàng track, dòng số liệu chỉ còn số giảng viên; lượt gọi /mentors lỗi thì cả
   mục là một dòng báo lỗi và dòng số liệu ẩn.

   Ảnh hiện ra một lần khi mục cuộn vào tầm nhìn: khung ảnh mở từ dưới lên, ảnh
   thu về cỡ thật, các thẻ lệch nhau một chút theo thứ tự. Lớp da-hien gắn lên
   từng thẻ khi ảnh của thẻ đã về, để khung mở ra là lộ ảnh chứ không lộ ô trống.
   Bật giảm chuyển động thì ảnh hiện sẵn. */

import { LoiApi, apiCatalog } from './api.js';
import { $, bieuTuong, chu, dongLoi, dongTrong, giamChuyenDong, so } from './giao-dien.js';
import { duongDan } from './goc.js';
import { SU_KIEN, nghe } from './su-kien.js';

/** Số liệu tổng quan của kho, giữ lại từ sự kiện KHO_DA_NAP; null khi kho chưa nạp hoặc lỗi. */
let thongKe = null;

/** Các mục by_track của một giảng viên, theo đúng thứ tự track của kho. */
const trackCua = (nguoi) => (thongKe?.by_track ?? []).filter((mot) => mot.track.mentor?.slug === nguoi.slug);

function veTheTrack(mot) {
  return (
    '<li>' +
    `<a class="gv-the" href="${duongDan('kho.html')}?track=${chu(encodeURIComponent(mot.track.slug))}">` +
    bieuTuong('badge-track') +
    `<span>${chu(mot.track.name)}</span>` +
    `<i>${so(mot.projects)}</i>` +
    '</a></li>'
  );
}

/**
 * Một thẻ giảng viên. Chỉ số thứ tự đưa vào biến CSS để tệp kiểu xếp thời điểm
 * hiện của từng ảnh. Người không phụ trách track nào thì không có huy hiệu và
 * hàng track, thay vì một huy hiệu ghi 0. Huy hiệu ẩn với trình đọc màn hình:
 * số track đã nằm trong số mục của danh sách track có nhãn ngay dưới, và đọc
 * "3 track" trước khi đọc tên thì không rõ của ai. Tên là h3 để nhảy được từ
 * người này sang người kia bằng tiêu đề, như tên project trên trang kho.
 */
function veMotNguoi(nguoi, chiSo) {
  const cacTrack = trackCua(nguoi);
  return (
    `<div class="gv" style="--i:${chiSo}">` +
    '<div class="gv-anh">' +
    `<img class="o-anh" src="anh/${chu(nguoi.photo)}" width="480" height="600" loading="lazy" decoding="async" alt="Ảnh chân dung ${chu(nguoi.name)}">` +
    (cacTrack.length > 0
      ? `<span class="gv-huy-hieu" aria-hidden="true">${bieuTuong('badge-track')}${so(cacTrack.length)} track</span>`
      : '') +
    '</div>' +
    '<div class="gv-bang">' +
    `<h3 class="nguoi-ten">${chu(nguoi.name)}</h3>` +
    `<p class="nguoi-chuc">${chu(nguoi.title)}</p>` +
    '</div>' +
    `<p class="nguoi-mo">${chu(nguoi.bio)}</p>` +
    (cacTrack.length > 0
      ? `<ul class="gv-track" aria-label="Track do ${chu(nguoi.name)} phụ trách">${cacTrack.map(veTheTrack).join('')}</ul>`
      : '') +
    '</div>'
  );
}

/** Dòng số liệu cạnh tiêu đề. Chỉ ghi những con số đã tải được. */
function veSoLieu(soGiangVien) {
  const o = $('#nhan-su-so');
  const phan = [`${so(soGiangVien)} giảng viên`];
  if (thongKe) phan.push(`${so(thongKe.by_track.length)} track`, `${so(thongKe.projects)} project`);
  o.textContent = phan.join(' · ');
  o.hidden = false;
}

/**
 * Ảnh mở ra khi lưới cuộn vào tầm nhìn, một lần cho cả trang. Chỉ theo dõi sau
 * khi thẻ đã vẽ: trước đó lưới chỉ có dòng đang tải, cao vài chục điểm ảnh, lộ
 * 20% là chuyện dễ xảy ra mà chưa có thẻ nào để đánh dấu. Từng thẻ chỉ mở khi
 * ảnh của nó đã về: ảnh tải lười, nhảy tới mục bằng liên kết đầu trang trên mạng
 * chậm thì lúc lưới lộ ra ảnh chưa có, mở khung lúc ấy chỉ lộ ô trống rồi ảnh
 * bật ra sau. Ảnh lỗi cũng mở, để lộ chữ thay thế.
 */
function theoDoiHienRa(o) {
  const quan = new IntersectionObserver(
    ([muc]) => {
      if (!muc.isIntersecting) return;
      quan.disconnect();
      for (const the of o.querySelectorAll('.gv')) {
        const anh = the.querySelector('.o-anh');
        const mo = () => the.classList.add('da-hien');
        if (anh.complete) {
          mo();
          continue;
        }
        anh.addEventListener('load', mo, { once: true });
        anh.addEventListener('error', mo, { once: true });
      }
    },
    { threshold: 0.2 }
  );
  quan.observe(o);
}

export async function nap() {
  const o = $('#nhan-su-luoi');
  try {
    const danhSach = await apiCatalog.danhSachGiangVien();
    if (danhSach.length === 0) {
      o.innerHTML = dongTrong('Chưa có thông tin giảng viên.');
      return;
    }
    o.innerHTML = danhSach.map(veMotNguoi).join('');
    veSoLieu(danhSach.length);
    if (o.classList.contains('co-chuyen-dong')) theoDoiHienRa(o);
  } catch (loi) {
    o.innerHTML = dongLoi(loi instanceof LoiApi ? loi.message : 'Không tải được danh sách giảng viên.');
  }
}

/**
 * Gắn trước khi js/app.js gọi kho.nap(), để không bỏ lỡ sự kiện số liệu. Lớp
 * co-chuyen-dong chỉ gắn khi chuyển động thật sự chạy, nên không có JavaScript
 * hay bật giảm chuyển động thì ảnh ở sẵn trạng thái cuối.
 */
export function khoiTao() {
  const o = $('#nhan-su-luoi');
  if (o === null) return;
  nghe(SU_KIEN.KHO_DA_NAP, (duLieu) => {
    thongKe = duLieu?.thongKe ?? null;
  });
  if (giamChuyenDong() || !('IntersectionObserver' in window)) return;
  o.classList.add('co-chuyen-dong');
}
