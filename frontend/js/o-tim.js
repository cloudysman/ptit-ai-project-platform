/* Ô tìm project ở đầu trang.

   Dựng theo mẫu combobox có hộp gợi ý dạng danh sách của WAI-ARIA APG. Tiêu điểm
   luôn nằm ở ô nhập; lựa chọn đang trỏ tới chỉ được báo qua thuộc tính
   aria-activedescendant, nên người gõ không bao giờ bị kéo tiêu điểm ra khỏi chỗ
   đang gõ, và trình đọc màn hình vẫn đọc được dòng đang trỏ.

   Mọi con số trong ô tìm đều lấy từ API: câu gợi ý trong ô đọc số project của
   /stats, hộp gợi ý đọc năm project đầu và tổng số project khớp của /projects.
   API chưa trả lời thì ô chỉ ghi "Tìm project", không đoán số.

   Không có tệp mã này thì ô tìm vẫn là một biểu mẫu GET gửi sang kho.html?q=...,
   và nút biểu tượng ở bề ngang hẹp vẫn là một liên kết sang trang kho. Tệp mã chỉ
   làm cho cả hai thông minh hơn, không phải điều kiện để chúng dùng được. */

import { LoiApi, apiCatalog } from './api.js';
import { $, NHAN_TRANG_THAI, bieuTuong, chu, so, soGio } from './giao-dien.js';
import { duongDan } from './goc.js';
import { moProject } from './project.js';
import { trangThaiCua } from './tien-do.js';

// Chờ người dùng ngừng gõ chừng này mili giây rồi mới gọi API, để gõ một từ
// năm chữ không thành năm lượt gọi.
const CHO_GO = 250;
const SO_GOI_Y = 5;
// Backend nhận từ khoá dài tối đa một trăm ký tự.
const TIM_TOI_DA = 100;
// Lượt tìm trả lời nhanh hơn mốc này thì hộp nhảy thẳng sang kết quả, không chớp
// qua dòng "Đang tìm" trong một khung hình.
const CHO_BAO_DANG_TIM = 120;
// Bề ngang tối thiểu để ô nhập còn đọc trọn câu "Tìm trong 200 project" cùng
// biểu tượng kính lúp và phím gợi ý. Hẹp hơn thì thu thành nút biểu tượng.
const RONG_O_TOI_THIEU = 236;
const RONG_NUT_TIM = 40;

const o = {};

const tt = {
  thongKe: null,
  // Các lựa chọn đang có trong hộp, cùng thứ tự với các dòng trên màn hình.
  cacLuaChon: [],
  chon: -1,
  dangMo: false,
  // Mỗi lượt gọi API mang một số thứ tự. Phản hồi về muộn của lượt cũ bị bỏ,
  // nếu không gõ nhanh "anh" rồi "ảnh sản phẩm" có thể hiện kết quả của "anh".
  luot: 0,
  henGo: 0,
  henBao: 0,
  // Hộp đang hiện gì: 'level', 'dang-tim', 'ket-qua', 'trong' hay 'loi'.
  loai: null,
};

/* Chuẩn hoá chữ để tô phần khớp.

   Backend so khớp trên chữ thường không dấu, nên gõ "anh" cũng ra "ảnh". Phần tô
   đậm phải theo đúng cách đó. Mỗi ký tự gốc được bỏ dấu riêng, nhờ vậy biết được
   đoạn khớp trong chuỗi không dấu ứng với những ký tự nào của chuỗi gốc. */

function boDauKyTu(kyTu) {
  if (kyTu === 'đ' || kyTu === 'Đ') return 'd';
  return kyTu.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function timDoanKhop(goc, tuKhoa) {
  const kyTuGoc = Array.from(goc);
  const cacPhan = kyTuGoc.map(boDauKyTu);
  const chuoi = cacPhan.join('');
  const khoa = Array.from(tuKhoa.trim()).map(boDauKyTu).join('');
  if (khoa === '') return null;
  const viTri = chuoi.indexOf(khoa);
  if (viTri < 0) return null;

  let dem = 0;
  let dau = -1;
  let cuoi = kyTuGoc.length;
  for (let i = 0; i < cacPhan.length; i += 1) {
    if (dau < 0 && cacPhan[i].length > 0 && dem + cacPhan[i].length > viTri) dau = i;
    dem += cacPhan[i].length;
    if (dau >= 0 && dem >= viTri + khoa.length) {
      cuoi = i + 1;
      break;
    }
  }
  return { kyTuGoc, dau, cuoi };
}

function toKhop(goc, doan) {
  const { kyTuGoc, dau, cuoi } = doan;
  return (
    chu(kyTuGoc.slice(0, dau).join('')) +
    `<b class="hop-tim-khop">${chu(kyTuGoc.slice(dau, cuoi).join(''))}</b>` +
    chu(kyTuGoc.slice(cuoi).join(''))
  );
}

/** Một đoạn tóm tắt quanh chỗ khớp, khi từ khoá chỉ có trong tóm tắt chứ không có trong tên. */
function trichTomTat(tomTat, doan) {
  const truoc = 26;
  const batDau = Math.max(0, doan.dau - truoc);
  // Cắt ở đầu một từ để đoạn trích không bắt đầu bằng nửa chữ.
  let tu = batDau;
  if (batDau > 0) {
    while (tu < doan.dau && doan.kyTuGoc[tu - 1] !== ' ') tu += 1;
  }
  const catBot = { kyTuGoc: doan.kyTuGoc.slice(tu), dau: doan.dau - tu, cuoi: doan.cuoi - tu };
  return (tu > 0 ? '…' : '') + toKhop(tomTat, catBot);
}

/* Vẽ hộp gợi ý. */

function veLuaChon(cacLuaChon) {
  tt.cacLuaChon = cacLuaChon;
  tt.chon = -1;
  o.ds.innerHTML = cacLuaChon
    .map(
      (mot, chiSo) =>
        `<li role="option" id="hop-tim-${chiSo}" aria-selected="false" class="hop-tim-muc ${mot.lop}" data-chi-so="${chiSo}">${mot.html}</li>`
    )
    .join('');
  o.ds.hidden = cacLuaChon.length === 0;
  o.o.removeAttribute('aria-activedescendant');
}

function datBao(html, loi = false) {
  o.bao.innerHTML = html;
  o.bao.classList.toggle('loi', loi);
  o.bao.hidden = html === '';
}

const muiTen = () => bieuTuong('mui-ten');

function luaChonKho(tuKhoa, noiDung, dauHop = false) {
  return {
    loai: 'kho',
    gt: tuKhoa,
    lop: `la-kho${dauHop ? ' dau-hop' : ''}`,
    html: `<span class="hop-tim-ten">${noiDung}</span>${muiTen()}`,
  };
}

/** Ô tìm còn trống: sáu level xếp thành tuyến dọc nhỏ, chọn một level là mở kho đã lọc theo level đó. */
function veLevel() {
  if (tt.thongKe === null) return false;
  tt.loai = 'level';
  const cacLevel = tt.thongKe.by_level;
  veLuaChon([
    ...cacLevel.map((mot, chiSo) => ({
      loai: 'level',
      gt: mot.level.id,
      lop: `la-level${chiSo === cacLevel.length - 1 ? ' cuoi-tuyen' : ''}`,
      html:
        `<span class="hop-tim-ga" aria-hidden="true">${mot.level.id}</span>` +
        `<span class="hop-tim-chu"><span class="hop-tim-ten">${chu(mot.level.name)}` +
        `<span class="an-khoi-mat">, level ${mot.level.id}</span></span></span>` +
        `<span class="hop-tim-dem">${so(mot.projects)} project</span>`,
    })),
    luaChonKho('', `Mở toàn bộ ${so(tt.thongKe.projects)} project của kho`),
  ]);
  datBao('');
  return true;
}

function veDangTim(tuKhoa) {
  tt.loai = 'dang-tim';
  veLuaChon([]);
  datBao(`<span>Đang tìm project khớp “${chu(tuKhoa)}”…</span>`);
}

function veKetQua(tuKhoa, trang) {
  tt.loai = 'ket-qua';
  const cacProject = trang.items.map((project) => {
    const doanTen = timDoanKhop(project.title, tuKhoa);
    const doanTomTat = doanTen === null ? timDoanKhop(project.summary ?? '', tuKhoa) : null;
    const trangThaiBai = trangThaiCua(project.slug);
    return {
      loai: 'project',
      gt: project.slug,
      lop: 'la-project',
      html:
        `<span class="hop-tim-ga" aria-hidden="true">${project.level.id}</span>` +
        '<span class="hop-tim-chu">' +
        `<span class="hop-tim-ten">${doanTen ? toKhop(project.title, doanTen) : chu(project.title)}</span>` +
        // Số level đã in trong vòng tròn nên dòng phụ không nhắc lại; trình đọc màn
        // hình không thấy vòng tròn nên vẫn được đọc chữ Level.
        `<span class="hop-tim-phu"><span class="an-khoi-mat">Level ${project.level.id}, </span>${chu(project.level.name)} · ${chu(project.track.name)} · ${soGio(project.estimated_hours)}</span>` +
        (doanTomTat ? `<span class="hop-tim-trich">${trichTomTat(project.summary, doanTomTat)}</span>` : '') +
        '</span>' +
        (trangThaiBai
          ? `<span class="nhan the-${trangThaiBai}">${NHAN_TRANG_THAI[trangThaiBai]}</span>`
          : ''),
    };
  });

  const conLai = trang.total - trang.items.length;
  const chuKho =
    conLai > 0
      ? `Xem cả ${so(trang.total)} project khớp trong kho`
      : 'Mở kết quả này trong kho để lọc thêm';
  veLuaChon([...cacProject, luaChonKho(tuKhoa, chuKho)]);
  datBao('');
  o.loa.textContent =
    conLai > 0
      ? `${trang.items.length} gợi ý đầu trong ${trang.total} project khớp. Dùng phím mũi tên để chọn.`
      : `${trang.total} project khớp. Dùng phím mũi tên để chọn.`;
}

function veTrong(tuKhoa) {
  tt.loai = 'trong';
  veLuaChon([luaChonKho('', 'Mở kho project để lọc theo level và track', true)]);
  datBao(`<span>Không có project nào khớp <b>“${chu(tuKhoa)}”</b>. Thử một từ khoá ngắn hơn.</span>`);
  o.loa.textContent = `Không có project nào khớp ${tuKhoa}.`;
}

function veLoi(tuKhoa, loi) {
  tt.loai = 'loi';
  veLuaChon([]);
  const cau = loi instanceof LoiApi ? loi.message : 'Không tìm được project vì trang gặp lỗi.';
  datBao(`${bieuTuong('loi')}<span>Chưa tìm được “${chu(tuKhoa)}”. ${chu(cau)}</span>`, true);
  o.loa.textContent = `Chưa tìm được. ${cau}`;
}

/* Mở, đóng, trỏ và chọn. */

function moHop() {
  if (tt.dangMo) return;
  tt.dangMo = true;
  o.hop.hidden = false;
  o.o.setAttribute('aria-expanded', 'true');
}

function dongHop() {
  clearTimeout(tt.henGo);
  clearTimeout(tt.henBao);
  // Lượt tìm đang chạy không còn được vẽ khi về tới.
  tt.luot += 1;
  if (!tt.dangMo) return;
  tt.dangMo = false;
  tt.chon = -1;
  o.hop.hidden = true;
  o.o.setAttribute('aria-expanded', 'false');
  o.o.removeAttribute('aria-activedescendant');
}

function datChon(chiSo) {
  const cacDong = o.ds.children;
  if (tt.chon >= 0 && cacDong[tt.chon]) cacDong[tt.chon].setAttribute('aria-selected', 'false');
  tt.chon = chiSo;
  if (chiSo < 0 || !cacDong[chiSo]) {
    o.o.removeAttribute('aria-activedescendant');
    return;
  }
  cacDong[chiSo].setAttribute('aria-selected', 'true');
  o.o.setAttribute('aria-activedescendant', cacDong[chiSo].id);
  cacDong[chiSo].scrollIntoView({ block: 'nearest' });
}

function sangKho(thamSo) {
  const chuoi = new URLSearchParams(thamSo).toString();
  window.location.assign(duongDan(`kho.html${chuoi ? `?${chuoi}` : ''}`));
}

function chonLuaChon(chiSo) {
  const mot = tt.cacLuaChon[chiSo];
  if (!mot) return;
  if (mot.loai === 'level') {
    dongHop();
    sangKho({ level: mot.gt });
    return;
  }
  if (mot.loai === 'kho') {
    dongHop();
    sangKho(mot.gt ? { q: mot.gt } : {});
    return;
  }
  // Hộp gợi ý còn mở trong lúc bảng chi tiết trượt vào, để tên project bay từ
  // dòng gợi ý lên tiêu đề của bảng; bảng mở xong mới đóng hộp.
  const dong = o.ds.children[chiSo];
  moProject(mot.gt, dong).finally(dongHop);
}

/** Nội dung hộp theo chữ đang có trong ô: trống thì sáu level, có chữ thì tìm. */
function hienTheoO({ ngay = false } = {}) {
  const tuKhoa = o.o.value.trim();
  clearTimeout(tt.henGo);
  if (tuKhoa === '') {
    tt.luot += 1;
    clearTimeout(tt.henBao);
    if (veLevel()) moHop();
    else dongHop();
    return;
  }
  // Đang hiện kết quả của từ khoá cũ thì giữ nguyên tới khi kết quả mới về, tránh
  // chớp mỗi lần gõ thêm một chữ. Đang hiện sáu level hay chưa mở thì báo ngay
  // là đang tìm, vì sáu level không liên quan gì tới chữ vừa gõ.
  if (tt.loai !== 'ket-qua' || !tt.dangMo) {
    veDangTim(tuKhoa);
    moHop();
  }
  tt.henGo = setTimeout(() => tim(tuKhoa), ngay ? 0 : CHO_GO);
}

async function tim(tuKhoa) {
  tt.luot += 1;
  const luot = tt.luot;
  clearTimeout(tt.henBao);
  tt.henBao = setTimeout(() => {
    if (luot === tt.luot && tt.loai === 'ket-qua') veDangTim(tuKhoa);
  }, CHO_BAO_DANG_TIM);

  let trang;
  try {
    trang = await apiCatalog.trangProject({ q: tuKhoa, page: 1, page_size: SO_GOI_Y });
  } catch (loi) {
    if (luot !== tt.luot) return;
    clearTimeout(tt.henBao);
    veLoi(tuKhoa, loi);
    moHop();
    return;
  }
  if (luot !== tt.luot) return;
  clearTimeout(tt.henBao);
  if (trang.total === 0 || trang.items.length === 0) veTrong(tuKhoa);
  else veKetQua(tuKhoa, trang);
  moHop();
}

/* Thu gọn thành nút biểu tượng. */

const dangGon = () => o.dauTrang.classList.contains('tim-gon');

function moLopTim() {
  o.tim.classList.add('dang-mo');
  o.dauTrang.classList.add('dang-tim');
  o.nutMo.setAttribute('aria-expanded', 'true');
}

function dongLopTim({ traTieuDiem = true } = {}) {
  if (!o.tim.classList.contains('dang-mo')) return;
  dongHop();
  o.tim.classList.remove('dang-mo');
  o.dauTrang.classList.remove('dang-tim');
  o.nutMo.setAttribute('aria-expanded', 'false');
  if (traTieuDiem) o.nutMo.focus();
}

/** Đưa tiêu điểm vào ô tìm, mở lớp phủ nếu ô đang thu gọn, và hiện hộp gợi ý. */
function moTim() {
  if (dangGon()) moLopTim();
  o.o.focus();
  o.o.select();
  hienTheoO({ ngay: true });
}

/**
 * Đo xem đầu trang có đủ chỗ cho ô tìm đầy đủ hay không.
 *
 * Khu tài khoản rộng hay hẹp tuỳ vai người dùng và độ dài tên, thanh điều hướng
 * của trang chủ dài hơn của trang kho, nên không có một ngưỡng bề ngang cố định
 * nào đúng cho mọi trường hợp. Đo thẳng ba khối kia rồi so với chỗ còn lại: ba
 * khối ấy không co giãn, nên đổi trạng thái ô tìm không làm chúng đổi bề ngang
 * và phép đo không tự dao động.
 */
function doChoTrong() {
  const trong = o.dauTrang.querySelector('.dau-trang-trong');
  if (window.matchMedia('(max-width: 640px)').matches) {
    // Bề ngang điện thoại: tệp kiểu tự xếp hai hàng và thu gọn ô tìm.
    o.dauTrang.classList.add('tim-gon');
    o.dauTrang.classList.remove('hai-hang');
    return;
  }
  const kieu = getComputedStyle(trong);
  const rong = trong.clientWidth - parseFloat(kieu.paddingLeft) - parseFloat(kieu.paddingRight);
  const khe = parseFloat(kieu.columnGap) || 0;
  const kheCum = parseFloat(getComputedStyle(o.cum).columnGap) || 0;
  const cacLienKet = Array.from(o.dieuHuong.children);
  const rongDieuHuong = cacLienKet.reduce(
    (tong, lienKet) => tong + lienKet.getBoundingClientRect().width,
    (parseFloat(getComputedStyle(o.dieuHuong).columnGap) || 0) * Math.max(0, cacLienKet.length - 1)
  );
  const rongHieu = o.hieu.getBoundingClientRect().width;
  const rongKhu = o.khu.getBoundingClientRect().width;
  const benPhai = rongDieuHuong + kheCum + rongKhu;
  const gon = rongHieu + RONG_O_TOI_THIEU + benPhai + khe * 2 > rong;
  const haiHang = rongHieu + RONG_NUT_TIM + benPhai + khe * 2 > rong;
  // Xuống hai hàng thì hàng trên chỉ còn khối tên, ô tìm và khu tài khoản, có thể
  // lại đủ chỗ cho ô tìm đầy đủ.
  const gonKhiHaiHang = rongHieu + RONG_O_TOI_THIEU + rongKhu + khe * 2 > rong;
  o.dauTrang.classList.toggle('hai-hang', haiHang);
  o.dauTrang.classList.toggle('tim-gon', haiHang ? gonKhiHaiHang : gon);
  if (!dangGon()) dongLopTim({ traTieuDiem: false });
}

/* Sự kiện. */

function ganSuKien() {
  o.o.addEventListener('input', () => {
    if (o.o.value.length > TIM_TOI_DA) o.o.value = o.o.value.slice(0, TIM_TOI_DA);
    o.xoa.hidden = o.o.value === '';
    hienTheoO();
  });

  o.o.addEventListener('click', () => {
    if (!tt.dangMo) hienTheoO({ ngay: true });
  });

  o.o.addEventListener('keydown', (sk) => {
    const soDong = tt.cacLuaChon.length;
    switch (sk.key) {
      case 'ArrowDown':
        sk.preventDefault();
        if (!tt.dangMo) {
          hienTheoO({ ngay: true });
          if (tt.loai !== 'dang-tim' && tt.cacLuaChon.length) datChon(0);
          return;
        }
        if (soDong) datChon(tt.chon + 1 >= soDong ? 0 : tt.chon + 1);
        return;
      case 'ArrowUp':
        sk.preventDefault();
        if (!tt.dangMo) {
          hienTheoO({ ngay: true });
          if (tt.loai !== 'dang-tim' && tt.cacLuaChon.length) datChon(tt.cacLuaChon.length - 1);
          return;
        }
        if (soDong) datChon(tt.chon <= 0 ? soDong - 1 : tt.chon - 1);
        return;
      case 'Enter':
        sk.preventDefault();
        if (tt.dangMo && tt.chon >= 0) {
          chonLuaChon(tt.chon);
        } else if (o.o.value.trim() !== '') {
          dongHop();
          sangKho({ q: o.o.value.trim() });
        } else {
          hienTheoO({ ngay: true });
        }
        return;
      case 'Escape':
        // Phím Esc lần lượt: đóng hộp gợi ý, xoá chữ, rồi mới đóng lớp phủ.
        if (tt.dangMo) {
          sk.preventDefault();
          dongHop();
        } else if (o.o.value !== '') {
          sk.preventDefault();
          o.o.value = '';
          o.xoa.hidden = true;
        } else if (dangGon()) {
          sk.preventDefault();
          dongLopTim();
        }
        return;
      case 'Tab':
        dongHop();
        return;
      default:
    }
  });

  // Nhập liệu bằng bàn phím ảo trên điện thoại có thể gửi biểu mẫu mà không qua
  // sự kiện phím Enter.
  o.mau.addEventListener('submit', (sk) => {
    sk.preventDefault();
    const tuKhoa = o.o.value.trim();
    if (tuKhoa !== '') sangKho({ q: tuKhoa });
  });

  // Bấm chuột vào hộp không được lấy mất tiêu điểm của ô nhập.
  o.hop.addEventListener('mousedown', (sk) => sk.preventDefault());
  o.ds.addEventListener('click', (sk) => {
    const dong = sk.target.closest('[role="option"]');
    if (dong) chonLuaChon(Number(dong.dataset.chiSo));
  });

  o.xoa.addEventListener('click', () => {
    o.o.value = '';
    o.xoa.hidden = true;
    o.o.focus();
    hienTheoO({ ngay: true });
  });

  o.nutMo.setAttribute('role', 'button');
  o.nutMo.setAttribute('aria-expanded', 'false');
  o.nutMo.setAttribute('aria-controls', 'tim-mau');
  o.nutMo.addEventListener('click', (sk) => {
    sk.preventDefault();
    moTim();
  });
  o.nutMo.addEventListener('keydown', (sk) => {
    if (sk.key === ' ') {
      sk.preventDefault();
      moTim();
    }
  });
  o.dong.addEventListener('click', () => dongLopTim());

  // Tiêu điểm rời khỏi cả khối tìm, ví dụ nhấn Tab đi tiếp, thì hộp đóng lại.
  // Cửa sổ trình duyệt mất tiêu điểm thì không có phần tử nhận, lớp phủ giữ nguyên.
  o.tim.addEventListener('focusout', (sk) => {
    if (sk.relatedTarget && o.tim.contains(sk.relatedTarget)) return;
    dongHop();
    if (sk.relatedTarget && dangGon()) dongLopTim({ traTieuDiem: false });
  });
  document.addEventListener('pointerdown', (sk) => {
    if (o.tim.contains(sk.target)) return;
    dongHop();
    if (dangGon()) dongLopTim({ traTieuDiem: false });
  });

  // Phím tắt: gạch chéo ở bất cứ đâu trong trang, trừ khi đang gõ vào một ô
  // khác, đang mở bảng trượt hay hộp đăng nhập.
  document.addEventListener('keydown', (sk) => {
    if (sk.key !== '/' || sk.ctrlKey || sk.metaKey || sk.altKey || sk.defaultPrevented) return;
    const dich = sk.target;
    if (dich instanceof Element && dich.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    if (document.body.classList.contains('khoa-cuon') || document.querySelector('dialog[open]')) return;
    sk.preventDefault();
    moTim();
  });

  const hen = () => requestAnimationFrame(doChoTrong);
  if ('ResizeObserver' in window) {
    const quanSat = new ResizeObserver(hen);
    quanSat.observe(o.dauTrang);
    quanSat.observe(o.khu);
    quanSat.observe(o.hieu);
  } else {
    window.addEventListener('resize', hen);
  }
}

/** Câu gợi ý trong ô nói đúng số project thật của kho. */
async function napSoLieu() {
  try {
    tt.thongKe = await apiCatalog.thongKe();
  } catch {
    // Không có số liệu thì ô vẫn ghi "Tìm project" và vẫn tìm được; chỉ phần sáu
    // level khi ô trống là không có.
    return;
  }
  o.o.placeholder = `Tìm trong ${so(tt.thongKe.projects)} project`;
  if (tt.dangMo && tt.loai === 'level') veLevel();
}

export function khoiTao() {
  o.dauTrang = $('.dau-trang');
  o.tim = $('#tim');
  if (o.dauTrang === null || o.tim === null) return;
  Object.assign(o, {
    mau: $('#tim-mau'),
    o: $('#tim-o'),
    phim: $('#tim-phim'),
    xoa: $('#tim-xoa'),
    hop: $('#hop-tim'),
    bao: $('#hop-tim-bao'),
    ds: $('#hop-tim-ds'),
    dong: $('#tim-dong'),
    loa: $('#tim-loa'),
    nutMo: $('#nut-mo-tim'),
    hieu: $('.hieu'),
    dieuHuong: $('.dieu-huong'),
    cum: $('.dau-trang-cum'),
    khu: $('#khu-tai-khoan'),
  });

  // Vai trò combobox chỉ gắn khi tệp mã đã chạy. Gắn sẵn trong HTML thì lúc tệp
  // mã hỏng, trình đọc màn hình vẫn hứa một hộp gợi ý không bao giờ mở ra.
  o.o.setAttribute('role', 'combobox');
  o.o.setAttribute('aria-autocomplete', 'list');
  o.o.setAttribute('aria-expanded', 'false');
  o.o.setAttribute('aria-controls', 'hop-tim-ds');
  o.phim.hidden = false;
  o.o.setAttribute('aria-keyshortcuts', '/');

  doChoTrong();
  ganSuKien();
  napSoLieu();
}
