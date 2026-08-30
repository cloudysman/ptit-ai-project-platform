/* Màn hình chấm bài, chỉ tài khoản giảng viên mới mở được.

   Backend đã chặn ở phía máy chủ: mọi lệnh gọi ở đây đều trả về lỗi 403 nếu
   người gọi không phải giảng viên, và cũng trả về 403 nếu giảng viên định chấm
   chính bài của mình. Việc giấu nút trên giao diện chỉ để đỡ rối mắt, không
   phải là lớp bảo vệ. */

import { LoiApi, apiQuanTri, phien } from './api.js';
import { $, chu, moBang, thoiGian, thongBao } from './giao-dien.js';
import { SU_KIEN, phat } from './su-kien.js';

const NHAN_KET_QUA = {
  accepted: 'Đạt',
  revision: 'Cần sửa lại',
  rejected: 'Chưa đạt',
};

function veMotBaiNop(bai) {
  const nguoi = bai.user.display_name || bai.user.username;
  // Không ô nào được chọn sẵn. Kết quả chấm là chung cuộc, không sửa lại được,
  // nên để sẵn "Đạt" thì một cú bấm nhầm cũng đủ cho qua một bài chưa xem kỹ.
  const cacLuaChon = Object.entries(NHAN_KET_QUA)
    .map(([gia, nhan]) => `<label><input type="radio" name="status" value="${gia}"> ${chu(nhan)}</label>`)
    .join('');

  return (
    `<form class="o-cham-bai mau" data-bai-nop="${bai.id}" novalidate>` +
    `<p class="cham-bai-project">${chu(bai.project.title)}</p>` +
    `<p class="cham-bai-nguoi">${chu(nguoi)} · nộp lúc ${chu(thoiGian(bai.submitted_at))}</p>` +
    `<p class="cham-bai-lien-ket"><a href="${chu(bai.repo_url)}" target="_blank" rel="noreferrer">Mã nguồn</a>` +
    (bai.demo_url
      ? ` · <a href="${chu(bai.demo_url)}" target="_blank" rel="noreferrer">Bản chạy thử</a>`
      : '') +
    '</p>' +
    (bai.note ? `<p class="cham-bai-ghi-chu">${chu(bai.note)}</p>` : '') +
    `<div class="cham-bai-chon">${cacLuaChon}</div>` +
    '<label>Điểm bài nộp, từ 0 đến 100' +
    '<input type="number" name="score" min="0" max="100" step="1" placeholder="Để trống nếu không chấm điểm">' +
    '</label>' +
    `<p class="mau-chu-dan">Điểm này cho người nộp biết bài làm tốt tới đâu. Số điểm tích luỹ cộng vào tài khoản là ${bai.project.reward_points} điểm, cố định theo project chứ không phụ thuộc điểm bài nộp.</p>` +
    '<label>Nhận xét gửi người nộp' +
    '<textarea name="feedback" rows="2" maxlength="4000"></textarea>' +
    '</label>' +
    '<p class="mau-loi" role="alert"></p>' +
    '<button type="submit" class="nut nut-day">Lưu kết quả chấm</button>' +
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
        ? ` Bạn còn ${cuaToi} bài của chính mình đang chờ chấm, những bài đó phải do giảng viên khác chấm.`
        : '';

    than.innerHTML =
      danhSach.length === 0
        ? `<p class="dang-tai">Không còn bài nộp nào chờ bạn chấm.${cauCuaToi}</p>`
        : `<p class="bang-tom-tat">${danhSach.length} bài đang chờ chấm, bài nộp sớm nhất xếp trước.${cauCuaToi}</p>` +
          danhSach.map(veMotBaiNop).join('');
  } catch (loi) {
    than.innerHTML = `<p class="dang-tai">${chu(loi instanceof LoiApi ? loi.message : 'Không tải được danh sách bài nộp.')}</p>`;
  }
}

async function chamMotBai(mau) {
  const oLoi = mau.querySelector('.mau-loi');
  const nut = mau.querySelector('button[type="submit"]');
  const duLieu = new FormData(mau);
  const diem = String(duLieu.get('score') || '').trim();
  oLoi.textContent = '';

  const ketQua = duLieu.get('status');
  if (!ketQua) {
    oLoi.textContent = 'Chọn một trong ba kết quả trước khi lưu: đạt, cần sửa lại, hoặc chưa đạt.';
    return;
  }

  const than = {
    status: ketQua,
    feedback: String(duLieu.get('feedback') || '').trim(),
  };

  if (diem !== '') {
    const so = Number(diem);
    // Ô nhập kiểu số vẫn cho gõ chữ và số ngoài khoảng ở một vài trình duyệt,
    // nên phải tự kiểm tra chứ không dựa hẳn vào thuộc tính min và max.
    if (!Number.isInteger(so) || so < 0 || so > 100) {
      oLoi.textContent = 'Điểm bài nộp phải là số nguyên từ 0 đến 100, hoặc để trống.';
      return;
    }
    than.score = so;
  }

  nut.disabled = true;
  oLoi.textContent = '';
  try {
    const daCham = await apiQuanTri.chamBai(Number(mau.dataset.baiNop), than);
    const soBadge = daCham.awarded_badges.length;
    thongBao(
      soBadge > 0
        ? `Đã chấm xong. Người nộp nhận thêm ${soBadge} badge.`
        : 'Đã chấm xong bài nộp này.'
    );
    phat(SU_KIEN.TIEN_DO_THAY_DOI);
    // Chỉ gỡ đúng bài vừa chấm khỏi danh sách. Dựng lại cả bảng thì người chấm
    // bị ném về đầu trang và mất phần nhận xét đang gõ dở ở những bài khác.
    boMotBaiNop(mau);
  } catch (loi) {
    nut.disabled = false;
    oLoi.textContent = loi instanceof LoiApi ? loi.message : 'Không lưu được kết quả chấm.';
  }
}

/** Gỡ một bài đã chấm khỏi danh sách và cập nhật lại dòng đếm ở đầu bảng. */
function boMotBaiNop(mau) {
  mau.remove();
  const conLai = $('#bang-cham-bai-than').querySelectorAll('.o-cham-bai').length;
  const dongDem = $('#bang-cham-bai-than').querySelector('.bang-tom-tat');
  if (conLai === 0) {
    $('#bang-cham-bai-than').innerHTML = '<p class="dang-tai">Không còn bài nộp nào chờ bạn chấm.</p>';
  } else if (dongDem) {
    dongDem.textContent = `${conLai} bài đang chờ chấm, bài nộp sớm nhất xếp trước.`;
  }
}

/** Mở màn hình chấm bài và tải danh sách bài đang chờ. */
export function moBangChamBai() {
  if (!phien.laGiangVien) return;
  moBang('bang-cham-bai');
  nap();
}

export function khoiTao() {
  $('#bang-cham-bai-than').addEventListener('submit', (sk) => {
    if (!sk.target.classList.contains('o-cham-bai')) return;
    sk.preventDefault();
    chamMotBai(sk.target);
  });
}
