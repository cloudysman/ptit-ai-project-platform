/* Điểm khởi động của trang kho project.

   Trang này dùng lại phần tài khoản, bảng chi tiết project và bảng chấm bài của
   trang chủ, chỉ thay phần danh sách bằng bản có bộ lọc đầy đủ và phân trang. */

import { khiPhienHong, khoiPhucPhien, phien, theoDoiPhienGiuaCacThe } from './api.js';
import * as chamBai from './cham-bai.js';
import { $, $$, batDauHienDan, chuanBiCacBang, dongBang, thongBao } from './giao-dien.js';
import * as project from './project.js';
import { SU_KIEN, nghe, phat } from './su-kien.js';
import * as taiKhoan from './tai-khoan.js';
import * as trangKho from './trang-kho.js';

function theoCuon() {
  let dangCho = false;

  const kiemTra = () => {
    dangCho = false;
    const toiDa = document.documentElement.scrollHeight - window.innerHeight;
    $('#vach-cuon-thanh').style.width =
      `${(toiDa > 0 ? (window.scrollY / toiDa) * 100 : 0).toFixed(2)}%`;
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

function ganSuKienChung() {
  $$('[data-dong]').forEach((nut) => nut.addEventListener('click', dongBang));
  $('#lop-nen').addEventListener('click', dongBang);
  window.addEventListener('keydown', (sk) => {
    if (sk.key === 'Escape' && !$('#hop-dang-nhap').open) dongBang();
  });

  $('#khu-tai-khoan').addEventListener('click', (sk) => {
    if (sk.target.closest('[data-mo-cham-bai]')) chamBai.moBangChamBai();
  });

  nghe(SU_KIEN.CAN_DANG_NHAP, () => taiKhoan.moHopDangNhap());

  khiPhienHong(() => {
    thongBao('Phiên đăng nhập đã hết hạn. Đăng nhập lại để nộp bài.', 'loi');
    phat(SU_KIEN.PHIEN_THAY_DOI);
  });

  // Giống trang chủ: đăng nhập hay đăng xuất ở thẻ khác thì trang này theo kịp.
  theoDoiPhienGiuaCacThe(async (token) => {
    if (token) {
      await khoiPhucPhien();
      thongBao('Bạn vừa đăng nhập ở một thẻ khác, trang này đã cập nhật theo.');
    } else {
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
}

async function khoiDong() {
  chuanBiCacBang();
  trangKho.khoiTao();
  project.khoiTao();
  taiKhoan.khoiTao();
  chamBai.khoiTao();
  ganSuKienChung();
  batDauHienDan();

  await khoiPhucPhien();
  taiKhoan.veKhuTaiKhoan();

  await trangKho.nap();
  if (phien.daDangNhap) {
    await taiKhoan.napTienDo();
    trangKho.veLaiTienDo();
  }

  theoCuon();
}

khoiDong();
