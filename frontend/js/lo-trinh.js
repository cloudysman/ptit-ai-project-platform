/* Lộ trình nghề nghiệp, vẽ thành hành trình leo level.

   Level của các bước trong một lộ trình không tăng đều: AI Engineer lên level 2
   rồi quay về level 1 trước khi lên level 3. Danh sách chữ giấu mất điều ấy, nên
   mỗi lộ trình được vẽ thành một hình leo: trục ngang là thứ tự bước, trục dọc là
   level, chỗ quay xuống và level cao nhất nhìn ra ngay. Mỗi lần chỉ vẽ một lộ
   trình, chọn bằng tab; mỗi tab mang đường leo thu nhỏ của chính lộ trình đó, để so
   dáng các lộ trình trước khi chọn.

   Các lộ trình dùng chung nhiều project. Số project chung chỉ tính được khi đã có
   chi tiết của mọi lộ trình, nên chi tiết được tải trong một lượt khi mục sắp cuộn
   tới, rồi giữ lại; đổi tab không gọi API nữa.

   Mỗi ga là một nút trong một danh sách có thứ tự, nên trình đọc màn hình đọc được
   trình tự mà không cần hình. Ga đang chọn là điểm dừng Tab duy nhất của danh sách,
   phím mũi tên đi sang ga kề. Thẻ cạnh hình nói về ga đang chọn và có nút mở bảng
   chi tiết project.

   Bề ngang điện thoại không đủ chỗ cho mười mấy ga nằm ngang mà ga nào cũng chạm
   trúng được, nên ở đó hình dựng đứng: mỗi bước một hàng cao ít nhất 44 điểm ảnh,
   chấm của ga dịch sang phải theo level, tên project nằm cạnh, và thẻ chi tiết mở
   ngay dưới hàng đang chọn thay vì ở cuối danh sách. */

import { LoiApi, apiCatalog, phien } from './api.js';
import {
  $,
  $$,
  NHAN_TRANG_THAI,
  bieuTuong,
  chu,
  dongLoi,
  dongTrong,
  giamChuyenDong,
  khiSapToi,
  so,
  soGio,
  tenLevel,
} from './giao-dien.js';
import { moProject } from './project.js';
import { trangThaiCua } from './tien-do.js';

// Hệ toạ độ của hình leo. SVG giãn theo khung với preserveAspectRatio="none" còn
// nét vẽ giữ bề dày nhờ vector-effect, nên toạ độ chỉ cần đúng tỷ lệ.
const RONG_HINH = 1000;
const CAO_HINH = 600;
// Khung của đường leo thu nhỏ trong tab.
const RONG_TAB = 96;
const CAO_TAB = 18;
// Bằng thời lượng chuyển động của thuộc tính d trong css/style.css, để ga và
// đường tới chỗ mới cùng lúc.
const THOI_GIAN_DOI = 500;
// Cùng ngưỡng với @media (max-width: 640px) của mục này trong css/style.css.
const dienThoai = window.matchMedia('(max-width: 640px)');
const coRiChuot = window.matchMedia('(hover: hover)');
// Ga cách đỉnh vùng vẽ dưới chừng này phần trăm chiều cao thì phía trên chấm không đủ
// chỗ cho nhãn rê chuột, nhãn đứng dưới chấm; với sáu level đó là ga ở level cao nhất.
const NHAN_XUONG_DUOI = 15;

// Các phần tử của mục, lấy một lần sau mỗi lần dựng khung.
const o = {};

const tt = {
  danhSach: [],
  chiTiet: new Map(),
  cacLevel: new Map(),
  levelCao: 1,
  // Slug project ánh xạ sang những lộ trình có project đó.
  thuoc: new Map(),
  // Lộ trình mà chi tiết không tải được, kèm câu lỗi để hiện khi chọn tab ấy.
  loi: new Map(),
  // Chi tiết đã về, dù đủ hay thiếu: từ đây mỗi lần đổi tab là một lần vẽ.
  daNap: false,
  dangXem: null,
  // Ga đang chọn của từng lộ trình, để quay lại tab cũ vẫn thấy đúng ga vừa xem.
  chon: new Map(),
  // Lộ trình mà người dùng đã tự chọn ga. Lộ trình còn lại thì ga mặc định đi theo
  // tiến độ: đăng nhập xong, thẻ chuyển sang bước đầu tiên chưa hoàn thành.
  chonTay: new Set(),
  // Toạ độ các ga lần vẽ trước, theo tỷ lệ 0 tới 1, để ga trượt từ chỗ cũ sang chỗ mới.
  gaCu: null,
};

const loTrinhDangXem = () => tt.danhSach.find((mot) => mot.slug === tt.dangXem);
const cacBuocCua = (slug) => tt.chiTiet.get(slug)?.steps ?? [];

/** Toạ độ tỷ lệ của từng ga: bước đầu ở mép trái, bước cuối ở mép phải, level 0 ở đáy. */
function toaDo(cacBuoc) {
  const n = cacBuoc.length;
  return cacBuoc.map((buoc, i) => ({
    x: n > 1 ? i / (n - 1) : 0.5,
    y: 1 - buoc.project.level.id / tt.levelCao,
  }));
}

/**
 * Đường bậc thang qua các ga: đi ngang tới giữa hai ga, lên hoặc xuống, rồi đi
 * ngang tới ga sau. Level là bậc rời, nên đường không bao giờ đi xiên qua một mức
 * không có thật.
 *
 * Đường luôn được đệm cho đủ soDiem điểm bằng cách lặp lại ga cuối. Trình duyệt chỉ
 * nội suy được thuộc tính d giữa hai đường có cùng số lệnh vẽ; nhờ phần đệm, đổi
 * sang một lộ trình dài ngắn khác thì đường uốn sang dáng mới thay vì nhảy.
 */
function duongBac(cacDiem, soDiem, rong, cao) {
  const viet = ({ x, y }) => `${(x * rong).toFixed(2)} ${(y * cao).toFixed(2)}`;
  const du = Array.from({ length: soDiem }, (_, i) => cacDiem[Math.min(i, cacDiem.length - 1)]);
  let d = `M${viet(du[0])}`;
  for (let i = 1; i < du.length; i += 1) {
    const giua = (du[i - 1].x + du[i].x) / 2;
    d += ` L${viet({ x: giua, y: du[i - 1].y })} L${viet({ x: giua, y: du[i].y })} L${viet(du[i])}`;
  }
  return d;
}

/** Số ga liền nhau, tính từ ga đầu, mà người đang đăng nhập đã hoàn thành. */
function soGaXongLienTiep(cacBuoc) {
  let n = 0;
  while (n < cacBuoc.length && trangThaiCua(cacBuoc[n].project.slug) === 'accepted') n += 1;
  return n;
}

/** Ga chọn sẵn: bước đầu tiên chưa hoàn thành, hoặc bước cuối khi đã xong hết. */
function gaMacDinh(cacBuoc) {
  const chiSo = cacBuoc.findIndex((buoc) => trangThaiCua(buoc.project.slug) !== 'accepted');
  return chiSo < 0 ? cacBuoc.length - 1 : chiSo;
}

/* Vẽ. */

function veTab(loTrinh) {
  const chon = loTrinh.slug === tt.dangXem;
  return (
    `<button type="button" role="tab" id="leo-tab-${chu(loTrinh.slug)}" aria-controls="leo-bang" ` +
    `aria-selected="${chon}" tabindex="${chon ? 0 : -1}" data-slug="${chu(loTrinh.slug)}">` +
    `<span>${chu(loTrinh.name)}</span>` +
    `<svg class="leo-tab-hinh" viewBox="0 0 ${RONG_TAB} ${CAO_TAB}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path/></svg>` +
    '</button>'
  );
}

/**
 * Dải số liệu, mọi con số cộng hoặc đếm từ chính các bước API trả về. Hai tổng mang
 * chữ "Tổng" vì đứng cạnh "Đã xong N/M": người đang đăng nhập không đọc nhầm điểm
 * của cả lộ trình thành điểm mình đang có. Số project chung chỉ đếm được khi chi
 * tiết của mọi lộ trình đã về; thiếu một lộ trình thì bỏ mục ấy.
 */
function veSoLieu(cacBuoc) {
  const cacProject = cacBuoc.map((buoc) => buoc.project);
  const cong = (truong) => cacProject.reduce((tong, project) => tong + project[truong], 0);
  const levelCao = cacProject.reduce((cao, project) => (project.level.id > cao.level.id ? project : cao)).level;
  const cacMuc = [
    ['Project', so(cacProject.length)],
    ['Tổng giờ dự kiến', so(cong('estimated_hours'))],
    ['Tổng điểm tích luỹ', so(cong('reward_points'))],
    ['Level cao nhất', `${levelCao.id} · ${levelCao.name}`],
    ['Track', so(new Set(cacProject.map((project) => project.track.id)).size)],
  ];
  if (tt.chiTiet.size === tt.danhSach.length) {
    const soChung = cacProject.filter((project) => tt.thuoc.get(project.slug).length > 1).length;
    cacMuc.push(['Chung với lộ trình khác', `${so(soChung)} project`]);
  }
  if (phien.daDangNhap) {
    const soXong = cacProject.filter((project) => trangThaiCua(project.slug) === 'accepted').length;
    cacMuc.unshift(['Đã xong', `${so(soXong)}/${so(cacProject.length)}`]);
  }
  return cacMuc.map(([nhan, gia]) => `<div><dt>${chu(nhan)}</dt><dd>${chu(gia)}</dd></div>`).join('');
}

/** Trục level: một hàng cho mỗi level, cao nhất ở trên. Chỉ để nhìn, tên level đã có trong tên từng ga. */
function veTruc() {
  return Array.from({ length: tt.levelCao + 1 }, (_, i) => tt.levelCao - i)
    .map(
      (id) =>
        `<li class="leo-muc" data-level="${id}" style="--y:${(100 * (1 - id / tt.levelCao)).toFixed(3)}">` +
        `<span class="leo-muc-so">${id}</span>` +
        `<span class="leo-muc-ten">${chu(tt.cacLevel.get(id)?.name ?? '')}</span>` +
        '</li>'
    )
    .join('');
}

/**
 * Một ga. Tên cho trình đọc màn hình gồm tên project, level và trạng thái bài nộp;
 * vị trí trong danh sách có thứ tự đã nói đây là bước thứ mấy.
 *
 * Các biến CSS mang cả hai cách vẽ: --x, --y đặt ga trên hình nằm ngang; --lv, --tu
 * và --qua là cột level của ga, cột bắt đầu và bề ngang đoạn rẽ từ ga trước, dùng
 * cho hình dựng đứng trên điện thoại.
 */
function veGa(cacBuoc, chiSo, diem, soXong) {
  const project = cacBuoc[chiSo].project;
  const trangThai = trangThaiCua(project.slug);
  const levelTruoc = chiSo > 0 ? cacBuoc[chiSo - 1].project.level.id : project.level.id;
  const lop = ['leo-ga-muc'];
  if (trangThai === 'accepted') lop.push('la-xong');
  else if (trangThai === 'pending') lop.push('la-cho');
  else if (trangThai) lop.push('la-tra');
  // Đoạn nối vào ga và đoạn nối ra khỏi ga được tô riêng, vì ga đã xong cuối cùng
  // chỉ có đoạn vào nằm trong phần đường đã đi.
  if (chiSo > 0 && chiSo < soXong) lop.push('vao-xong');
  if (chiSo < soXong - 1) lop.push('ra-xong');
  const bien =
    `--x:${(diem.x * 100).toFixed(3)};--y:${(diem.y * 100).toFixed(3)};--lv:${project.level.id};` +
    `--tu:${Math.min(levelTruoc, project.level.id)};--qua:${Math.abs(levelTruoc - project.level.id)}`;
  return (
    `<li class="${lop.join(' ')}" style="${bien}">` +
    `<button type="button" class="leo-nut" tabindex="-1" data-chi-so="${chiSo}">` +
    `<span class="leo-diem" aria-hidden="true">${trangThai === 'accepted' ? bieuTuong('tich') : ''}</span>` +
    `<span class="leo-nut-chu"><span class="leo-ten">${chu(project.title)}</span>` +
    `<span class="an-khoi-mat">, ${chu(tenLevel(project.level))}${trangThai ? `, ${chu(NHAN_TRANG_THAI[trangThai])}` : ''}</span></span>` +
    '</button>' +
    '</li>'
  );
}

function veDauThe(cacBuoc, chiSo) {
  const trangThai = trangThaiCua(cacBuoc[chiSo].project.slug);
  return (
    `<span id="leo-the-buoc">Bước ${chiSo + 1}/${cacBuoc.length}</span>` +
    (trangThai ? `<span class="nhan the-${chu(trangThai)}">${chu(NHAN_TRANG_THAI[trangThai])}</span>` : '')
  );
}

// Những phần của thẻ mô tả thêm cho nút ga đang chọn: số bước, track, giờ, điểm và
// ghi chú. Tên project, level và trạng thái đã nằm trong tên của nút; các nút trong
// thẻ không mô tả ga.
const MO_TA_GA = 'leo-the-buoc leo-the-phu leo-the-ghi';

/** Thẻ của ga đang chọn. Tên các lộ trình khác có cùng project là nút sang đúng ga ấy bên lộ trình kia. */
function veThe(loTrinh, cacBuoc, chiSo) {
  const buoc = cacBuoc[chiSo];
  const project = buoc.project;
  const khac = tt.thuoc.get(project.slug).filter((mot) => mot.slug !== loTrinh.slug);
  return (
    `<p class="leo-the-dau">${veDauThe(cacBuoc, chiSo)}</p>` +
    `<h3 class="leo-the-ten leo-ten">${chu(project.title)}</h3>` +
    `<p class="leo-the-level">${chu(tenLevel(project.level))}</p>` +
    `<p class="leo-the-phu" id="leo-the-phu">${chu(project.track.name)} · ${chu(soGio(project.estimated_hours))} · ${so(project.reward_points)} điểm tích luỹ</p>` +
    (buoc.note ? `<p class="leo-the-ghi" id="leo-the-ghi">${chu(buoc.note)}</p>` : '') +
    (khac.length > 0
      ? '<p class="leo-the-chung" id="leo-the-chung">Cũng có trong lộ trình</p>' +
        '<div class="the-hang" role="group" aria-labelledby="leo-the-chung">' +
        khac
          .map(
            (mot) =>
              `<button type="button" class="the-lien-ket" data-sang="${chu(mot.slug)}" data-project="${chu(project.slug)}">${chu(mot.name)}</button>`
          )
          .join('') +
        '</div>'
      : '') +
    '<p class="leo-the-hanh">' +
    `<button type="button" class="nut nut-vien" data-mo-project="${chu(project.slug)}">Mở project${bieuTuong('mui-ten')}</button>` +
    '</p>'
  );
}

/** Dựng khung của bảng một lần, khi chi tiết đã về. Sau đó chỉ đổi nội dung, để đường còn uốn được từ dáng cũ. */
function dungBang() {
  o.bang.innerHTML =
    '<p class="leo-mo"></p>' +
    '<dl class="leo-so"></dl>' +
    '<div class="leo-than">' +
    // Số cột của làn level ở hình dựng đứng, cho css/style.css.
    `<div class="leo-hinh" style="--so-level:${tt.levelCao + 1}">` +
    `<ol class="leo-truc" aria-hidden="true">${veTruc()}</ol>` +
    '<div class="leo-do">' +
    `<svg class="leo-ve" viewBox="0 0 ${RONG_HINH} ${CAO_HINH}" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    '<defs><linearGradient id="leo-day" x1="0" y1="1" x2="1" y2="0">' +
    '<stop offset="0" class="leo-day-dau"/><stop offset="1" class="leo-day-cuoi"/>' +
    '</linearGradient></defs>' +
    '<path class="leo-vung"/><path class="leo-duong"/><path class="leo-duong-xong"/>' +
    '</svg>' +
    '<span class="leo-chu-thap" aria-hidden="true"><span></span></span>' +
    '<ol class="leo-ga"></ol>' +
    '<span class="leo-goi-y an" aria-hidden="true"></span>' +
    '</div>' +
    '</div>' +
    '<div class="leo-the" id="leo-the"></div>' +
    '</div>';
  Object.assign(o, {
    mo: $('.leo-mo', o.bang),
    so: $('.leo-so', o.bang),
    than: $('.leo-than', o.bang),
    hinh: $('.leo-hinh', o.bang),
    truc: $('.leo-truc', o.bang),
    vung: $('.leo-vung', o.bang),
    duong: $('.leo-duong', o.bang),
    duongXong: $('.leo-duong-xong', o.bang),
    chuThap: $('.leo-chu-thap', o.bang),
    ga: $('.leo-ga', o.bang),
    goiY: $('.leo-goi-y', o.bang),
    the: $('#leo-the'),
  });
  theoDoiHienRa();
  o.ga.addEventListener('pointerover', (sk) => hienGoiY(sk.target.closest('.leo-nut')));
  o.ga.addEventListener('pointerleave', () => hienGoiY(null));
}

/**
 * Nhãn tên project khi rê chuột qua một ga không phải ga đang chọn; ga đang chọn đã
 * có tên trong thẻ. Nhãn chỉ để mắt lướt, tên của nút đã có sẵn cho trình đọc màn hình.
 */
function hienGoiY(nut) {
  const muc = nut?.parentElement;
  if (!muc || !coRiChuot.matches || dienThoai.matches || muc.classList.contains('dang-chon')) {
    o.goiY.classList.add('an');
    return;
  }
  const buoc = cacBuocCua(tt.dangXem)[Number(nut.dataset.chiSo)];
  const y = muc.style.getPropertyValue('--y');
  o.goiY.textContent = buoc.project.title;
  o.goiY.style.setProperty('--x', muc.style.getPropertyValue('--x'));
  o.goiY.style.setProperty('--y', y);
  o.goiY.classList.toggle('o-duoi', Number(y) < NHAN_XUONG_DUOI);
  o.goiY.classList.remove('an');
}

/**
 * Đường vẽ một lần từ bước đầu tới bước cuối khi hình vào tầm nhìn, ga hiện lên
 * lúc đường chạy tới: chính là thứ tự đi của lộ trình. Lớp co-chuyen-dong chỉ gắn
 * khi chuyển động thật sự chạy, nên không có IntersectionObserver hay bật giảm
 * chuyển động thì hình hiện sẵn.
 */
function theoDoiHienRa() {
  if (giamChuyenDong() || !('IntersectionObserver' in window)) return;
  o.goc.classList.add('co-chuyen-dong');
  const hinh = o.hinh;
  const quan = new IntersectionObserver(
    ([muc]) => {
      if (!muc.isIntersecting) return;
      quan.disconnect();
      hinh.classList.add('da-hien');
    },
    { threshold: 0.4 }
  );
  quan.observe(hinh);
}

/** Thẻ nằm cạnh hình trên màn hình rộng, và ngay dưới hàng đang chọn trên điện thoại. */
function datChoThe() {
  const noi = dienThoai.matches ? o.ga.querySelector('.dang-chon') : o.than;
  if (noi && o.the.parentElement !== noi) noi.append(o.the);
}

/** Ga của lộ trình mới trượt từ chỗ của ga cùng thứ tự bên lộ trình cũ, cùng lúc với đường uốn. */
function truotGa(cacDiem) {
  const cu = tt.gaCu;
  tt.gaCu = cacDiem;
  if (cu === null || giamChuyenDong() || dienThoai.matches) return;
  const khung = o.ga.getBoundingClientRect();
  Array.from(o.ga.children).forEach((muc, i) => {
    const tu = cu[Math.min(i, cu.length - 1)];
    const lechX = (tu.x - cacDiem[i].x) * khung.width;
    const lechY = (tu.y - cacDiem[i].y) * khung.height;
    if (Math.abs(lechX) + Math.abs(lechY) < 0.5) return;
    muc.animate([{ translate: `${lechX}px ${lechY}px` }, { translate: '0 0' }], {
      duration: THOI_GIAN_DOI,
      easing: 'cubic-bezier(.16, 1, .3, 1)',
    });
  });
}

/**
 * Chọn một ga: đổi điểm dừng Tab, dời đường gióng xuống trục và vẽ thẻ. giuThe chỉ
 * đổi dòng trạng thái của thẻ, xem veLoTrinh.
 *
 * Trên điện thoại thẻ nằm trong hàng đang chọn, nên dời thẻ sang hàng mới kéo các
 * hàng phía dưới lên xuống đúng bằng chiều cao thẻ cũ. Chạm thì hàng vừa chạm phải
 * đứng yên dưới ngón tay: đo vị trí của nó trước rồi cuộn bù. Chọn bằng phím thì
 * ngược lại, hàng mới cùng thẻ của nó phải vào tầm nhìn, vì hàng ấy có thể đang nằm
 * khuất dưới thẻ cũ; tiêu điểm đặt trước với preventScroll để chỉ có một lượt cuộn.
 */
function chonGa(chiSo, { tieuDiem = false, giuThe = false } = {}) {
  const loTrinh = loTrinhDangXem();
  const cacBuoc = cacBuocCua(loTrinh.slug);
  tt.chon.set(loTrinh.slug, chiSo);
  const cacMuc = Array.from(o.ga.children);
  const muc = cacMuc[chiSo];
  const truoc = muc.getBoundingClientRect().top;
  cacMuc.forEach((mot, i) => {
    const la = i === chiSo;
    const nut = mot.firstElementChild;
    mot.classList.toggle('dang-chon', la);
    nut.tabIndex = la ? 0 : -1;
    if (la) {
      nut.setAttribute('aria-current', 'true');
      nut.setAttribute('aria-describedby', MO_TA_GA);
    } else {
      nut.removeAttribute('aria-current');
      nut.removeAttribute('aria-describedby');
    }
  });
  o.chuThap.style.setProperty('--x', muc.style.getPropertyValue('--x'));
  o.chuThap.style.setProperty('--y', muc.style.getPropertyValue('--y'));
  o.chuThap.firstElementChild.textContent = `Bước ${chiSo + 1}`;
  hienGoiY(null);
  if (giuThe) $('.leo-the-dau', o.the).innerHTML = veDauThe(cacBuoc, chiSo);
  else o.the.innerHTML = veThe(loTrinh, cacBuoc, chiSo);
  datChoThe();
  if (tieuDiem) {
    muc.firstElementChild.focus({ preventScroll: true });
    // Hàng còn trong khung nhìn nhưng khuất dưới đầu trang dính thì "nearest" không
    // cuộn; khi ấy canh hàng lên đầu, cách đầu trang một khoảng scroll-margin-top.
    const caoDau = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cao-dau-trang')) || 0;
    muc.scrollIntoView({ block: muc.getBoundingClientRect().top < caoDau ? 'start' : 'nearest' });
    return;
  }
  const lech = muc.getBoundingClientRect().top - truoc;
  if (lech !== 0) window.scrollBy({ top: lech, behavior: 'instant' });
}

/**
 * Vẽ lộ trình đang chọn lên khung đã dựng.
 *
 * chiTienDo là lần vẽ lại sau khi tiến độ đổi. Khi ấy ga đang chọn vẫn là ga cũ thì
 * thẻ chỉ đổi dòng trạng thái: nút "Mở project" trong thẻ có thể là chỗ bảng chi
 * tiết đang chờ trả tiêu điểm về, thay nút ấy thì tiêu điểm rơi mất khi đóng bảng.
 */
function veLoTrinh({ chiTienDo = false } = {}) {
  const loTrinh = loTrinhDangXem();
  const cacBuoc = cacBuocCua(loTrinh.slug);
  // Bảng đang là dòng lỗi hay dòng trống thì khung phải dựng lại ở lần vẽ sau.
  if (tt.loi.has(loTrinh.slug) || cacBuoc.length === 0) {
    o.bang.innerHTML = tt.loi.has(loTrinh.slug) ? dongLoi(tt.loi.get(loTrinh.slug)) : dongTrong('Lộ trình này chưa có bước nào.');
    tt.gaCu = null;
    return;
  }
  if (!o.bang.contains(o.ga ?? null)) dungBang();

  const cacDiem = toaDo(cacBuoc);
  const soDiem = Math.max(...Array.from(tt.chiTiet.values(), (chiTiet) => chiTiet.steps.length));
  const soXong = soGaXongLienTiep(cacBuoc);

  o.mo.textContent = loTrinh.description;
  o.so.innerHTML = veSoLieu(cacBuoc);

  const coGa = new Set(cacBuoc.map((buoc) => buoc.project.level.id));
  const dinh = Math.max(...coGa);
  $$('.leo-muc', o.truc).forEach((muc) => {
    const id = Number(muc.dataset.level);
    muc.classList.toggle('co-ga', coGa.has(id));
    muc.classList.toggle('la-dinh', id === dinh);
  });

  const duong = duongBac(cacDiem, soDiem, RONG_HINH, CAO_HINH);
  const x = (diem) => (diem.x * RONG_HINH).toFixed(2);
  o.duong.setAttribute('d', duong);
  o.vung.setAttribute('d', `${duong} L${x(cacDiem[cacDiem.length - 1])} ${CAO_HINH} L${x(cacDiem[0])} ${CAO_HINH} Z`);
  // Chưa có hai ga liền nhau đã xong thì chưa có đoạn đường nào đã đi: đường tiến
  // độ thu về ga đầu và ẩn đi, vẫn đủ số lệnh vẽ để lần sau còn dài ra được.
  o.duongXong.setAttribute('d', duongBac(cacDiem.slice(0, Math.max(1, soXong)), soDiem, RONG_HINH, CAO_HINH));
  o.duongXong.classList.toggle('an', soXong < 2);

  const tieuDiemTaiGa = o.ga.contains(document.activeElement);
  const chonCu = tt.chon.get(loTrinh.slug);
  // Thẻ có thể đang nằm trong danh sách ga; đưa ra ngoài trước khi vẽ lại danh sách.
  o.than.append(o.the);
  o.ga.style.setProperty('--khoang', Math.max(1, cacBuoc.length - 1));
  o.ga.setAttribute('aria-label', `Các bước của lộ trình ${loTrinh.name}`);
  o.ga.innerHTML = cacBuoc.map((_, i) => veGa(cacBuoc, i, cacDiem[i], soXong)).join('');
  if (!chiTienDo) truotGa(cacDiem);

  const chiSo = tt.chonTay.has(loTrinh.slug) && chonCu !== undefined ? chonCu : gaMacDinh(cacBuoc);
  const giuThe = chiTienDo && chiSo === chonCu && $('.leo-the-dau', o.the) !== null;
  chonGa(chiSo, { tieuDiem: tieuDiemTaiGa, giuThe });
}

/* Tab và các lượt chọn. */

function doiTab(slug, { tieuDiem = false } = {}) {
  if (slug === tt.dangXem) return;
  tt.dangXem = slug;
  $$('[role="tab"]', o.tab).forEach((tab, i) => {
    const la = tab.dataset.slug === slug;
    tab.setAttribute('aria-selected', String(la));
    tab.tabIndex = la ? 0 : -1;
    if (!la) return;
    o.tab.style.setProperty('--tab', i);
    o.bang.setAttribute('aria-labelledby', tab.id);
    if (tieuDiem) tab.focus();
  });
  if (tt.daNap) veLoTrinh();
}

/** Từ thẻ của một ga sang đúng project ấy trong lộ trình khác. */
function sangLoTrinh(slug, slugProject) {
  doiTab(slug);
  const chiSo = cacBuocCua(slug).findIndex((buoc) => buoc.project.slug === slugProject);
  if (chiSo < 0) return;
  tt.chonTay.add(slug);
  chonGa(chiSo, { tieuDiem: true });
}

/**
 * Vị trí mới sau một phím mũi tên, Home hoặc End. Tab xoay vòng như mẫu tabs của
 * WAI-ARIA APG và chỉ nghe hai phím ngang; ga nghe cả bốn phím, vì trên điện thoại
 * hình dựng đứng, và dừng ở hai đầu vì hành trình có điểm đầu, điểm cuối.
 */
function viTriMoi(phim, hienTai, soLuong, laTab) {
  if (phim === 'Home') return 0;
  if (phim === 'End') return soLuong - 1;
  const buoc = laTab
    ? { ArrowRight: 1, ArrowLeft: -1 }[phim]
    : { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[phim];
  if (buoc === undefined) return null;
  return laTab ? (hienTai + buoc + soLuong) % soLuong : Math.min(soLuong - 1, Math.max(0, hienTai + buoc));
}

/* Tải dữ liệu. */

/**
 * Chi tiết cả ba lộ trình về cùng lượt. Lộ trình nào lỗi thì tab của nó hiện dòng
 * lỗi, các lộ trình còn lại vẫn vẽ; không vì một lượt gọi hỏng mà mất cả mục.
 */
async function napChiTiet() {
  const ketQua = await Promise.allSettled(tt.danhSach.map((mot) => apiCatalog.chiTietLoTrinh(mot.slug)));
  tt.danhSach.forEach((loTrinh, i) => {
    const kq = ketQua[i];
    if (kq.status === 'rejected') {
      tt.loi.set(loTrinh.slug, kq.reason instanceof LoiApi ? kq.reason.message : 'Không tải được lộ trình.');
      return;
    }
    tt.chiTiet.set(loTrinh.slug, kq.value);
    for (const { project } of kq.value.steps) {
      tt.cacLevel.set(project.level.id, project.level);
      const cacLoTrinh = tt.thuoc.get(project.slug) ?? [];
      if (!cacLoTrinh.includes(loTrinh)) cacLoTrinh.push(loTrinh);
      tt.thuoc.set(project.slug, cacLoTrinh);
    }
  });
  tt.levelCao = Math.max(1, ...tt.cacLevel.keys());
  tt.daNap = true;
  o.bang.classList.remove('dang-cho');

  $$('[role="tab"]', o.tab).forEach((tab) => {
    const cacBuoc = cacBuocCua(tab.dataset.slug);
    if (cacBuoc.length > 0) {
      tab.querySelector('path').setAttribute('d', duongBac(toaDo(cacBuoc), cacBuoc.length, RONG_TAB, CAO_TAB));
    }
  });
  veLoTrinh();
}

export async function nap() {
  o.goc = $('#leo');
  if (o.goc === null) return;
  try {
    tt.danhSach = await apiCatalog.danhSachLoTrinh();
  } catch (loi) {
    o.goc.innerHTML = dongLoi(loi instanceof LoiApi ? loi.message : 'Không tải được lộ trình.');
    return;
  }
  if (tt.danhSach.length === 0) {
    o.goc.innerHTML = dongTrong('Chưa có lộ trình nào.');
    return;
  }

  tt.dangXem = tt.danhSach[0].slug;
  o.goc.innerHTML =
    '<div class="leo-dau">' +
    `<div class="leo-tab" role="tablist" aria-labelledby="lo-trinh-nghe-ten" style="--so-tab:${tt.danhSach.length}">` +
    tt.danhSach.map(veTab).join('') +
    '</div>' +
    '</div>' +
    `<div class="leo-bang dang-cho" id="leo-bang" role="tabpanel" aria-labelledby="leo-tab-${chu(tt.dangXem)}">` +
    dongTrong('Đang tải lộ trình…') +
    '</div>';
  o.tab = $('.leo-tab', o.goc);
  o.bang = $('#leo-bang');
  khiSapToi($('#lo-trinh-nghe'), napChiTiet);
}

/** Vẽ lại dấu tiến độ sau khi đăng nhập, đăng xuất, nộp bài hay chấm bài. */
export function veLaiTienDo() {
  if (!o.ga?.isConnected) return;
  veLoTrinh({ chiTienDo: true });
}

export function khoiTao() {
  const goc = $('#leo');
  if (goc === null) return;

  goc.addEventListener('click', (sk) => {
    const tab = sk.target.closest('[role="tab"]');
    if (tab) {
      doiTab(tab.dataset.slug);
      return;
    }
    const nutGa = sk.target.closest('.leo-nut');
    if (nutGa) {
      tt.chonTay.add(tt.dangXem);
      chonGa(Number(nutGa.dataset.chiSo));
      return;
    }
    const nutSang = sk.target.closest('[data-sang]');
    if (nutSang) {
      sangLoTrinh(nutSang.dataset.sang, nutSang.dataset.project);
      return;
    }
    const nutMo = sk.target.closest('[data-mo-project]');
    if (nutMo) {
      // Người đã mở một project từ thẻ thì ga ấy là ga họ chọn: đăng nhập hay nộp
      // bài trong bảng chi tiết không được đổi thẻ sang ga khác.
      tt.chonTay.add(tt.dangXem);
      // Tên project bay lên tiêu đề bảng từ chỗ đang hiện tên: thẻ trên màn hình
      // rộng, hàng của ga trên điện thoại.
      moProject(nutMo.dataset.moProject, o.the.closest('li') ?? o.the);
    }
  });

  goc.addEventListener('keydown', (sk) => {
    const tab = sk.target.closest('[role="tab"]');
    if (tab) {
      const cacTab = $$('[role="tab"]', o.tab);
      const moi = viTriMoi(sk.key, cacTab.indexOf(tab), cacTab.length, true);
      if (moi === null) return;
      sk.preventDefault();
      doiTab(cacTab[moi].dataset.slug, { tieuDiem: true });
      return;
    }
    const nutGa = sk.target.closest('.leo-nut');
    if (!nutGa) return;
    const moi = viTriMoi(sk.key, Number(nutGa.dataset.chiSo), o.ga.children.length, false);
    if (moi === null) return;
    sk.preventDefault();
    tt.chonTay.add(tt.dangXem);
    chonGa(moi, { tieuDiem: true });
  });

  dienThoai.addEventListener('change', () => {
    if (o.the?.isConnected) datChoThe();
  });
}
