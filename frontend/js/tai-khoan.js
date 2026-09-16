/* Phiên đăng nhập và bảng tài khoản: điểm tích luỹ, badge, tiến độ theo track,
   bài nộp và đề xuất project tiếp theo. */

import { LoiApi, apiQuanTri, apiTaiKhoan, apiTienDo, phien } from './api.js';
import {
  $,
  NHAN_TRANG_THAI,
  chu,
  chuCaiDau,
  bieuTuong,
  dongBang,
  dongLoi,
  duongDanAnh,
  moBang,
  quenBangTruoc,
  so,
  soDiem,
  soGio,
  tenLevel,
  thoiGian,
  thongBao,
} from './giao-dien.js';
import { moHopDangNhap } from './hop-tai-khoan.js';
import { moProject } from './project.js';
import { SU_KIEN, phat } from './su-kien.js';
import * as tienDo from './tien-do.js';

// Số project mà phần đề xuất hiển thị mỗi lần.
const SO_DE_XUAT = 5;

/**
 * Biểu tượng của một badge, chọn theo loại điều kiện mà slug của badge cho biết.
 *
 * Backend lưu một ký tự emoji cho mỗi badge, nhưng emoji do từng máy vẽ một
 * kiểu và máy không có phông emoji thì để trống. Giao diện vẽ bốn biểu tượng
 * của riêng mình, mỗi biểu tượng ứng với một trong bốn loại điều kiện cấp badge.
 */
function bieuTuongBadge(slug) {
  if (slug.startsWith('level-')) return bieuTuong('badge-level');
  if (slug.startsWith('diem-')) return bieuTuong('badge-diem');
  if (slug.endsWith('-specialist')) return bieuTuong('badge-track');
  return bieuTuong('badge-project');
}

/* Khu tài khoản ở góc phải đầu trang. */

// Số liệu cho dòng chú thích của thẻ người dùng. Giữ ở đây vì khu tài khoản
// được vẽ lại nhiều lần, còn tiến độ thì chỉ tải lại khi có việc thay đổi nó.
let tienDoHienTai = { daXong: 0, tong: 0 };

/* Kết quả của lượt tải tiến độ gần nhất, giữ nguyên cho phần khác đọc.

   Mục kêu gọi cuối trang chủ (js/keu-goi.js) vẽ tuyến level và project đề xuất
   từ đúng ba phản hồi mà bảng tài khoản dùng, nên nó đọc ở đây thay vì gọi lại
   ba endpoint. Đăng xuất thì xoá, để không phần nào còn vẽ số liệu của người đã
   rời đi. Lượt tải lỗi thì giữ số liệu cũ, cùng cách với bảng tài khoản: bảng
   giữ nội dung đã có thay vì thay bằng dòng lỗi. */
let tomTatGanNhat = null;
let deXuatGanNhat = [];
// Số bài đang chờ chấm, chỉ có nghĩa với tài khoản giảng viên; null khi chưa tải.
let soBaiChoCham = null;
// Dấu vân của lượt tải tiến độ gần nhất: điểm, số project, và trạng thái từng bài
// nộp. Lượt tải sau mà khác thì có chuyện đã xảy ra ở nơi khác (bài vừa được
// chấm), và mọi phần đang vẽ tiến độ phải vẽ lại chứ không chỉ bảng tài khoản.
let dauVanTienDo = '';

// Mốc reviewed_at mới nhất mà người dùng đã thấy, lưu theo username, để lần mở
// trang sau còn báo được bài nào vừa có kết quả chấm trong lúc họ vắng mặt.
const KHOA_DA_XEM = 'nen-tang-project:da-xem-cham';

function docMocDaXem(username) {
  try {
    return JSON.parse(localStorage.getItem(KHOA_DA_XEM) ?? '{}')?.[username] ?? null;
  } catch {
    return null;
  }
}

function ghiMocDaXem(username, moc) {
  try {
    let tatCa = JSON.parse(localStorage.getItem(KHOA_DA_XEM) ?? '{}');
    if (tatCa === null || typeof tatCa !== 'object' || Array.isArray(tatCa)) tatCa = {};
    tatCa[username] = moc;
    localStorage.setItem(KHOA_DA_XEM, JSON.stringify(tatCa));
  } catch {
    // Trình duyệt chặn lưu trữ thì lần sau báo lại, không sao.
  }
}

/**
 * Báo những bài được chấm sau mốc đã xem. Lần đầu tiên chưa có mốc thì chỉ ghi
 * mốc, không báo: người vừa đăng ký không có gì mới để nghe.
 */
function baoKetQuaChamMoi(username, danhSachBaiNop) {
  const daCham = danhSachBaiNop.filter((bai) => bai.reviewed_at);
  const mocMoi = daCham.reduce((cao, bai) => (bai.reviewed_at > cao ? bai.reviewed_at : cao), '');
  const mocCu = docMocDaXem(username);
  if (mocCu !== null) {
    for (const bai of daCham.filter((mot) => mot.reviewed_at > mocCu)) {
      thongBao(`Có kết quả chấm: ${bai.project.title} · ${NHAN_TRANG_THAI[bai.status]}.`);
    }
  }
  if (mocMoi !== mocCu) ghiMocDaXem(username, mocMoi);
}

/** Tóm tắt tiến độ của người đang đăng nhập (phản hồi /me/progress), null khi chưa có. */
export const tomTatTienDo = () => tomTatGanNhat;

/** Danh sách project đề xuất của người đang đăng nhập, rỗng khi chưa có. */
export const deXuatCuaToi = () => deXuatGanNhat;

export function veKhuTaiKhoan() {
  const khu = $('#khu-tai-khoan');
  // Khu này được vẽ lại mỗi lần đăng nhập hay đăng xuất, đúng lúc tiêu điểm đang
  // nằm trong nó: hộp đăng nhập đóng lại thì trả tiêu điểm về nút "Đăng nhập", còn
  // bấm "Đăng xuất" thì tiêu điểm ở trên chính nút đó. Nút cũ bị thay thì tiêu điểm
  // rơi ra body, nên nó được đưa sang nút chính của khu mới.
  const giuTieuDiem = khu.contains(document.activeElement);

  // Đăng nhập rồi thì khu tài khoản rộng thêm khoảng một phần tư đầu trang, nên
  // thanh điều hướng phải xuống hàng riêng sớm hơn. Tệp kiểu đọc trạng thái này
  // qua lớp trên thẻ body, xem hai khối @media của phần đầu trang.
  document.body.classList.toggle('da-dang-nhap', phien.daDangNhap);
  // Tài khoản giảng viên có thêm nút chấm bài nên khu tài khoản còn rộng hơn nữa,
  // và ngưỡng cho thanh điều hướng xuống hàng cũng phải cao hơn một bậc.
  document.body.classList.toggle('la-giang-vien', phien.laGiangVien);

  if (!phien.daDangNhap) {
    khu.innerHTML = '<button type="button" class="nut nut-vien" data-mo-dang-nhap>Đăng nhập</button>';
    if (giuTieuDiem) khu.querySelector('[data-mo-dang-nhap]').focus();
    return;
  }

  const nguoi = phien.nguoiDung;
  const ten = nguoi.display_name || nguoi.username;
  const { daXong, tong } = tienDoHienTai;
  // Giảng viên là người chấm, không phải người học: thẻ của họ không ghi số
  // project và điểm tích luỹ, hai con số luôn bằng không và nói sai vai của họ.
  const nhan = phien.laGiangVien
    ? 'Tài khoản giảng viên'
    : tong > 0
      ? `Đã hoàn thành ${daXong} trên ${tong} project của kho`
      : 'Chưa có số liệu tiến độ';
  const dongSo = phien.laGiangVien ? 'Giảng viên' : `${daXong} project · ${soDiem(nguoi.total_points)}`;
  const chuChamBai = soBaiChoCham > 0 ? `Chấm bài · ${so(soBaiChoCham)}` : 'Chấm bài';

  khu.innerHTML =
    `<button type="button" class="the-nguoi-dung" data-mo-tai-khoan title="${chu(nhan)}">` +
    '<span class="the-vong">' +
    (nguoi.avatar
      ? `<img class="the-anh" src="${chu(duongDanAnh(nguoi.avatar))}" width="34" height="34" alt="">`
      : `<span class="the-chu-cai">${chu(chuCaiDau(ten))}</span>`) +
    '</span>' +
    '<span class="the-chu">' +
    `<span class="the-ten">${chu(ten)}</span>` +
    `<span class="the-so">${chu(dongSo)}</span>` +
    '</span>' +
    '</button>' +
    (phien.laGiangVien
      ? `<button type="button" class="nut nut-vien" data-mo-cham-bai>${chu(chuChamBai)}</button>`
      : '') +
    '<button type="button" class="nut-thoat" data-dang-xuat>Đăng xuất</button>';
  if (giuTieuDiem) khu.querySelector('[data-mo-tai-khoan]').focus();
}

/* Bảng tài khoản. */

function veTienDoTheoTrack(danhSach) {
  const daDung = danhSach.filter((mot) => mot.completed > 0);
  if (daDung.length === 0) {
    return '<p class="bang-doan">Bạn chưa hoàn thành project nào.</p>';
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
    return '<p class="bang-doan">Chưa có badge nào.</p>';
  }
  return (
    '<div class="badge-luoi">' +
    danhSach
      .map(
        (mot) =>
          '<div class="badge-o">' +
          `<span class="badge-hinh">${bieuTuongBadge(mot.badge.slug)}</span>` +
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
        `<button type="button" class="bai-nop-ten" data-mo-project="${chu(bai.project.slug)}" data-bai-nop="${bai.id}">${chu(bai.project.title)}</button>` +
        `<span class="bai-nop-the nhan the-${chu(bai.status)}">${chu(NHAN_TRANG_THAI[bai.status])}</span>` +
        `<span class="bai-nop-moc">${chu(thoiGian(bai.submitted_at))}</span>` +
        '</div>'
    )
    .join('');
}

function veDeXuat(danhSach) {
  if (danhSach.length === 0) {
    return '<p class="bang-doan">Chưa có project nào để đề xuất.</p>';
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

// Hai dòng trạng thái của việc tải ảnh: đang tải và câu lỗi. Giữ ở đây chứ
// không chỉ trong DOM, vì bảng tài khoản được vẽ lại mỗi khi tiến độ về, có thể
// ngay giữa lúc ảnh đang tải: dòng đã ghi vào bảng cũ thì mất theo bảng cũ.
const trangThaiAnh = { cho: '', loi: '' };

function datTrangThaiAnh(cho, loi) {
  trangThaiAnh.cho = cho;
  trangThaiAnh.loi = loi;
  const oCho = $('#cho-anh');
  const oLoi = $('#loi-anh');
  if (oCho) oCho.textContent = cho;
  if (oLoi) oLoi.textContent = loi;
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
    `<p class="mau-chu-dan" id="cho-anh" role="status" aria-live="polite">${chu(trangThaiAnh.cho)}</p>` +
    `<p class="mau-loi" id="loi-anh" role="alert">${chu(trangThaiAnh.loi)}</p>` +
    '</div>' +
    '</div>'
  );
}

/** Lưới số liệu của người học: điểm, project, bài chờ chấm, bài cần sửa lại, level. */
function veSoLieuHocVien(tomTat, danhSachBaiNop) {
  // Đếm theo project: một project bị trả về nhiều lần vẫn là một việc phải làm.
  const soCanSua = new Set(
    danhSachBaiNop.filter((bai) => bai.status === 'revision').map((bai) => bai.project.slug)
  ).size;
  return (
    '<div class="so-nho">' +
    `<div><b>${so(tomTat.total_points)}</b><span>điểm tích luỹ</span></div>` +
    `<div><b>${so(tomTat.completed_projects)}</b><span>project đã hoàn thành</span></div>` +
    `<div><b>${so(tomTat.pending_submissions)}</b><span>bài đang chờ chấm</span></div>` +
    `<div><b>${so(soCanSua)}</b><span>bài cần sửa lại</span></div>` +
    // Bốn ô trên là số đếm, ô này là số hiệu level. Đứng cạnh nhau mà cùng chỉ có
    // một con số thì "0" đọc thành "chưa hoàn thành level nào", nên chữ Level
    // được ghi kèm ngay trong con số.
    `<div><b>${tomTat.completed_projects > 0 ? `Level ${so(tomTat.highest_level)}` : '-'}</b>` +
    '<span>level cao nhất đã hoàn thành</span></div>' +
    '</div>'
  );
}

function veBangTaiKhoan(tomTat, danhSachBaiNop, danhSachDeXuat) {
  const nguoi = phien.nguoiDung;
  // Giảng viên không có lộ trình học để đề xuất, và số liệu học viên của họ luôn
  // bằng không; thay bằng con số họ cần: bài đang chờ mình chấm.
  const phanRieng = phien.laGiangVien
    ? '<div class="so-nho">' +
      `<div><b>${soBaiChoCham === null ? '-' : so(soBaiChoCham)}</b><span>bài đang chờ chấm</span></div>` +
      '<div><b>Giảng viên</b><span>vai trò tài khoản</span></div>' +
      '</div>'
    : veSoLieuHocVien(tomTat, danhSachBaiNop) +
      '<p class="bang-muc-nhan">Đề xuất cho bạn</p>' +
      veDeXuat(danhSachDeXuat);
  $('#bang-tai-khoan-than').innerHTML =
    `<h3 class="bang-ten">${chu(nguoi.display_name || nguoi.username)}</h3>` +
    `<p class="bang-tom-tat">${chu(nguoi.email)} · ${chu(nguoi.username)}</p>` +
    veKhuAnh(nguoi) +
    phanRieng +
    '<p class="bang-muc-nhan">Tiến độ theo track</p>' +
    veTienDoTheoTrack(tomTat.by_track) +
    '<p class="bang-muc-nhan">Badge</p>' +
    veBadge(tomTat.badges) +
    '<p class="bang-muc-nhan">Bài nộp gần đây</p>' +
    veBaiNop(danhSachBaiNop) +
    // Trên điện thoại nút đăng xuất ở đầu trang bị ẩn (quá sát ô tài khoản, một
    // chạm là thoát), nên bảng tài khoản có nút của riêng nó ở cuối.
    '<p class="bang-thoat"><button type="button" class="nut nut-vien" data-dang-xuat>Đăng xuất</button></p>';
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
    tomTatGanNhat = null;
    deXuatGanNhat = [];
    capNhatOTienDo(null);
    return;
  }

  // Người dùng có thể đăng xuất hoặc đổi tài khoản trong lúc ba lệnh gọi còn
  // đang chờ. Ghi tên tài khoản lại từ trước rồi so lại lúc có kết quả, nếu
  // không dữ liệu của phiên cũ sẽ đè lên màn hình của phiên mới.
  const nguoiLucGoi = phien.nguoiDung.username;

  try {
    const [tomTat, danhSachBaiNop, danhSachDeXuat, hangDoi] = await Promise.all([
      apiTienDo.tienDo(),
      apiTienDo.baiNopCuaToi(),
      apiTienDo.deXuat(SO_DE_XUAT),
      // Giảng viên cần biết còn bao nhiêu bài chờ chấm; lượt gọi này hỏng thì
      // giữ con số cũ, không làm hỏng cả lượt tải tiến độ.
      phien.laGiangVien ? apiQuanTri.soBaiChoCham().catch(() => soBaiChoCham) : null,
    ]);

    if (!phien.daDangNhap || phien.nguoiDung.username !== nguoiLucGoi) return;

    tienDo.dat(danhSachBaiNop);
    tienDo.datTheoLevel(tomTat.by_level);
    tomTatGanNhat = tomTat;
    deXuatGanNhat = danhSachDeXuat;
    if (phien.laGiangVien) soBaiChoCham = hangDoi;
    const dauVanMoi = JSON.stringify([
      tomTat.total_points,
      tomTat.completed_projects,
      tomTat.pending_submissions,
      danhSachBaiNop.map((bai) => [bai.id, bai.status]),
    ]);
    const daDoi = dauVanTienDo !== '' && dauVanTienDo !== dauVanMoi;
    dauVanTienDo = dauVanMoi;
    baoKetQuaChamMoi(nguoiLucGoi, danhSachBaiNop);
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
    if (daDoi) phat(SU_KIEN.TIEN_DO_DA_NAP);
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
    than.innerHTML = dongLoi('Chưa tải được tiến độ của bạn.');
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
  datTrangThaiAnh('Đang tải ảnh lên…', '');
  try {
    phien.nguoiDung = await apiTaiKhoan.taiAnhLen(tep);
    datTrangThaiAnh('', '');
    veKhuTaiKhoan();
    veBangTaiKhoanLai();
    thongBao('Đã đổi ảnh đại diện.');
  } catch (loi) {
    datTrangThaiAnh('', loi instanceof LoiApi ? loi.message : 'Không tải được ảnh lên.');
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

/**
 * Dọn màn hình sau khi phiên kết thúc, dù kết thúc bằng cách nào: bấm "Đăng
 * xuất", đăng xuất ở thẻ khác, hay backend từ chối token giữa chừng.
 *
 * Bảng tài khoản và bảng chấm bài đang hiển thị dữ liệu của người vừa rời đi,
 * nên phải đóng lại và xoá nội dung thay vì để nguyên trên màn hình. Chỉ đóng
 * đúng hai bảng đó; bảng chi tiết project đang mở thì giữ, vì nó không mang dữ
 * liệu riêng của ai và được vẽ lại theo phiên mới ngay sau đó.
 */
export function donSauThoat() {
  datTrangThaiAnh('', '');
  tienDo.xoa();
  tienDoHienTai = { daXong: 0, tong: 0 };
  tomTatGanNhat = null;
  deXuatGanNhat = [];
  soBaiChoCham = null;
  dauVanTienDo = '';
  if (document.querySelector('#bang-tai-khoan.dang-mo, #bang-cham-bai.dang-mo')) dongBang();
  // Bảng project đang mở đè lên một trong hai bảng ấy thì cũng không mở lại chúng nữa.
  quenBangTruoc();
  $('#bang-tai-khoan-than').innerHTML = '';
  $('#bang-cham-bai-than').innerHTML = '';
}

function dangXuat() {
  phien.xoa();
  donSauThoat();
  thongBao('Đã đăng xuất.');
  phat(SU_KIEN.PHIEN_THAY_DOI);
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
    const nutTaiKhoan = sk.target.closest('[data-mo-tai-khoan]');
    if (sk.target.closest('[data-mo-dang-nhap]')) moHopDangNhap();
    else if (nutTaiKhoan) {
      // Bấm chuột vào nút không chắc đưa tiêu điểm vào nút (Safari không làm),
      // mà bảng đóng lại thì trả tiêu điểm về phần tử đang có tiêu điểm lúc mở.
      nutTaiKhoan.focus();
      moBangTaiKhoan();
    } else if (sk.target.closest('[data-dang-xuat]')) dangXuat();
  });

  $('#bang-tai-khoan-than').addEventListener('click', (sk) => {
    const nut = sk.target.closest('[data-mo-project]');
    if (nut) {
      // Dòng "Bài nộp gần đây" mở đúng bài nộp ấy; đề xuất thì mở project như thường.
      const baiNopId = nut.dataset.baiNop ? Number(nut.dataset.baiNop) : null;
      moProject(nut.dataset.moProject, nut.parentElement, { baiNopId });
      return;
    }
    if (sk.target.closest('[data-dang-xuat]')) {
      dangXuat();
      return;
    }
    if (sk.target.closest('[data-bo-anh]')) boAnhDaiDien();
  });

  $('#bang-tai-khoan-than').addEventListener('change', (sk) => {
    if (sk.target.id === 'o-chon-anh' && sk.target.files.length > 0) {
      taiAnhLen(sk.target.files[0]);
    }
  });

  // Nút của mục kêu gọi, chỉ có ở trang chủ. Chữ trên nút do js/keu-goi.js đặt
  // theo trạng thái đăng nhập; mời một người đang đăng nhập đi "tạo tài khoản"
  // thì vừa thừa vừa khó hiểu, nên với họ nút mở bảng tài khoản đã có.
  $('#nut-keu-goi')?.addEventListener('click', () => {
    if (phien.daDangNhap) moBangTaiKhoan();
    else moHopDangNhap('dang-ky');
  });
}
