/* Phiên đăng nhập và bảng tài khoản: điểm tích luỹ, badge, tiến độ theo track,
   bài nộp và đề xuất project tiếp theo. */

import { LoiApi, apiTaiKhoan, apiTienDo, phien } from './api.js';
import {
  $,
  $$,
  NHAN_TRANG_THAI,
  chu,
  dongBang,
  duongDanAnh,
  moBang,
  so,
  soDiem,
  soGio,
  tenLevel,
  thoiGian,
  thongBao,
} from './giao-dien.js';
import { moProject } from './project.js';
import { SU_KIEN, phat } from './su-kien.js';
import * as tienDo from './tien-do.js';

// Số project mà phần đề xuất hiển thị mỗi lần.
const SO_DE_XUAT = 5;

// Đúng bộ ký tự mà backend nhận cho username.
const MAU_USERNAME = /^[a-z0-9_]{3,50}$/;

/* Khu tài khoản ở góc phải đầu trang. */

// Số liệu để vẽ vòng tiến độ. Giữ ở đây vì khu tài khoản được vẽ lại nhiều lần,
// còn tiến độ thì chỉ tải lại khi có việc thay đổi nó.
let tienDoHienTai = { daXong: 0, tong: 0 };

/**
 * Hai chữ cái đại diện cho một người dùng.
 *
 * Lấy chữ đầu của từ đầu và từ cuối trong tên hiển thị, ví dụ "Trần Tiến Công"
 * thành TC. Tên chỉ có một từ thì lấy hai chữ cái đầu của từ đó.
 */
function chuCaiDau(ten) {
  const tu = ten.trim().split(/\s+/).filter(Boolean);
  if (tu.length === 0) return '?';
  if (tu.length === 1) return tu[0].slice(0, 2).toUpperCase();
  return (tu[0][0] + tu[tu.length - 1][0]).toUpperCase();
}

/**
 * Vòng tròn tiến độ bao quanh chữ cái đại diện.
 *
 * Cung tròn dài theo tỷ lệ project đã hoàn thành trên tổng số project của kho.
 * Vòng bắt đầu từ đỉnh nên phải xoay ngược chín mươi độ, vì mặc định cung tròn
 * của SVG bắt đầu từ phía bên phải.
 */
function veVongTienDo(daXong, tong) {
  const banKinh = 19;
  const chuVi = 2 * Math.PI * banKinh;
  const tiLe = tong > 0 ? Math.min(1, daXong / tong) : 0;

  return (
    '<svg class="vong-tien-do" viewBox="0 0 44 44" aria-hidden="true">' +
    `<circle cx="22" cy="22" r="${banKinh}" fill="none" stroke="rgba(22,19,15,.12)" stroke-width="2.5"></circle>` +
    `<circle class="vong-chay" cx="22" cy="22" r="${banKinh}" fill="none" stroke="var(--do)" stroke-width="2.5"` +
    ` stroke-linecap="round" stroke-dasharray="${chuVi.toFixed(1)}"` +
    ` stroke-dashoffset="${(chuVi * (1 - tiLe)).toFixed(1)}" transform="rotate(-90 22 22)"></circle>` +
    '</svg>'
  );
}

export function veKhuTaiKhoan() {
  const khu = $('#khu-tai-khoan');
  veKhuKeuGoi();

  if (!phien.daDangNhap) {
    khu.innerHTML = '<button type="button" class="nut nut-vien" data-mo-dang-nhap>Đăng nhập</button>';
    return;
  }

  const nguoi = phien.nguoiDung;
  const ten = nguoi.display_name || nguoi.username;
  const { daXong, tong } = tienDoHienTai;
  const nhan =
    tong > 0
      ? `Đã hoàn thành ${daXong} trên ${tong} project của kho`
      : 'Chưa có số liệu tiến độ';

  khu.innerHTML =
    `<button type="button" class="the-nguoi-dung" data-mo-tai-khoan title="${chu(nhan)}">` +
    '<span class="the-vong">' +
    veVongTienDo(daXong, tong) +
    (nguoi.avatar
      ? `<img class="the-anh" src="${chu(duongDanAnh(nguoi.avatar))}" width="34" height="34" alt="">`
      : `<span class="the-chu-cai">${chu(chuCaiDau(ten))}</span>`) +
    '</span>' +
    '<span class="the-chu">' +
    `<span class="the-ten">${chu(ten)}</span>` +
    `<span class="the-so">${daXong} project · ${soDiem(nguoi.total_points)}</span>` +
    '</span>' +
    '</button>' +
    (phien.laGiangVien
      ? '<button type="button" class="nut nut-vien" data-mo-cham-bai>Chấm bài</button>'
      : '') +
    '<button type="button" class="nut-thoat" data-dang-xuat>Đăng xuất</button>';
}

/* Bảng tài khoản. */

function veTienDoTheoTrack(danhSach) {
  const daDung = danhSach.filter((mot) => mot.completed > 0);
  if (daDung.length === 0) {
    return '<p class="bang-doan">Phần này đếm số project đã hoàn thành trong từng track. Bạn chưa hoàn thành project nào nên chưa có gì để đếm.</p>';
  }

  return daDung
    .map((mot) => {
      const tiLe = mot.total === 0 ? 0 : (mot.completed / mot.total) * 100;
      return (
        '<div class="track-hang">' +
        `<span class="track-ten">${chu(mot.track.name)}</span>` +
        `<span class="track-so">${mot.completed} trên ${mot.total}</span>` +
        `<span class="track-vach"><i style="width:${tiLe.toFixed(1)}%"></i></span>` +
        '</div>'
      );
    })
    .join('');
}

function veBadge(danhSach) {
  if (danhSach.length === 0) {
    return '<p class="bang-doan">Chưa có badge nào. Badge được cấp theo bốn điều kiện: đủ số project bất kỳ, đủ số project trong một track, hoàn thành một project ở level đủ cao, hoặc tích đủ điểm.</p>';
  }
  return (
    '<div class="badge-luoi">' +
    danhSach
      .map(
        (mot) =>
          '<div class="badge-o">' +
          `<span class="badge-hinh">${chu(mot.badge.icon)}</span>` +
          `<span class="badge-ten">${chu(mot.badge.name)}</span>` +
          `<span class="badge-mo">${chu(mot.badge.description)}</span>` +
          `<span class="badge-moc">${chu(thoiGian(mot.awarded_at))}</span>` +
          '</div>'
      )
      .join('') +
    '</div>'
  );
}

function veBaiNop(danhSach) {
  if (danhSach.length === 0) {
    return '<p class="bang-doan">Bạn chưa nộp bài nào.</p>';
  }
  return danhSach
    .slice(0, 10)
    .map(
      (bai) =>
        '<div class="bai-nop-hang">' +
        `<button type="button" class="bai-nop-ten" data-mo-project="${chu(bai.project.slug)}">${chu(bai.project.title)}</button>` +
        `<span class="bai-nop-the the-${chu(bai.status)}">${chu(NHAN_TRANG_THAI[bai.status])}</span>` +
        `<span class="bai-nop-moc">${chu(thoiGian(bai.submitted_at))}</span>` +
        '</div>'
    )
    .join('');
}

function veDeXuat(danhSach) {
  if (danhSach.length === 0) {
    return '<p class="bang-doan">Chưa có project nào để đề xuất. Phần này chỉ lấy project đã mở khoá mà bạn chưa nộp bài, nên hãy chờ những bài đang chờ chấm có kết quả.</p>';
  }
  return danhSach
    .map(
      (mot) =>
        '<div class="de-xuat-o">' +
        `<button type="button" class="de-xuat-ten" data-mo-project="${chu(mot.project.slug)}">${chu(mot.project.title)}</button>` +
        `<p class="de-xuat-ly-do">${chu(mot.reason)}</p>` +
        `<p class="de-xuat-the">${chu(tenLevel(mot.project.level))} · ${chu(mot.project.track.name)} · ${chu(soGio(mot.project.estimated_hours))}</p>` +
        '</div>'
    )
    .join('');
}

/** Phần đổi ảnh đại diện trong bảng tài khoản. */
function veKhuAnh(nguoi) {
  const ten = nguoi.display_name || nguoi.username;
  return (
    '<div class="o-doi-anh">' +
    (nguoi.avatar
      ? `<img class="anh-lon" src="${chu(duongDanAnh(nguoi.avatar))}" width="96" height="96" alt="Ảnh đại diện của ${chu(ten)}">`
      : `<span class="anh-lon anh-chu-cai">${chu(chuCaiDau(ten))}</span>`) +
    '<div class="doi-anh-nut">' +
    '<label class="nut nut-vien nut-chon-anh">Chọn ảnh' +
    '<input type="file" id="o-chon-anh" accept="image/jpeg,image/png,image/webp" hidden>' +
    '</label>' +
    (nguoi.avatar ? '<button type="button" class="nut-thoat" data-bo-anh>Bỏ ảnh</button>' : '') +
    '<p class="mau-chu-dan">Ảnh JPEG, PNG hoặc WebP, không quá 2 MB.</p>' +
    '<p class="mau-loi" id="loi-anh" role="alert"></p>' +
    '</div>' +
    '</div>'
  );
}

function veBangTaiKhoan(tomTat, danhSachBaiNop, danhSachDeXuat) {
  const nguoi = phien.nguoiDung;
  $('#bang-tai-khoan-than').innerHTML =
    `<h3 class="bang-ten">${chu(nguoi.display_name || nguoi.username)}</h3>` +
    `<p class="bang-tom-tat">${chu(nguoi.email)} · ${chu(nguoi.username)}</p>` +
    veKhuAnh(nguoi) +
    '<div class="so-nho">' +
    `<div><b>${so(tomTat.total_points)}</b><span>điểm tích luỹ</span></div>` +
    `<div><b>${so(tomTat.completed_projects)}</b><span>project đã hoàn thành</span></div>` +
    `<div><b>${so(tomTat.pending_submissions)}</b><span>bài đang chờ chấm</span></div>` +
    // Ba ô trên là số đếm, ô này là số hiệu level. Đứng cạnh nhau mà cùng chỉ có
    // một con số thì "0" đọc thành "chưa hoàn thành level nào", nên chữ Level
    // được ghi kèm ngay trong con số.
    `<div><b>${tomTat.completed_projects > 0 ? `Level ${so(tomTat.highest_level)}` : '-'}</b>` +
    '<span>level cao nhất đã hoàn thành</span></div>' +
    '</div>' +
    '<p class="bang-muc-nhan">Đề xuất cho bạn</p>' +
    veDeXuat(danhSachDeXuat) +
    '<p class="bang-muc-nhan">Tiến độ theo track</p>' +
    veTienDoTheoTrack(tomTat.by_track) +
    '<p class="bang-muc-nhan">Badge</p>' +
    veBadge(tomTat.badges) +
    '<p class="bang-muc-nhan">Bài nộp gần đây</p>' +
    veBaiNop(danhSachBaiNop);
}

/* Tải dữ liệu tiến độ. */

/**
 * Tải tiến độ của người đang đăng nhập.
 *
 * Ba lệnh gọi chạy song song vì chúng không phụ thuộc nhau, nên bảng tài khoản
 * chỉ phải chờ đúng lệnh gọi chậm nhất.
 */
export async function napTienDo() {
  if (!phien.daDangNhap) {
    tienDo.xoa();
    capNhatOTienDo(null);
    return;
  }

  // Người dùng có thể đăng xuất hoặc đổi tài khoản trong lúc ba lệnh gọi còn
  // đang chờ. Ghi tên tài khoản lại từ trước rồi so lại lúc có kết quả, nếu
  // không dữ liệu của phiên cũ sẽ đè lên màn hình của phiên mới.
  const nguoiLucGoi = phien.nguoiDung.username;

  try {
    const [tomTat, danhSachBaiNop, danhSachDeXuat] = await Promise.all([
      apiTienDo.tienDo(),
      apiTienDo.baiNopCuaToi(),
      apiTienDo.deXuat(SO_DE_XUAT),
    ]);

    if (!phien.daDangNhap || phien.nguoiDung.username !== nguoiLucGoi) return;

    tienDo.dat(danhSachBaiNop);
    tienDo.datTheoLevel(tomTat.by_level);
    // Điểm tích luỹ trong phiên được cập nhật theo số liệu vừa đọc, để thẻ ở đầu trang
    // không hiển thị con số cũ sau khi một bài nộp được chấm.
    phien.nguoiDung.total_points = tomTat.total_points;
    tienDoHienTai = {
      daXong: tomTat.completed_projects,
      tong: tomTat.by_track.reduce((cong, mot) => cong + mot.total, 0),
    };
    veKhuTaiKhoan();
    capNhatOTienDo(tomTat);
    veBangTaiKhoan(tomTat, danhSachBaiNop, danhSachDeXuat);
  } catch (loi) {
    if (!phien.daDangNhap || phien.nguoiDung.username !== nguoiLucGoi) return;
    thongBao(loi instanceof LoiApi ? loi.message : 'Không tải được tiến độ.', 'loi');
    // Không đọc được tiến độ không có nghĩa là người dùng đã đăng xuất. Nói đúng
    // chuyện vừa xảy ra, thay vì để ô tiến độ ghi "Chưa đăng nhập" ngay bên dưới
    // tên người đang đăng nhập.
    baoKhongTaiDuocTienDo();
  }
}

/** Ô tiến độ và bảng tài khoản khi lượt gọi hỏng, người dùng thì vẫn đang đăng nhập. */
function baoKhongTaiDuocTienDo() {
  const o = $('#o-tien-do-so');
  if (o !== null) o.textContent = 'Chưa tải được tiến độ';

  const than = $('#bang-tai-khoan-than');
  if (than !== null && than.innerHTML.trim() === '') {
    than.innerHTML =
      '<p class="dang-tai">Chưa tải được tiến độ của bạn. Kiểm tra đường truyền rồi mở lại bảng này.</p>';
  }
}

/**
 * Ô tiến độ nhỏ ở đầu phần kho project.
 *
 * Chỉ trang chủ mới có ô này, nên phải kiểm tra trước. Phần tài khoản được dùng
 * lại nguyên vẹn ở trang kho project, nơi không có ô đó.
 */
function capNhatOTienDo(tomTat) {
  const o = $('#o-tien-do-so');
  if (o === null) return;
  o.textContent = tomTat
    ? `${tomTat.completed_projects} project · ${soDiem(tomTat.total_points)}`
    : 'Chưa đăng nhập';
}

/* Ảnh đại diện. */

async function taiAnhLen(tep) {
  const oLoi = $('#loi-anh');
  oLoi.textContent = 'Đang tải ảnh lên…';
  try {
    phien.nguoiDung = await apiTaiKhoan.taiAnhLen(tep);
    veKhuTaiKhoan();
    veBangTaiKhoanLai();
    thongBao('Đã đổi ảnh đại diện.');
  } catch (loi) {
    oLoi.textContent = loi instanceof LoiApi ? loi.message : 'Không tải được ảnh lên.';
  }
}

async function boAnhDaiDien() {
  try {
    await apiTaiKhoan.boAnh();
    phien.nguoiDung.avatar = '';
    veKhuTaiKhoan();
    veBangTaiKhoanLai();
    thongBao('Đã bỏ ảnh đại diện.');
  } catch (loi) {
    thongBao(loi instanceof LoiApi ? loi.message : 'Không bỏ được ảnh.', 'loi');
  }
}

/** Vẽ lại riêng phần ảnh, giữ nguyên phần còn lại của bảng tài khoản. */
function veBangTaiKhoanLai() {
  const khu = $('#bang-tai-khoan-than .o-doi-anh');
  if (khu === null) return;
  khu.outerHTML = veKhuAnh(phien.nguoiDung);
}

/* Hộp đăng nhập và đăng ký. */

function doiCheDo(cheDo) {
  const laDangKy = cheDo === 'dang-ky';
  $('#mau-dang-nhap').hidden = laDangKy;
  $('#mau-dang-ky').hidden = !laDangKy;
  $$('#doi-che-do button').forEach((nut) =>
    nut.classList.toggle('dang-chon', nut.dataset.cheDo === cheDo)
  );
}

/** Mở hộp đăng nhập. Truyền 'dang-ky' để mở thẳng sang mẫu đăng ký. */
export function moHopDangNhap(cheDo = 'dang-nhap') {
  // Dọn dữ liệu và câu báo lỗi của lần gửi trước, để lần mở này bắt đầu sạch.
  $$('#hop-dang-nhap .mau').forEach((mau) => {
    mau.reset();
    mau.querySelector('.mau-loi').textContent = '';
  });
  doiCheDo(cheDo);
  $('#hop-dang-nhap').showModal();
}

/**
 * Kiểm tra dữ liệu đăng ký ngay tại trình duyệt.
 *
 * Backend vẫn là chốt chặn thật, nhưng câu lỗi của nó chỉ nêu tên trường sai.
 * Kiểm tra trước ở đây để nói được sai chỗ nào và phải sửa thế nào, nhất là với
 * username: trình duyệt hay tự điền thư điện tử vào ô đó.
 */
function loiCuaMauDangKy(duLieu) {
  if (!duLieu.email.includes('@')) {
    return 'Thư điện tử chưa đúng dạng, cần có dấu @.';
  }
  if (!MAU_USERNAME.test(duLieu.username)) {
    return 'Username chỉ gồm chữ thường, chữ số và dấu gạch dưới, từ 3 đến 50 ký tự. Thư điện tử không dùng làm username được.';
  }
  if (duLieu.password.length < 8) {
    return 'Mật khẩu cần từ 8 ký tự trở lên.';
  }
  // bcrypt chỉ băm 72 byte đầu, và một chữ tiếng Việt có dấu chiếm hai tới ba
  // byte. Một mật khẩu ba mươi chữ tiếng Việt vẫn nằm trong giới hạn 64 ký tự
  // nhưng đã vượt 72 byte, nên phải đo bằng byte thì câu nhắc mới đúng.
  const soByte = new TextEncoder().encode(duLieu.password).length;
  if (soByte > 72) {
    return `Mật khẩu quá dài: chữ tiếng Việt có dấu chiếm nhiều chỗ hơn chữ thường, mật khẩu này đã dùng ${soByte} trên 72 chỗ cho phép. Rút ngắn bớt rồi thử lại.`;
  }
  return null;
}

async function guiMau(mau, goiApi) {
  const oLoi = mau.querySelector('.mau-loi');
  const nut = mau.querySelector('button[type="submit"]');

  nut.disabled = true;
  oLoi.textContent = '';
  try {
    const ket = await goiApi();
    phien.dat(ket.access_token, ket.user);
    $('#hop-dang-nhap').close();
    mau.reset();
    thongBao(`Xin chào ${ket.user.display_name || ket.user.username}.`);
    phat(SU_KIEN.PHIEN_THAY_DOI);
  } catch (loi) {
    oLoi.textContent = loi instanceof LoiApi ? loi.message : 'Không gửi được yêu cầu.';
  } finally {
    nut.disabled = false;
  }
}

function dangXuat() {
  phien.xoa();
  tienDo.xoa();
  tienDoHienTai = { daXong: 0, tong: 0 };
  // Bảng tài khoản và bảng chấm bài đang hiển thị dữ liệu của người vừa đăng
  // xuất, nên phải đóng lại và xoá nội dung thay vì để nguyên trên màn hình.
  dongBang();
  $('#bang-tai-khoan-than').innerHTML = '';
  $('#bang-cham-bai-than').innerHTML = '';
  thongBao('Đã đăng xuất.');
  phat(SU_KIEN.PHIEN_THAY_DOI);
}

/**
 * Mục cuối trang chủ đổi lời theo trạng thái đăng nhập.
 *
 * Mời một người đang đăng nhập đi "tạo tài khoản" thì vừa thừa vừa khó hiểu:
 * bấm vào nút đó lại mở ra bảng tài khoản họ đã có.
 */
function veKhuKeuGoi() {
  const nut = $('#nut-keu-goi');
  if (nut === null) return;

  const daVao = phien.daDangNhap;
  $('#keu-goi-tieu-de').textContent = daVao
    ? 'Đi tiếp từ chỗ bạn đang đứng'
    : 'Bắt đầu từ project đầu tiên';
  $('#keu-goi-dan').textContent = daVao
    ? 'Tiến độ, điểm tích luỹ và badge của bạn được lưu trên máy chủ, nên mở ở máy nào cũng thấy. Bảng tài khoản có sẵn vài project được đề xuất cho chặng tiếp theo.'
    : 'Tạo một tài khoản là đủ để nộp bài. Tiến độ, điểm tích luỹ và badge được lưu trên máy chủ nên bạn mở ở máy nào cũng thấy.';
  nut.textContent = daVao ? 'Mở tài khoản của tôi' : 'Tạo tài khoản';
}

/**
 * Mở bảng tài khoản.
 *
 * Nội dung bảng do lượt gọi tiến độ dựng nên, và lượt gọi đó có thể mất một
 * giây. Bảng vì vậy mở ra với một dòng báo đang tải, thay vì trượt ra trống
 * trơn khiến người dùng tưởng hỏng và bấm đóng ngay.
 */
export function moBangTaiKhoan() {
  const than = $('#bang-tai-khoan-than');
  if (than.innerHTML.trim() === '') {
    than.innerHTML = '<p class="dang-tai">Đang tải tài khoản của bạn…</p>';
  }
  moBang('bang-tai-khoan');
  if (phien.daDangNhap) napTienDo();
}

export function khoiTao() {
  $('#khu-tai-khoan').addEventListener('click', (sk) => {
    if (sk.target.closest('[data-mo-dang-nhap]')) moHopDangNhap();
    else if (sk.target.closest('[data-mo-tai-khoan]')) moBangTaiKhoan();
    else if (sk.target.closest('[data-dang-xuat]')) dangXuat();
  });

  $('#doi-che-do').addEventListener('click', (sk) => {
    const nut = sk.target.closest('[data-che-do]');
    if (nut) doiCheDo(nut.dataset.cheDo);
  });

  $('#mau-dang-nhap').addEventListener('submit', (sk) => {
    sk.preventDefault();
    const mau = sk.target;
    guiMau(mau, () =>
      apiTaiKhoan.dangNhap({
        identifier: mau.identifier.value.trim(),
        password: mau.password.value,
      })
    );
  });

  $('#mau-dang-ky').addEventListener('submit', (sk) => {
    sk.preventDefault();
    const mau = sk.target;
    const than = {
      email: mau.email.value.trim().toLowerCase(),
      // Backend cũng hạ chữ, làm sẵn ở đây để phần kiểm tra bên dưới không bắt
      // lỗi oan người gõ chữ hoa.
      username: mau.username.value.trim().toLowerCase(),
      password: mau.password.value,
      display_name: mau.display_name.value.trim(),
    };

    const loi = loiCuaMauDangKy(than);
    if (loi !== null) {
      mau.querySelector('.mau-loi').textContent = loi;
      return;
    }
    guiMau(mau, () => apiTaiKhoan.dangKy(than));
  });

  $('#bang-tai-khoan-than').addEventListener('click', (sk) => {
    const nut = sk.target.closest('[data-mo-project]');
    if (nut) {
      moProject(nut.dataset.moProject);
      return;
    }
    if (sk.target.closest('[data-bo-anh]')) boAnhDaiDien();
  });

  $('#bang-tai-khoan-than').addEventListener('change', (sk) => {
    if (sk.target.id === 'o-chon-anh' && sk.target.files.length > 0) {
      taiAnhLen(sk.target.files[0]);
    }
  });

  // Nút kêu gọi chỉ có ở trang chủ.
  $('#nut-keu-goi')?.addEventListener('click', () => {
    if (phien.daDangNhap) moBangTaiKhoan();
    else moHopDangNhap('dang-ky');
  });
}
