/* Điểm khởi động của giao diện: nối các phần lại với nhau, gắn những sự kiện
   dùng chung và chạy các hiệu ứng theo cuộn. */

import { khiPhienHong, khoiPhucPhien, phien, theoDoiPhienGiuaCacThe } from './api.js';
import * as chamBai from './cham-bai.js';
import * as giangVien from './giang-vien.js';
import { $, $$, batDauHienDan, chuanBiCacBang, dongBang, thongBao } from './giao-dien.js';
import * as kho from './kho.js';
import * as loTrinh from './lo-trinh.js';
import * as project from './project.js';
import { SU_KIEN, nghe, phat } from './su-kien.js';
import * as taiKhoan from './tai-khoan.js';
import * as xepHang from './xep-hang.js';

const giamChuyenDong = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Hiệu ứng theo cuộn: vạch tiến độ trên cùng, bốn số liệu đếm lên và level đang
   xem được tô đậm. Phần nội dung hiện dần nằm trong giao-dien.js vì nó phải theo
   dõi được cả những phần tử dựng sau khi gọi API. */

function demLen(o) {
  const dich = Number(o.dataset.dem);
  if (giamChuyenDong) {
    o.textContent = dich;
    return;
  }

  const batDau = performance.now();
  const buoc = (bayGio) => {
    const phan = Math.min(1, (bayGio - batDau) / 1100);
    o.textContent = Math.round(dich * (1 - (1 - phan) ** 3));
    if (phan < 1) requestAnimationFrame(buoc);
  };
  requestAnimationFrame(buoc);
}

function theoCuon() {
  let dangCho = false;

  const kiemTra = () => {
    dangCho = false;
    const nguong = window.innerHeight - 60;

    for (const o of $$('[data-dem]:not(.da-dem)')) {
      if (o.getBoundingClientRect().top <= nguong) {
        o.classList.add('da-dem');
        demLen(o);
      }
    }

    const toiDa = document.documentElement.scrollHeight - window.innerHeight;
    $('#vach-cuon-thanh').style.width =
      `${(toiDa > 0 ? (window.scrollY / toiDa) * 100 : 0).toFixed(2)}%`;

    const cacDoan = $$('.doan-level');
    const cacNut = $$('.muc-nut');
    let dangXem = 0;
    cacDoan.forEach((o, chiSo) => {
      if (o.getBoundingClientRect().top <= window.innerHeight * 0.34) dangXem = chiSo;
    });
    cacNut.forEach((nut, chiSo) => nut.classList.toggle('dang-xem', chiSo === dangXem));
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

/** Vùng sáng đi theo con trỏ ở phần mở đầu. */
function hieuUngDauTrang() {
  if (giamChuyenDong) return;

  const moDau = $('#mo-dau');
  const den = $('#mo-dau-den');
  moDau.addEventListener(
    'mousemove',
    (sk) => {
      const khung = moDau.getBoundingClientRect();
      den.style.transform = `translate(${sk.clientX - khung.left}px, ${sk.clientY - khung.top}px)`;
    },
    { passive: true }
  );
  moDau.addEventListener('mouseenter', () => {
    den.style.opacity = '1';
  });
  moDau.addEventListener('mouseleave', () => {
    den.style.opacity = '0';
  });
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

  nghe(SU_KIEN.CAN_DANG_NHAP, () => taiKhoan.moHopDangNhap());

  // Backend từ chối token: đưa trang về trạng thái chưa đăng nhập và nói rõ lý do.
  khiPhienHong(() => {
    thongBao('Phiên đăng nhập đã hết hạn. Đăng nhập lại để nộp bài.', 'loi');
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
      thongBao('Bạn vừa đăng xuất ở một thẻ khác, trang này cũng thoát theo.');
    }
    phat(SU_KIEN.PHIEN_THAY_DOI);
  });

  nghe(SU_KIEN.PHIEN_THAY_DOI, async () => {
    taiKhoan.veKhuTaiKhoan();
    await taiKhoan.napTienDo();
    kho.veLaiTienDo();
    project.veLaiBangDangMo();
    xepHang.nap();
  });

  nghe(SU_KIEN.TIEN_DO_THAY_DOI, async () => {
    await taiKhoan.napTienDo();
    kho.veLaiTienDo();
    project.veLaiBangDangMo();
    xepHang.nap();
  });
}

/* Khởi động. */

async function khoiDong() {
  chuanBiCacBang();
  kho.khoiTao();
  project.khoiTao();
  taiKhoan.khoiTao();
  chamBai.khoiTao();
  loTrinh.khoiTao();
  ganSuKienChung();
  hieuUngDauTrang();
  batDauHienDan();

  await khoiPhucPhien();
  taiKhoan.veKhuTaiKhoan();

  // Kho project phải xong trước, vì phần tiến độ vẽ đè lên chính danh sách đó.
  await kho.nap();
  if (phien.daDangNhap) {
    await taiKhoan.napTienDo();
    kho.veLaiTienDo();
  }

  loTrinh.nap();
  xepHang.nap();
  giangVien.nap();
  theoCuon();
}

khoiDong();
