/* Hộp đăng nhập và đăng ký.

   Hộp chia hai nửa. Nửa phải là việc chính: tiêu đề, hai nút chọn chế độ và
   biểu mẫu. Nửa trái là một tấm thẻ xem trước, vẽ đúng thứ người dùng sẽ có sau
   bước này: ở chế độ đăng ký, thẻ điền dần theo họ tên và username đang gõ, đứng
   ở level đầu tiên như mọi tài khoản mới; ở chế độ đăng nhập, thẻ là số liệu thật
   của kho; mở hộp từ bảng một project thì thẻ là chính project đó.
   Bề ngang hẹp thì nửa trái thu thành một dải chỉ còn dòng đầu của thẻ.

   Thẻ chỉ minh hoạ lại điều đã có ở nửa phải, nên nó nằm ngoài cây trợ năng:
   người dùng trình đọc màn hình không phải nghe lại từng chữ vừa gõ.

   Mọi con số trên thẻ lấy từ API. Số liệu kho, danh sách level và level đầu tiên
   lấy từ /stats qua apiCatalog.thongKe(); ô tìm ở đầu trang đã gọi lời hứa đó lúc
   mở trang và lớp gọi API giữ chung một lượt, nên hộp không tốn thêm lượt gọi
   nào. Level và điểm tích luỹ của project lấy từ chính project đang xem. /stats
   lỗi thì thẻ không vẽ hàng ga và bỏ mọi dòng cần tới /stats: thẻ đăng nhập chỉ
   còn một câu không có số, thẻ đăng ký chỉ còn tên, thẻ project còn tên, level
   và điểm tích luỹ của project. */

import { LoiApi, apiCatalog, apiTaiKhoan, phien } from './api.js';
import { $, $$, bieuTuong, chu, chuCaiDau, ghiMocMo, giamChuyenDong, so, tenLevel, thongBao, xoaMocMo } from './giao-dien.js';
import { SU_KIEN, phat } from './su-kien.js';

// Đúng bộ ký tự mà backend nhận cho username.
const MAU_USERNAME = /^[a-z0-9_]{3,50}$/;
const USERNAME_TOI_THIEU = 3;
// Ràng buộc mật khẩu của backend: từ 8 tới 64 ký tự, và bcrypt chỉ băm 72 byte đầu.
const MAT_KHAU_TOI_THIEU = 8;
const MAT_KHAU_TOI_DA = 64;
const BYTE_TOI_DA = 72;

// Dấu cách không ngắt dòng, nối con số với đơn vị của nó. Cột chữ trên thẻ có
// lúc chỉ rộng khoảng 140 điểm ảnh, và khi đó "200 project, 6 level" bị ngắt
// thành "200 project, 6" với "level" trơ trọi ở dòng dưới.
const CACH_LIEN = ' ';

const CHU_NUT = {
  'mau-dang-nhap': 'Đăng nhập',
  'mau-dang-ky': 'Tạo tài khoản',
};

const CHU_DANG_GUI = {
  'mau-dang-nhap': 'Đang đăng nhập…',
  'mau-dang-ky': 'Đang tạo tài khoản…',
};

const CAU_USERNAME = 'Chữ cái không dấu, chữ số và dấu gạch dưới, từ 3 đến 50 ký tự. Đây không phải thư điện tử.';

const o = {};

const tt = {
  cheDo: 'dang-nhap',
  // Project đang xem khi hộp được mở từ bảng chi tiết project, null khi mở từ chỗ khác.
  project: null,
  thongKe: null,
  // Mặt thẻ đang vẽ. Chuyển động chỉ chạy khi đổi mặt, không chạy mỗi lần gõ phím.
  matThe: null,
  // Vị trí dọc của khối thẻ ở lần đo trước, để khối trượt tới chỗ mới thay vì nhảy.
  trenKhoi: null,
  // Số lần hộp đã được mở. Yêu cầu gửi đi ở một lần mở chỉ được đổi nút và câu lỗi
  // của chính lần mở đó, xem guiMau.
  lanMo: 0,
  // Những ô đã rời khỏi ít nhất một lần. Câu "chưa đủ dài" chỉ đỏ lên ở những ô
  // này, để người dùng không bị báo lỗi khi mới gõ chữ đầu tiên.
  daRoi: new Set(),
};

/* Quy tắc của mẫu đăng ký. */

/** Số byte của mật khẩu khi mã hoá UTF-8, đúng đơn vị mà bcrypt đếm. */
const soByteMatKhau = (matKhau) => new TextEncoder().encode(matKhau).length;

/**
 * Kiểm tra dữ liệu đăng ký ngay tại trình duyệt.
 *
 * Backend vẫn là chốt chặn thật, nhưng câu lỗi của nó chỉ nêu tên trường sai.
 * Kiểm tra trước ở đây để nói được sai chỗ nào và phải sửa thế nào, nhất là với
 * username: trình duyệt hay tự điền thư điện tử vào ô đó.
 *
 * Trả về null khi hợp lệ, hoặc { truong, cau }: tên ô sai và câu báo lỗi.
 */
function loiCuaMauDangKy(duLieu) {
  // Ô còn trống thì nói là trống, không nói sai dạng: "chưa đúng dạng, cần có
  // dấu @" cho một ô chưa gõ gì làm người mới tưởng mình gõ sai.
  if (!duLieu.email) return { truong: 'email', cau: 'Cần nhập thư điện tử.' };
  if (!duLieu.username) return { truong: 'username', cau: 'Cần nhập username.' };
  if (!duLieu.password) return { truong: 'password', cau: 'Cần nhập mật khẩu.' };
  if (!duLieu.email.includes('@')) {
    return { truong: 'email', cau: 'Thư điện tử chưa đúng dạng, cần có dấu @.' };
  }
  // Cùng mức khắt khe với backend: phải có phần trước dấu @ và phần tên miền có
  // dấu chấm. Chỉ xét dấu @ thì "a@b" lọt qua và người dùng nhận nguyên câu báo
  // lỗi tiếng Anh của backend.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(duLieu.email)) {
    return { truong: 'email', cau: 'Thư điện tử chưa đúng dạng, ví dụ ten@stu.ptit.edu.vn.' };
  }
  if (!MAU_USERNAME.test(duLieu.username)) {
    return {
      truong: 'username',
      cau: 'Username chỉ gồm chữ cái không dấu, chữ số và dấu gạch dưới, từ 3 đến 50 ký tự. Thư điện tử không dùng làm username được.',
    };
  }
  if (duLieu.password.length < MAT_KHAU_TOI_THIEU) {
    return { truong: 'password', cau: `Mật khẩu cần từ ${MAT_KHAU_TOI_THIEU} ký tự trở lên.` };
  }
  // Ô mật khẩu có maxlength, nhưng trình quản lý mật khẩu và việc dán bằng mã
  // lệnh đặt thẳng giá trị nên vượt qua được giới hạn đó.
  if (duLieu.password.length > MAT_KHAU_TOI_DA) {
    return { truong: 'password', cau: `Mật khẩu chỉ được dài tối đa ${MAT_KHAU_TOI_DA} ký tự.` };
  }
  // bcrypt chỉ băm 72 byte đầu, và một chữ tiếng Việt có dấu chiếm hai tới ba
  // byte. Một mật khẩu ba mươi chữ tiếng Việt vẫn nằm trong giới hạn 64 ký tự
  // nhưng đã vượt 72 byte, nên phải đo bằng byte thì câu nhắc mới đúng.
  const soByte = soByteMatKhau(duLieu.password);
  if (soByte > BYTE_TOI_DA) {
    return {
      truong: 'password',
      cau: `Mật khẩu quá dài: chữ tiếng Việt có dấu chiếm nhiều chỗ hơn chữ không dấu, mật khẩu này đã dùng ${soByte} trên ${BYTE_TOI_DA} chỗ cho phép. Rút ngắn bớt rồi thử lại.`,
    };
  }
  return null;
}

/**
 * Câu nhắc sống dưới ô username.
 *
 * Trả về loại 'trung' (chỉ nêu quy tắc), 'dat' hoặc 'loi'. Mỗi kiểu sai có một câu
 * riêng, vì "chưa đúng quy tắc" không cho người gõ biết phải sửa ký tự nào.
 */
function trangThaiUsername(gia, daRoi) {
  const goc = gia.trim();
  const thuong = goc.toLowerCase();
  if (thuong === '') return { loai: 'trung', cau: CAU_USERNAME };
  if (MAU_USERNAME.test(thuong)) {
    // Backend hạ chữ trước khi lưu. Nói trước điều đó thay vì để người dùng
    // đăng nhập bằng SinhVien01 rồi thấy trang ghi sinhvien01.
    const haChu = thuong !== goc ? ` Chữ hoa sẽ được lưu thành chữ thường: ${thuong}.` : '';
    return { loai: 'dat', cau: `Đúng quy tắc username.${haChu}` };
  }
  if (thuong.includes('@')) {
    // Gợi ý phần trước dấu @ nếu đổi dấu chấm và gạch ngang thành gạch dưới là
    // dùng được, vì đó thường là tên người dùng đã quen gõ.
    const goiY = thuong.split('@')[0].replace(/[.-]/g, '_');
    return {
      loai: 'loi',
      cau: MAU_USERNAME.test(goiY)
        ? `Username không phải thư điện tử. Có thể dùng ${goiY}.`
        : 'Username không phải thư điện tử. Chọn một tên ngắn, ví dụ: sinhvien01.',
    };
  }
  const kyTuLa = [...new Set(thuong.replace(/[a-z0-9_]/g, ''))].slice(0, 3);
  if (kyTuLa.length > 0) {
    const ten = kyTuLa.map((kyTu) => (kyTu === ' ' ? 'dấu cách' : `“${kyTu}”`)).join(', ');
    return { loai: 'loi', cau: `Username không nhận ${ten}. Chỉ dùng chữ cái không dấu, chữ số và dấu gạch dưới.` };
  }
  if (thuong.length < USERNAME_TOI_THIEU) {
    return { loai: daRoi ? 'loi' : 'trung', cau: `Cần ít nhất ${USERNAME_TOI_THIEU} ký tự, mới có ${thuong.length}.` };
  }
  return { loai: 'loi', cau: CAU_USERNAME };
}

/** Câu nhắc sống dưới ô mật khẩu: số ký tự đã gõ, giới hạn 64 ký tự và giới hạn 72 byte. */
function trangThaiMatKhau(gia, daRoi) {
  if (gia === '') return { loai: 'trung', cau: `Từ ${MAT_KHAU_TOI_THIEU} đến ${MAT_KHAU_TOI_DA} ký tự.` };
  const dem = `${gia.length}/${MAT_KHAU_TOI_DA} ký tự`;
  if (gia.length > MAT_KHAU_TOI_DA) {
    return { loai: 'loi', cau: `${dem}. Tối đa ${MAT_KHAU_TOI_DA} ký tự.` };
  }
  const soByte = soByteMatKhau(gia);
  if (soByte > BYTE_TOI_DA) {
    return {
      loai: 'loi',
      cau: `${dem}. Đã dùng ${soByte} trên ${BYTE_TOI_DA} chỗ cho phép: chữ có dấu chiếm nhiều chỗ hơn chữ không dấu.`,
    };
  }
  // Số chỗ chỉ được nhắc khi mật khẩu có chữ có dấu, lúc nó khác số ký tự; với
  // mật khẩu không dấu thì hai con số trùng nhau và câu thứ hai chỉ gây rối.
  const cho = soByte !== gia.length ? `, dùng ${soByte} trên ${BYTE_TOI_DA} chỗ` : '';
  if (gia.length < MAT_KHAU_TOI_THIEU) {
    return { loai: daRoi ? 'loi' : 'trung', cau: `${dem}${cho}. Cần từ ${MAT_KHAU_TOI_THIEU} ký tự.` };
  }
  return { loai: 'dat', cau: `${dem}${cho}. Đủ dài.` };
}

/** Vẽ một câu nhắc sống. Trạng thái nói bằng biểu tượng và chữ, không chỉ bằng màu. */
function veGoiY(oGoiY, oNhap, { loai, cau }) {
  const bieu = { dat: bieuTuong('tich'), loi: bieuTuong('loi') }[loai] ?? '';
  oGoiY.dataset.loai = loai;
  oGoiY.innerHTML = `${bieu}<span>${chu(cau)}</span>`;
  if (loai === 'loi') oNhap.setAttribute('aria-invalid', 'true');
  else oNhap.removeAttribute('aria-invalid');
}

function capNhatGoiYDangKy() {
  const { username, password } = o.mauDangKy;
  veGoiY(o.danUsername, username, trangThaiUsername(username.value, tt.daRoi.has(username)));
  veGoiY(o.danMatKhau, password, trangThaiMatKhau(password.value, tt.daRoi.has(password)));
}

/* Tấm thẻ xem trước. */

/**
 * Hàng ga ở chân thẻ, cùng ngữ pháp vòng tròn đánh số nối bằng đường thẳng
 * với tuyến level của trang chủ.
 *
 * Các ga là đúng danh sách level của /stats. Chưa có /stats thì không vẽ hàng ga:
 * số ga cũng là một con số, và thẻ không đoán số.
 *
 * moc là ga được tô đặc (level đầu tiên, hoặc level của project đang xem), dich là
 * ga được viền đậm (level của project đang xem khi thẻ đang là thẻ đăng ký).
 */
function hangGa({ moc = null, dich = null, voiSoProject = false } = {}) {
  if (!tt.thongKe) return '';
  return (
    '<ol class="the-tuyen">' +
    tt.thongKe.by_level
      .map(({ level, projects }) => {
        const lop = level.id === moc ? ' la-moc' : level.id === dich ? ' la-dich' : '';
        return (
          `<li class="the-ga${lop}"><span class="the-ga-so">${level.id}</span>` +
          (voiSoProject ? `<span class="the-ga-dem">${so(projects)}</span>` : '') +
          '</li>'
        );
      })
      .join('') +
    '</ol>'
  );
}

/** Phần đầu thẻ: vòng tròn, dòng tên và các dòng phụ. Dòng phụ mang lớp la-them ẩn ở dải hẹp. */
function dauThe(vong, dongTen, cacDongPhu, lopTen = '') {
  return (
    '<p class="the-hv-phat">Nền tảng học tập theo project</p>' +
    '<div class="the-hv-dinh">' +
    vong +
    '<span class="the-hv-chu">' +
    `<span class="the-hv-ten${lopTen}">${chu(dongTen)}</span>` +
    cacDongPhu.map(([noiDung, lop = '']) => `<span class="the-hv-phu${lop}">${chu(noiDung)}</span>`).join('') +
    '</span>' +
    '</div>'
  );
}

function matDangKy() {
  const mau = o.mauDangKy;
  const ten = mau.display_name.value.trim();
  // Thẻ vẽ tài khoản sắp có, nên chỉ in username khi nó đúng quy tắc: "@an nguyễn"
  // không bao giờ thành username được, trong khi câu nhắc cạnh ô đang báo lỗi.
  const goUsername = mau.username.value.trim().toLowerCase();
  const username = MAU_USERNAME.test(goUsername) ? goUsername : '';
  const dongTen = ten || (username ? `@${username}` : '');
  const vong = dongTen
    ? `<span class="the-hv-vong">${chu(chuCaiDau(ten || username))}</span>`
    : '<span class="the-hv-vong la-trong"></span>';
  const cacDongPhu = ten && username ? [[`@${username}`, ' la-them']] : [];

  // Dòng chân là một lời chỉ đường chứ không phải trạng thái "Level 0": bảng tài
  // khoản cố ý không ghi level 0 cho tài khoản chưa hoàn thành project nào.
  const levelDau = tt.thongKe?.by_level[0]?.level ?? null;
  const dich = tt.project?.level.id ?? null;
  return (
    dauThe(vong, dongTen || 'Họ tên hiển thị', cacDongPhu, dongTen ? '' : ' la-cho') +
    hangGa({ moc: levelDau?.id ?? null, dich }) +
    (levelDau
      ? '<p class="the-hv-chan">' +
        `Tài khoản mới bắt đầu từ level ${levelDau.id}, ${chu(levelDau.name)}.` +
        (dich !== null && dich !== levelDau.id ? ` Project đang xem ở level ${dich}.` : '') +
        '</p>'
      : '')
  );
}

function matDangNhap() {
  const tk = tt.thongKe;
  const vong = `<span class="the-hv-vong">${bieuTuong('badge-level')}</span>`;
  if (!tk) return dauThe(vong, 'Project xếp theo level, từ dễ đến khó', []);
  return (
    dauThe(vong, `${so(tk.projects)}${CACH_LIEN}project, ${so(tk.by_level.length)}${CACH_LIEN}level`, [
      [`${so(tk.by_track.length)}${CACH_LIEN}track · ${so(tk.skills)}${CACH_LIEN}skill`],
    ]) +
    hangGa({ voiSoProject: true }) +
    '<p class="the-hv-chan">Số project của từng level.</p>'
  );
}

function matProject(project) {
  return (
    dauThe(`<span class="the-hv-vong la-level">${project.level.id}</span>`, project.title, [[tenLevel(project.level)]]) +
    hangGa({ moc: project.level.id }) +
    (Number.isFinite(project.reward_points)
      ? `<p class="the-hv-chan">Bài đạt được cộng ${so(project.reward_points)}${CACH_LIEN}điểm tích luỹ.</p>`
      : '')
  );
}

/** Mặt thẻ đổi thì hiện dần; người giảm chuyển động chỉ thấy mờ dần, không trượt. */
function hienDan(phanTu) {
  const khung = giamChuyenDong()
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }];
  phanTu.animate(khung, { duration: 240, easing: 'cubic-bezier(.16, 1, .3, 1)' });
}

function veThe() {
  // Thẻ đăng ký luôn là thẻ của chính người đang gõ, kể cả khi hộp mở từ một
  // project; project đó vẫn được đánh dấu trên hàng ga và nêu ở tiêu đề.
  const mat = tt.cheDo === 'dang-ky' ? 'dang-ky' : tt.project ? 'project' : 'dang-nhap';
  o.the.innerHTML = mat === 'dang-ky' ? matDangKy() : mat === 'project' ? matProject(tt.project) : matDangNhap();
  if (o.hop.open && tt.matThe !== null && tt.matThe !== mat) hienDan(o.the);
  tt.matThe = mat;
}

/**
 * Cho khối thẻ trượt tới chỗ mới mỗi khi nửa trái đổi chiều cao.
 *
 * Khối bọc tấm thẻ, căn giữa nửa trái theo chiều dọc để mẫu đăng ký, vốn dài
 * hơn, không để lại một khoảng trống lớn ở đáy. Hệ quả là khi hộp cao thêm, lúc
 * sang mẫu đăng ký hay lúc một câu nhắc dài thêm dòng, khối dời xuống nửa phần
 * cao thêm. Dời thẳng thì khối nhảy; ở đây khối bắt đầu từ chỗ cũ rồi trượt về
 * chỗ mới. Người giảm chuyển động thấy khối đứng ngay ở chỗ mới. Chuyển động gắn
 * vào khối bọc chứ không vào tấm thẻ, vì tấm thẻ có hoạt ảnh hiện dần riêng mỗi
 * lần đổi mặt, và huỷ hoạt ảnh trượt dở ở đây sẽ huỷ luôn hoạt ảnh đó.
 */
function truotKhoiThe() {
  const cu = tt.trenKhoi;
  const moi = o.khoiThe.offsetTop;
  tt.trenKhoi = moi;
  if (!o.hop.open || cu === null || cu === moi || giamChuyenDong()) return;
  // Khối có thể còn đang trượt dở từ lần trước: bắt đầu từ đúng chỗ đang hiện
  // trên màn hình, không phải từ chỗ đã tính, để khối không giật lùi.
  const dangLech = new DOMMatrixReadOnly(getComputedStyle(o.khoiThe).transform).m42;
  o.khoiThe.getAnimations().forEach((hoatAnh) => hoatAnh.cancel());
  o.khoiThe.animate([{ transform: `translateY(${cu - moi + dangLech}px)` }, { transform: 'none' }], {
    duration: 320,
    easing: 'cubic-bezier(.16, 1, .3, 1)',
  });
}

/* Tiêu đề và chế độ. */

function datTieuDe() {
  const laDangKy = tt.cheDo === 'dang-ky';
  const { project } = tt;
  // Phần tiêu đề nhìn thấy được giữ nguyên độ dài dù mở từ đâu: một tên project dài
  // làm tiêu đề thêm dòng, và hai nút chọn chế độ ngay dưới sẽ nhảy mỗi lần đổi
  // chế độ. Tên và level của project đã hiện trên thẻ, nhưng thẻ nằm ngoài cây trợ
  // năng, nên chúng đi vào tiêu đề qua một vế chỉ dành cho trình đọc màn hình.
  o.tieuDe.innerHTML =
    (laDangKy ? 'Tạo tài khoản mới' : 'Đăng nhập tài khoản') +
    (project
      ? `<span class="an-khoi-mat"> để nộp bài cho project “${chu(project.title)}”, level ${project.level.id}, ${chu(project.level.name)}.</span>`
      : '');
}

/**
 * Mang chữ đã gõ sang mẫu của chế độ kia.
 *
 * Người gõ thư điện tử hay username vào mẫu đăng nhập rồi mới nhận ra mình chưa có
 * tài khoản thì không phải gõ lại, và người đang điền mẫu đăng ký rồi nhớ ra mình
 * đã có tài khoản cũng vậy. Chỉ điền vào ô còn trống, không đè chữ đã có, và chỉ
 * mang chữ dùng được ở ô đích. Công tắc ghi nhớ đi theo: đó là một lựa chọn về
 * chiếc máy đang dùng, không đổi chỉ vì người dùng đổi chế độ.
 */
function mangChuSang(cheDo) {
  const { identifier } = o.mauDangNhap;
  const { email, username } = o.mauDangKy;
  const [nguon, dich] = cheDo === 'dang-ky' ? [o.mauDangNhap, o.mauDangKy] : [o.mauDangKy, o.mauDangNhap];
  dich.ghi_nho.checked = nguon.ghi_nho.checked;

  if (cheDo === 'dang-ky') {
    const dinhDanh = identifier.value.trim();
    if (dinhDanh.includes('@')) {
      if (email.value === '') email.value = dinhDanh;
    } else if (MAU_USERNAME.test(dinhDanh.toLowerCase()) && username.value === '') {
      username.value = dinhDanh;
    }
  } else if (identifier.value === '') {
    const goEmail = email.value.trim();
    const goUsername = username.value.trim();
    if (goEmail.includes('@')) identifier.value = goEmail;
    else if (MAU_USERNAME.test(goUsername.toLowerCase())) identifier.value = goUsername;
  }
}

function doiCheDo(cheDo) {
  const cheDoMoi = cheDo === 'dang-ky' ? 'dang-ky' : 'dang-nhap';
  const laDangKy = cheDoMoi === 'dang-ky';
  if (cheDoMoi !== tt.cheDo) mangChuSang(cheDoMoi);
  tt.cheDo = cheDoMoi;

  o.mauDangNhap.hidden = laDangKy;
  o.mauDangKy.hidden = !laDangKy;
  for (const nut of o.cacNutCheDo) {
    const chon = nut.dataset.cheDo === tt.cheDo;
    nut.classList.toggle('dang-chon', chon);
    nut.setAttribute('aria-selected', String(chon));
    nut.tabIndex = chon ? 0 : -1;
  }
  datTieuDe();
  veThe();
  if (laDangKy) capNhatGoiYDangKy();
}

const mauDangMo = () => (tt.cheDo === 'dang-ky' ? o.mauDangKy : o.mauDangNhap);

/** Ô nhập chữ còn trống đầu tiên của mẫu, hoặc ô đầu tiên nếu ô nào cũng đã có chữ. */
function oCanGo(mau) {
  const cacO = Array.from(mau.elements).filter((e) => e.tagName === 'INPUT' && e.type !== 'checkbox');
  return cacO.find((e) => e.value === '') ?? cacO[0];
}

/** Đổi chế độ bằng chuột hay bằng nút liên kết: tiêu điểm đi thẳng vào chỗ cần gõ. */
function sangCheDo(cheDo) {
  doiCheDo(cheDo);
  oCanGo(mauDangMo())?.focus();
}

/* Ô mật khẩu: nút hiện mật khẩu và câu báo Caps Lock. */

function doiHienMatKhau(nut, hien) {
  const oNhap = document.getElementById(nut.getAttribute('aria-controls'));
  const dangGo = document.activeElement === oNhap;
  const { value: giaTri, selectionStart: dau, selectionEnd: cuoi } = oNhap;
  oNhap.type = hien ? 'text' : 'password';
  // Chỉ aria-pressed đổi; nhãn luôn là "Hiện mật khẩu". Theo mẫu nút bật tắt của
  // WAI-ARIA APG, nếu nhãn cũng đổi thành "Ẩn mật khẩu" thì trình đọc màn hình đọc
  // "Ẩn mật khẩu, đang bật", nghe như mật khẩu đang bị ẩn.
  nut.setAttribute('aria-pressed', String(hien));
  // Đổi kiểu ô đang gõ thì Chromium dựng lại phần soạn chữ bên trong và, khi bấm
  // bằng chuột, đưa con trỏ về đầu ô lúc xử lý xong cú nhả chuột, tức là sau hàm
  // này. Trả con trỏ về chỗ cũ ở khung hình kế tiếp thì không bị đè mất. Riêng khi
  // chữ trong ô đã đổi trong khung hình đó, như lúc nhấn Enter để gửi rồi gõ tiếp
  // ngay, con trỏ đang đứng đúng sau chữ vừa gõ; kéo nó về chỗ cũ thì chữ gõ sau
  // chen vào trước chữ gõ trước.
  if (dangGo) {
    requestAnimationFrame(() => {
      if (oNhap.value === giaTri) oNhap.setSelectionRange(dau, cuoi);
    });
  }
}

function anMatKhauCua(goc) {
  $$('.nut-hien-mk', goc).forEach((nut) => doiHienMatKhau(nut, false));
}

function baoCapsLock(oNhap, bat) {
  const oBao = oNhap.closest('.truong').querySelector('.bao-caps');
  // Chỉ viết lại khi trạng thái đổi: vùng báo này được trình đọc màn hình đọc mỗi
  // lần nội dung thay đổi, không được đọc lại sau từng phím.
  if (oBao.dataset.bat === String(bat)) return;
  oBao.dataset.bat = String(bat);
  oBao.innerHTML = bat ? `${bieuTuong('caps')}<span>Caps Lock đang bật, chữ gõ vào sẽ là chữ hoa.</span>` : '';
}

/* Gửi mẫu. */

function datLoi(mau, cau) {
  const oLoi = mau.querySelector('.mau-loi');
  oLoi.innerHTML = cau ? `${bieuTuong('loi')}<span>${chu(cau)}</span>` : '';
  // Trên điện thoại bàn phím ảo che nửa dưới hộp; câu lỗi phải lọt vào phần còn thấy.
  if (cau) oLoi.scrollIntoView({ block: 'nearest' });
}

const nutGuiCua = (mau) => mau.querySelector('button[type="submit"]');
const dangGui = (mau) => nutGuiCua(mau).getAttribute('aria-disabled') === 'true';

function traNutGui(mau) {
  const nut = nutGuiCua(mau);
  nut.removeAttribute('aria-disabled');
  nut.removeAttribute('aria-busy');
  nut.textContent = CHU_NUT[mau.id];
}

async function guiMau(mau, goiApi) {
  const nut = nutGuiCua(mau);
  const lan = tt.lanMo;
  // Không bật công tắc này thì phiên chỉ sống trong thẻ trình duyệt đang mở, đóng thẻ là thoát.
  const ghiNho = mau.querySelector('[name="ghi_nho"]')?.checked === true;

  // Mật khẩu đang hiện thì che lại trước khi gửi: trình quản lý mật khẩu nhận ra
  // ô mật khẩu theo kiểu ô, và người đứng sau lưng không đọc được lúc chờ.
  anMatKhauCua(mau);
  // Nút báo bận bằng aria-disabled chứ không bằng disabled: khoá hẳn một nút đang có
  // tiêu điểm thì tiêu điểm rơi ra body, ra ngoài hộp, suốt lúc chờ. Lần gửi thứ
  // hai trong lúc chờ bị hai trình xử lý submit bỏ qua, xem dangGui.
  nut.setAttribute('aria-disabled', 'true');
  nut.setAttribute('aria-busy', 'true');
  nut.textContent = CHU_DANG_GUI[mau.id];
  datLoi(mau, '');
  // Người dùng có thể đóng hộp trong lúc chờ rồi mở lại. Khi đó mẫu, nút và câu
  // lỗi đã được dọn cho lần mở mới, và trả lời muộn của lần gửi cũ không được vẽ
  // đè lên chúng.
  const vanLanMoCu = () => tt.lanMo === lan;
  try {
    const ket = await goiApi();
    // Phiên là thật dù hộp đã đóng hay đã mở lại, nên vẫn lưu, vẫn chào và báo cho
    // cả trang; chỉ việc đóng hộp và dọn mẫu thuộc về lần mở cũ.
    phien.dat(ket.access_token, ket.user, ghiNho);
    if (vanLanMoCu()) {
      o.hop.close();
      mau.reset();
    }
    thongBao(`Xin chào ${ket.user.display_name || ket.user.username}.`);
    phat(SU_KIEN.PHIEN_THAY_DOI);
  } catch (loi) {
    if (vanLanMoCu()) datLoi(mau, loi instanceof LoiApi ? loi.message : 'Không gửi được yêu cầu.');
  } finally {
    if (vanLanMoCu()) traNutGui(mau);
  }
}

// Nút Back của điện thoại đóng hộp; hộp đóng bằng cách khác thì bỏ mốc lịch sử.
const dongHopTheoLichSu = () => o.hop.close();

/** Mở hộp đăng nhập. Truyền 'dang-ky' để mở thẳng sang mẫu đăng ký, và project khi mở từ bảng chi tiết của nó. */
export function moHopDangNhap(cheDo = 'dang-nhap', project = null) {
  tt.lanMo++;
  // Dọn mọi thứ của lần mở trước: chữ đã gõ, câu báo lỗi, nút còn đang báo bận,
  // câu nhắc, ô bị đánh dấu sai, mật khẩu đang hiện, câu báo Caps Lock, vị trí
  // khối thẻ, và project của lần mở trước.
  tt.project = project;
  tt.daRoi.clear();
  tt.trenKhoi = null;
  for (const mau of [o.mauDangNhap, o.mauDangKy]) {
    mau.reset();
    datLoi(mau, '');
    traNutGui(mau);
  }
  o.mauDangKy.email.removeAttribute('aria-invalid');
  anMatKhauCua(o.hop);
  $$('.bao-caps', o.hop).forEach((oBao) => {
    delete oBao.dataset.bat;
    oBao.innerHTML = '';
  });
  capNhatGoiYDangKy();
  doiCheDo(cheDo);
  o.hop.showModal();
  ghiMocMo(dongHopTheoLichSu);
  // Trên máy có chuột và bàn phím, tiêu điểm vào thẳng ô cần gõ. Trên màn hình
  // chạm thì không, vì bàn phím ảo bật lên sẽ che nửa dưới của hộp.
  if (window.matchMedia('(pointer: fine)').matches) oCanGo(mauDangMo())?.focus();
}

function ganSuKien() {
  o.hop.addEventListener('close', () => xoaMocMo(dongHopTheoLichSu));

  o.doiCheDo.addEventListener('click', (sk) => {
    const nut = sk.target.closest('[data-che-do]');
    if (nut) sangCheDo(nut.dataset.cheDo);
  });

  // Mẫu tabs của WAI-ARIA APG: phím mũi tên, Home và End đổi chế độ ngay, tiêu điểm
  // ở lại trên nút; chỉ nút đang chọn nằm trong thứ tự phím Tab.
  o.doiCheDo.addEventListener('keydown', (sk) => {
    const hienTai = o.cacNutCheDo.indexOf(sk.target.closest('[role="tab"]'));
    const toi = { ArrowRight: hienTai + 1, ArrowLeft: hienTai - 1, Home: 0, End: o.cacNutCheDo.length - 1 }[sk.key];
    if (hienTai < 0 || toi === undefined) return;
    sk.preventDefault();
    const nut = o.cacNutCheDo[(toi + o.cacNutCheDo.length) % o.cacNutCheDo.length];
    doiCheDo(nut.dataset.cheDo);
    nut.focus();
  });

  o.hop.addEventListener('click', (sk) => {
    const lienKet = sk.target.closest('[data-doi-sang]');
    if (lienKet) {
      sangCheDo(lienKet.dataset.doiSang);
      return;
    }
    const nut = sk.target.closest('.nut-hien-mk');
    if (nut) doiHienMatKhau(nut, nut.getAttribute('aria-pressed') !== 'true');
  });

  // Bấm chuột vào nút hiện mật khẩu trong lúc đang gõ thì tiêu điểm ở lại ô nhập.
  o.hop.addEventListener('mousedown', (sk) => {
    const nut = sk.target.closest('.nut-hien-mk');
    if (nut && document.activeElement?.id === nut.getAttribute('aria-controls')) sk.preventDefault();
  });

  const theoPhim = (sk) => {
    if (sk.target.matches?.('.o-mat-khau input') && typeof sk.getModifierState === 'function') {
      baoCapsLock(sk.target, sk.getModifierState('CapsLock'));
    }
  };
  o.hop.addEventListener('keydown', theoPhim);
  o.hop.addEventListener('keyup', theoPhim);

  o.mauDangKy.addEventListener('input', (sk) => {
    const ten = sk.target.name;
    // Ô thư điện tử chỉ bị đánh dấu sai lúc gửi, xem trình xử lý submit bên dưới;
    // gõ lại là bỏ dấu đó, chờ lần gửi sau kiểm tra lại.
    if (ten === 'email') sk.target.removeAttribute('aria-invalid');
    if (ten === 'username' || ten === 'password') {
      capNhatGoiYDangKy();
      // Câu nhắc có thể dài thêm một dòng lúc đang gõ. Ô nằm sát mép dưới vùng cuộn
      // thì dòng mới rơi khuất, nên vùng cuộn đi theo cho tới hết câu nhắc.
      sk.target.closest('.truong').scrollIntoView({ block: 'nearest' });
    }
    if (ten === 'username' || ten === 'display_name') veThe();
  });

  o.hop.addEventListener('focusout', (sk) => {
    if (sk.target.matches?.('.o-mat-khau input')) baoCapsLock(sk.target, false);
    if (sk.target.form === o.mauDangKy && (sk.target.name === 'username' || sk.target.name === 'password')) {
      tt.daRoi.add(sk.target);
      capNhatGoiYDangKy();
    }
  });

  o.mauDangNhap.addEventListener('submit', (sk) => {
    sk.preventDefault();
    const mau = sk.target;
    if (dangGui(mau)) return;
    guiMau(mau, () =>
      apiTaiKhoan.dangNhap({
        identifier: mau.identifier.value.trim(),
        password: mau.password.value,
      })
    );
  });

  o.mauDangKy.addEventListener('submit', (sk) => {
    sk.preventDefault();
    const mau = sk.target;
    if (dangGui(mau)) return;
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
      // Gửi rồi thì coi như đã rời mọi ô, để câu nhắc cạnh ô sai cũng đỏ lên.
      tt.daRoi.add(mau.username).add(mau.password);
      capNhatGoiYDangKy();
      // Username và mật khẩu đã được câu nhắc sống đánh dấu; ô thư điện tử không có
      // câu nhắc riêng nên được đánh dấu ở đây. Mọi ô còn trống cũng được đánh dấu,
      // để người dùng thấy ngay còn thiếu mấy ô chứ không chỉ ô đầu tiên.
      if (loi.truong === 'email') mau.email.setAttribute('aria-invalid', 'true');
      for (const ten of ['email', 'username', 'password']) {
        if (!than[ten]) mau[ten].setAttribute('aria-invalid', 'true');
      }
      datLoi(mau, loi.cau);
      // Tiêu điểm vào đúng ô sai, để người dùng bàn phím sửa được ngay thay vì phải
      // đi tìm ô đó từ nút gửi.
      mau[loi.truong].focus();
      return;
    }
    guiMau(mau, () => apiTaiKhoan.dangKy(than));
  });
}

export function khoiTao() {
  Object.assign(o, {
    hop: $('#hop-dang-nhap'),
    tieuDe: $('#hop-tieu-de'),
    doiCheDo: $('#doi-che-do'),
    mauDangNhap: $('#mau-dang-nhap'),
    mauDangKy: $('#mau-dang-ky'),
    danUsername: $('#dan-username'),
    danMatKhau: $('#dan-mat-khau'),
    the: $('#the-hv'),
    khoiThe: $('#hop-the-khoi'),
  });
  o.cacNutCheDo = $$('[role="tab"]', o.doiCheDo);

  capNhatGoiYDangKy();
  veThe();
  ganSuKien();

  // Theo dõi cả nửa trái lẫn chính khối thẻ: vị trí của khối đổi khi nửa trái cao
  // thêm và cả khi thẻ đổi mặt mà cao thấp khác đi.
  if ('ResizeObserver' in window) {
    const quanSat = new ResizeObserver(truotKhoiThe);
    quanSat.observe(o.khoiThe.parentElement);
    quanSat.observe(o.khoiThe);
  }

  apiCatalog
    .thongKe()
    .then((thongKe) => {
      tt.thongKe = thongKe;
      veThe();
    })
    .catch(() => {
      // Không có số liệu thì thẻ giữ các mặt không cần /stats, xem chú thích đầu
      // tệp. Câu báo lỗi đã có ở phần kho và ở ô tìm, không nhắc lần nữa ở đây.
    });
}
