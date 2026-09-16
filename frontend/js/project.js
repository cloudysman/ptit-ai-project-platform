/* Bảng chi tiết một project: toàn bộ thông tin của project, gợi ý mở dần theo
   tầng, và phần nộp bài.

   Đầu bảng là một dải xanh chàm của Trung tâm với lớp ảnh mờ màn hình mã lệnh,
   cùng cách làm với các dải xanh của trang chủ: tuyến sáu level thu nhỏ với ga
   của project được tô, tên project, và ba thẻ track, giờ, điểm tích luỹ với biểu
   tượng của chính khái niệm ấy. Mỗi mục bên dưới mang một biểu tượng cùng bộ ký
   hiệu; sản phẩm phải nộp là hàng ô đánh dấu, đã hoàn thành project thì các ô
   được tích; project tiên quyết vẽ thành một tuyến ngắn dẫn tới project này; ba
   tầng gợi ý hiện sẵn dạng khoá và mở dần. Các mục hiện lần lượt từ trên xuống
   mỗi lần bảng vẽ, người bật giảm chuyển động thì hiện ngay. */

import { LoiApi, apiCatalog, apiTienDo, phien } from './api.js';
import {
  $,
  NHAN_TRANG_THAI,
  bieuTuong,
  chu,
  chuyenCanh,
  dongLoi,
  moBang,
  so,
  soGio,
  tenLevel,
  thoiGian,
  thongBao,
} from './giao-dien.js';
import { SU_KIEN, phat } from './su-kien.js';
import { baiNopCua, daHoanThanh, lichSuBaiNopCua } from './tien-do.js';

// Backend chia gợi ý làm ba tầng, tầng sau cụ thể hơn tầng trước.
const TANG_CAO_NHAT = 3;

// Danh sách level của kho, lấy từ số liệu tổng quan mà js/api.js đã giữ sẵn
// sau lượt gọi đầu, để tuyến level ở đầu bảng không phải gọi thêm lượt nào.
let cacLevelKho = null;

// Độ dài tối đa của hai cột đường dẫn trong bảng submission của backend.
const DAI_TOI_DA_DUONG_DAN = 512;

/**
 * Kiểm tra một đường dẫn người dùng nhập.
 *
 * Backend chỉ nhận http và https. Kiểm tra trước ở đây để nói rõ sai chỗ nào,
 * thay vì để người dùng nhận câu "Dữ liệu không hợp lệ ở: repo_url".
 */
function loiCuaDuongDan(chuoi, ten) {
  let dia_chi;
  try {
    dia_chi = new URL(chuoi);
  } catch {
    return `${ten} phải là một đường dẫn đầy đủ, bắt đầu bằng http:// hoặc https://`;
  }
  if (dia_chi.protocol !== 'http:' && dia_chi.protocol !== 'https:') {
    return `${ten} chỉ nhận đường dẫn http hoặc https.`;
  }
  if (chuoi.length > DAI_TOI_DA_DUONG_DAN) {
    return `${ten} dài quá ${DAI_TOI_DA_DUONG_DAN} ký tự.`;
  }
  return null;
}

// truoc: project đang xem lúc người dùng bấm sang một project khác ngay trong
// bảng (chip tiên quyết), để bảng mới có nút quay lại; null khi mở từ ngoài.
// tieuDiemSauNop: vừa nộp bài xong; nút gửi bị khoá làm tiêu điểm rơi ra body
// trước khi phần bài nộp vẽ lại, nên phải nhớ để đưa tiêu điểm vào khối trạng thái.
const dangXem = { project: null, tangGoiY: 0, slugDangCho: null, truoc: null, tieuDiemSauNop: false };

/* Bản nháp bài nộp.

   Bảng chi tiết đóng lại là toàn bộ biểu mẫu bị gỡ khỏi trang, nên chữ đang gõ
   mất theo. Người dùng bấm nhầm ra vùng tối hay bấm phím Esc là mất công viết,
   mà không được hỏi lại câu nào. Nội dung đang gõ vì vậy được giữ lại theo từng
   project, và điền lại khi mở bảng lần sau. */
const KHOA_NHAP = 'nen-tang-project:nhap';

// Chỉ nhận đối tượng thường. Khoá này nằm trong localStorage, tức ai cũng sửa
// được: một giá trị null hay chuỗi ở đó mà đọc như đối tượng thì bảng chi tiết
// hỏng ở lần mở sau, và mỗi lần gõ lại ném lỗi.
const laDoiTuong = (gia) => gia !== null && typeof gia === 'object' && !Array.isArray(gia);

function docCacBanNhap() {
  try {
    const gia = JSON.parse(localStorage.getItem(KHOA_NHAP) ?? '{}');
    return laDoiTuong(gia) ? gia : {};
  } catch {
    return {};
  }
}

function ghiCacBanNhap(cacBan) {
  try {
    localStorage.setItem(KHOA_NHAP, JSON.stringify(cacBan));
  } catch {
    // Trình duyệt chặn lưu trữ cục bộ thì bản nháp chỉ sống trong lần mở này.
  }
}

function banNhapCua(slug) {
  const ban = docCacBanNhap()[slug];
  return laDoiTuong(ban) ? ban : null;
}

function luuBanNhap(slug, ban) {
  const cacBan = docCacBanNhap();
  const conChu = Object.values(ban).some((gia) => String(gia).trim() !== '');
  if (conChu) cacBan[slug] = ban;
  else delete cacBan[slug];
  ghiCacBanNhap(cacBan);
}

function xoaBanNhap(slug) {
  const cacBan = docCacBanNhap();
  delete cacBan[slug];
  ghiCacBanNhap(cacBan);
}

/** Một mục có tiêu đề nhỏ, chỉ vẽ khi phần nội dung có gì để hiển thị. */
/**
 * Một mục của bảng: nhãn có biểu tượng rồi nội dung, bọc trong khối để các mục
 * hiện lần lượt theo thứ tự chiSo. Không có nội dung thì không có mục.
 */
function muc(bieu, nhan, noiDung, chiSo) {
  if (!noiDung) return '';
  return (
    `<section class="bang-muc" style="--i:${chiSo}">` +
    `<h4 class="bang-muc-nhan">${bieuTuong(bieu)}${chu(nhan)}</h4>${noiDung}` +
    '</section>'
  );
}

const doan = (noiDung) => (noiDung ? `<p class="bang-doan">${chu(noiDung)}</p>` : '');

/**
 * Danh sách sản phẩm phải nộp, mỗi dòng một ô đánh dấu như hình bước hai của mục
 * Ba bước; project đã hoàn thành thì các ô được tích. Thử thách nâng cao dùng
 * ngôi sao của badge điểm, vì đó là phần làm thêm chứ không phải phần bắt buộc.
 */
function danhSachO(cacDong, daXong) {
  if (cacDong.length === 0) return '';
  return (
    `<ul class="bang-danh-sach ds-o${daXong ? ' da-xong' : ''}">` +
    cacDong.map((dong, i) => `<li style="--j:${i}"><span class="o-tich" aria-hidden="true">${bieuTuong('tich')}</span><span>${chu(dong)}</span></li>`).join('') +
    '</ul>'
  );
}

const danhSachSao = (cacDong) =>
  cacDong.length > 0
    ? `<ul class="bang-danh-sach ds-sao">${cacDong.map((dong) => `<li>${bieuTuong('badge-diem')}<span>${chu(dong)}</span></li>`).join('')}</ul>`
    : '';

/**
 * Danh sách project tiên quyết.
 *
 * Backend chặn hẳn việc nộp bài khi còn project tiên quyết chưa hoàn thành, nên
 * phần này nói "phải hoàn thành trước". Project đã xong được đánh dấu để người
 * học biết còn thiếu cái nào.
 */
function veTienQuyet(danhSach, tenProject) {
  if (danhSach.length === 0) return '';
  // Các project tiên quyết nối nhau thành một tuyến ngắn, ga cuối là chính
  // project này, cùng ngữ pháp vòng tròn nối bằng đường với tuyến level.
  const cacGa = danhSach
    .map((mot) => {
      const xong = daHoanThanh(mot.slug);
      return (
        `<li class="tq-ga${xong ? ' da-xong' : ''}">` +
        `<button type="button" class="the-lien-ket${xong ? ' da-xong' : ''}" data-mo-project="${chu(mot.slug)}">` +
        `${bieuTuong('tich')}${chu(mot.title)}</button>` +
        '</li>'
      );
    })
    .join('');
  return `<ol class="tq-tuyen">${cacGa}<li class="tq-ga la-day"><span class="tq-day">${chu(tenProject)}</span></li></ol>`;
}

/** Những project tiên quyết mà người đang đăng nhập chưa hoàn thành. */
const conThieuTienQuyet = (project) =>
  project.prerequisites.filter((mot) => !daHoanThanh(mot.slug));

/** Tên các project tiên quyết còn thiếu, mỗi tên là một nút mở project đó. */
const nutTienQuyet = (conThieu) =>
  conThieu
    .map((mot) => `<button type="button" class="the-lien-ket" data-mo-project="${chu(mot.slug)}">${chu(mot.title)}</button>`)
    .join(', ');

/**
 * Dòng báo khoá ngay dưới dải xanh, để người mở project biết ngay từ đầu bảng
 * chứ không phải cuộn tới cuối phần Bài nộp mới thấy.
 */
function veDongKhoa(project) {
  if (!phien.daDangNhap) return '';
  const conThieu = conThieuTienQuyet(project);
  if (conThieu.length === 0) return '';
  return `<p class="bang-khoa">${bieuTuong('khoa')}<span>Chưa mở khoá · hoàn thành trước: ${nutTienQuyet(conThieu)}</span></p>`;
}

/**
 * Người phụ trách của project, lấy theo track.
 *
 * Backend gán người phụ trách cho từng track chứ không cho từng project, nên
 * mọi project cùng một track có chung một giảng viên.
 */
function veNguoiPhuTrach(nguoi) {
  if (!nguoi) return '';
  return (
    '<div class="o-phu-trach">' +
    `<img class="phu-trach-anh" src="anh/${chu(nguoi.photo)}" width="96" height="96" loading="lazy" alt="Ảnh chân dung ${chu(nguoi.name)}">` +
    '<span>' +
    `<span class="phu-trach-ten">${chu(nguoi.name)}</span>` +
    `<span class="phu-trach-chuc">${chu(nguoi.title)}</span>` +
    '</span>' +
    '</div>'
  );
}

/** Một bài nộp: nhãn trạng thái, mốc thời gian, điểm và nhận xét của người chấm. */
function veMotBaiNop(bai, laLanTruoc) {
  // Hai con số dễ bị đọc nhầm thành một, nên mỗi con số được gọi bằng đúng tên
  // của nó: điểm bài nộp là mức người chấm đánh giá, còn điểm tích luỹ là số
  // điểm cố định của project cộng vào tài khoản khi bài đạt.
  const dongPhu = [];
  if (bai.score !== null && bai.score !== undefined) {
    dongPhu.push(`Người chấm cho ${bai.score} trên 100 điểm bài nộp.`);
  }
  if (bai.awarded_points > 0) {
    dongPhu.push(`Tài khoản được cộng ${so(bai.awarded_points)} điểm tích luỹ.`);
  }

  return (
    `<div class="o-bai-nop${laLanTruoc ? ' bai-nop-truoc' : ''}" data-bai-nop-id="${bai.id}" tabindex="-1">` +
    '<p class="bai-nop-trang-thai">' +
    (laLanTruoc ? '<span class="bai-nop-lan">Lần chấm trước</span>' : '') +
    `<span class="nhan the-${chu(bai.status)}">${chu(NHAN_TRANG_THAI[bai.status])}</span></p>` +
    `<p class="bai-nop-moc">Nộp lúc ${chu(thoiGian(bai.submitted_at))}.` +
    (bai.reviewed_at ? ` Chấm lúc ${chu(thoiGian(bai.reviewed_at))}.` : '') +
    '</p>' +
    (dongPhu.length > 0 ? `<p class="bai-nop-moc">${chu(dongPhu.join(' '))}</p>` : '') +
    (bai.feedback ? `<p class="bai-nop-nhan-xet">${chu(bai.feedback)}</p>` : '') +
    '</div>'
  );
}

/**
 * Phần bài nộp đã có của người đang đăng nhập cho chính project này: bài tiêu
 * biểu trước, rồi những lần chấm trước đó. Nộp lại sau "Cần sửa lại" thì nhận
 * xét của lần trước vẫn còn đây, để người học đối chiếu trong lúc chờ chấm.
 */
function veBaiNopCuaToi(slug) {
  const bai = baiNopCua(slug);
  if (!bai) return '';
  return veMotBaiNop(bai, false) + lichSuBaiNopCua(slug).map((cu) => veMotBaiNop(cu, true)).join('');
}

/**
 * Phần nộp bài.
 *
 * Bốn trường hợp: chưa đăng nhập, project chưa mở khoá, đã hoàn thành, và còn
 * lại là nộp được. Bài đang chờ chấm vẫn sửa được: bản mới thay bản cũ nên hàng
 * đợi của người chấm không có hai bài của cùng một project.
 */
function veKhuNopBai(project) {
  if (!phien.daDangNhap) {
    return (
      '<div class="o-nop-bai">' +
      '<p class="bang-doan">Đăng nhập rồi bạn mới nộp được bài cho project này.</p>' +
      '<button type="button" class="nut nut-day" data-can-dang-nhap>Đăng nhập</button>' +
      '</div>'
    );
  }

  if (daHoanThanh(project.slug)) {
    return (
      '<div class="o-nop-bai">' +
      '<p class="bang-doan">Bạn đã hoàn thành project này.</p>' +
      '</div>'
    );
  }

  const conThieu = conThieuTienQuyet(project);
  if (conThieu.length > 0) {
    return (
      '<div class="o-nop-bai">' +
      '<p class="bang-doan">Project này chưa mở khoá. Hoàn thành trước ' +
      nutTienQuyet(conThieu) +
      ' rồi mới nộp bài ở đây được.</p>' +
      '</div>'
    );
  }

  const baiCu = baiNopCua(project.slug);
  const dangCho = baiCu?.status === 'pending';
  const daTungNop = baiCu !== null;
  // Bài bị trả về hay chưa đạt thì nộp lại thường là cùng kho mã đã sửa, nên hai
  // ô đường dẫn điền sẵn từ bài trước; ghi chú thì để trống vì nói về lần nộp mới.
  const dienLai = dangCho || baiCu?.status === 'revision' || baiCu?.status === 'rejected';

  // Ba ô được điền sẵn theo thứ tự ưu tiên: chữ người dùng đang gõ dở lần trước,
  // rồi tới nội dung của bài trước, cuối cùng là để trống.
  const nhap = banNhapCua(project.slug);
  const cu = (ten) =>
    chu(nhap?.[ten] ?? (dienLai && (dangCho || ten !== 'note') ? (baiCu[ten] ?? '') : ''));

  return (
    '<form class="o-nop-bai mau" id="mau-nop-bai" novalidate>' +
    (dangCho ? '<p class="bang-doan">Bài của bạn đang chờ chấm.</p>' : '') +
    (nhap
      ? '<p class="mau-chu-dan">Đây là nội dung bạn gõ dở lần trước, hệ thống giữ lại giúp.</p>'
      : '') +
    '<label>Đường dẫn tới mã nguồn' +
    `<input type="url" name="repo_url" value="${cu('repo_url')}" placeholder="https://github.com/ten-cua-ban/project" required>` +
    '</label>' +
    '<label>Đường dẫn tới bản chạy thử, nếu có' +
    `<input type="url" name="demo_url" value="${cu('demo_url')}" placeholder="https://">` +
    '</label>' +
    '<label>Ghi chú gửi người chấm' +
    `<textarea name="note" rows="3" maxlength="2000" placeholder="Phần nào đã xong, phần nào còn dở.">${cu('note')}</textarea>` +
    '</label>' +
    '<p class="mau-loi" id="nop-bai-loi" role="alert"></p>' +
    '<button type="submit" class="nut nut-day">' +
    (dangCho ? 'Cập nhật bài đang chờ' : daTungNop ? 'Nộp lại' : 'Nộp bài') +
    bieuTuong('nop') +
    '</button>' +
    '</form>'
  );
}

/** Phần bài nộp: bài đã có, rồi tới biểu mẫu nộp bài. */
const veKhuBaiNop = (project) => veBaiNopCuaToi(project.slug) + veKhuNopBai(project);

/**
 * Tuyến level thu nhỏ ở đầu bảng, ga của project được tô. Chỉ để nhìn: level đã
 * ghi ở nhãn của bảng. Không có số liệu tổng quan thì không vẽ, không đoán số level.
 */
function veTuyenLevel(levelId) {
  if (cacLevelKho === null) return '';
  return (
    '<ol class="bang-tuyen" aria-hidden="true">' +
    cacLevelKho.map((id) => `<li class="bang-ga${id === levelId ? ' la-day' : ''}">${id}</li>`).join('') +
    '</ol>'
  );
}

/** Ba tầng gợi ý: tầng chưa mở hiện dạng khoá, để thấy trước còn bao nhiêu tầng. */
const veTangKhoa = (tang) =>
  `<div class="goi-y-dong la-khoa" data-tang="${tang}"><span class="goi-y-tang">${bieuTuong('khoa')}Tầng ${tang}</span><span class="goi-y-cho" aria-hidden="true"></span></div>`;

function veBang(project) {
  const daXong = daHoanThanh(project.slug);
  const theDau = [
    ['badge-track', project.track.name],
    ['gio', soGio(project.estimated_hours)],
    ['badge-diem', `${so(project.reward_points)} điểm tích luỹ`],
  ];

  $('#bang-project-nhan').textContent = tenLevel(project.level);
  // Tên của hộp thoại ghép nhãn level với tên project, chỉ khi tên đã có trong
  // trang; tham chiếu aria tới một id chưa tồn tại là một tham chiếu hỏng.
  $('#bang-project').setAttribute('aria-labelledby', 'bang-project-nhan bang-project-ten');
  const truoc = dangXem.truoc;
  $('#bang-project-than').innerHTML =
    (truoc
      ? `<p class="bang-quay-lai"><button type="button" class="the-lien-ket" data-mo-project="${chu(truoc.slug)}" data-quay-lai>${bieuTuong('trai')}Quay lại ${chu(truoc.title)}</button></p>`
      : '') +
    '<div class="bang-truong">' +
    veTuyenLevel(project.level.id) +
    `<h3 class="bang-ten" id="bang-project-ten">${chu(project.title)}</h3>` +
    `<div class="bang-the">${theDau.map(([bieu, mot]) => `<span>${bieuTuong(bieu)}${chu(mot)}</span>`).join('')}</div>` +
    '</div>' +
    veDongKhoa(project) +
    `<p class="bang-tom-tat">${chu(project.summary)}</p>` +
    muc('boi-canh', 'Bối cảnh', doan(project.context), 1) +
    muc('muc-tieu', 'Mục tiêu học tập', doan(project.objective), 2) +
    muc(
      'skill',
      'Skill được rèn',
      project.skills.length > 0
        ? `<div class="the-hang">${project.skills.map((kn) => `<span class="the-tinh">${chu(kn.name)}</span>`).join('')}</div>`
        : '',
      3
    ) +
    muc('badge-project', 'Sản phẩm phải nộp', danhSachO(project.deliverables, daXong), 4) +
    muc('badge-diem', 'Thử thách nâng cao', danhSachSao(project.bonus_challenges), 5) +
    muc('khoa', 'Phải hoàn thành trước', veTienQuyet(project.prerequisites, project.title), 6) +
    muc('nguoi', 'Người phụ trách', veNguoiPhuTrach(project.track.mentor), 7) +
    muc(
      'du-lieu',
      'Nguồn dữ liệu',
      project.dataset_url
        ? `<p class="bang-doan"><a href="${chu(project.dataset_url)}" target="_blank" rel="noreferrer">${chu(project.dataset_url)} ${bieuTuong('ngoai')}</a></p>`
        : '',
      8
    ) +
    '<section class="bang-muc" style="--i:9">' +
    `<h4 class="bang-muc-nhan">${bieuTuong('tang')}Gợi ý</h4>` +
    '<div id="o-goi-y">' +
    Array.from({ length: TANG_CAO_NHAT }, (_, i) => veTangKhoa(i + 1)).join('') +
    '<button type="button" class="nut nut-vien nut-goi-y" id="nut-goi-y">Mở gợi ý tầng 1</button>' +
    '</div>' +
    '</section>' +
    '<section class="bang-muc" style="--i:10">' +
    `<h4 class="bang-muc-nhan">${bieuTuong('nop')}Bài nộp</h4>` +
    `<div id="khu-bai-nop">${veKhuBaiNop(project)}</div>` +
    '</section>';
}

/* Gợi ý. */

async function moTiepGoiY() {
  const tangMoi = dangXem.tangGoiY + 1;
  const slugLucGoi = dangXem.project.slug;
  const nut = $('#nut-goi-y');
  nut.disabled = true;

  try {
    const danhSach = await apiCatalog.goiY(slugLucGoi, tangMoi);
    // Người dùng có thể đã mở sang project khác trong lúc chờ. Bỏ qua phản hồi
    // cũ, nếu không gợi ý của project này lại hiện trong bảng của project kia.
    if (dangXem.project.slug !== slugLucGoi) return;
    dangXem.tangGoiY = tangMoi;

    const oGoiY = $('#o-goi-y');
    // Backend trả mọi tầng tới tangMoi. Mỗi tầng thay đúng ô khoá của mình, tầng đã
    // mở rồi thì thay tại chỗ; tầng backend không có thì ô khoá của nó bỏ đi.
    for (const mot of danhSach) {
      const cho = oGoiY.querySelector(`.goi-y-dong[data-tang="${mot.tier}"]`);
      const dong = `<div class="goi-y-dong da-mo" data-tang="${mot.tier}"><span class="goi-y-tang">Tầng ${mot.tier}</span><p>${chu(mot.content)}</p></div>`;
      if (cho) cho.outerHTML = dong;
      else nut.insertAdjacentHTML('beforebegin', dong);
    }
    if (danhSach.length < tangMoi) {
      oGoiY.querySelectorAll('.goi-y-dong.la-khoa').forEach((dong) => dong.remove());
    }

    if (tangMoi >= TANG_CAO_NHAT || danhSach.length < tangMoi) {
      nut.remove();
    } else {
      nut.textContent = `Mở gợi ý tầng ${tangMoi + 1}`;
      nut.disabled = false;
    }
  } catch (loi) {
    nut.disabled = false;
    thongBao(loi instanceof LoiApi ? loi.message : 'Không tải được gợi ý.', 'loi');
  }
}

/* Nộp bài. */

/**
 * Báo một ô của biểu mẫu nộp bài sai, theo cùng cách với biểu mẫu đăng ký: câu
 * lỗi hiện ra, ô sai được đánh dấu cho trình đọc màn hình và nhận tiêu điểm để
 * người dùng bàn phím sửa ngay thay vì phải đi tìm ô đó từ nút gửi.
 */
function baoOSai(mau, oLoi, ten, cau) {
  oLoi.textContent = cau;
  const o = mau[ten];
  o.setAttribute('aria-invalid', 'true');
  o.setAttribute('aria-describedby', oLoi.id);
  o.focus();
}

async function nopBai(mau) {
  const oLoi = mau.querySelector('.mau-loi');
  const duLieu = new FormData(mau);
  const than = {
    repo_url: String(duLieu.get('repo_url') || '').trim(),
    note: String(duLieu.get('note') || '').trim(),
  };
  const banChayThu = String(duLieu.get('demo_url') || '').trim();
  if (banChayThu) than.demo_url = banChayThu;

  if (!than.repo_url) {
    baoOSai(mau, oLoi, 'repo_url', 'Cần điền đường dẫn tới mã nguồn.');
    return;
  }

  const loiMaNguon = loiCuaDuongDan(than.repo_url, 'Đường dẫn tới mã nguồn');
  if (loiMaNguon !== null) {
    baoOSai(mau, oLoi, 'repo_url', loiMaNguon);
    return;
  }
  const loiChayThu = than.demo_url ? loiCuaDuongDan(than.demo_url, 'Đường dẫn tới bản chạy thử') : null;
  if (loiChayThu !== null) {
    baoOSai(mau, oLoi, 'demo_url', loiChayThu);
    return;
  }

  const nut = mau.querySelector('button[type="submit"]');
  nut.disabled = true;
  oLoi.textContent = '';

  try {
    const dangCho = baiNopCua(dangXem.project.slug)?.status === 'pending';
    await apiTienDo.nopBai(dangXem.project.slug, than);
    xoaBanNhap(dangXem.project.slug);
    dangXem.tieuDiemSauNop = true;
    thongBao(
      dangCho
        ? 'Đã cập nhật bài đang chờ chấm.'
        : 'Đã nộp bài. Chờ người chấm xem và cho kết quả.'
    );
    phat(SU_KIEN.TIEN_DO_THAY_DOI);
  } catch (loi) {
    nut.disabled = false;
    oLoi.textContent = loi instanceof LoiApi ? loi.message : 'Không nộp được bài.';
  }
}

/* Mở bảng. */

/**
 * Mở bảng chi tiết của một project theo slug.
 *
 * Tham số nguon là phần tử người dùng vừa bấm, nếu có. Tên project trong phần
 * tử đó được gắn tên chuyển cảnh, nên khi bảng vẽ xong, tên bay từ chỗ cũ lên
 * tiêu đề của bảng thay vì biến mất ở một chỗ rồi hiện ra ở chỗ khác.
 *
 * baiNopId: mở để xem một bài nộp cụ thể (dòng trong bảng tài khoản), bảng cuộn
 * tới đúng bài đó sau khi vẽ.
 */
export async function moProject(slug, nguon = null, { baiNopId = null } = {}) {
  // Bấm từ trong chính bảng project (chip tiên quyết) thì nhớ project đang xem,
  // để bảng mới có đường quay lại; mở từ nơi khác thì không.
  const tuTrongBang = nguon?.closest('#bang-project') !== null && nguon !== null;
  dangXem.truoc =
    tuTrongBang && dangXem.project && dangXem.project.slug !== slug
      ? { slug: dangXem.project.slug, title: dangXem.project.title }
      : null;
  dangXem.tangGoiY = 0;
  dangXem.slugDangCho = slug;
  $('#bang-project-nhan').textContent = '';
  $('#bang-project').setAttribute('aria-labelledby', 'bang-project-nhan');
  $('#bang-project-than').innerHTML = '<p class="dang-tai">Đang tải project…</p>';
  moBang('bang-project');

  let project;
  try {
    // Số liệu tổng quan đã được phần kho gọi từ lúc mở trang, js/api.js giữ lại
    // lời hứa ấy nên đây không phải một lượt gọi mới; lỗi thì bảng bỏ tuyến level.
    const [chiTiet, thongKe] = await Promise.all([
      apiCatalog.chiTietProject(slug),
      apiCatalog.thongKe().catch(() => null),
    ]);
    project = chiTiet;
    cacLevelKho = thongKe ? thongKe.by_level.map((mot) => mot.level.id).sort((a, b) => a - b) : null;
  } catch (loi) {
    if (dangXem.slugDangCho !== slug) return;
    $('#bang-project-than').innerHTML = dongLoi(
      loi instanceof LoiApi ? loi.message : 'Không tải được project.'
    );
    return;
  }

  // Bấm nhanh sang project khác thì phản hồi về sau không được vẽ đè lên.
  if (dangXem.slugDangCho !== slug) return;
  dangXem.project = project;

  const tenNguon = nguon?.querySelector('.hang-ten > span, .chu-thich-ten, .the-lien-ket, .bai-nop-ten, .de-xuat-ten, .leo-ten, .hop-tim-ten, .kg-the-ten');
  if (tenNguon) tenNguon.style.viewTransitionName = 'ten-project';

  // Thân bảng vẽ trước, ngoài chuyển cảnh: chuyển cảnh chỉ chuyển tên chuyển
  // cảnh từ chỗ bấm lên tiêu đề để tên bay, còn nội dung đã có sẵn trên màn hình
  // dù trình duyệt có hoãn chuyển cảnh bao lâu. Vẽ bên trong chuyển cảnh thì
  // suốt lúc hoãn bảng chỉ có tiêu đề và tóm tắt, thân trống.
  veBang(project);
  if (baiNopId !== null) {
    const o = $(`#bang-project-than [data-bai-nop-id="${baiNopId}"]`);
    if (o) {
      o.scrollIntoView({ block: 'center' });
      o.focus({ preventScroll: true });
    }
  }
  await chuyenCanh(() => {
    if (tenNguon) tenNguon.style.viewTransitionName = '';
    const tenBang = $('#bang-project-than .bang-ten');
    if (tenBang) tenBang.style.viewTransitionName = 'ten-project';
  });
  $('#bang-project-than .bang-ten')?.style.removeProperty('view-transition-name');
}

/**
 * Vẽ lại phần bài nộp của bảng đang mở.
 *
 * Dùng sau khi nộp bài, sau khi một bài được chấm, và sau khi đăng nhập hoặc
 * đăng xuất. Chỉ vẽ lại đúng phần đổi, nhờ vậy những gợi ý người dùng đã mở vẫn
 * còn nguyên trên màn hình.
 */
export function veLaiBangDangMo() {
  const khu = $('#khu-bai-nop');
  if (dangXem.project === null || khu === null) return;
  // Tiêu điểm có thể đang ở ngay trong phần bị vẽ lại: đăng nhập từ bảng này xong,
  // hộp đăng nhập đóng lại và trả tiêu điểm về nút "Đăng nhập" của phần bài nộp.
  // Nút đó bị thay thì tiêu điểm rơi ra body, nên nó được đưa vào điều khiển đầu
  // tiên của phần mới, thường là ô đường dẫn để nộp bài; phần mới không có điều
  // khiển nào thì về nút đóng bảng, cũng là chỗ tiêu điểm đứng khi bảng vừa mở.
  const giuTieuDiem = khu.contains(document.activeElement) || dangXem.tieuDiemSauNop;
  dangXem.tieuDiemSauNop = false;
  khu.innerHTML = veKhuBaiNop(dangXem.project);
  if (!giuTieuDiem) return;
  // Vừa nộp bài xong thì tiêu điểm vào khối trạng thái của bài, để trình đọc màn
  // hình đọc ngay "Chờ chấm" thay vì rơi vào ô đường dẫn của biểu mẫu.
  (
    khu.querySelector('.o-bai-nop:not(.bai-nop-truoc)') ??
    khu.querySelector('input, textarea, button') ??
    $('#bang-project [data-dong]')
  )?.focus();
}

export function khoiTao() {
  const than = $('#bang-project-than');

  than.addEventListener('click', (sk) => {
    if (sk.target.closest('#nut-goi-y')) {
      moTiepGoiY();
      return;
    }
    if (sk.target.closest('[data-can-dang-nhap]')) {
      // Gửi kèm project đang xem, để hộp đăng nhập nói rõ đăng nhập để nộp bài cho project nào.
      phat(SU_KIEN.CAN_DANG_NHAP, { project: dangXem.project });
      return;
    }
    const nutMo = sk.target.closest('[data-mo-project]');
    if (!nutMo) return;
    // Nút quay lại mở project cũ như mở từ ngoài, để không tạo vòng quay lại nữa.
    if (nutMo.hasAttribute('data-quay-lai')) {
      dangXem.project = null;
      moProject(nutMo.dataset.moProject);
      return;
    }
    moProject(nutMo.dataset.moProject, nutMo.parentElement);
  });

  // Mỗi lần gõ là một lần ghi lại bản nháp, để đóng bảng không làm mất công viết.
  than.addEventListener('input', (sk) => {
    const mau = sk.target.closest('#mau-nop-bai');
    if (!mau || dangXem.project === null) return;
    // Người dùng đã bắt đầu sửa thì bỏ dấu sai trên ô đó.
    sk.target.removeAttribute('aria-invalid');
    sk.target.removeAttribute('aria-describedby');
    const duLieu = new FormData(mau);
    luuBanNhap(dangXem.project.slug, {
      repo_url: String(duLieu.get('repo_url') || ''),
      demo_url: String(duLieu.get('demo_url') || ''),
      note: String(duLieu.get('note') || ''),
    });
  });

  than.addEventListener('submit', (sk) => {
    if (sk.target.id !== 'mau-nop-bai') return;
    sk.preventDefault();
    nopBai(sk.target);
  });
}
