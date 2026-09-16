/* Ô xem video hướng dẫn ở đầu mục Ba bước, và hộp chiếu video ấy.

   Ô là một nút duy nhất: ảnh chờ của video có vòng tròn phát, nhãn và thời
   lượng. Bấm thì mở một hộp thoại modal với trình phát của trình duyệt. Video chỉ chạy vì người xem vừa bấm; trang không tự phát
   video này ở bất kỳ đâu.

   Trước khi bấm, trang chỉ tải ảnh thu nhỏ của ô, và ảnh ấy tải lười. Video để
   preload="none". Hai thứ còn lại chỉ bật lúc mở hộp, vì ghi sẵn trong HTML thì
   trình duyệt tải ngay khi mở trang, kể cả trên điện thoại chưa cuộn tới mục này:
   ảnh chờ của trình phát, là tệp cỡ đầy đủ ghi ở thuộc tính src của ảnh trong ô
   (srcset của ô thường chọn bản nhỏ); và phụ đề, nên thẻ track không mang thuộc
   tính default. Phụ đề tắt sẵn: mỗi câu phụ đề chỉ là tên bước, và tên ấy đã in
   trên hình, nên bật sẵn thì người xem thấy cùng một dòng hai lần. Lần mở đầu tiên
   đặt phụ đề ở chế độ hidden để trình duyệt nạp sẵn các câu; người xem muốn thấy
   thì bật ở thanh điều khiển, và những lần mở sau giữ lựa chọn ấy.

   Thời lượng trên ô ghi tay trong index.html, ở chữ, ở datetime và ở aria-label,
   vì đọc từ tệp video thì phải tải tệp trước khi người xem bấm.

   Đóng hộp bằng nút Đóng, phím Escape hay bấm ra nền tối đều dừng video và tua về
   đầu, để lần mở sau chạy lại từ đầu, rồi trả tiêu điểm về chỗ vừa mở hộp, để
   người dùng bàn phím ở lại đúng chỗ vừa rời.

   Liên kết "Video hướng dẫn" ở chân trang mang data-mo-video và cũng mở hộp này;
   không có JavaScript thì nó là liên kết neo tới mục Ba bước, nơi có ô xem video. */

import { $, $$, dongLoi, ghiMocMo, xoaMocMo } from './giao-dien.js';

export function khoiTao() {
  const o = $('#o-xem-video');
  const hop = $('#hop-video');
  if (o === null || hop === null) return;
  const video = $('video', hop);
  const anh = $('img', o);
  const vungLoi = $('#hop-video-loi');

  const hongTep = () => video.error !== null || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;

  let lanDau = true;
  let lucMo = 0;
  const manHinhChamHep = window.matchMedia('(pointer: coarse) and (max-width: 640px)');
  // Nút Back của điện thoại đóng hộp; hộp đóng bằng cách khác thì bỏ mốc lịch sử.
  const dongHopTheoLichSu = () => hop.close();
  // Phần tử vừa mở hộp, để đóng hộp thì trả tiêu điểm về đúng đó.
  let noiMo = o;
  const moHop = () => {
    vungLoi.innerHTML = '';
    lucMo = performance.now();
    if (lanDau) {
      lanDau = false;
      video.poster = anh.src;
      for (const phuDe of video.textTracks) phuDe.mode = 'hidden';
    }
    // Lần mở trước không tải được tệp nào thì video đứng chờ một thẻ source mới
    // và play() không thử lại; load() cho nó chọn nguồn lại từ đầu.
    if (hongTep()) video.load();
    hop.showModal();
    ghiMocMo(dongHopTheoLichSu);
    video
      .play()
      .then(() => {
        // Video là bản quay màn hình 1440 điểm ảnh; trên điện thoại dọc chữ trong
        // khung 374 điểm ảnh không đọc được, nên phát là mở toàn màn hình luôn.
        if (!manHinhChamHep.matches) return;
        const moToanManHinh = video.requestFullscreen?.bind(video) ?? video.webkitEnterFullscreen?.bind(video);
        // Trình duyệt có thể từ chối; khi đó video vẫn chạy trong hộp như thường.
        Promise.resolve(moToanManHinh?.()).catch(() => {});
      })
      .catch((loi) => {
        // Chính sách tự phát của trình duyệt vẫn có thể chặn dù người xem vừa bấm.
        // Thanh điều khiển vẫn còn, nên tiêu điểm vào video để một lần nhấn phím
        // cách là phát được. Những lần từ chối khác
        // không báo ở đây: AbortError là người xem đóng hộp trước khi video kịp
        // chạy, còn tệp hỏng thì trình nghe error bên dưới báo.
        if (loi?.name === 'NotAllowedError') video.focus();
      });
  };

  o.addEventListener('click', () => {
    noiMo = o;
    moHop();
  });
  for (const lienKet of $$('[data-mo-video]')) {
    lienKet.addEventListener('click', (sk) => {
      sk.preventDefault();
      noiMo = lienKet;
      moHop();
    });
  }

  // Video lấy nguồn từ các thẻ source, nên khi mọi tệp đều lỗi thì play() không
  // bao giờ báo lỗi: lỗi chỉ bắn ở từng thẻ source, không nổi bọt lên video, nên
  // phải nghe ở pha bắt. Lỗi giải mã giữa chừng thì bắn ở chính video.
  video.addEventListener('error', () => {
    if (hongTep()) vungLoi.innerHTML = dongLoi('Không tải được video hướng dẫn.');
  }, true);

  // Sự kiện close đến từ cả ba lối đóng: nút Đóng gửi biểu mẫu method="dialog",
  // phím Escape, và lượt bấm ra nền tối bên dưới.
  hop.addEventListener('close', () => {
    xoaMocMo(dongHopTheoLichSu);
    video.pause();
    video.currentTime = 0;
    noiMo.focus();
  });

  // Nền tối là chính phần tử dialog nằm ngoài khung hộp. Chỉ đóng khi cả lúc ấn
  // lẫn lúc nhả đều ở ngoài hộp: kéo thanh tua của video rồi nhả chuột ra ngoài
  // hộp cũng sinh một lượt click trên dialog, và lượt đó không được đóng hộp.
  const ngoaiHop = (sk) => {
    if (sk.target !== hop) return false;
    const khung = hop.getBoundingClientRect();
    return sk.clientX < khung.left || sk.clientX > khung.right || sk.clientY < khung.top || sk.clientY > khung.bottom;
  };
  let anNgoaiHop = false;

  // Bấm đúp vào ô thì lượt bấm đầu mở hộp, lượt thứ hai rơi vào hộp vừa mở: trúng
  // nền tối thì đóng hộp ngay, trúng video thì dừng video. Bỏ lượt bấm thứ hai ấy
  // ở pha bắt, trước khi tới trình phát.
  const bamDupVuaMo = (sk) => sk.detail > 1 && performance.now() - lucMo < 600;
  for (const loai of ['click', 'dblclick']) {
    hop.addEventListener(loai, (sk) => {
      if (!bamDupVuaMo(sk)) return;
      sk.preventDefault();
      sk.stopImmediatePropagation();
      anNgoaiHop = false;
    }, true);
  }
  hop.addEventListener('pointerdown', (sk) => {
    anNgoaiHop = ngoaiHop(sk);
  });
  hop.addEventListener('click', (sk) => {
    if (anNgoaiHop && ngoaiHop(sk)) hop.close();
    anNgoaiHop = false;
  });
}
