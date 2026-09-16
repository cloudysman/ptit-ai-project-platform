/* Điểm khởi động của giao diện: nối các phần lại với nhau, gắn những sự kiện
   dùng chung và chạy các hiệu ứng theo cuộn. */

import { khiPhienHong, khoiPhucPhien, phien, theoDoiPhienGiuaCacThe } from './api.js';
import * as baBuoc from './ba-buoc.js';
import * as chamBai from './cham-bai.js';
import * as chanTrang from './chan-trang.js';
import * as chuThichVideo from './chu-thich-video.js';
import * as giangVien from './giang-vien.js';
import * as hopTaiKhoan from './hop-tai-khoan.js';
import * as keuGoi from './keu-goi.js';
import { $, $$, chuanBiCacBang, danhDauDaCuon, dongBang, theoDoiChieuCaoDauTrang, thongBao } from './giao-dien.js';
import * as kho from './kho.js';
import * as khungVideo from './khung-video.js';
import * as loTrinh from './lo-trinh.js';
import * as oTim from './o-tim.js';
import * as project from './project.js';
import { SU_KIEN, nghe, phat } from './su-kien.js';
import * as taiKhoan from './tai-khoan.js';
import * as videoHuongDan from './video-huong-dan.js';
import * as xepHang from './xep-hang.js';

/* Theo vị trí cuộn: level đang xem được tô đậm ở cả mục lục bên trái lẫn ga của
   nó trên tuyến, và đầu trang co lại một chút khi trang đã cuộn khỏi đỉnh. */

function theoCuon() {
  let dangCho = false;

  const kiemTra = () => {
    dangCho = false;
    danhDauDaCuon();

    const cacDoan = $$('.doan-level');
    const cacNut = $$('.muc-nut');
    let dangXem = 0;
    cacDoan.forEach((o, chiSo) => {
      if (o.getBoundingClientRect().top <= window.innerHeight * 0.34) dangXem = chiSo;
    });
    cacNut.forEach((nut, chiSo) => nut.classList.toggle('dang-xem', chiSo === dangXem));
    cacDoan.forEach((doan, chiSo) => doan.classList.toggle('dang-xem', chiSo === dangXem));
  };

  const hen = () => {
    if (dangCho) return;
    dangCho = true;
    requestAnimationFrame(kiemTra);
  };

  window.addEventListener('scroll', hen, { passive: true });
  window.addEventListener('resize', hen);
  kiemTra();
}

/* Sự kiện dùng chung cho cả trang. */

function ganSuKienChung() {
  $$('[data-dong]').forEach((nut) => nut.addEventListener('click', dongBang));
  $('#lop-nen').addEventListener('click', dongBang);
  window.addEventListener('keydown', (sk) => {
    // Hộp thoại đăng nhập tự đóng bằng phím Escape. Không kiểm tra thì một lần
    // nhấn phím đóng luôn cả bảng nằm phía sau nó.
    if (sk.key === 'Escape' && !$('#hop-dang-nhap').open) dongBang();
  });

  $('#khu-tai-khoan').addEventListener('click', (sk) => {
    if (sk.target.closest('[data-mo-cham-bai]')) chamBai.moBangChamBai();
  });

  nghe(SU_KIEN.CAN_DANG_NHAP, (chiTiet) => hopTaiKhoan.moHopDangNhap('dang-nhap', chiTiet?.project ?? null));

  // Backend từ chối token: đưa trang về trạng thái chưa đăng nhập và nói rõ lý do.
  khiPhienHong(() => {
    taiKhoan.donSauThoat();
    thongBao('Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi tiếp tục.', 'loi');
    phat(SU_KIEN.PHIEN_THAY_DOI);
  });

  // Người dùng hay mở nền tảng ở nhiều thẻ cùng lúc. Đăng nhập hay đăng xuất ở
  // một thẻ phải hiện ra ở mọi thẻ còn lại, chứ không để một thẻ vẫn hiện tên
  // người vừa đăng xuất.
  theoDoiPhienGiuaCacThe(async (token) => {
    if (token) {
      await khoiPhucPhien();
      thongBao('Bạn vừa đăng nhập ở một thẻ khác, trang này đã cập nhật theo.');
    } else {
      taiKhoan.donSauThoat();
      thongBao('Bạn vừa đăng xuất ở một thẻ khác, trang này cũng thoát theo.');
    }
    phat(SU_KIEN.PHIEN_THAY_DOI);
  });

  nghe(SU_KIEN.PHIEN_THAY_DOI, async () => {
    taiKhoan.veKhuTaiKhoan();
    await taiKhoan.napTienDo();
    kho.veLaiTienDo();
    loTrinh.veLaiTienDo();
    project.veLaiBangDangMo();
    keuGoi.ve();
    xepHang.nap();
  });

  nghe(SU_KIEN.TIEN_DO_THAY_DOI, async () => {
    await taiKhoan.napTienDo();
    kho.veLaiTienDo();
    loTrinh.veLaiTienDo();
    project.veLaiBangDangMo();
    keuGoi.ve();
    xepHang.nap();
  });

  // Tiến độ về với số liệu khác lần trước dù trang này không nộp hay chấm gì
  // (bài được chấm ở nơi khác): mọi phần vẽ tiến độ vẽ lại, không chỉ thẻ tên.
  nghe(SU_KIEN.TIEN_DO_DA_NAP, () => {
    kho.veLaiTienDo();
    loTrinh.veLaiTienDo();
    project.veLaiBangDangMo();
    keuGoi.ve();
    xepHang.nap();
  });

  // Người quay lại thẻ sau một lúc thì tải lại tiến độ, để thấy kết quả chấm
  // trong lúc vắng mặt mà không phải tải lại trang.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && phien.daDangNhap) taiKhoan.napTienDo();
  });
}

/* Trang mở bằng một địa chỉ có neo, ví dụ /#xep-hang từ trang kho, thì trình
   duyệt cuộn tới mục đó ngay lúc HTML vừa nạp, khi phần lớn nội dung phía trên
   còn là dòng "Đang tải…". Nội dung đó vẽ xong thì mục đã trôi xa hàng nghìn
   điểm ảnh. Cuộn lại một lần nữa sau mỗi phần nạp xong; scroll-margin-top của
   mục đã trừ sẵn chiều cao đầu trang. Người dùng đã tự cuộn đi thì thôi. */

function cuonLaiToiNeo() {
  const ten = location.hash.slice(1);
  if (!ten) return;
  let muc = null;
  try {
    muc = document.getElementById(decodeURIComponent(ten));
  } catch {
    return;
  }
  if (muc && !daTuCuon) muc.scrollIntoView({ block: 'start' });
}

let daTuCuon = false;

function theoDoiTuCuon() {
  if (!location.hash) return;
  const ghi = () => {
    daTuCuon = true;
  };
  window.addEventListener('wheel', ghi, { passive: true, once: true });
  window.addEventListener('touchstart', ghi, { passive: true, once: true });
  window.addEventListener('keydown', ghi, { once: true });
}

/* Khởi động. */

async function khoiDong() {
  khungVideo.khoiTao();
  videoHuongDan.khoiTao();
  // Bốn phần này nghe sự kiện kho đã nạp, nên phải gắn trước khi gọi kho.nap().
  chuThichVideo.khoiTao();
  baBuoc.khoiTao();
  giangVien.khoiTao();
  keuGoi.khoiTao();
  theoDoiChieuCaoDauTrang();
  oTim.khoiTao();
  chuanBiCacBang();
  kho.khoiTao();
  project.khoiTao();
  hopTaiKhoan.khoiTao();
  taiKhoan.khoiTao();
  chamBai.khoiTao();
  loTrinh.khoiTao();
  xepHang.khoiTao();
  ganSuKienChung();
  theoDoiTuCuon();

  await khoiPhucPhien();
  taiKhoan.veKhuTaiKhoan();

  // Cột số liệu ở chân trang gọi /stats trước để kho.nap() dùng chung một lượt
  // gọi, kể cả khi lượt ấy lỗi: gọi sau thì kho đã bỏ lời hứa hỏng và chân trang
  // sẽ gọi lại lần hai.
  chanTrang.nap();
  // Kho project phải xong trước, vì phần tiến độ vẽ đè lên chính danh sách đó.
  await kho.nap();
  // Phần mở đầu đã đủ cao, nên giờ mới biết ba bước có thật sự trong tầm nhìn không.
  baBuoc.theoDoiHienRa();
  if (phien.daDangNhap) {
    await taiKhoan.napTienDo();
    kho.veLaiTienDo();
  }
  // Vẽ sau cả kho lẫn tiến độ, để mục hiện trọn một trạng thái; kho lỗi mà chưa
  // đăng nhập thì lượt vẽ này thu hai khối giữ chỗ của mục lại.
  keuGoi.ve();
  cuonLaiToiNeo();
  theoCuon();

  // Ba phần này tự bắt lỗi của mình, nên Promise.all không bao giờ ném ra.
  await Promise.all([loTrinh.nap(), xepHang.nap(), giangVien.nap()]);
  cuonLaiToiNeo();
}

khoiDong();
