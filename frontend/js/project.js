/* Bảng chi tiết một project: toàn bộ thông tin của project, gợi ý mở dần theo
   tầng, và phần nộp bài. */

import { LoiApi, apiCatalog, apiTienDo, phien } from './api.js';
import {
  $,
  NHAN_TRANG_THAI,
  chu,
  moBang,
  so,
  soGio,
  tenLevel,
  thoiGian,
  thongBao,
} from './giao-dien.js';
import { SU_KIEN, phat } from './su-kien.js';
import { baiNopCua, daHoanThanh } from './tien-do.js';

// Backend chia gợi ý làm ba tầng, tầng sau cụ thể hơn tầng trước.
const TANG_CAO_NHAT = 3;

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
    return `${ten} phải là một đường dẫn đầy đủ, bắt đầu bằng https://`;
  }
  if (dia_chi.protocol !== 'http:' && dia_chi.protocol !== 'https:') {
    return `${ten} chỉ nhận đường dẫn http hoặc https.`;
  }
  if (chuoi.length > DAI_TOI_DA_DUONG_DAN) {
    return `${ten} dài quá ${DAI_TOI_DA_DUONG_DAN} ký tự.`;
  }
  return null;
}

const dangXem = { project: null, tangGoiY: 0, slugDangCho: null };

/* Bản nháp bài nộp.

   Bảng chi tiết đóng lại là toàn bộ biểu mẫu bị gỡ khỏi trang, nên chữ đang gõ
   mất theo. Người dùng bấm nhầm ra vùng tối hay bấm phím Esc là mất công viết,
   mà không được hỏi lại câu nào. Nội dung đang gõ vì vậy được giữ lại theo từng
   project, và điền lại khi mở bảng lần sau. */
const KHOA_NHAP = 'nen-tang-project:nhap';

function docCacBanNhap() {
  try {
    return JSON.parse(localStorage.getItem(KHOA_NHAP) ?? '{}');
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

const banNhapCua = (slug) => docCacBanNhap()[slug] ?? null;

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
function muc(nhan, noiDung) {
  return noiDung ? `<p class="bang-muc-nhan">${chu(nhan)}</p>${noiDung}` : '';
}

const doan = (noiDung) => (noiDung ? `<p class="bang-doan">${chu(noiDung)}</p>` : '');

const danhSachGach = (cacDong) =>
  cacDong.length > 0
    ? `<ul class="bang-danh-sach">${cacDong.map((dong) => `<li>${chu(dong)}</li>`).join('')}</ul>`
    : '';

/**
 * Danh sách project tiên quyết.
 *
 * Backend chặn hẳn việc nộp bài khi còn project tiên quyết chưa hoàn thành, nên
 * phần này nói "phải hoàn thành trước". Project đã xong được đánh dấu để người
 * học biết còn thiếu cái nào.
 */
function veTienQuyet(danhSach) {
  if (danhSach.length === 0) return '';
  const cacNut = danhSach
    .map((mot) => {
      const xong = daHoanThanh(mot.slug);
      return (
        `<button type="button" class="the-lien-ket${xong ? ' da-xong' : ''}" data-mo-project="${chu(mot.slug)}">` +
        `${xong ? '✓ ' : ''}${chu(mot.title)}</button>`
      );
    })
    .join('');
  return `<div class="the-hang">${cacNut}</div>`;
}

/** Những project tiên quyết mà người đang đăng nhập chưa hoàn thành. */
const conThieuTienQuyet = (project) =>
  project.prerequisites.filter((mot) => !daHoanThanh(mot.slug));

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

/** Phần bài nộp đã có của người đang đăng nhập cho chính project này. */
function veBaiNopCuaToi(slug) {
  const bai = baiNopCua(slug);
  if (!bai) return '';

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
    '<div class="o-bai-nop">' +
    `<p class="bai-nop-trang-thai the-${chu(bai.status)}">${chu(NHAN_TRANG_THAI[bai.status])}</p>` +
    `<p class="bai-nop-moc">Nộp lúc ${chu(thoiGian(bai.submitted_at))}.` +
    (bai.reviewed_at ? ` Chấm lúc ${chu(thoiGian(bai.reviewed_at))}.` : '') +
    '</p>' +
    (dongPhu.length > 0 ? `<p class="bai-nop-moc">${chu(dongPhu.join(' '))}</p>` : '') +
    (bai.feedback ? `<p class="bai-nop-nhan-xet">${chu(bai.feedback)}</p>` : '') +
    '</div>'
  );
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
      '<p class="bang-doan">Bạn đã hoàn thành project này. Mỗi project chỉ tính điểm một lần nên hệ thống không nhận thêm bài nộp.</p>' +
      '</div>'
    );
  }

  const conThieu = conThieuTienQuyet(project);
  if (conThieu.length > 0) {
    return (
      '<div class="o-nop-bai">' +
      '<p class="bang-doan">Project này chưa mở khoá. Hoàn thành trước ' +
      conThieu.map((mot) => chu(mot.title)).join(', ') +
      ' rồi mới nộp bài ở đây được.</p>' +
      '</div>'
    );
  }

  const baiCu = baiNopCua(project.slug);
  const dangCho = baiCu?.status === 'pending';
  const daTungNop = baiCu !== null;

  const dan = dangCho
    ? 'Bài của bạn đang chờ chấm. Sửa đường dẫn hay ghi chú rồi gửi lại thì bản mới thay hẳn bản đang chờ, người chấm chỉ thấy một bài.'
    : daTungNop
      ? 'Bài nộp trước đã có kết quả. Sửa theo nhận xét rồi nộp lại ở đây.'
      : '';

  // Ba ô được điền sẵn theo thứ tự ưu tiên: chữ người dùng đang gõ dở lần trước,
  // rồi tới nội dung của bài đang chờ chấm, cuối cùng là để trống.
  const nhap = banNhapCua(project.slug);
  const cu = (ten) => chu(nhap?.[ten] ?? (dangCho ? (baiCu[ten] ?? '') : ''));

  return (
    '<form class="o-nop-bai mau" id="mau-nop-bai" novalidate>' +
    (dan ? `<p class="bang-doan">${dan}</p>` : '') +
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
    '<p class="mau-loi" role="alert"></p>' +
    '<button type="submit" class="nut nut-day">' +
    (dangCho ? 'Cập nhật bài đang chờ' : daTungNop ? 'Nộp lại' : 'Nộp bài') +
    '</button>' +
    '</form>'
  );
}

/** Phần bài nộp: bài đã có, rồi tới biểu mẫu nộp bài. */
const veKhuBaiNop = (project) => veBaiNopCuaToi(project.slug) + veKhuNopBai(project);

function veBang(project) {
  const theDau = [
    project.track.name,
    soGio(project.estimated_hours),
    `${so(project.reward_points)} điểm tích luỹ`,
  ];

  $('#bang-project-nhan').textContent = tenLevel(project.level);
  $('#bang-project-than').innerHTML =
    `<h3 class="bang-ten">${chu(project.title)}</h3>` +
    `<div class="bang-the">${theDau.map((mot) => `<span>${chu(mot)}</span>`).join('')}</div>` +
    `<p class="bang-tom-tat">${chu(project.summary)}</p>` +
    muc('Bối cảnh', doan(project.context)) +
    muc('Mục tiêu học tập', doan(project.objective)) +
    muc(
      'Skill được rèn',
      project.skills.length > 0
        ? `<div class="the-hang">${project.skills.map((kn) => `<span class="the-tinh">${chu(kn.name)}</span>`).join('')}</div>`
        : ''
    ) +
    muc('Sản phẩm phải nộp', danhSachGach(project.deliverables)) +
    muc('Thử thách nâng cao', danhSachGach(project.bonus_challenges)) +
    muc('Phải hoàn thành trước', veTienQuyet(project.prerequisites)) +
    muc('Người phụ trách', veNguoiPhuTrach(project.track.mentor)) +
    muc(
      'Nguồn dữ liệu',
      project.dataset_url
        ? `<p class="bang-doan"><a href="${chu(project.dataset_url)}" target="_blank" rel="noreferrer">${chu(project.dataset_url)}</a></p>`
        : ''
    ) +
    '<p class="bang-muc-nhan">Gợi ý</p>' +
    '<div id="o-goi-y">' +
    '<p class="bang-doan">Gợi ý mở dần theo ba tầng. Tầng sau cụ thể hơn tầng trước, nên hãy tự nghĩ trước khi mở tiếp.</p>' +
    '<button type="button" class="nut nut-vien nut-goi-y" id="nut-goi-y">Mở gợi ý tầng 1</button>' +
    '</div>' +
    '<p class="bang-muc-nhan">Bài nộp</p>' +
    `<div id="khu-bai-nop">${veKhuBaiNop(project)}</div>`;
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
    const cacDong = danhSach
      .map(
        (mot) =>
          `<div class="goi-y-dong"><span class="goi-y-tang">Tầng ${mot.tier}</span><p>${chu(mot.content)}</p></div>`
      )
      .join('');
    oGoiY.querySelectorAll('.goi-y-dong').forEach((dong) => dong.remove());
    nut.insertAdjacentHTML('beforebegin', cacDong);

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
    oLoi.textContent = 'Cần điền đường dẫn tới mã nguồn.';
    return;
  }

  const loiDuongDan =
    loiCuaDuongDan(than.repo_url, 'Đường dẫn tới mã nguồn') ??
    (than.demo_url ? loiCuaDuongDan(than.demo_url, 'Đường dẫn tới bản chạy thử') : null);
  if (loiDuongDan !== null) {
    oLoi.textContent = loiDuongDan;
    return;
  }

  const nut = mau.querySelector('button[type="submit"]');
  nut.disabled = true;
  oLoi.textContent = '';

  try {
    const dangCho = baiNopCua(dangXem.project.slug)?.status === 'pending';
    await apiTienDo.nopBai(dangXem.project.slug, than);
    xoaBanNhap(dangXem.project.slug);
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

/** Mở bảng chi tiết của một project theo slug. */
export async function moProject(slug) {
  dangXem.tangGoiY = 0;
  dangXem.slugDangCho = slug;
  $('#bang-project-nhan').textContent = '';
  $('#bang-project-than').innerHTML = '<p class="dang-tai">Đang tải project…</p>';
  moBang('bang-project');

  let project;
  try {
    project = await apiCatalog.chiTietProject(slug);
  } catch (loi) {
    if (dangXem.slugDangCho !== slug) return;
    $('#bang-project-than').innerHTML =
      `<p class="dang-tai">${chu(loi instanceof LoiApi ? loi.message : 'Không tải được project.')}</p>`;
    return;
  }

  // Bấm nhanh sang project khác thì phản hồi về sau không được vẽ đè lên.
  if (dangXem.slugDangCho !== slug) return;
  dangXem.project = project;
  veBang(project);
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
  khu.innerHTML = veKhuBaiNop(dangXem.project);
}

export function khoiTao() {
  const than = $('#bang-project-than');

  than.addEventListener('click', (sk) => {
    if (sk.target.closest('#nut-goi-y')) {
      moTiepGoiY();
      return;
    }
    if (sk.target.closest('[data-can-dang-nhap]')) {
      phat(SU_KIEN.CAN_DANG_NHAP);
      return;
    }
    const nutTienQuyet = sk.target.closest('[data-mo-project]');
    if (nutTienQuyet) moProject(nutTienQuyet.dataset.moProject);
  });

  // Mỗi lần gõ là một lần ghi lại bản nháp, để đóng bảng không làm mất công viết.
  than.addEventListener('input', (sk) => {
    const mau = sk.target.closest('#mau-nop-bai');
    if (!mau || dangXem.project === null) return;
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
