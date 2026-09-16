/* Màn hình chấm bài, chỉ tài khoản giảng viên mới mở được.

   Backend đã chặn ở phía máy chủ: mọi lệnh gọi ở đây đều trả về lỗi 403 nếu
   người gọi không phải giảng viên, và cũng trả về 403 nếu giảng viên định chấm
   chính bài của mình. Việc giấu nút trên giao diện chỉ để đỡ rối mắt, không
   phải là lớp bảo vệ.

   Kết quả chấm là chung cuộc, không sửa lại được, nên lưu là hai bước: bấm
   "Lưu kết quả chấm" thì biểu mẫu tóm tắt lại kết quả và nút đổi thành "Xác
   nhận"; bấm lần nữa mới gửi. Sửa bất kỳ ô nào trong lúc đó là quay về bước
   đầu. Phím Enter trong ô điểm không gửi biểu mẫu, chỉ chuyển sang ô nhận xét.

   Nhận xét đang gõ dở được giữ trong sessionStorage theo mã bài nộp: đóng bảng
   rồi mở lại, hay phiên hết hạn giữa chừng rồi đăng nhập lại, thì chữ vẫn còn. */

import { LoiApi, apiQuanTri, phien } from './api.js';
import { $, NHAN_TRANG_THAI, bieuTuong, chu, dongLoi, moBang, so, tenLevel, thoiGian, thongBao } from './giao-dien.js';
import { moProject } from './project.js';
import { SU_KIEN, phat } from './su-kien.js';

const NHAN_KET_QUA = {
  accepted: 'Đạt',
  revision: 'Cần sửa lại',
  rejected: 'Chưa đạt',
};

const CHU_NUT_LUU = 'Lưu kết quả chấm';
const CHU_NUT_XAC_NHAN = 'Xác nhận';

/* Bản nháp theo mã bài nộp. */
const TIEN_TO_NHAP = 'nen-tang-project:nhap-cham:';

function docNhap(maBaiNop) {
  try {
    const gia = JSON.parse(sessionStorage.getItem(TIEN_TO_NHAP + maBaiNop) ?? 'null');
    return gia !== null && typeof gia === 'object' && !Array.isArray(gia) ? gia : null;
  } catch {
    return null;
  }
}

function ghiNhap(mau) {
  const duLieu = new FormData(mau);
  const ban = {
    status: String(duLieu.get('status') || ''),
    score: String(duLieu.get('score') || ''),
    feedback: String(duLieu.get('feedback') || ''),
  };
  try {
    if (Object.values(ban).some((gia) => gia.trim() !== '')) {
      sessionStorage.setItem(TIEN_TO_NHAP + mau.dataset.baiNop, JSON.stringify(ban));
    } else {
      sessionStorage.removeItem(TIEN_TO_NHAP + mau.dataset.baiNop);
    }
  } catch {
    // Trình duyệt chặn lưu trữ thì bản nháp chỉ sống trong lần mở này.
  }
}

function xoaNhap(maBaiNop) {
  try {
    sessionStorage.removeItem(TIEN_TO_NHAP + maBaiNop);
  } catch {
    // Không lưu được thì cũng không có gì để xoá.
  }
}

function veMotBaiNop(bai) {
  const nguoi = bai.user.display_name || bai.user.username;
  const nhap = docNhap(bai.id);
  // Không ô nào được chọn sẵn. Kết quả chấm là chung cuộc, không sửa lại được,
  // nên để sẵn "Đạt" thì một cú bấm nhầm cũng đủ cho qua một bài chưa xem kỹ.
  // Chỉ bản nháp của chính người chấm mới điền lại.
  const cacLuaChon = Object.entries(NHAN_KET_QUA)
    .map(
      ([gia, nhan]) =>
        `<label><input type="radio" name="status" value="${gia}"${nhap?.status === gia ? ' checked' : ''}> ${chu(nhan)}</label>`
    )
    .join('');
  const lanTruoc = bai.previous_review;

  return (
    `<form class="o-cham-bai mau" data-bai-nop="${bai.id}" aria-labelledby="cb-${bai.id}" novalidate>` +
    `<h3 class="cham-bai-project" id="cb-${bai.id}">${chu(bai.project.title)}</h3>` +
    // Level, track, số lần nộp và lần chấm trước chỉ có khi backend đã kèm chúng
    // vào hàng đợi; backend cũ không có thì dòng này bỏ trống chứ không vỡ bảng.
    (bai.project.level && bai.project.track
      ? `<p class="cham-bai-meta">${chu(tenLevel(bai.project.level))} · ${chu(bai.project.track.name)}` +
        (bai.attempt > 1 ? ` · <span class="nhan the-revision">Nộp lại, lần ${so(bai.attempt)}</span>` : '') +
        '</p>'
      : '') +
    `<p class="cham-bai-nguoi">${chu(nguoi)} (${chu(bai.user.username)}) · nộp lúc ${chu(thoiGian(bai.submitted_at))}</p>` +
    `<p class="cham-bai-lien-ket"><a href="${chu(bai.repo_url)}" target="_blank" rel="noreferrer">Mã nguồn${bieuTuong('ngoai')}</a>` +
    (bai.demo_url
      ? `<a href="${chu(bai.demo_url)}" target="_blank" rel="noreferrer">Bản chạy thử${bieuTuong('ngoai')}</a>`
      : '') +
    `<button type="button" class="the-lien-ket" data-mo-project="${chu(bai.project.slug)}">Xem đề bài</button>` +
    '</p>' +
    (bai.note ? `<p class="cham-bai-ghi-chu">${chu(bai.note)}</p>` : '') +
    (lanTruoc
      ? '<div class="cham-bai-lan-truoc">' +
        `<p class="bai-nop-moc">Lần chấm trước · <span class="nhan the-${chu(lanTruoc.status)}">${chu(NHAN_TRANG_THAI[lanTruoc.status])}</span>` +
        (lanTruoc.reviewed_at ? ` · ${chu(thoiGian(lanTruoc.reviewed_at))}` : '') +
        '</p>' +
        (lanTruoc.feedback ? `<p class="bai-nop-nhan-xet">${chu(lanTruoc.feedback)}</p>` : '') +
        '</div>'
      : '') +
    // Ba ô chọn nằm trong một fieldset có legend, để trình đọc màn hình đọc được
    // nhóm này là gì trước khi đọc từng lựa chọn.
    `<fieldset class="cham-bai-chon"><legend>Kết quả chấm</legend>${cacLuaChon}</fieldset>` +
    '<label>Điểm bài nộp, từ 0 đến 100' +
    `<input type="number" name="score" min="0" max="100" step="1" inputmode="numeric" value="${chu(nhap?.score ?? '')}" placeholder="Để trống nếu không chấm điểm">` +
    '</label>' +
    '<label>Nhận xét gửi người nộp' +
    `<textarea name="feedback" rows="2" maxlength="4000">${chu(nhap?.feedback ?? '')}</textarea>` +
    '</label>' +
    '<p class="mau-loi" role="alert"></p>' +
    '<p class="cham-bai-xac-nhan" role="status"></p>' +
    `<button type="submit" class="nut nut-day">${CHU_NUT_LUU}</button>` +
    '</form>'
  );
}

async function nap() {
  const than = $('#bang-cham-bai-than');
  than.innerHTML = '<p class="dang-tai">Đang tải danh sách bài nộp…</p>';

  try {
    const tatCa = await apiQuanTri.baiNopChoCham();
    // Bài của chính người đang chấm không hiện ở đây, vì backend không cho tự
    // chấm bài của mình. Đưa vào danh sách chỉ khiến người chấm bấm rồi nhận lỗi.
    const cuaToi = tatCa.filter((bai) => bai.user.username === phien.nguoiDung.username).length;
    const danhSach = tatCa.filter((bai) => bai.user.username !== phien.nguoiDung.username);

    const cauCuaToi =
      cuaToi > 0
        ? ` Bạn còn ${cuaToi} bài của chính mình đang chờ giảng viên khác chấm.`
        : '';
    const nutTaiLai = '<button type="button" class="the-lien-ket" data-tai-lai>Tải lại danh sách</button>';

    than.innerHTML =
      danhSach.length === 0
        ? `<p class="dang-tai">Không còn bài nộp nào chờ bạn chấm.${cauCuaToi}</p><p class="cham-bai-tai-lai">${nutTaiLai}</p>`
        : `<p class="bang-tom-tat cham-bai-dem"><span>${danhSach.length} bài đang chờ chấm.${cauCuaToi}</span>${nutTaiLai}</p>` +
          danhSach.map(veMotBaiNop).join('');
  } catch (loi) {
    than.innerHTML =
      dongLoi(loi instanceof LoiApi ? loi.message : 'Không tải được danh sách bài nộp.') +
      '<p class="cham-bai-tai-lai"><button type="button" class="nut nut-vien" data-thu-lai>Thử lại</button></p>';
  }
}

/** Đưa biểu mẫu về bước đầu: nút ghi "Lưu kết quả chấm", không còn dòng tóm tắt. */
function veBuocDau(mau) {
  delete mau.dataset.choXacNhan;
  mau.querySelector('.cham-bai-xac-nhan').textContent = '';
  mau.querySelector('button[type="submit"]').textContent = CHU_NUT_LUU;
}

/**
 * Đọc và kiểm tra biểu mẫu. Trả về thân yêu cầu, hoặc null sau khi đã ghi câu
 * lỗi và đưa tiêu điểm vào ô cần sửa.
 */
function docKetQua(mau, oLoi) {
  const duLieu = new FormData(mau);
  const diem = String(duLieu.get('score') || '').trim();

  const ketQua = duLieu.get('status');
  if (!ketQua) {
    oLoi.textContent = 'Chọn một trong ba kết quả trước khi lưu: đạt, cần sửa lại, hoặc chưa đạt.';
    mau.querySelector('[name=status]').focus();
    return null;
  }

  const than = {
    status: ketQua,
    feedback: String(duLieu.get('feedback') || '').trim(),
  };

  // Bài không đạt mà không có nhận xét thì người nộp chỉ thấy một nhãn đỏ,
  // không biết phải sửa gì. Backend cũng từ chối trường hợp này.
  if (than.status !== 'accepted' && than.feedback === '') {
    oLoi.textContent = 'Cần ghi nhận xét khi kết quả là cần sửa lại hoặc chưa đạt.';
    mau.querySelector('[name=feedback]').focus();
    return null;
  }

  if (diem !== '') {
    // Ô nhập kiểu số vẫn nhận "1e2" hay "1.0" và Number() đọc chúng thành 100 và
    // 1, nên điểm phải là đúng một tới ba chữ số, không dạng luỹ thừa hay thập phân.
    if (!/^\d{1,3}$/.test(diem) || Number(diem) > 100) {
      oLoi.textContent = 'Điểm bài nộp phải là số nguyên từ 0 đến 100, hoặc để trống.';
      mau.querySelector('[name=score]').focus();
      return null;
    }
    than.score = Number(diem);
  }
  return than;
}

async function chamMotBai(mau) {
  const oLoi = mau.querySelector('.mau-loi');
  const nut = mau.querySelector('button[type="submit"]');
  oLoi.textContent = '';

  const than = docKetQua(mau, oLoi);
  if (than === null) {
    veBuocDau(mau);
    return;
  }

  // Bước một: tóm tắt lại điều sắp lưu và đổi nút thành "Xác nhận".
  if (mau.dataset.choXacNhan !== 'true') {
    mau.dataset.choXacNhan = 'true';
    mau.querySelector('.cham-bai-xac-nhan').textContent =
      `Sắp lưu: ${NHAN_KET_QUA[than.status]}` +
      (than.score === undefined ? '' : ` · ${than.score} điểm bài nộp`) +
      (than.feedback ? ' · có nhận xét' : ' · không nhận xét');
    nut.textContent = CHU_NUT_XAC_NHAN;
    return;
  }

  nut.disabled = true;
  nut.setAttribute('aria-busy', 'true');
  nut.textContent = 'Đang lưu…';
  try {
    const daCham = await apiQuanTri.chamBai(Number(mau.dataset.baiNop), than);
    const soBadge = daCham.awarded_badges.length;
    thongBao(
      soBadge > 0
        ? `Đã chấm xong. Người nộp nhận thêm ${soBadge} badge.`
        : 'Đã chấm xong bài nộp này.'
    );
    xoaNhap(mau.dataset.baiNop);
    phat(SU_KIEN.TIEN_DO_THAY_DOI);
    // Chỉ gỡ đúng bài vừa chấm khỏi danh sách. Dựng lại cả bảng thì người chấm
    // bị ném về đầu trang và mất phần nhận xét đang gõ dở ở những bài khác.
    boMotBaiNop(mau);
  } catch (loi) {
    nut.disabled = false;
    nut.removeAttribute('aria-busy');
    veBuocDau(mau);
    // Giảng viên khác vừa chấm bài này: nói rõ rồi gỡ thẻ, vì không còn gì để làm.
    if (loi instanceof LoiApi && loi.maTrangThai === 409) {
      oLoi.textContent = 'Bài này vừa được giảng viên khác chấm.';
      nut.disabled = true;
      setTimeout(() => boMotBaiNop(mau), 1500);
      return;
    }
    oLoi.textContent = loi instanceof LoiApi ? loi.message : 'Không lưu được kết quả chấm.';
  }
}

/**
 * Gỡ một bài đã chấm khỏi danh sách và cập nhật lại dòng đếm ở đầu bảng.
 *
 * Bài không biến mất ngay: nó trượt sang phải rồi khép lại, những bài còn lại
 * dồn lên, để người chấm thấy rõ bài nào vừa đi. Lớp da-cham mang hoạt ảnh đó;
 * gỡ khỏi trang khi hoạt ảnh xong, hoặc ngay lập tức nếu không có hoạt ảnh.
 */
function boMotBaiNop(mau) {
  if (!mau.isConnected) return;
  const goHan = () => {
    mau.remove();
    capNhatDongDem();
  };
  mau.classList.add('da-cham');
  // Người dùng giảm chuyển động thì tệp kiểu tắt hoạt ảnh, và animationend sẽ
  // không bao giờ tới; khi đó gỡ ngay.
  if (getComputedStyle(mau).animationName === 'none') {
    goHan();
    return;
  }
  mau.addEventListener('animationend', goHan, { once: true });
}

function capNhatDongDem() {
  const conLai = $('#bang-cham-bai-than').querySelectorAll('.o-cham-bai').length;
  const dongDem = $('#bang-cham-bai-than').querySelector('.cham-bai-dem span');
  if (conLai === 0) {
    $('#bang-cham-bai-than').innerHTML =
      '<p class="dang-tai">Không còn bài nộp nào chờ bạn chấm.</p>' +
      '<p class="cham-bai-tai-lai"><button type="button" class="the-lien-ket" data-tai-lai>Tải lại danh sách</button></p>';
  } else if (dongDem) {
    dongDem.textContent = `${conLai} bài đang chờ chấm.`;
  }
}

/** Mở màn hình chấm bài và tải danh sách bài đang chờ. */
export function moBangChamBai() {
  if (!phien.laGiangVien) return;
  moBang('bang-cham-bai');
  nap();
}

export function khoiTao() {
  const than = $('#bang-cham-bai-than');

  than.addEventListener('submit', (sk) => {
    if (!sk.target.classList.contains('o-cham-bai')) return;
    sk.preventDefault();
    chamMotBai(sk.target);
  });

  than.addEventListener('click', (sk) => {
    if (sk.target.closest('[data-thu-lai], [data-tai-lai]')) {
      nap();
      return;
    }
    // Đề bài mở trong bảng project; đóng bảng đó thì bảng chấm bài quay lại
    // nguyên trạng, xem moBang trong js/giao-dien.js.
    const nutDeBai = sk.target.closest('[data-mo-project]');
    if (nutDeBai) moProject(nutDeBai.dataset.moProject);
  });

  // Enter trong ô điểm không gửi: kết quả chấm là chung cuộc, một phím Enter
  // theo phản xạ không được là cú lưu. Tiêu điểm chuyển sang ô nhận xét.
  than.addEventListener('keydown', (sk) => {
    if (sk.key !== 'Enter' || sk.target.name !== 'score') return;
    sk.preventDefault();
    sk.target.form.querySelector('[name=feedback]').focus();
  });

  // Mỗi lần gõ hay đổi lựa chọn: ghi bản nháp, và bước xác nhận (nếu đang ở đó)
  // trở về bước đầu vì nội dung sắp lưu đã khác.
  for (const loai of ['input', 'change']) {
    than.addEventListener(loai, (sk) => {
      const mau = sk.target.closest('.o-cham-bai');
      if (!mau) return;
      ghiNhap(mau);
      if (mau.dataset.choXacNhan === 'true') veBuocDau(mau);
    });
  }
}
