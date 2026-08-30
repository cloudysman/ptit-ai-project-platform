/* Phần kho project trên trang chủ: số liệu tổng quan, mục lục sáu level, và vài
   project đầu tiên của mỗi level.

   Trang chủ chỉ giới thiệu, nên mỗi level lấy đúng sáu project chứ không tải cả
   kho về. Việc lọc và tìm kiếm nằm ở trang kho project, tệp js/trang-kho.js. */

import { LoiApi, apiCatalog } from './api.js';
import {
  $,
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
import { daHoanThanh, tienDoLevel, trangThaiCua } from './tien-do.js';

// Số project hiển thị cho mỗi level ở trang chủ.
const MOI_LEVEL = 6;

// Ba màu của bảng màu, dùng để phân biệt ba chặng của lộ trình: level 0 tới 2
// màu đỏ, level 3 và 4 màu vàng đồng, level 5 màu mực.
const MAU_LEVEL = ['#A21C2B', '#A21C2B', '#A21C2B', '#E0A03A', '#E0A03A', '#16130F'];

// Cùng ba chặng đó nhưng dùng cho phần chữ. Vàng đồng làm nền thì đọc được,
// còn làm màu chữ trên nền giấy thì quá nhạt, nên chỗ nào là chữ sẽ lấy sắc
// vàng đậm hơn.
const MAU_LEVEL_CHU = ['#A21C2B', '#A21C2B', '#A21C2B', '#8F5E0C', '#8F5E0C', '#16130F'];

const mauCuaLevel = (maLevel) => MAU_LEVEL[maLevel] ?? '#16130F';
const mauChuCuaLevel = (maLevel) => MAU_LEVEL_CHU[maLevel] ?? '#16130F';

/** Hai biến màu mà mục lục và mỗi đoạn level dùng để tự tô theo chặng của mình. */
const bienMau = (maLevel) =>
  `--mau-level:${mauCuaLevel(maLevel)};--mau-level-chu:${mauChuCuaLevel(maLevel)}`;

const trangThai = {
  thongKe: null,
  // Vài project đầu của từng level, khoá là số hiệu level.
  theoLevel: new Map(),
};

/* Phần vẽ. */

function veSoLieu() {
  const { projects, skills, by_level: theoLevel, by_track: theoTrack } = trangThai.thongKe;
  const cacO = [
    [projects, 'project trong kho'],
    [theoLevel.length, 'level, từ dễ đến khó'],
    [theoTrack.length, 'track chuyên môn'],
    [skills, 'skill được rèn qua các project'],
  ];
  $('#so-lieu').innerHTML = cacO
    .map(
      ([gia, nhan]) =>
        `<div><p class="so-lieu-so" data-dem="${gia}">0</p><p class="so-lieu-chu">${chu(nhan)}</p></div>`
    )
    .join('');
  $('#tieu-de-so').textContent = `${so(projects)} project.`;
}

function veHinhLevel() {
  const danhSach = trangThai.thongKe.by_level;
  const buoc = 68;
  // Điểm nút đầu tiên nằm ở toạ độ 26, nên đường nối cũng bắt đầu từ đó chứ
  // không bắt đầu từ mép trên khung vẽ, nếu không sẽ thừa một đoạn thò lên trên
  // điểm nút đầu và thò xuống dưới điểm nút cuối.
  const dau = 26;
  const cuoi = dau + (danhSach.length - 1) * buoc;
  const dai = cuoi - dau;

  const cacNut = danhSach
    .map((mot, chiSo) => {
      const y = dau + chiSo * buoc;
      return (
        `<circle class="nut-sang" cx="40" cy="${y}" r="6" fill="${mauCuaLevel(mot.level.id)}" style="animation-delay:${chiSo * 0.4}s"></circle>` +
        `<text x="62" y="${y + 5}">${chu(mot.level.name)}</text>` +
        `<text class="hinh-so" x="228" y="${y + 5}" text-anchor="end">${mot.projects}</text>`
      );
    })
    .join('');

  $('#hinh-level').innerHTML =
    `<path d="M40 ${dau} L40 ${cuoi}" fill="none" stroke="rgba(22,19,15,.14)" stroke-width="1"></path>` +
    `<path class="duong-ve" d="M40 ${dau} L40 ${cuoi}" fill="none" stroke="#A21C2B" stroke-width="2" stroke-dasharray="${dai}" stroke-dashoffset="${dai}"></path>` +
    `<g class="hinh-chu">${cacNut}</g>`;
}

function veDaiChay() {
  const mot = trangThai.thongKe.by_track
    .map((item) => `<span>${chu(item.track.name)}</span><b>·</b>`)
    .join('');
  // Nội dung lặp hai lần để vòng chạy nối liền, không hở quãng trống.
  $('#dai-chay-trong').innerHTML = mot + mot;
}

/**
 * Mục lục sáu level ở cột trái, kèm vạch tiến độ của người đang đăng nhập.
 *
 * Vạch tính trên tổng số project của cả level, lấy từ số liệu tiến độ backend
 * gửi về. Trang chủ chỉ tải sáu project mỗi level, nên nếu đếm trên số đang
 * hiển thị thì vạch nói sai: hoàn thành ba project trong một level bốn mươi
 * project mà vạch đã chạy được nửa đường.
 */
function veMucLuc() {
  $('#muc-luc-level').innerHTML = trangThai.thongKe.by_level
    .map((mot) => {
      const cua = tienDoLevel(mot.level.id);
      const daXong = cua ? cua.completed : 0;
      const tong = cua ? cua.total : mot.projects;
      const tiLe = tong === 0 ? 0 : (daXong / tong) * 100;
      return (
        `<button type="button" class="muc-nut" data-level="${mot.level.id}" style="${bienMau(mot.level.id)}">` +
        '<span class="muc-hang">' +
        `<span class="muc-so">${mot.level.id}</span>` +
        `<span class="muc-ten">${chu(mot.level.name)}</span>` +
        `<span class="muc-dem">${mot.projects}</span>` +
        '</span>' +
        `<span class="muc-vach"><i style="width:${tiLe.toFixed(1)}%"></i></span>` +
        '</button>'
      );
    })
    .join('');
}

function veMotHang(project) {
  const trangThaiBai = trangThaiCua(project.slug);
  const xong = daHoanThanh(project.slug);

  return (
    `<button type="button" class="hang${xong ? ' da-xong' : ''}" data-slug="${chu(project.slug)}">` +
    `<span class="hang-o">${xong ? '✓' : ''}</span>` +
    `<span class="hang-ten">${chu(project.title)}` +
    (trangThaiBai && !xong ? `<i class="hang-nhan">${chu(NHAN_TRANG_THAI[trangThaiBai])}</i>` : '') +
    '</span>' +
    `<span class="hang-track">${chu(project.track.name)}</span>` +
    `<span class="hang-gio">${soGio(project.estimated_hours)}</span>` +
    '<span class="hang-mo">Xem chi tiết →</span>' +
    '</button>'
  );
}

/** Sáu đoạn nội dung, mỗi đoạn một level. */
function veCotNoiDung() {
  if (trangThai.thongKe === null) return;

  $('#cot-noi-dung').innerHTML = trangThai.thongKe.by_level
    .map((mot) => {
      const nhom = trangThai.theoLevel.get(mot.level.id) ?? [];
      const conLai =
        mot.projects > nhom.length
          ? `<p class="doan-them"><a href="/kho.html?level=${mot.level.id}">Xem tất cả ${mot.projects} project của level ${chu(mot.level.name)}<span aria-hidden="true">→</span></a></p>`
          : '';
      const than =
        nhom.length > 0
          ? `<div class="bang-hang">${nhom.map(veMotHang).join('')}</div>${conLai}`
          : '<p class="dang-tai">Level này chưa có project nào.</p>';

      return (
        `<section class="doan-level" data-level="${mot.level.id}" style="${bienMau(mot.level.id)}">` +
        '<div class="doan-dau hien-dan">' +
        `<span class="doan-so">${mot.level.id}</span>` +
        `<h3 class="doan-ten">${chu(tenLevel(mot.level))}</h3>` +
        `<span class="doan-dem">${mot.projects} project</span>` +
        '</div>' +
        `<p class="doan-mo hien-dan">${chu(mot.level.description)}</p>` +
        than +
        '</section>'
      );
    })
    .join('');
  theoDoiHienDan();
}

/* Phần tải dữ liệu. */

/**
 * Tải vài project đầu của từng level.
 *
 * Sáu lượt gọi chạy song song, mỗi lượt lấy đúng sáu bản ghi. Cách này giữ cho
 * khối lượng dữ liệu tải về không tăng theo kích thước kho: kho có 200 hay 2000
 * project thì trang chủ vẫn chỉ tải 36 bản ghi.
 */
async function napProject() {
  const cacLevel = trangThai.thongKe.by_level.map((mot) => mot.level.id);
  const ketQua = await Promise.all(
    cacLevel.map((maLevel) =>
      apiCatalog
        .trangProject({ level: maLevel, sort: 'level', page: 1, page_size: MOI_LEVEL })
        .then((trang) => trang.items)
        .catch(() => [])
    )
  );

  trangThai.theoLevel = new Map(cacLevel.map((maLevel, chiSo) => [maLevel, ketQua[chiSo]]));
  veCotNoiDung();
  veMucLuc();
}

/** Tải số liệu tổng quan rồi tải project. Gọi một lần khi mở trang. */
export async function nap() {
  try {
    trangThai.thongKe = await apiCatalog.thongKe();
  } catch (loi) {
    const cau = loi instanceof LoiApi ? loi.message : 'Không tải được số liệu của kho project.';
    $('#cot-noi-dung').innerHTML = dongTrong(cau);
    $('#tieu-de-so').textContent = 'Chưa tải được dữ liệu.';
    thongBao(cau, 'loi');
    return false;
  }

  veSoLieu();
  veHinhLevel();
  veDaiChay();
  await napProject();
  return true;
}

/** Vẽ lại phần đánh dấu sau khi tiến độ thay đổi, không phải gọi lại API. */
export function veLaiTienDo() {
  veCotNoiDung();
  veMucLuc();
}

/* Phần sự kiện. */

export function khoiTao() {
  $('#cot-noi-dung').addEventListener('click', (sk) => {
    const hang = sk.target.closest('.hang');
    if (hang) moProject(hang.dataset.slug);
  });

  $('#muc-luc-level').addEventListener('click', (sk) => {
    const nut = sk.target.closest('.muc-nut');
    if (!nut) return;
    const dich = $(`.doan-level[data-level="${nut.dataset.level}"]`);
    if (dich) window.scrollTo({ top: dich.getBoundingClientRect().top + window.scrollY - 92 });
  });

  $('#nut-ngau-nhien').addEventListener('click', async () => {
    try {
      const project = await apiCatalog.projectNgauNhien();
      moProject(project.slug);
    } catch (loi) {
      thongBao(loi instanceof LoiApi ? loi.message : 'Không chọn được project.', 'loi');
    }
  });
}
