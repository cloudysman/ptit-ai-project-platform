/* Điểm khởi động của trang kho project.

   Trang này dùng lại phần tài khoản, bảng chi tiết project và bảng chấm bài của
   trang chủ, chỉ thay phần danh sách bằng bản có bộ lọc đầy đủ và phân trang. */

import { khiPhienHong, khoiPhucPhien, phien, theoDoiPhienGiuaCacThe } from './api.js';
import * as chamBai from './cham-bai.js';
import * as chanTrang from './chan-trang.js';
import { $, $$, chuanBiCacBang, danhDauDaCuon, dongBang, theoDoiChieuCaoDauTrang, thongBao } from './giao-dien.js';
import * as hopTaiKhoan from './hop-tai-khoan.js';
import * as oTim from './o-tim.js';
import * as project from './project.js';
import { SU_KIEN, nghe, phat } from './su-kien.js';
import * as taiKhoan from './tai-khoan.js';
import * as trangKho from './trang-kho.js';

/* Đầu trang co lại một chút khi trang đã cuộn khỏi đỉnh, giống trang chủ. */
function theoCuon() {
  let dangCho = false;
  const kiemTra = () => {
    dangCho = false;
    danhDauDaCuon();
  };
  const hen = () => {
    if (dangCho) return;
    dangCho = true;
    requestAnimationFrame(kiemTra);
  };
  window.addEventListener('scroll', hen, { passive: true });
  kiemTra();
}

function ganSuKienChung() {
  $$('[data-dong]').forEach((nut) => nut.addEventListener('click', dongBang));
  $('#lop-nen').addEventListener('click', dongBang);
  window.addEventListener('keydown', (sk) => {
    if (sk.key === 'Escape' && !$('#hop-dang-nhap').open) dongBang();
  });

  $('#khu-tai-khoan').addEventListener('click', (sk) => {
    if (sk.target.closest('[data-mo-cham-bai]')) chamBai.moBangChamBai();
  });

  nghe(SU_KIEN.CAN_DANG_NHAP, (chiTiet) => hopTaiKhoan.moHopDangNhap('dang-nhap', chiTiet?.project ?? null));

  khiPhienHong(() => {
    taiKhoan.donSauThoat();
    thongBao('Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi tiếp tục.', 'loi');
    phat(SU_KIEN.PHIEN_THAY_DOI);
  });

  // Giống trang chủ: đăng nhập hay đăng xuất ở thẻ khác thì trang này theo kịp.
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

  const capNhat = async () => {
    await taiKhoan.napTienDo();
    trangKho.veLaiTienDo();
    project.veLaiBangDangMo();
  };

  nghe(SU_KIEN.PHIEN_THAY_DOI, async () => {
    taiKhoan.veKhuTaiKhoan();
    await capNhat();
  });
  nghe(SU_KIEN.TIEN_DO_THAY_DOI, capNhat);

  // Tiến độ về với số liệu khác lần trước (bài được chấm ở nơi khác): vẽ lại từ
  // dữ liệu đã có. Quay lại thẻ thì tải lại tiến độ, như trang chủ.
  nghe(SU_KIEN.TIEN_DO_DA_NAP, () => {
    trangKho.veLaiTienDo();
    project.veLaiBangDangMo();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && phien.daDangNhap) taiKhoan.napTienDo();
  });
}

async function khoiDong() {
  theoDoiChieuCaoDauTrang();
  oTim.khoiTao();
  chuanBiCacBang();
  trangKho.khoiTao();
  project.khoiTao();
  hopTaiKhoan.khoiTao();
  taiKhoan.khoiTao();
  chamBai.khoiTao();
  ganSuKienChung();

  await khoiPhucPhien();
  taiKhoan.veKhuTaiKhoan();

  // Gọi /stats trước để trangKho.nap() dùng chung một lượt gọi, kể cả khi lượt ấy lỗi.
  chanTrang.nap();
  await trangKho.nap();
  if (phien.daDangNhap) {
    await taiKhoan.napTienDo();
    trangKho.veLaiTienDo();
  }

  theoCuon();
}

khoiDong();
