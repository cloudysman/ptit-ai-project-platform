/* Phần kho project trên trang chủ: số liệu tổng quan, mục lục sáu level, và vài
   project đầu tiên của mỗi level.

   Trang chủ chỉ giới thiệu, nên mỗi level lấy đúng sáu project chứ không tải cả
   kho về. Việc lọc và tìm kiếm nằm ở trang kho project, tệp js/trang-kho.js. */

import { LoiApi, apiCatalog, phien } from './api.js';
import {
  $,
  NHAN_TRANG_THAI,
  bieuTuong,
  chu,
  dongLoi,
  so,
  soGio,
  tenLevel,
  thongBao,
} from './giao-dien.js';
import { duongDan } from './goc.js';
import { moProject } from './project.js';
import { SU_KIEN, phat } from './su-kien.js';
import { daHoanThanh, oTrangThai, tienDoLevel, trangThaiCua } from './tien-do.js';

// Số project hiển thị cho mỗi level ở trang chủ.
const MOI_LEVEL = 6;

const trangThai = {
  thongKe: null,
  // Vài project đầu của từng level, khoá là số hiệu level.
  theoLevel: new Map(),
  // Câu báo lỗi của những level mà lượt gọi hỏng, khoá là số hiệu level. Để
  // riêng chứ không trộn vào theoLevel, vì phần khác đọc theoLevel như danh sách.
  loiLevel: new Map(),
};

/* Phần vẽ. */

/**
 * Điền số liệu vào câu dẫn của phần mở đầu.
 *
 * Con số nằm ngay trong câu văn, không tách ra thành một dải số liệu riêng: câu
 * "Kho hiện có 200 project thuộc 11 track" đọc tự nhiên hơn bốn con số to đứng
 * cạnh bốn dòng chú thích.
 */
function veSoLieu() {
  const { projects, skills, by_track: theoTrack } = trangThai.thongKe;
  const gia = { projects, tracks: theoTrack.length, skills };
  for (const o of document.querySelectorAll('[data-so]')) {
    o.textContent = so(gia[o.dataset.so] ?? 0);
  }
  $('#tieu-de-so').textContent = `${so(projects)} project`;
}

/**
 * Tuyến sáu level ở phần mở đầu.
 *
 * Mỗi level là một ga: số hiệu trong vòng tròn, tên, số project, và một thanh
 * dài theo tỷ lệ so với level đông nhất. Chỉ số thứ tự và tỷ lệ được đưa vào
 * hai biến CSS để tệp kiểu tự xếp thời điểm hiện của từng ga theo đúng lúc
 * đường tuyến vẽ tới. Bấm một ga thì cuộn tới đoạn của level đó ở phía dưới.
 */
function veHinhLevel() {
  const danhSach = trangThai.thongKe.by_level;
  const nhieuNhat = Math.max(1, ...danhSach.map((mot) => mot.projects));

  $('#hinh-level').innerHTML = danhSach
    .map((mot, chiSo) => {
      const tiLe = (mot.projects / nhieuNhat).toFixed(3);
      return (
        `<li class="ga" style="--i:${chiSo};--ti-le:${tiLe}">` +
        `<button type="button" class="ga-nut" data-level="${mot.level.id}">` +
        `<span class="ga-diem">${mot.level.id}</span>` +
        '<span class="ga-chu">' +
        `<span class="ga-ten">${chu(mot.level.name)}</span>` +
        `<span class="ga-dem">${mot.projects} project</span>` +
        '<span class="ga-vach"><i></i></span>' +
        '</span>' +
        '</button></li>'
      );
    })
    .join('');
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
        `<button type="button" class="muc-nut" data-level="${mot.level.id}">` +
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
  const o = oTrangThai(project);

  return (
    `<button type="button" class="hang${xong ? ' da-xong' : ''}${o.khoa ? ' bi-khoa' : ''}" data-slug="${chu(project.slug)}">` +
    `<span class="hang-o" role="img" aria-label="${chu(o.nhan)}" title="${chu(o.nhan)}">${bieuTuong(o.khoa ? 'khoa' : 'tich')}</span>` +
    `<span class="hang-ten"><span>${chu(project.title)}</span>` +
    (trangThaiBai && !xong
      ? `<i class="hang-nhan nhan the-${chu(trangThaiBai)}">${chu(NHAN_TRANG_THAI[trangThaiBai])}</i>`
      : '') +
    '</span>' +
    '<span class="hang-meta">' +
    `<span class="hang-track">${chu(project.track.name)}</span>` +
    `<span class="hang-gio">${soGio(project.estimated_hours)}</span>` +
    '</span>' +
    `<span class="hang-mo"><span>Xem chi tiết</span>${bieuTuong('mui-ten')}</span>` +
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
          ? `<p class="doan-them"><a href="${duongDan('kho.html')}?level=${mot.level.id}">Xem tất cả ${mot.projects} project của level ${chu(mot.level.name)}${bieuTuong('mui-ten')}</a></p>`
          : '';
      const loi = trangThai.loiLevel.get(mot.level.id);
      let than;
      if (nhom.length > 0) than = `<div class="bang-hang">${nhom.map(veMotHang).join('')}</div>${conLai}`;
      // Lượt gọi hỏng thì nói đúng là hỏng. Ghi "chưa có project nào" là nói sai
      // về kho, và người dùng không biết rằng tải lại trang là thấy lại.
      else if (loi) than = dongLoi(loi);
      else than = '<p class="dang-tai">Level này chưa có project nào.</p>';

      return (
        `<section class="doan-level" data-level="${mot.level.id}">` +
        '<div class="doan-dau">' +
        `<span class="doan-so">${mot.level.id}</span>` +
        `<h3 class="doan-ten">${chu(tenLevel(mot.level))}</h3>` +
        `<span class="doan-dem">${mot.projects} project</span>` +
        '</div>' +
        `<p class="doan-mo">${chu(mot.level.description)}</p>` +
        than +
        '</section>'
      );
    })
    .join('');
}

/* Phần tải dữ liệu. */

/**
 * Tải vài project đầu của từng level.
 *
 * Sáu lượt gọi chạy song song, mỗi lượt lấy đúng sáu bản ghi. Cách này giữ cho
 * khối lượng dữ liệu tải về không tăng theo kích thước kho: kho có 200 hay 2000
 * project thì trang chủ vẫn chỉ tải 36 bản ghi.
 *
 * Cách xếp 'level' của backend là level tăng dần rồi số giờ tăng dần, nên sáu
 * bản ghi của mỗi level là sáu project ít giờ nhất của level đó. Dòng chú thích
 * dưới khung video dựa vào đúng điều này để nói "ít giờ nhất trong level", xem
 * js/chu-thich-video.js; đổi cách xếp ở đây thì phải sửa câu chữ ở đó.
 */
async function napProject() {
  const cacLevel = trangThai.thongKe.by_level.map((mot) => mot.level.id);
  const ketQua = await Promise.all(
    cacLevel.map((maLevel) =>
      apiCatalog
        .trangProject({ level: maLevel, sort: 'level', page: 1, page_size: MOI_LEVEL })
        .then((trang) => trang.items)
        .catch((loi) => ({ loi: loi instanceof LoiApi ? loi.message : 'Không tải được project của level này.' }))
    )
  );

  // Phản hồi thiếu trường items thì coi như level trống, không phải lỗi.
  trangThai.theoLevel = new Map(
    cacLevel.map((maLevel, chiSo) => [maLevel, Array.isArray(ketQua[chiSo]) ? ketQua[chiSo] : []])
  );
  trangThai.loiLevel = new Map(
    cacLevel.flatMap((maLevel, chiSo) => (ketQua[chiSo]?.loi ? [[maLevel, ketQua[chiSo].loi]] : []))
  );
  veCotNoiDung();
  veMucLuc();
  // Báo cho phần khác dữ liệu đã có, kèm luôn dữ liệu, để không phần nào phải
  // gọi lại đúng những lượt vừa gọi.
  phat(SU_KIEN.KHO_DA_NAP, { thongKe: trangThai.thongKe, theoLevel: trangThai.theoLevel });
}

/** Tải số liệu tổng quan rồi tải project. Gọi một lần khi mở trang. */
export async function nap() {
  try {
    trangThai.thongKe = await apiCatalog.thongKe();
  } catch (loi) {
    const cau = loi instanceof LoiApi ? loi.message : 'Không tải được số liệu của kho project.';
    $('#cot-noi-dung').innerHTML = dongLoi(cau);
    // Phần mở đầu không được giữ con số viết sẵn trong HTML mà API chưa xác nhận,
    // cũng không chèn câu báo lỗi vào giữa tiêu đề: cụm số liệu trong tiêu đề ẩn
    // đi, tiêu đề còn "Sáu level. Bắt đầu từ chỗ vừa sức."; đoạn dẫn chỉ có câu số
    // liệu nên ẩn cả đoạn. Tuyến sáu ga chưa có ga nào nên ẩn hẳn, thay vì để đường
    // tuyến vẽ ra một vạch trắng trơ trọi. Câu báo lỗi đã có ở thông báo và ở đoạn kho.
    for (const o of document.querySelectorAll('[data-can-so-lieu]')) o.hidden = true;
    $('#hinh-level').hidden = true;
    thongBao(cau, 'loi');
    return false;
  }

  veSoLieu();
  veHinhLevel();
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
    if (hang) moProject(hang.dataset.slug, hang);
  });

  // Hai mục lục, một ở phần mở đầu và một ở cột trái, cùng cuộn tới đoạn level.
  const cuonToiLevel = (sk) => {
    const nut = sk.target.closest('[data-level]');
    if (!nut) return;
    $(`.doan-level[data-level="${nut.dataset.level}"]`)?.scrollIntoView({ block: 'start' });
  };
  $('#muc-luc-level').addEventListener('click', cuonToiLevel);
  $('#hinh-level').addEventListener('click', cuonToiLevel);

  // Project vừa sức: chưa đăng nhập thì hai level đầu, vì người mới không nên
  // rơi ngay vào một project 50 giờ của level 5; đã đăng nhập thì backend chọn
  // theo tiến độ (chưa xong, đã mở khoá, không cao quá một level). Lượt bấm sau
  // mà trúng lại project vừa chọn thì gọi thêm một lần.
  let slugVuaChon = null;
  $('#nut-ngau-nhien').addEventListener('click', async () => {
    const thamSo = phien.daDangNhap ? {} : { level: [0, 1] };
    try {
      let project = await apiCatalog.projectNgauNhien(thamSo);
      if (project.slug === slugVuaChon) project = await apiCatalog.projectNgauNhien(thamSo);
      slugVuaChon = project.slug;
      moProject(project.slug);
    } catch (loi) {
      thongBao(loi instanceof LoiApi ? loi.message : 'Không chọn được project.', 'loi');
    }
  });
}
