/* Khung video của phần mở đầu.

   Cột phải của phần mở đầu có một khung chiếu đoạn video ngắn: dòng lệnh đang
   chạy trên màn hình một máy tính, đã pha về xanh chàm và xanh da trời rồi làm
   mờ nhẹ lúc dựng tệp. Hình ảnh lấy từ chính việc mà người học làm trên nền
   tảng này: viết mã, chạy thử, rồi nộp bài. Tệp này chỉ quyết định khi nào ảnh
   chờ được gán và khi nào video được phát; vị trí, khung và việc ẩn khung ở bề
   ngang hẹp đều là quy tắc CSS; tệp này còn quyết định nút tạm dừng mang biểu
   tượng nào.

   Khung chỉ tồn tại trên màn hình rộng hơn 1100 điểm ảnh, vì dưới đó chữ cần cả
   bề ngang và CSS ẩn hẳn khung; nên ảnh chờ cũng chỉ gán trên màn hình rộng,
   điện thoại không tải 22 KB vô ích. Trên màn hình rộng, video phát khi
   người dùng không bật giảm chuyển động và trình duyệt không báo đang tiết
   kiệm dữ liệu; không đủ thì phần mở đầu hiện ảnh chờ, là khung hình đầu của
   video. Đang phát mà phần mở đầu ra khỏi khung nhìn hoặc thẻ bị ẩn thì dừng,
   quay lại thì phát tiếp.

   Video lặp mười giây một vòng và chạy song song với chữ, nên theo tiêu chí
   2.2.2 của WCAG người xem phải dừng được nó. Nút tạm dừng nằm ngoài khung
   aria-hidden, ở góc trên bên phải của khung, và chỉ hiện khi video có thể phát:
   người bật giảm chuyển động, đang tiết kiệm dữ liệu hay dùng chế độ màu cưỡng
   bức chỉ thấy ảnh tĩnh, không có gì để dừng nên cũng không có nút. Người xem đã bấm dừng thì video
   đứng yên cho tới khi bấm phát, kể cả khi cuộn đi rồi quay lại. */

import { $, giamChuyenDong } from './giao-dien.js';

const MAN_HINH_RONG = '(min-width: 1101px)';

export function khoiTao() {
  const khung = $('.khung-video');
  if (khung === null) return;
  const video = $('video', khung);
  const nut = $('#nut-video');
  const manHinhRong = window.matchMedia(MAN_HINH_RONG);
  const tietKiemDuLieu = navigator.connection?.saveData === true;
  // Chế độ màu cưỡng bức của hệ điều hành bỏ quầng trắng quanh vòng tiêu điểm,
  // khiến vòng nằm thẳng trên video; người dùng chế độ này thấy ảnh tĩnh như
  // người bật giảm chuyển động, không có video chạy nên cũng không cần nút.
  const mauCuongBuc = window.matchMedia('(forced-colors: active)').matches;
  const duocPhat = !giamChuyenDong() && !tietKiemDuLieu && !mauCuongBuc;

  // Ảnh chờ về thì mới gán vào video và cho khung hiện dần, để không có cảnh
  // ảnh nhảy ra giữa nền. Ảnh không về thì khung cứ ẩn, chỗ của nó để trống, và
  // nút tạm dừng cũng không hiện vì không có gì nhìn thấy để dừng.
  const ganAnhCho = () => {
    if (!manHinhRong.matches || video.poster !== '') return;
    const anhCho = new Image();
    anhCho.addEventListener('load', () => {
      video.poster = anhCho.src;
      khung.classList.add('da-co-anh');
      if (duocPhat && nut !== null) nut.hidden = false;
    }, { once: true });
    anhCho.src = video.dataset.anhCho;
  };
  ganAnhCho();
  manHinhRong.addEventListener('change', ganAnhCho);

  if (!duocPhat) return;

  let dangThay = true;
  // Người xem tự bấm dừng. Tách khỏi trạng thái paused của video, vì video còn
  // tự dừng khi ra khỏi khung nhìn hay khi thẻ bị ẩn, và những lần đó không được
  // làm đổi chữ trên nút hay chặn việc phát tiếp.
  let nguoiXemDung = false;

  // Nút chỉ có biểu tượng, không có chữ trên mặt nút; tên của nút cho trình đọc
  // màn hình nằm ở aria-label và đổi cùng biểu tượng.
  const bieuTuongNut = nut?.querySelector('use');
  const veNut = () => {
    if (nut === null) return;
    nut.setAttribute('aria-label', nguoiXemDung ? 'Phát video' : 'Tạm dừng video');
    bieuTuongNut?.setAttribute('href', nguoiXemDung ? '#bt-phat' : '#bt-tam-dung');
  };

  const capNhat = () => {
    if (manHinhRong.matches && dangThay && !document.hidden && !nguoiXemDung) {
      // Trình duyệt có thể từ chối tự phát; khi đó ảnh chờ vẫn ở nguyên và nút
      // đổi sang biểu tượng phát, để nút không nói sai điều đang thấy.
      // Chỉ lỗi từ chối mới tính: lượt phát bị một lần dừng vì cuộn đi cắt
      // ngang cũng báo lỗi, nhưng đó không phải lựa chọn của người xem.
      video.play().catch((loi) => {
        if (loi?.name !== 'NotAllowedError') return;
        nguoiXemDung = true;
        veNut();
      });
    } else {
      video.pause();
    }
  };

  nut?.addEventListener('click', () => {
    nguoiXemDung = !nguoiXemDung;
    veNut();
    capNhat();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([muc]) => { dangThay = muc.isIntersecting; capNhat(); }).observe(khung);
  }
  document.addEventListener('visibilitychange', capNhat);
  manHinhRong.addEventListener('change', capNhat);
  capNhat();
}
