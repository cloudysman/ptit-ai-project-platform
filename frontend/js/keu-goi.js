/* Mục kêu gọi cuối trang chủ: một điểm xuất phát cụ thể chứ không phải một câu
   khẩu hiệu đứng cạnh một cái nút.

   Cột trái là tiêu đề, tuyến sáu level thu nhỏ và nút chính của mục. Cột phải
   là một thẻ trắng ghi đúng một project. Chưa đăng nhập: ga của level xuất phát
   tô đặc, dưới ga ấy là số project của level; thẻ là project mà phần mở đầu
   giới thiệu, chọn bằng cùng một hàm với dòng chú thích dưới khung video, nên
   ba chỗ của trang chủ cùng nói về một project; nút chính mở mẫu đăng ký, nút
   của thẻ mở bảng chi tiết project. Đã đăng nhập: ga nào có project đã hoàn
   thành thì tô đặc, dưới mỗi ga là số đã xong trên tổng số của level, ga của
   project đề xuất có vòng ngoài, rồi một dòng tổng số project đã xong và điểm
   tích luỹ; thẻ là project đứng đầu danh sách đề xuất kèm câu lý do backend
   trả về, nút của thẻ mở project, còn nút chính của mục mở bảng tài khoản.

   Dữ liệu không gọi API lần nào: số liệu kho lấy từ sự kiện KHO_DA_NAP của
   js/kho.js, tiến độ và đề xuất đọc từ js/tai-khoan.js, là chính ba phản hồi mà
   bảng tài khoản đã tải. Chưa đăng nhập mà thiếu số liệu kho, hay đã đăng nhập
   mà thiếu tiến độ, thì tuyến và thẻ ẩn, mục chỉ còn tiêu đề và nút như bản
   trước. Có tiến độ mà danh sách đề xuất rỗng thì chỉ thẻ ẩn. Trong lúc chờ,
   tuyến và thẻ giữ chỗ bằng hai khối vô hình cao cỡ khối thật, để chân trang
   không nhảy khi dữ liệu về.

   Chuyển động chạy một lần khi mục cuộn vào tầm nhìn: đường tuyến vẽ từ ga 0
   sang phải, các ga tô đặc sáng lên lần lượt theo thứ tự level, thẻ nhấc lên.
   Chỉ bắt đầu theo dõi khi đã có tuyến hay thẻ để vẽ; những lần vẽ lại sau khi
   đăng nhập hay có bài được chấm không chạy lại. Bật giảm chuyển động thì mọi
   thứ hiện sẵn ở trạng thái cuối.

   Mục chỉ vẽ khi js/app.js gọi ve(): lúc mở trang sau khi cả kho lẫn tiến độ đã
   về, và sau mỗi lượt tải lại tiến độ. Sự kiện KHO_DA_NAP chỉ được giữ dữ liệu
   lại, vì lúc ấy tiến độ của người đã đăng nhập thường chưa về. */

import { phien } from './api.js';
import { chonProject } from './chu-thich-video.js';
import { $, bieuTuong, chu, giamChuyenDong, so, soDiem, soGio, tenLevel } from './giao-dien.js';
import { moProject } from './project.js';
import { SU_KIEN, nghe } from './su-kien.js';
import { deXuatCuaToi, tomTatTienDo } from './tai-khoan.js';

/** Số liệu kho và vài project đầu mỗi level, giữ lại từ sự kiện KHO_DA_NAP; null khi chưa có hoặc lỗi. */
let duLieuKho = null;

/**
 * Một ga trên tuyến. Chỉ số thứ tự đưa vào biến CSS để tệp kiểu xếp thời điểm
 * ga sáng lên đúng lúc đường tuyến vẽ tới. Nhãn dưới ga có bản đọc riêng cho
 * trình đọc màn hình khi bản nhìn là dạng rút gọn như "8/25".
 */
function veGa(level, chiSo, { daXong = false, laDich = false, nhan = '', nhanDoc = '' } = {}) {
  const lop = ['kg-ga', daXong ? 'la-xong' : '', laDich ? 'la-dich' : ''].filter(Boolean).join(' ');
  const dem = nhan
    ? nhanDoc
      ? `<span class="kg-ga-dem"><span aria-hidden="true">${chu(nhan)}</span><span class="an-khoi-mat">${chu(nhanDoc)}</span></span>`
      : `<span class="kg-ga-dem">${chu(nhan)}</span>`
    : '';
  return (
    `<li class="${lop}" style="--i:${chiSo}">` +
    `<span class="kg-ga-diem">${level.id}</span>` +
    `<span class="kg-ga-ten">${chu(level.name)}</span>` +
    dem +
    '</li>'
  );
}

function veThe({ nhan, project, lyDo = '', nutChu, nutLop }) {
  return (
    `<p class="kg-the-nhan">${chu(nhan)}</p>` +
    `<h3 class="kg-the-ten">${chu(project.title)}</h3>` +
    (lyDo ? `<p class="kg-the-ly-do">${chu(lyDo)}</p>` : '') +
    '<ul class="kg-the-so">' +
    `<li>${bieuTuong('badge-level')}<span>${chu(tenLevel(project.level))}</span></li>` +
    `<li>${bieuTuong('badge-track')}<span>${chu(project.track.name)}</span></li>` +
    `<li>${bieuTuong('gio')}<span>${chu(soGio(project.estimated_hours))}</span></li>` +
    `<li>${bieuTuong('badge-diem')}<span>${so(project.reward_points)} điểm tích luỹ</span></li>` +
    '</ul>' +
    `<button type="button" class="nut ${nutLop}" data-mo-project="${chu(project.slug)}">${nutChu}${bieuTuong('mui-ten')}</button>`
  );
}

/** Ba phần của mục khi chưa đăng nhập: tuyến, dòng số liệu (không có), thẻ. */
function noiDungChuaVao() {
  if (duLieuKho === null) return { tuyen: null, dong: null, the: null };
  const cacLevel = [...duLieuKho.thongKe.by_level].sort((a, b) => a.level.id - b.level.id);
  if (cacLevel.length === 0) return { tuyen: null, dong: null, the: null };
  const chon = chonProject(duLieuKho);
  // Level xuất phát là level của project được giới thiệu: level thấp nhất còn có
  // project. Kho không có project nào thì ga đầu tiên vẫn là nơi bắt đầu.
  const maXuatPhat = chon ? chon.level.id : cacLevel[0].level.id;
  return {
    nhanTuyen: 'Sáu level của nền tảng',
    tuyen: cacLevel
      .map((mot, chiSo) =>
        veGa(mot.level, chiSo, mot.level.id === maXuatPhat ? { daXong: true, nhan: `${so(mot.projects)} project` } : {})
      )
      .join(''),
    dong: null,
    the: chon
      ? veThe({ nhan: 'Project đầu tiên', project: chon.project, nutChu: 'Xem project', nutLop: 'nut-vien' })
      : null,
  };
}

/** Ba phần của mục khi đã đăng nhập. */
function noiDungDaVao() {
  const tomTat = tomTatTienDo();
  if (tomTat === null) return { tuyen: null, dong: null, the: null };
  const deXuat = deXuatCuaToi()[0] ?? null;
  const cacLevel = [...tomTat.by_level].sort((a, b) => a.level.id - b.level.id);
  if (cacLevel.length === 0) return { tuyen: null, dong: null, the: null };
  const tong = cacLevel.reduce((cong, mot) => cong + mot.total, 0);
  return {
    nhanTuyen: 'Tiến độ của bạn theo level',
    tuyen: cacLevel
      .map((mot, chiSo) =>
        veGa(mot.level, chiSo, {
          daXong: mot.completed > 0,
          laDich: deXuat !== null && deXuat.project.level.id === mot.level.id,
          nhan: `${so(mot.completed)}/${so(mot.total)}`,
          nhanDoc: `${so(mot.completed)} trên ${so(mot.total)} project`,
        })
      )
      .join(''),
    dong: `Đã xong ${so(tomTat.completed_projects)}/${so(tong)} project · ${soDiem(tomTat.total_points)} tích luỹ`,
    the: deXuat
      ? veThe({ nhan: 'Đề xuất cho bạn', project: deXuat.project, lyDo: deXuat.reason, nutChu: 'Mở project', nutLop: 'nut-do' })
      : null,
  };
}

/** Điền một khối giữ chỗ: có nội dung thì hiện, không thì ẩn hẳn. */
function dien(o, noiDung) {
  o.hidden = noiDung === null;
  if (noiDung === null) return;
  o.innerHTML = noiDung;
  o.classList.remove('dang-cho');
}

let dangTheoDoi = false;

/**
 * Chuyển động chạy khi mục cuộn vào tầm nhìn, một lần cho cả trang. Lớp
 * co-chuyen-dong chỉ gắn khi chuyển động thật sự chạy, nên không có JavaScript
 * hay bật giảm chuyển động thì mục ở sẵn trạng thái cuối. Lớp da-hien gắn lên
 * mục, không lên nội dung, nên vẽ lại nội dung không chạy lại chuyển động.
 */
function theoDoiHienRa(muc) {
  if (dangTheoDoi || !muc.classList.contains('co-chuyen-dong')) return;
  dangTheoDoi = true;
  // Mốc là 30% bề cao của mục lộ ra. Khung nhìn thấp hơn thế (điện thoại phóng
  // to 400%, mục cao gấp ba khung nhìn) thì không bao giờ tới mốc ấy, nên còn
  // một mốc thứ hai: mục đã choán quá nửa khung nhìn. Các ngưỡng 0,1 và 0,2 chỉ
  // để bộ quan sát gọi lại đủ dày cho mốc thứ hai được xét.
  const quan = new IntersectionObserver(
    ([mot]) => {
      const nuaKhung = (mot.rootBounds?.height ?? window.innerHeight) / 2;
      if (!mot.isIntersecting || (mot.intersectionRatio < 0.3 && mot.intersectionRect.height < nuaKhung)) return;
      quan.disconnect();
      muc.classList.add('da-hien');
    },
    { threshold: [0.1, 0.2, 0.3] }
  );
  quan.observe(muc);
}

/**
 * Vẽ cả mục theo trạng thái đăng nhập và dữ liệu đang có. js/app.js gọi sau khi
 * kho đã nạp và sau mỗi lượt tải tiến độ, để mục đổi trọn một lần chứ không đổi
 * tiêu đề trước rồi tuyến và thẻ theo sau.
 */
export function ve() {
  const muc = $('#keu-goi');
  if (muc === null) return;
  const daVao = phien.daDangNhap;

  $('#keu-goi-tieu-de').textContent = daVao ? 'Đi tiếp từ chỗ bạn đang đứng' : 'Bắt đầu từ project đầu tiên';
  // Chưa đăng nhập thì nút chính của mục là tạo tài khoản, nút của thẻ chỉ xem
  // project. Đã đăng nhập thì việc chính là mở project đề xuất, nằm trên thẻ;
  // nút mở bảng tài khoản lùi về kiểu viền.
  const nut = $('#nut-keu-goi');
  nut.textContent = daVao ? 'Mở tài khoản của tôi' : 'Tạo tài khoản';
  nut.classList.toggle('nut-do', !daVao);
  nut.classList.toggle('nut-vien', daVao);

  const { nhanTuyen, tuyen, dong, the } = daVao ? noiDungDaVao() : noiDungChuaVao();
  const oTuyen = $('#kg-tuyen');
  if (nhanTuyen) oTuyen.setAttribute('aria-label', nhanTuyen);
  dien(oTuyen, tuyen);
  const oDong = $('#kg-tien-do');
  oDong.hidden = dong === null;
  oDong.textContent = dong ?? '';
  dien($('#kg-the'), the);

  if (tuyen !== null || the !== null) theoDoiHienRa(muc);
}

/** Gắn trước khi js/app.js gọi kho.nap(), để không bỏ lỡ sự kiện số liệu. */
export function khoiTao() {
  const muc = $('#keu-goi');
  if (muc === null) return;
  if (!giamChuyenDong() && 'IntersectionObserver' in window) muc.classList.add('co-chuyen-dong');

  // Chỉ giữ dữ liệu, không vẽ: js/app.js gọi ve() sau khi cả kho lẫn tiến độ đã
  // về. Vẽ ngay ở đây thì người mở lại trang khi đã đăng nhập thấy mục thu lại
  // (tiến độ chưa có nên tuyến và thẻ ẩn) rồi bung ra khi tiến độ về sau kho.
  nghe(SU_KIEN.KHO_DA_NAP, (duLieu) => {
    duLieuKho = duLieu ?? null;
  });

  // Truyền cả thẻ làm nguồn, để tên project bay từ thẻ lên tiêu đề bảng chi tiết
  // như khi bấm một dòng project, và đóng bảng thì tiêu điểm về nút vừa bấm.
  const the = $('#kg-the');
  the.addEventListener('click', (sk) => {
    const nut = sk.target.closest('[data-mo-project]');
    if (nut) moProject(nut.dataset.moProject, the);
  });
}
