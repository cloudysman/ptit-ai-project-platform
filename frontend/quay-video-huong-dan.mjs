/* Quay video hướng dẫn cho mục "Ba bước" của trang chủ.

   Video là cảnh quay màn hình thật của giao diện, không có tiếng: một sinh viên
   tìm và mở project "Đổi tên hàng loạt file ảnh", đọc bối cảnh và sản phẩm phải
   nộp, mở gợi ý tầng 1, đăng nhập, nộp đường dẫn mã nguồn; một giảng viên chấm
   "Đạt"; sinh viên mở tài khoản xem điểm tích luỹ, badge, rồi mở project được đề
   xuất tiếp theo. Mỗi cảnh mang một nhãn nhỏ ở góc dưới bên trái, trùng tên ba
   bước trên trang chủ.

   Cách chạy: node quay-video-huong-dan.mjs [địa chỉ gốc] [thư mục ra]
   Địa chỉ gốc mặc định là http://127.0.0.1:8452, thư mục ra mặc định là
   video-huong-dan-ra trong thư mục đang đứng. Kết quả ghi vào thư mục ra:
     video-huong-dan.mp4      H.264, yuv420p, không tiếng, +faststart, dưới 4 MB
     video-huong-dan.webm     VP9, không tiếng, dưới 3 MB
     video-huong-dan.jpg      ảnh chờ 1280x720 dưới 120 kB, lấy lúc bảng project vừa mở
     video-huong-dan-nho.jpg  cùng khung hình, rộng 440, cho ảnh thu nhỏ trong ô
     video-huong-dan.vtt      phụ đề tiếng Việt, mỗi bước một dòng, đặt đè lên nhãn trên hình
     khung/                   ảnh cắt từ bản MP4 ở những thời điểm chính, để soát bằng mắt
   Soát ảnh trong khung/ xong thì chép năm tệp video-huong-dan* vào frontend/anh/.

   Chuẩn bị. Làm lại đủ các bước mỗi lần quay: lượt quay nộp bài và chấm bài thật,
   nên cơ sở dữ liệu của lần trước không dùng lại được. Không bao giờ quay trên
   bản sao cơ sở dữ liệu thật, vì bản đó có tài khoản của người dùng thật. Chạy từ
   thư mục backend, với một tệp cơ sở dữ liệu tạm mới tinh:

     export DATABASE_URL=sqlite:////duong/dan/tam/video.db SECRET_KEY=<chuỗi ngẫu nhiên từ 32 byte>
     .venv/bin/python -m app.seed && .venv/bin/python -m app.tai_khoan_demo tao
     FRONTEND_DIR=../frontend ROOT_PATH="" PORT=8452 .venv/bin/python -m app &

   Playwright không phải phụ thuộc của dự án. Cài nó vào một thư mục riêng
   (npm install playwright, rồi npx playwright install chromium), đứng ở thư mục ấy
   và gọi node với đường dẫn tới tệp này; máy cần có ffmpeg. Quay xong thì dừng
   máy chủ và xoá tệp cơ sở dữ liệu tạm.

   Trên hình chỉ có tài khoản hư cấu: sinh viên "Sinh viên mẫu" do tệp này đăng ký
   qua API ngay trước khi quay, giảng viên "Giảng viên 1", và "Nguyễn Văn Nam" của
   bộ tài khoản trình bày trong hàng đợi chấm bài. Phần người phụ trách của project
   là hồ sơ giảng viên công khai trong dữ liệu mẫu, cũng là hồ sơ ở mục Giảng viên
   của trang chủ. Nó nằm ngay trên mục gợi ý nên có trên hình từ lúc mở gợi ý tới
   lúc nộp bài; nộp xong, bảng dài thêm và được cuộn để phần này ra khỏi hình.

   Giao diện đổi thì sửa phần KỊCH BẢN ở cuối tệp: mọi bộ chọn phần tử và mọi
   khoảng nghỉ nằm ở đó. Cách quay không phụ thuộc giao diện:

   - Hình lấy bằng Page.startScreencast của Chrome DevTools Protocol, ảnh PNG
     không mất nét, thay vì recordVideo của Playwright vốn nén mạnh làm nhoè chữ.
     Chrome chỉ gửi khung khi màn hình đổi, kèm mốc thời gian; mỗi khung được xếp
     vào ô 1/30 giây theo mốc đó, ô trống lấy lại khung gần nhất phía trước. Nhờ
     vậy nhịp của video là nhịp thật của lượt quay, máy chậm cũng không tua nhanh.
   - Con trỏ chuột và nhãn bước là hai phần tử chèn vào trang, đặt ở lớp trên cùng
     (popover) để nổi cả trên hộp đăng nhập vốn là dialog dạng modal. Con trỏ bám
     theo sự kiện chuột thật, nên trạng thái hover của trang cũng là thật.
   - Trong lúc quay, Chromium chạy không giao diện hay treo View Transition của
     bảng project đúng 4 giây: bảng đứng yên nửa chừng với dòng "Đang tải
     project…". Đo 15 lần mở bảng trong lúc quay thì treo khoảng 2 lần, và thử các
     cờ khởi động của Chromium không chữa được, nên đoạn nào bị treo thì bỏ đi và
     quay lại đoạn đó. Hai đoạn có View Transition đều chưa ghi
     gì vào cơ sở dữ liệu nên quay lại bao nhiêu lần cũng được.
   - Video cắt giữa hai ngữ cảnh trình duyệt riêng của sinh viên và giảng viên;
     trang của sinh viên được tải lại ngoài hình trước đoạn cuối, như lúc sinh viên
     quay lại trang sau khi bài đã được chấm. */

import { execFileSync } from 'node:child_process';
import { linkSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

// Playwright được cài ở một thư mục riêng chứ không nằm cạnh tệp này, nên tìm
// gói theo thư mục đang đứng thay vì theo vị trí tệp.
const require = createRequire(join(process.cwd(), 'goi.js'));
const { chromium } = require('playwright');

const GOC = (process.argv[2] ?? 'http://127.0.0.1:8452').replace(/\/$/, '');
const RA = resolve(process.argv[3] ?? 'video-huong-dan-ra');
const THO = join(RA, 'khung-tho');
const CHUOI = join(RA, 'khung-chuoi');
const SOAT = join(RA, 'khung');

const RONG = 1280;
const CAO = 720;
const FPS = 30;
const TOI_DA_MP4 = 4 * 1024 * 1024;
const TOI_DA_WEBM = 3 * 1024 * 1024;
const TOI_DA_ANH_CHO = 120 * 1024;
// Ô xem video hiện ảnh thu nhỏ rộng 220 điểm ảnh; bản 440 đủ cho màn hình dày điểm ảnh gấp đôi.
const RONG_ANH_NHO = 440;
// View Transition bình thường xong trong khoảng 0,6 giây, lần bị treo mất đúng 4 giây.
const NGUONG_TREO_MS = 2000;
// Mỗi lần quay lại chỉ tốn vài giây; mười lần liền đều treo thì gần như chắc có lỗi khác.
const SO_LAN_THU = 10;

// Mật khẩu chung của bộ tài khoản trình bày, xem MAT_KHAU_CHUNG trong app/tai_khoan_demo.py.
const MAT_KHAU = 'matkhau12345';
// Sinh viên "sinhvien" của bộ trình bày đã có sẵn bài chờ chấm cho chính project
// này, nên video dùng một tài khoản mới tinh để thấy đủ trạng thái trước và sau khi nộp.
const SINH_VIEN = { username: 'sinhvienmau', display_name: 'Sinh viên mẫu', email: 'sinhvienmau@example.com' };
const GIANG_VIEN = 'giangvien1';
const SLUG_PROJECT = 'doi-ten-file-anh-hang-loat';
const TU_KHOA = 'ảnh';
// example.com là tên miền dành riêng cho ví dụ, không trỏ tới kho mã của ai.
const DUONG_DAN_BAI = 'https://example.com/sinhvienmau/doi-ten-file-anh';
const NHAN_BUOC = ['1 · Chọn một project', '2 · Làm rồi nộp bài', '3 · Nhận điểm và đi tiếp'];
const KHOA_TOKEN = 'nen-tang-project:token';

const nghi = (ms) => new Promise((xong) => setTimeout(xong, ms));

// Nhịp gõ phím lấy từ một dãy giả ngẫu nhiên có hạt cố định, để mỗi lần quay lại
// ra cùng một nhịp và hai bản video chỉ khác nhau ở chỗ giao diện đổi.
let hat = 20260914;
function ngauNhien() {
  hat = (hat + 0x6d2b79f5) | 0;
  let x = Math.imul(hat ^ (hat >>> 15), 1 | hat);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

const muot = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

/* Chuẩn bị tài khoản qua API. */

async function goiApi(duong, { phuongThuc = 'GET', than, token } = {}) {
  const phanHoi = await fetch(`${GOC}/api/v1${duong}`, {
    method: phuongThuc,
    headers: {
      ...(than ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: than ? JSON.stringify(than) : undefined,
  });
  return { ma: phanHoi.status, du: await phanHoi.json().catch(() => null) };
}

async function dangNhapApi(dinhDanh) {
  const { du } = await goiApi('/auth/login', { phuongThuc: 'POST', than: { identifier: dinhDanh, password: MAT_KHAU } });
  if (!du?.access_token) throw new Error(`Không đăng nhập được ${dinhDanh}. Đã chạy python -m app.tai_khoan_demo tao chưa?`);
  return du.access_token;
}

/** Đăng ký sinh viên của video nếu chưa có, và trả về token của giảng viên chấm bài. */
async function chuanBiTaiKhoan() {
  const dangKy = await goiApi('/auth/register', { phuongThuc: 'POST', than: { ...SINH_VIEN, password: MAT_KHAU } });
  if (dangKy.ma !== 201 && dangKy.ma !== 409) {
    throw new Error(`Không đăng ký được ${SINH_VIEN.username}: ${JSON.stringify(dangKy.du)}`);
  }
  const tokenSinhVien = dangKy.ma === 201 ? dangKy.du.access_token : await dangNhapApi(SINH_VIEN.username);
  // Tài khoản đã nộp bài ở lượt quay trước thì bảng project không còn biểu mẫu
  // nộp bài mới, kịch bản sẽ hỏng giữa chừng. Dừng ngay và nói cách sửa.
  const { du } = await goiApi('/me/submissions', { token: tokenSinhVien });
  if (du.total > 0) {
    throw new Error(`${SINH_VIEN.username} đã có bài nộp từ lượt quay trước. Dựng lại demo.db theo phần chuẩn bị ở đầu tệp.`);
  }
  return dangNhapApi(GIANG_VIEN);
}

/* Lớp phủ trong trang: con trỏ chuột, nhãn bước và phần đo View Transition. Hàm
   này chạy bên trong trình duyệt qua addInitScript, nên không dùng được biến nào
   ở ngoài nó. */

function lopPhu() {
  if (window.top !== window) return;

  // Ghi thời lượng từng View Transition để máy quay biết lần nào bị treo. Chỉ đo,
  // không đổi gì: lời gọi vẫn đi thẳng tới hàm gốc của trình duyệt.
  window.__vdChuyenCanh = [];
  const chuyenCanhGoc = Document.prototype.startViewTransition;
  if (typeof chuyenCanhGoc === 'function') {
    Document.prototype.startViewTransition = function batDauChuyenCanh(...thamSo) {
      const chuyenCanh = chuyenCanhGoc.apply(this, thamSo);
      const batDau = performance.now();
      const ghi = () => window.__vdChuyenCanh.push(performance.now() - batDau);
      chuyenCanh.finished.then(ghi, ghi);
      return chuyenCanh;
    };
  }

  const dung = () => {
    const kieu = document.createElement('style');
    // Màu và phông lấy đúng token của css/style.css: --xanh, --trang, --muc, --chu.
    // Trắng trên #5154F5 đạt 5,33:1.
    kieu.textContent = `
      #vd-con-tro, #vd-nhan-buoc { position: fixed; margin: 0; overflow: visible; pointer-events: none; }
      #vd-con-tro { inset: 0 auto auto 0; width: 20px; height: 26px; padding: 0; border: 0; background: none; transform: translate(-40px, -40px); }
      #vd-con-tro svg { display: block; width: 20px; height: 26px; transform-origin: 2px 2px; transition: transform .12s ease; }
      #vd-con-tro.dang-bam svg { transform: scale(.86); }
      #vd-vong { position: absolute; left: -15px; top: -15px; width: 30px; height: 30px; border: 2px solid #5154F5; border-radius: 50%; opacity: 0; box-sizing: border-box; }
      #vd-nhan-buoc { inset: auto auto 16px 16px; padding: 5px 14px 6px; border: 0; border-radius: 8px; background: #5154F5; color: #FFFFFF; font: 400 18px/1.35 'Times New Roman', Times, 'Liberation Serif', serif; box-shadow: 0 0 0 1px #FFFFFF, 0 4px 14px rgba(21, 26, 40, .18); }
    `;
    const conTro = document.createElement('div');
    conTro.id = 'vd-con-tro';
    conTro.popover = 'manual';
    conTro.innerHTML =
      '<span id="vd-vong"></span>' +
      '<svg viewBox="0 0 20 26" aria-hidden="true"><path d="M2 2v19.5l5.1-4.9 3.4 7.6 3.3-1.5-3.3-7.4h7.1z" fill="#151A28" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const nhan = document.createElement('div');
    nhan.id = 'vd-nhan-buoc';
    nhan.popover = 'manual';
    // Gắn vào thẻ html chứ không vào body: trang gắn inert cho mọi con của body
    // mỗi khi mở bảng trượt, và hai phần tử này không thuộc giao diện.
    document.documentElement.append(kieu, conTro, nhan);

    const vong = conTro.querySelector('#vd-vong');
    addEventListener('mousemove', (sk) => {
      conTro.style.transform = `translate(${sk.clientX}px, ${sk.clientY}px)`;
      if (!conTro.matches(':popover-open')) conTro.showPopover();
    }, { capture: true, passive: true });
    addEventListener('mousedown', () => {
      conTro.classList.add('dang-bam');
      vong.animate(
        [{ opacity: 0.9, transform: 'scale(.35)' }, { opacity: 0, transform: 'scale(1.15)' }],
        { duration: 450, easing: 'cubic-bezier(.2, .7, .3, 1)' },
      );
    }, { capture: true });
    addEventListener('mouseup', () => conTro.classList.remove('dang-bam'), { capture: true });

    // Dialog dạng modal vào lớp trên cùng sau hai phần tử này và che chúng đi.
    // Mở lại popover thì nó xếp lên trên dialog vừa mở.
    const nangLen = () => {
      for (const phanTu of [nhan, conTro]) {
        if (!phanTu.matches(':popover-open')) continue;
        phanTu.hidePopover();
        phanTu.showPopover();
      }
    };
    new MutationObserver((cacDoi) => {
      if (cacDoi.some((doi) => doi.target.tagName === 'DIALOG' && doi.target.open)) nangLen();
    }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['open'] });

    window.__vdNhanBuoc = (chu) => {
      nhan.textContent = chu;
      if (!nhan.matches(':popover-open')) nhan.showPopover();
      nangLen();
      nhan.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
    };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dung, { once: true });
  else dung();
}

/* Máy quay. */

class MayQuay {
  constructor() {
    // Mỗi đoạn là một lần quay liền trên một trang: mốc bắt đầu, số khung, danh
    // sách ô 1/30 giây đã có khung, và các mốc đặt tên ghi trong lúc quay.
    this.cacDoan = [];
    this.dangQuay = null;
    this.cacPhien = new Map();
  }

  moc(ten) {
    this.dangQuay.cacMoc.push({ ten, giay: Date.now() / 1000 - this.dangQuay.batDau });
  }

  /** Các mốc trên trục thời gian của cả video, sau khi mọi đoạn đã quay xong. */
  cacMoc() {
    let truoc = 0;
    return this.cacDoan.flatMap((doan) => {
      const ketQua = doan.cacMoc.map(({ ten, giay }) => ({ ten, giay: truoc + giay }));
      truoc += doan.soKhung / FPS;
      return ketQua;
    });
  }

  async phienCua(trang) {
    if (this.cacPhien.has(trang)) return this.cacPhien.get(trang);
    const phien = await trang.context().newCDPSession(trang);
    phien.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      phien.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
      const doan = this.dangQuay;
      if (doan === null || doan.trang !== trang) return;
      this.nhanKhung(doan, metadata.timestamp, data);
    });
    this.cacPhien.set(trang, phien);
    return phien;
  }

  nhanKhung(doan, giay, data) {
    // Khung chụp lúc t hiện ở mọi ô từ ceil(t * FPS) trở đi. Hai khung rơi vào
    // cùng một ô thì khung sau thắng, vì ô đó phải là hình mới nhất tại mốc của nó.
    const o = Math.max(0, Math.ceil((giay - doan.batDau) * FPS - 1e-6));
    if (doan.cho !== null && doan.cho.o !== o) this.ghiKhung(doan);
    doan.cho = { o, data };
  }

  ghiKhung(doan) {
    const { o, data } = doan.cho;
    writeFileSync(join(THO, `${doan.so}-${o}.png`), Buffer.from(data, 'base64'));
    doan.cacO.push(o);
    doan.cho = null;
  }

  async batDau(trang) {
    const phien = await this.phienCua(trang);
    const so = this.cacDoan.reduce((lon, doan) => Math.max(lon, doan.so + 1), 0);
    this.dangQuay = { so, trang, batDau: Date.now() / 1000, soKhung: 0, cacO: [], cho: null, cacMoc: [] };
    await phien.send('Page.startScreencast', { format: 'png', maxWidth: RONG, maxHeight: CAO, everyNthFrame: 1 });
  }

  async ngung() {
    const doan = this.dangQuay;
    doan.soKhung = Math.round((Date.now() / 1000 - doan.batDau) * FPS);
    await this.cacPhien.get(doan.trang).send('Page.stopScreencast');
    // Khung chụp trước mốc dừng có thể còn trên đường về.
    await nghi(200);
    this.dangQuay = null;
    return doan;
  }

  async dung() {
    const doan = await this.ngung();
    if (doan.cho !== null && doan.cho.o < doan.soKhung) this.ghiKhung(doan);
    if (doan.cacO.length === 0) throw new Error(`Đoạn ${doan.so} không nhận được khung hình nào.`);
    this.cacDoan.push(doan);
  }

  /** Bỏ đoạn đang quay, xoá khung đã ghi của nó. */
  async huy() {
    const doan = await this.ngung();
    for (const o of doan.cacO) rmSync(join(THO, `${doan.so}-${o}.png`), { force: true });
  }

  /** Dựng chuỗi ảnh đều 30 khung mỗi giây bằng liên kết cứng, không chép dữ liệu. */
  dungChuoi() {
    let so = 0;
    for (const doan of this.cacDoan) {
      let j = 0;
      for (let k = 0; k < doan.soKhung; k += 1) {
        while (j + 1 < doan.cacO.length && doan.cacO[j + 1] <= k) j += 1;
        linkSync(join(THO, `${doan.so}-${doan.cacO[j]}.png`), join(CHUOI, `${String(so).padStart(5, '0')}.png`));
        so += 1;
      }
    }
    return so;
  }
}

/* Người thao tác trên một trang: con trỏ đi mượt tới đích rồi mới bấm, gõ phím
   theo nhịp người, cuộn bảng trượt từ từ. */

class NguoiDung {
  constructor(trang) {
    this.trang = trang;
    this.x = RONG / 2;
    this.y = CAO / 2;
    this.chieu = 1;
  }

  async datNgay(x, y) {
    this.x = x;
    this.y = y;
    await this.trang.mouse.move(x, y);
  }

  /** Đi theo một đường cong nhẹ, nhanh dần rồi chậm dần, như tay người kéo chuột. */
  async diToi(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    const quangDuong = Math.hypot(dx, dy);
    if (quangDuong < 2) return;
    const thoiGian = Math.min(850, Math.max(400, 280 + quangDuong * 0.7));
    // Điểm uốn lệch sang một bên, đổi bên sau mỗi lần đi cho đỡ máy móc.
    this.chieu = -this.chieu;
    const cx = this.x + dx / 2 - dy * 0.08 * this.chieu;
    const cy = this.y + dy / 2 + dx * 0.08 * this.chieu;
    const [x0, y0] = [this.x, this.y];
    const batDau = Date.now();
    for (;;) {
      const p = Math.min(1, (Date.now() - batDau) / thoiGian);
      const s = muot(p);
      await this.trang.mouse.move(
        (1 - s) ** 2 * x0 + 2 * (1 - s) * s * cx + s * s * x,
        (1 - s) ** 2 * y0 + 2 * (1 - s) * s * cy + s * s * y,
      );
      if (p >= 1) break;
      await nghi(14);
    }
    this.x = x;
    this.y = y;
  }

  async diToiPhanTu(dinhVi, { ngang = 0.5, doc = 0.5 } = {}) {
    const hop = await dinhVi.boundingBox();
    if (hop === null) throw new Error(`Không thấy phần tử để đưa chuột tới: ${dinhVi}`);
    await this.diToi(hop.x + hop.width * ngang, hop.y + hop.height * doc);
  }

  async bam(dinhVi, viTri) {
    await this.diToiPhanTu(dinhVi, viTri);
    await nghi(180);
    await this.trang.mouse.down();
    await nghi(90);
    await this.trang.mouse.up();
  }

  async go(chuoi, [nhanh, cham]) {
    for (const kyTu of chuoi) {
      await this.trang.keyboard.type(kyTu);
      await nghi(nhanh + ngauNhien() * (cham - nhanh));
    }
  }

  /**
   * Cuộn bảng trượt chứa phần tử cho tới khi mép trên (hoặc mép dưới) của phần tử
   * cách mép trên (hoặc mép dưới) của bảng một khoảng cho trước.
   */
  async cuonToi(dinhVi, { canh = 'tren', le = 120, thoiGian = 900 } = {}) {
    await dinhVi.evaluate(
      (phanTu, { canh, le, thoiGian }) =>
        new Promise((xong) => {
          const bang = phanTu.closest('.bang');
          const hop = phanTu.getBoundingClientRect();
          const khung = bang.getBoundingClientRect();
          const lech = canh === 'tren' ? hop.top - khung.top - le : hop.bottom - khung.bottom + le;
          const tu = bang.scrollTop;
          const toi = Math.max(0, Math.min(bang.scrollHeight - bang.clientHeight, tu + lech));
          const batDau = performance.now();
          const buoc = (bayGio) => {
            const p = Math.min(1, (bayGio - batDau) / thoiGian);
            // Cùng đường cong với muot; hàm này chạy trong trang nên phải viết lại.
            const s = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
            bang.scrollTop = tu + (toi - tu) * s;
            if (p < 1) requestAnimationFrame(buoc);
            else xong();
          };
          requestAnimationFrame(buoc);
        }),
      { canh, le, thoiGian },
    );
  }

  async nhanBuoc(chu) {
    await this.trang.evaluate((c) => window.__vdNhanBuoc(c), chu);
  }

  /** Chờ View Transition vừa gọi chạy xong, trả về true nếu nó bị treo. */
  async chuyenCanhBiTreo() {
    await this.trang.waitForFunction(() => window.__vdChuyenCanh.length > 0, null, { timeout: 10000 });
    return this.trang.evaluate((nguong) => window.__vdChuyenCanh.some((ms) => ms > nguong), NGUONG_TREO_MS);
  }
}

/* Mã hoá. */

function ffmpeg(thamSo) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...thamSo], { stdio: 'inherit' });
}

// Ảnh chụp là RGB đủ dải; video web mặc định là BT.709 dải hẹp. Đổi rõ ràng và
// gắn nhãn màu, nếu không màu xanh chàm của trang lệch đi khi phát.
const LOC_MAU = 'scale=flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p';
const NHAN_MAU = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
const DAU_VAO = ['-framerate', String(FPS), '-i', join(CHUOI, '%05d.png')];

/** Mã hoá với mức nén tăng dần cho tới khi tệp nằm dưới giới hạn dung lượng. */
function maHoaDuoiGioiHan(tep, toiDa, crfDau, crfCuoi, thamSoTheoCrf) {
  for (let crf = crfDau; crf <= crfCuoi; crf += 2) {
    ffmpeg([...DAU_VAO, '-vf', LOC_MAU, ...thamSoTheoCrf(crf), ...NHAN_MAU, '-an', tep]);
    const kichThuoc = statSync(tep).size;
    console.log(`${tep.split('/').pop()}: crf ${crf}, ${(kichThuoc / 1024).toFixed(0)} kB`);
    if (kichThuoc <= toiDa) return;
  }
  throw new Error(`${tep} vẫn vượt ${toiDa} byte ở crf ${crfCuoi}.`);
}

function maHoa(soKhung, cacMoc) {
  const mp4 = join(RA, 'video-huong-dan.mp4');
  const webm = join(RA, 'video-huong-dan.webm');
  // stillimage giảm lọc khử khối, giữ nét chữ; khung khoá mỗi 2 giây để tua nhanh.
  maHoaDuoiGioiHan(mp4, TOI_DA_MP4, 26, 34, (crf) => [
    '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'stillimage', '-crf', String(crf),
    '-g', String(FPS * 2), '-movflags', '+faststart',
  ]);
  maHoaDuoiGioiHan(webm, TOI_DA_WEBM, 34, 44, (crf) => [
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-deadline', 'good', '-cpu-used', '1',
    '-row-mt', '1', '-g', String(FPS * 2),
  ]);

  // Ảnh chờ lấy thẳng từ khung PNG gốc nên nét hơn khung giải mã từ video.
  const giayAnhCho = cacMoc.find((moc) => moc.ten === 'bang-project').giay + 1;
  const khungAnhCho = join(CHUOI, `${String(Math.min(soKhung - 1, Math.round(giayAnhCho * FPS))).padStart(5, '0')}.png`);
  const jpg = join(RA, 'video-huong-dan.jpg');
  for (let chatLuong = 3; chatLuong <= 12; chatLuong += 1) {
    ffmpeg(['-i', khungAnhCho, '-vf', 'format=yuvj420p', '-q:v', String(chatLuong), jpg]);
    if (statSync(jpg).size <= TOI_DA_ANH_CHO) break;
  }
  console.log(`video-huong-dan.jpg: ${(statSync(jpg).size / 1024).toFixed(0)} kB`);
  const nho = join(RA, 'video-huong-dan-nho.jpg');
  ffmpeg(['-i', khungAnhCho, '-vf', `scale=${RONG_ANH_NHO}:-2:flags=lanczos,format=yuvj420p`, '-q:v', '4', nho]);
  console.log(`video-huong-dan-nho.jpg: ${(statSync(nho).size / 1024).toFixed(0)} kB`);

  // Ảnh soát cắt từ bản MP4 đã nén, vì chữ phải đọc được ở bản người xem nhận.
  // Lùi thêm một chút sau mỗi mốc, để nhãn bước vừa đổi đã hiện rõ hẳn.
  rmSync(SOAT, { recursive: true, force: true });
  mkdirSync(SOAT);
  cacMoc.forEach(({ ten, giay }, chiSo) => {
    const tai = Math.min(soKhung / FPS - 0.1, giay + 0.35).toFixed(3);
    ffmpeg(['-ss', tai, '-i', mp4, '-frames:v', '1', join(SOAT, `${String(chiSo + 1).padStart(2, '0')}-${ten}.png`)]);
  });
}

function ghiPhuDe(cacMoc, tongGiay) {
  const moc = (giay) => {
    const ms = Math.round(giay * 1000);
    const hai = (so, dai = 2) => String(so).padStart(dai, '0');
    return `${hai(Math.floor(ms / 3600000))}:${hai(Math.floor(ms / 60000) % 60)}:${hai(Math.floor(ms / 1000) % 60)}.${hai(ms % 1000, 3)}`;
  };
  // Bước 1 bắt đầu cùng khung hình đầu tiên; mốc ghi được trễ vài mili giây sau lệnh quay.
  const batDau = NHAN_BUOC.map((_, chiSo) => (chiSo === 0 ? 0 : cacMoc.find((m) => m.ten === `buoc-${chiSo + 1}`).giay));
  // Câu phụ đề đặt ở góc dưới bên trái, đè lên nhãn bước in trên hình: đặt mặc định
  // ở giữa phía dưới thì câu che dòng thông báo của trang hiện đúng chỗ ấy.
  const cacDong = NHAN_BUOC.map(
    (nhan, chiSo) => `${moc(batDau[chiSo])} --> ${moc(batDau[chiSo + 1] ?? tongGiay)} line:-1 position:1% align:start\n${nhan}\n`,
  );
  writeFileSync(join(RA, 'video-huong-dan.vtt'), `WEBVTT\n\n${cacDong.join('\n')}`);
}

/* KỊCH BẢN. */

async function moTrang(trinhDuyet, chuanBi) {
  const nguCanh = await trinhDuyet.newContext({
    viewport: { width: RONG, height: CAO },
    deviceScaleFactor: 1,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  });
  await nguCanh.addInitScript(lopPhu);
  if (chuanBi) await nguCanh.addInitScript(chuanBi.ham, chuanBi.thamSo);
  const trang = await nguCanh.newPage();
  trang.on('pageerror', (loi) => console.error('Lỗi trang:', loi.message));
  return trang;
}

async function taiTrang(trang) {
  await trang.goto(`${GOC}/`, { waitUntil: 'networkidle' });
  await trang.evaluate(() => document.fonts.ready);
  // Chờ khung video phần mở đầu chạy và các dòng số liệu hiện hẳn.
  await nghi(1500);
}

/**
 * Quay một đoạn có View Transition, quay lại nếu View Transition bị treo.
 *
 * Hàm canh chạy các thao tác tới ngay sau lúc gọi View Transition; đoạn không
 * treo thì vẫn đang quay khi hàm trả về, để phần sau nối liền vào cùng một đoạn.
 */
async function quayDoanCoChuyenCanh(may, nguoi, { chuanBi, canh }) {
  for (let lan = 1; lan <= SO_LAN_THU; lan += 1) {
    await chuanBi();
    await may.batDau(nguoi.trang);
    await canh();
    if (!(await nguoi.chuyenCanhBiTreo())) return;
    console.log(`View Transition bị treo ở lần quay ${lan}, quay lại đoạn này.`);
    await may.huy();
  }
  throw new Error(`View Transition bị treo cả ${SO_LAN_THU} lần quay.`);
}

async function quay() {
  const tokenGiangVien = await chuanBiTaiKhoan();
  const project = (await goiApi(`/projects/${SLUG_PROJECT}`)).du;
  if (!project?.title) throw new Error(`Không đọc được project ${SLUG_PROJECT} từ ${GOC}.`);

  rmSync(THO, { recursive: true, force: true });
  rmSync(CHUOI, { recursive: true, force: true });
  mkdirSync(THO, { recursive: true });
  mkdirSync(CHUOI);

  const trinhDuyet = await chromium.launch();
  const may = new MayQuay();

  const trangSv = await moTrang(trinhDuyet);
  const sv = new NguoiDung(trangSv);

  /* Bước 1: tìm, mở project, đọc bối cảnh và sản phẩm phải nộp, mở gợi ý tầng 1. */
  await quayDoanCoChuyenCanh(may, sv, {
    chuanBi: async () => {
      await taiTrang(trangSv);
      await sv.nhanBuoc(NHAN_BUOC[0]);
      // Chỗ trống dưới tuyến level, không chạm vào điều khiển nào.
      await sv.datNgay(960, 600);
    },
    canh: async () => {
      may.moc('buoc-1');
      await nghi(1000);
      await sv.bam(trangSv.locator('#tim-o'), { ngang: 0.3 });
      await nghi(300);
      await sv.go(TU_KHOA, [150, 230]);
      const dongTim = trangSv.locator('#hop-tim-ds .hop-tim-muc', { hasText: project.title }).first();
      await dongTim.waitFor();
      await nghi(250);
      may.moc('tim');
      await nghi(600);
      await sv.bam(dongTim, { ngang: 0.3 });
      await trangSv.locator('#bang-project-than .bang-ten').waitFor();
      may.moc('bang-project');
    },
  });
  await nghi(1300);
  await sv.diToi(1010, 430);
  await sv.cuonToi(trangSv.locator('#bang-project-than .bang-danh-sach').first(), { canh: 'duoi', le: 28, thoiGian: 700 });
  may.moc('san-pham');
  await nghi(1500);
  const nutGoiY = trangSv.locator('#nut-goi-y');
  await sv.cuonToi(nutGoiY, { canh: 'duoi', le: 160, thoiGian: 900 });
  await nghi(200);
  await sv.bam(nutGoiY, { ngang: 0.4 });
  await trangSv.locator('#o-goi-y .goi-y-dong').first().waitFor();
  await nghi(300);
  may.moc('goi-y');
  await nghi(1400);

  /* Bước 2: đăng nhập ngay trong bảng project, dán đường dẫn, nộp bài. */
  await sv.nhanBuoc(NHAN_BUOC[1]);
  may.moc('buoc-2');
  const nutDangNhap = trangSv.locator('#khu-bai-nop [data-can-dang-nhap]');
  await sv.cuonToi(nutDangNhap, { canh: 'duoi', le: 60, thoiGian: 600 });
  await nghi(200);
  await sv.bam(nutDangNhap, { ngang: 0.4 });
  await trangSv.locator('#dn-dinh-danh').waitFor({ state: 'visible' });
  await nghi(600);
  await sv.bam(trangSv.locator('#dn-dinh-danh'), { ngang: 0.15 });
  await sv.go(SINH_VIEN.username, [60, 120]);
  await nghi(250);
  await sv.bam(trangSv.locator('#dn-mat-khau'), { ngang: 0.15 });
  await sv.go(MAT_KHAU, [50, 95]);
  may.moc('dang-nhap');
  await nghi(350);
  await sv.bam(trangSv.locator('#mau-dang-nhap button[type="submit"]'), { ngang: 0.4 });
  await trangSv.locator('#hop-dang-nhap').waitFor({ state: 'hidden' });
  await trangSv.locator('#mau-nop-bai').waitFor();
  await nghi(700);
  // Đưa mục gợi ý lên sát mép trên để biểu mẫu nộp bài hiện trọn; bảng chưa đủ
  // dài nên thường dừng ở cuối bảng.
  await sv.cuonToi(trangSv.locator('#o-goi-y'), { canh: 'tren', le: 56, thoiGian: 900 });
  await nghi(200);
  const oDuongDan = trangSv.locator('#mau-nop-bai input[name="repo_url"]');
  await sv.bam(oDuongDan, { ngang: 0.2 });
  await sv.go(DUONG_DAN_BAI, [35, 70]);
  await nghi(400);
  may.moc('go-duong-dan');
  await sv.bam(trangSv.locator('#mau-nop-bai button[type="submit"]'), { ngang: 0.4 });
  await trangSv.locator('#khu-bai-nop .o-bai-nop .the-pending').waitFor();
  await nghi(300);
  // Khối trạng thái vừa thêm làm bảng dài ra, đủ để đẩy phần người phụ trách lên
  // khỏi mép trên và để khối "Chờ chấm" đứng giữa hình.
  await sv.cuonToi(trangSv.locator('#khu-bai-nop'), { canh: 'tren', le: 150, thoiGian: 700 });
  await sv.diToi(1180, 330);
  may.moc('cho-cham');
  await nghi(1500);
  await may.dung();

  /* Bước 3: giảng viên chấm Đạt, sinh viên xem điểm tích luỹ, badge, project đề xuất. */
  // Giảng viên đã đăng nhập sẵn ngoài hình: token nằm trong sessionStorage đúng
  // như sau khi đăng nhập không tick ô ghi nhớ.
  const trangGv = await moTrang(trinhDuyet, {
    ham: ([khoa, token]) => sessionStorage.setItem(khoa, token),
    thamSo: [KHOA_TOKEN, tokenGiangVien],
  });
  const gv = new NguoiDung(trangGv);
  await taiTrang(trangGv);
  await gv.nhanBuoc(NHAN_BUOC[2]);
  await gv.datNgay(960, 600);
  await may.batDau(trangGv);
  may.moc('buoc-3');
  await nghi(600);
  await gv.bam(trangGv.locator('#khu-tai-khoan [data-mo-cham-bai]'), { ngang: 0.5 });
  const baiMoi = trangGv.locator('#bang-cham-bai-than .o-cham-bai', { hasText: SINH_VIEN.display_name });
  await baiMoi.waitFor();
  await nghi(900);
  // Cuộn xong, chỗ này là khoảng trống bên phải hàng ba kết quả chấm: con trỏ không
  // dừng trên một kết quả nào trước khi bấm "Đạt".
  await gv.diToi(1180, 420);
  await gv.cuonToi(baiMoi, { canh: 'tren', le: 60, thoiGian: 1100 });
  await nghi(300);
  may.moc('cham-bai');
  await nghi(400);
  await gv.bam(baiMoi.locator('label:has(input[value="accepted"])'), { ngang: 0.3 });
  await nghi(300);
  await gv.bam(baiMoi.locator('input[name="score"]'), { ngang: 0.2 });
  await gv.go('90', [150, 220]);
  await nghi(400);
  await gv.bam(baiMoi.locator('button[type="submit"]'), { ngang: 0.4 });
  await trangGv.locator('#thong-bao .thong-bao-dong').waitFor();
  // Bài vừa chấm trượt đi và bài bên dưới dồn lên đúng chỗ con trỏ; đưa con trỏ ra
  // chỗ trống để không trông như đang bấm tiếp vào bài của người khác.
  await gv.diToi(1180, 300);
  await nghi(200);
  may.moc('da-cham');
  await nghi(1100);
  await may.dung();
  // Trang giảng viên chỉ mở trong đúng đoạn của nó. Để nó chạy tiếp thì trong lúc
  // quay đoạn cuối có thêm một trang phát video, và khi đo, video phát ở trang khác
  // cũng làm View Transition của trang đang quay bị treo.
  await trangGv.context().close();

  await quayDoanCoChuyenCanh(may, sv, {
    chuanBi: async () => {
      await taiTrang(trangSv);
      await sv.nhanBuoc(NHAN_BUOC[2]);
      await sv.datNgay(960, 600);
    },
    canh: async () => {
      await nghi(700);
      await sv.bam(trangSv.locator('#khu-tai-khoan [data-mo-tai-khoan]'), { ngang: 0.5 });
      await trangSv.locator('#bang-tai-khoan-than .so-nho').waitFor();
      await nghi(400);
      may.moc('tai-khoan');
      await nghi(1000);
      await sv.diToi(1010, 460);
      await sv.cuonToi(trangSv.locator('#bang-tai-khoan-than .badge-luoi'), { canh: 'tren', le: 150, thoiGian: 1000 });
      await nghi(300);
      may.moc('badge');
      await nghi(1000);
      const deXuat = trangSv.locator('#bang-tai-khoan-than .de-xuat-ten').first();
      await sv.cuonToi(deXuat, { canh: 'tren', le: 230, thoiGian: 900 });
      await nghi(300);
      await sv.bam(deXuat, { ngang: 0.3 });
    },
  });
  await trangSv.locator('#bang-project.dang-mo #bang-project-than .bang-ten').waitFor();
  await nghi(300);
  may.moc('di-tiep');
  await nghi(1500);
  await may.dung();

  await trinhDuyet.close();

  const soKhung = may.dungChuoi();
  const tongGiay = soKhung / FPS;
  const cacMoc = may.cacMoc();
  console.log(`${soKhung} khung, ${tongGiay.toFixed(2)} giây`);
  for (const { ten, giay } of cacMoc) console.log(`  ${giay.toFixed(2).padStart(6)}  ${ten}`);
  ghiPhuDe(cacMoc, tongGiay);
  maHoa(soKhung, cacMoc);

  rmSync(THO, { recursive: true, force: true });
  rmSync(CHUOI, { recursive: true, force: true });
}

await quay();
