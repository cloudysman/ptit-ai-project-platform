/* Trang kho project: bộ lọc đầy đủ và phân trang thật.

   Khác với trang chủ, trang này không tải cả kho về rồi cắt. Mỗi lần đổi bộ lọc
   là một lượt gọi API với đúng tham số lọc, phân trang và sắp xếp, nên số bản
   ghi tải về không tăng theo kích thước kho. */

import { LoiApi, goi } from './api.js';
import {
  $,
  $$,
  NHAN_TRANG_THAI,
  chu,
  dongTrong,
  so,
  soGio,
  tenLevel,
  theoDoiHienDan,
  thongBao,
} from './giao-dien.js';
import { moProject } from './project.js';
import { daHoanThanh, trangThaiCua } from './tien-do.js';

const MOI_TRANG = 20;

// Các giá trị mà bộ lọc chấp nhận. Địa chỉ trang là thứ ai cũng sửa được nên
// mọi tham số đọc lên từ đó đều phải qua vòng kiểm tra này, nếu không một địa
// chỉ gõ sai sẽ đẩy thẳng giá trị lạ xuống máy chủ rồi nhận về câu báo lỗi kỹ
// thuật, thứ người dùng không hiểu và cũng không sửa được.
const SAP_XEP_HOP_LE = ['level', '-level', 'hours', '-hours', 'points', '-points', 'title'];
const TIM_TOI_DA = 100;
const GIO_NHO_NHAT = 1;
const GIO_LON_NHAT = 1000;
const TRANG_LON_NHAT = 1000;

/** Giữ lại một số nguyên trong khoảng cho phép, ngoài khoảng thì trả về chuỗi rỗng. */
function soTrongKhoang(gia, nhoNhat, lonNhat) {
  const n = Number(String(gia).trim());
  if (!Number.isInteger(n) || n < nhoNhat || n > lonNhat) return '';
  return String(n);
}

const trangThai = {
  thongKe: null,
  levels: [],
  tracks: [],
  tim: '',
  sapXep: 'level',
  gioMin: '',
  gioMax: '',
  trang: 1,
  tong: 0,
  soTrang: 0,
};

/* Đọc bộ lọc từ địa chỉ trang, để một đường dẫn có thể chia sẻ được. */

function docTuDiaChi() {
  const tham = new URLSearchParams(window.location.search);
  trangThai.levels = tham
    .getAll('level')
    .map((mot) => Number(soTrongKhoang(mot, 0, 99)))
    .filter((n) => Number.isInteger(n));
  trangThai.tracks = tham.getAll('track');
  trangThai.tim = (tham.get('q') ?? '').slice(0, TIM_TOI_DA);
  const sapXep = tham.get('sort') ?? 'level';
  trangThai.sapXep = SAP_XEP_HOP_LE.includes(sapXep) ? sapXep : 'level';
  trangThai.gioMin = soTrongKhoang(tham.get('min_hours') ?? '', GIO_NHO_NHAT, GIO_LON_NHAT);
  trangThai.gioMax = soTrongKhoang(tham.get('max_hours') ?? '', GIO_NHO_NHAT, GIO_LON_NHAT);
  trangThai.trang = Number(soTrongKhoang(tham.get('page') ?? 1, 1, TRANG_LON_NHAT) || 1);
}

/**
 * Bỏ những level và track có trong địa chỉ trang nhưng không có thật trong kho.
 *
 * Chỉ gọi được sau khi số liệu tổng quan đã tải xong, vì danh sách level và
 * track thật nằm trong đó.
 */
function locBoDieuKienLa() {
  const levelThat = trangThai.thongKe.by_level.map((mot) => mot.level.id);
  const trackThat = trangThai.thongKe.by_track.map((mot) => mot.track.slug);
  const soDieuKien = trangThai.levels.length + trangThai.tracks.length;

  trangThai.levels = trangThai.levels.filter((mot) => levelThat.includes(mot));
  trangThai.tracks = trangThai.tracks.filter((mot) => trackThat.includes(mot));

  return soDieuKien - trangThai.levels.length - trangThai.tracks.length;
}

function ghiVaoDiaChi(dayVaoLichSu = false) {
  const tham = new URLSearchParams();
  trangThai.levels.forEach((mot) => tham.append('level', mot));
  trangThai.tracks.forEach((mot) => tham.append('track', mot));
  if (trangThai.tim.trim()) tham.set('q', trangThai.tim.trim());
  if (trangThai.sapXep !== 'level') tham.set('sort', trangThai.sapXep);
  if (trangThai.gioMin) tham.set('min_hours', trangThai.gioMin);
  if (trangThai.gioMax) tham.set('max_hours', trangThai.gioMax);
  if (trangThai.trang > 1) tham.set('page', trangThai.trang);

  const chuoi = tham.toString();
  const dia = chuoi ? `?${chuoi}` : window.location.pathname;
  // Mỗi lần người dùng đổi bộ lọc là thêm một mốc vào lịch sử trình duyệt, nhờ
  // đó nút quay lại hoàn tác đúng một bước lọc thay vì nhảy ra khỏi trang kho.
  if (dayVaoLichSu && dia !== window.location.search + window.location.hash) {
    window.history.pushState(null, '', dia);
  } else {
    window.history.replaceState(null, '', dia);
  }
}

/* Phần vẽ bộ lọc. */

function veTheLoc(oId, danhSach, dangChon) {
  $(oId).innerHTML = danhSach
    .map((mot) => {
      const chon = dangChon.includes(mot.gt);
      return (
        `<button type="button" class="${chon ? 'dang-chon' : ''}" data-gt="${chu(mot.gt)}"` +
        ` aria-pressed="${chon}">${chu(mot.ten)}` +
        (mot.dem === undefined ? '' : ` <i>${mot.dem}</i>`) +
        '</button>'
      );
    })
    .join('');
}

function veBoLoc() {
  veTheLoc(
    '#loc-level',
    trangThai.thongKe.by_level.map((mot) => ({
      gt: String(mot.level.id),
      ten: tenLevel(mot.level),
      dem: mot.projects,
    })),
    trangThai.levels.map(String)
  );
  veTheLoc(
    '#loc-track',
    trangThai.thongKe.by_track.map((mot) => ({
      gt: mot.track.slug,
      ten: mot.track.name,
      dem: mot.projects,
    })),
    trangThai.tracks
  );
  $('#o-tim').value = trangThai.tim;
  $('#o-sap-xep').value = trangThai.sapXep;
  $('#o-gio-min').value = trangThai.gioMin;
  $('#o-gio-max').value = trangThai.gioMax;
}

/* Phần vẽ danh sách. */

function veMotHang(project) {
  const trangThaiBai = trangThaiCua(project.slug);
  const xong = daHoanThanh(project.slug);

  return (
    `<button type="button" class="hang${xong ? ' da-xong' : ''}" data-slug="${chu(project.slug)}"` +
    ` style="--mau-level:${mauCuaLevel(project.level.id)};--mau-level-chu:${mauChuCuaLevel(project.level.id)}">` +
    `<span class="hang-o">${xong ? '✓' : ''}</span>` +
    `<span class="hang-ten">${chu(project.title)}` +
    (trangThaiBai && !xong ? `<i class="hang-nhan">${chu(NHAN_TRANG_THAI[trangThaiBai])}</i>` : '') +
    '</span>' +
    `<span class="hang-level">${chu(project.level.name)}</span>` +
    `<span class="hang-track">${chu(project.track.name)}</span>` +
    `<span class="hang-gio">${soGio(project.estimated_hours)}</span>` +
    '<span class="hang-mo">Xem chi tiết →</span>' +
    '</button>'
  );
}

// Ba chặng của lộ trình, giống hệt cách trang chủ tô màu.
const MAU_LEVEL = ['#A21C2B', '#A21C2B', '#A21C2B', '#E0A03A', '#E0A03A', '#16130F'];
const MAU_LEVEL_CHU = ['#A21C2B', '#A21C2B', '#A21C2B', '#8F5E0C', '#8F5E0C', '#16130F'];
const mauCuaLevel = (maLevel) => MAU_LEVEL[maLevel] ?? '#16130F';
const mauChuCuaLevel = (maLevel) => MAU_LEVEL_CHU[maLevel] ?? '#16130F';

function veKetQua(trang) {
  const dau = Math.min((trang.page - 1) * trang.page_size + 1, trang.total);
  const cuoi = Math.min(trang.page * trang.page_size, trang.total);
  $('#kho-ket-qua').textContent =
    trang.total === 0
      ? 'Không có project nào khớp với bộ lọc.'
      : `Đang xem project ${dau} tới ${cuoi} trong ${so(trang.total)} project khớp bộ lọc.`;

  $('#danh-sach').innerHTML =
    trang.items.length > 0
      ? trang.items.map(veMotHang).join('')
      : dongTrong('Bỏ bớt một vài điều kiện lọc rồi thử lại.');
  theoDoiHienDan();
}

function vePhanTrang() {
  const o = $('#phan-trang');
  if (trangThai.soTrang <= 1) {
    o.innerHTML = '';
    return;
  }

  // Chỉ hiện vài trang quanh trang hiện tại, kèm trang đầu và trang cuối.
  const gan = new Set([1, trangThai.soTrang, trangThai.trang]);
  for (let buoc = 1; buoc <= 2; buoc += 1) {
    gan.add(trangThai.trang - buoc);
    gan.add(trangThai.trang + buoc);
  }
  const cacTrang = [...gan].filter((n) => n >= 1 && n <= trangThai.soTrang).sort((a, b) => a - b);

  let html = `<button type="button" class="trang-nut" data-trang="${trangThai.trang - 1}"${trangThai.trang === 1 ? ' disabled' : ''}>← Trang trước</button>`;
  let truoc = 0;
  for (const n of cacTrang) {
    if (truoc && n - truoc > 1) html += '<span class="trang-cach">…</span>';
    html +=
      `<button type="button" class="trang-nut${n === trangThai.trang ? ' dang-chon' : ''}" data-trang="${n}"` +
      `${n === trangThai.trang ? ' aria-current="page"' : ''}>${n}</button>`;
    truoc = n;
  }
  html += `<button type="button" class="trang-nut" data-trang="${trangThai.trang + 1}"${trangThai.trang === trangThai.soTrang ? ' disabled' : ''}>Trang sau →</button>`;
  o.innerHTML = html;
}

/* Phần tải dữ liệu. */

let luotTaiGanNhat = 0;

/** Câu nhắc khi hai ô giờ nghịch nhau, hiện ngay tại trang thay vì gọi máy chủ. */
function loiKhoangGio() {
  const min = Number(trangThai.gioMin);
  const max = Number(trangThai.gioMax);
  if (!trangThai.gioMin || !trangThai.gioMax || min <= max) return '';
  return `Khoảng thời gian đang ngược: từ ${min} giờ tới ${max} giờ. Đổi lại hai ô cho đúng thứ tự rồi xem tiếp.`;
}

async function napDanhSach({ dayVaoLichSu = false } = {}) {
  const luot = ++luotTaiGanNhat;
  ghiVaoDiaChi(dayVaoLichSu);

  const loiGio = loiKhoangGio();
  if (loiGio) {
    $('#kho-ket-qua').textContent = '';
    $('#danh-sach').innerHTML = dongTrong(loiGio);
    $('#phan-trang').innerHTML = '';
    return;
  }

  const thamSo = {
    level: trangThai.levels,
    track: trangThai.tracks,
    q: trangThai.tim.trim() || undefined,
    sort: trangThai.sapXep,
    min_hours: trangThai.gioMin || undefined,
    max_hours: trangThai.gioMax || undefined,
    page: trangThai.trang,
    page_size: MOI_TRANG,
  };

  let trang;
  try {
    trang = await goi('/projects', { thamSo });
  } catch (loi) {
    if (luot !== luotTaiGanNhat) return;
    $('#danh-sach').innerHTML = dongTrong(
      loi instanceof LoiApi ? loi.message : 'Không tải được danh sách project.'
    );
    $('#kho-ket-qua').textContent = '';
    $('#phan-trang').innerHTML = '';
    return;
  }

  if (luot !== luotTaiGanNhat) return;

  // Địa chỉ trang có thể ghi số trang lớn hơn số trang thật, chẳng hạn khi
  // người dùng vừa siết bộ lọc. Khi đó lùi về trang cuối và tải lại, thay vì
  // hiện một danh sách trống mà không nói vì sao.
  if (trang.pages >= 1 && trangThai.trang > trang.pages) {
    trangThai.trang = trang.pages;
    await napDanhSach();
    return;
  }

  trangThai.tong = trang.total;
  trangThai.soTrang = trang.pages;
  veKetQua(trang);
  vePhanTrang();
}

/** Tải số liệu tổng quan rồi dựng bộ lọc và danh sách. */
export async function nap() {
  docTuDiaChi();
  try {
    trangThai.thongKe = await goi('/stats');
  } catch (loi) {
    $('#danh-sach').innerHTML = dongTrong(
      loi instanceof LoiApi ? loi.message : 'Không tải được số liệu của kho project.'
    );
    return;
  }

  const soLa = locBoDieuKienLa();
  if (soLa > 0) {
    thongBao(
      soLa === 1
        ? 'Địa chỉ trang có một điều kiện lọc không có trong kho, đã bỏ qua.'
        : `Địa chỉ trang có ${soLa} điều kiện lọc không có trong kho, đã bỏ qua.`
    );
  }

  const soLevel = trangThai.thongKe.by_level.length;
  $('#kho-ghi-chu').textContent =
    `Toàn bộ ${so(trangThai.thongKe.projects)} project của kho, chia theo ${soLevel} level ` +
    `và ${trangThai.thongKe.by_track.length} track. Chọn nhiều điều kiện cùng lúc cũng được.`;
  veBoLoc();
  await napDanhSach();
}

/** Vẽ lại danh sách sau khi tiến độ đổi, không phải gọi lại API. */
export function veLaiTienDo() {
  $$('#danh-sach .hang').forEach((hang) => {
    const xong = daHoanThanh(hang.dataset.slug);
    hang.classList.toggle('da-xong', xong);
    hang.querySelector('.hang-o').textContent = xong ? '✓' : '';
  });
}

/* Phần sự kiện. */

let hetGioGoNhap = null;

function doiLoc(danhSach, gt) {
  const chiSo = danhSach.indexOf(gt);
  if (chiSo >= 0) danhSach.splice(chiSo, 1);
  else danhSach.push(gt);
  trangThai.trang = 1;
  veBoLoc();
  napDanhSach({ dayVaoLichSu: true });
}

export function khoiTao() {
  $('#loc-level').addEventListener('click', (sk) => {
    const nut = sk.target.closest('[data-gt]');
    if (nut) doiLoc(trangThai.levels, Number(nut.dataset.gt));
  });

  $('#loc-track').addEventListener('click', (sk) => {
    const nut = sk.target.closest('[data-gt]');
    if (nut) doiLoc(trangThai.tracks, nut.dataset.gt);
  });

  $('#o-tim').addEventListener('input', (sk) => {
    // Ô tìm nhận tối đa một trăm ký tự. Chuỗi dài hơn thường là do dán nhầm cả
    // một đoạn văn bản, và máy chủ sẽ từ chối, nên cắt ngay tại đây.
    if (sk.target.value.length > TIM_TOI_DA) sk.target.value = sk.target.value.slice(0, TIM_TOI_DA);
    trangThai.tim = sk.target.value;
    trangThai.trang = 1;
    clearTimeout(hetGioGoNhap);
    hetGioGoNhap = setTimeout(() => napDanhSach({ dayVaoLichSu: true }), 300);
  });

  $('#o-sap-xep').addEventListener('change', (sk) => {
    trangThai.sapXep = SAP_XEP_HOP_LE.includes(sk.target.value) ? sk.target.value : 'level';
    trangThai.trang = 1;
    napDanhSach({ dayVaoLichSu: true });
  });

  for (const [oId, ten] of [
    ['#o-gio-min', 'gioMin'],
    ['#o-gio-max', 'gioMax'],
  ]) {
    $(oId).addEventListener('change', (sk) => {
      // Ô nhập kiểu số vẫn cho gõ số không, số âm hay số rất lớn. Giá trị ngoài
      // khoảng được kéo về mép gần nhất và ô hiện lại con số đã chỉnh, để người
      // dùng thấy ngay điều gì vừa xảy ra.
      const goVao = sk.target.value.trim();
      let gia = soTrongKhoang(goVao, GIO_NHO_NHAT, GIO_LON_NHAT);
      if (goVao !== '' && gia === '') {
        const n = Math.round(Number(goVao));
        gia = String(
          Number.isFinite(n) ? Math.min(Math.max(n, GIO_NHO_NHAT), GIO_LON_NHAT) : GIO_NHO_NHAT
        );
        sk.target.value = gia;
        thongBao(`Số giờ nhận từ ${GIO_NHO_NHAT} đến ${GIO_LON_NHAT}, đã chỉnh lại thành ${gia}.`);
      }
      trangThai[ten] = gia;
      trangThai.trang = 1;
      napDanhSach({ dayVaoLichSu: true });
    });
  }

  $('#nut-xoa-loc').addEventListener('click', () => {
    Object.assign(trangThai, {
      levels: [],
      tracks: [],
      tim: '',
      sapXep: 'level',
      gioMin: '',
      gioMax: '',
      trang: 1,
    });
    veBoLoc();
    napDanhSach({ dayVaoLichSu: true });
  });

  $('#bo-loc').addEventListener('submit', (sk) => sk.preventDefault());

  // Nút quay lại và nút đi tiếp của trình duyệt: đọc lại bộ lọc từ địa chỉ mới
  // rồi tải danh sách, không ghi thêm mốc lịch sử nào nữa.
  window.addEventListener('popstate', () => {
    docTuDiaChi();
    if (trangThai.thongKe !== null) locBoDieuKienLa();
    veBoLoc();
    napDanhSach();
  });

  $('#danh-sach').addEventListener('click', (sk) => {
    const hang = sk.target.closest('.hang');
    if (hang) moProject(hang.dataset.slug);
  });

  $('#phan-trang').addEventListener('click', (sk) => {
    const nut = sk.target.closest('[data-trang]');
    if (!nut || nut.disabled) return;
    trangThai.trang = Number(nut.dataset.trang);
    napDanhSach({ dayVaoLichSu: true });
    window.scrollTo({ top: 0 });
  });
}
