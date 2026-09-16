/* Lớp gọi API và phiên đăng nhập.
   Mọi lệnh gọi backend trong trang đều đi qua file này, nhờ vậy phần xử lý
   token, phần dựng chuỗi truy vấn và phần đọc câu báo lỗi chỉ viết một lần. */

import { duongDan } from './goc.js';

// Giao diện và API cùng một origin vì backend phục vụ luôn trang này, nên đổi
// cổng cũng không phải sửa mã nguồn. Gốc lấy từ goc.js để bản chạy dưới một
// tiền tố đường dẫn gọi đúng địa chỉ API của chính nó.
const GOC_API = duongDan('api/v1');

// Khoá lưu token. Đặt riêng cho nền tảng để không đụng dữ liệu của trang khác
// trên cùng một origin, chuyện rất dễ xảy ra khi nhiều project cùng chạy thử ở
// địa chỉ 127.0.0.1 với cùng một cổng.
const KHOA_TOKEN = 'nen-tang-project:token';

/* Token nằm ở một trong hai kho, tuỳ người dùng có tick ô ghi nhớ hay không.

   sessionStorage sống trong đúng một thẻ trình duyệt và mất khi đóng thẻ. Đây
   là kho mặc định, vì phần lớn người học mở nền tảng trên máy phòng thực hành
   hoặc máy dùng chung, và một phiên còn nguyên sau khi họ đứng dậy là chuyện
   không nên có.

   localStorage sống qua cả những lần tắt trình duyệt, chỉ dùng khi người dùng
   chủ động tick ô ghi nhớ trên máy này. */
const khoLuu = () => {
  try {
    return { phien: window.sessionStorage, lau: window.localStorage };
  } catch {
    // Trình duyệt chặn hẳn phần lưu trữ, ví dụ khi chặn cookie của bên thứ ba.
    return { phien: null, lau: null };
  }
};

/** Đọc token đã lưu. Kho của thẻ được ưu tiên, vì nó mới hơn kho lâu dài. */
function docTokenDaLuu() {
  const kho = khoLuu();
  try {
    return kho.phien?.getItem(KHOA_TOKEN) ?? kho.lau?.getItem(KHOA_TOKEN) ?? null;
  } catch {
    return null;
  }
}

// Được app.js gán sau khi trang khởi động, để lớp gọi API báo ra ngoài mỗi khi
// phiên bị backend từ chối. Không nhập khẩu thẳng phần tài khoản vì phần đó lại
// gọi ngược vào đây.
let baoPhienHong = () => {};

export function khiPhienHong(xuLy) {
  baoPhienHong = xuLy;
}

/** Lỗi do backend trả về, mang theo mã trạng thái và câu báo lỗi tiếng Việt. */
export class LoiApi extends Error {
  constructor(thongDiep, maTrangThai) {
    super(thongDiep);
    this.name = 'LoiApi';
    this.maTrangThai = maTrangThai;
  }
}

/** Phiên đăng nhập hiện tại. */
export const phien = {
  token: null,
  nguoiDung: null,
  // Phiên này có được giữ lại sau khi đóng trình duyệt hay không.
  ghiNho: false,

  get daDangNhap() {
    return this.nguoiDung !== null;
  },

  get laGiangVien() {
    return this.nguoiDung !== null && this.nguoiDung.is_mentor === true;
  },

  /**
   * Ghi nhận một phiên vừa mở.
   *
   * Tham số ghiNho quyết định token nằm ở kho nào. Dù nằm ở kho nào thì kho còn
   * lại cũng được dọn sạch, để không bao giờ có hai token của hai lần đăng nhập
   * khác nhau cùng tồn tại rồi tranh nhau lúc mở trang.
   */
  dat(token, nguoiDung, ghiNho = false) {
    this.token = token;
    this.nguoiDung = nguoiDung;
    this.ghiNho = ghiNho;

    const kho = khoLuu();
    const noiGhi = ghiNho ? kho.lau : kho.phien;
    const noiXoa = ghiNho ? kho.phien : kho.lau;
    try {
      noiXoa?.removeItem(KHOA_TOKEN);
      noiGhi?.setItem(KHOA_TOKEN, token);
    } catch {
      // Trình duyệt chặn lưu trữ thì phiên chỉ sống trong lần mở trang này.
    }
  },

  xoa() {
    this.token = null;
    this.nguoiDung = null;
    this.ghiNho = false;

    const kho = khoLuu();
    try {
      kho.phien?.removeItem(KHOA_TOKEN);
      kho.lau?.removeItem(KHOA_TOKEN);
    } catch {
      // Không lưu được thì cũng không có gì để xoá.
    }
  },
};

/**
 * Theo dõi token để các thẻ đang mở cùng nhìn một phiên.
 *
 * Sự kiện storage chỉ bắn sang những thẻ khác, không bắn tại thẻ vừa gây ra thay
 * đổi. Nhờ đó đăng xuất ở một thẻ là mọi thẻ còn lại cũng thoát theo, và đăng
 * nhập bằng tài khoản khác ở một thẻ thì các thẻ kia không còn hiện tên người cũ.
 *
 * Sự kiện này chỉ bắn cho localStorage, tức chỉ cho phiên có tick ô ghi nhớ.
 * Phiên không ghi nhớ nằm trong sessionStorage, vốn riêng của từng thẻ, nên nó
 * không đồng bộ sang thẻ khác. Đó là điều đúng: một phiên chỉ sống trong một
 * thẻ thì không có lý do gì lan sang thẻ bên cạnh.
 */
export function theoDoiPhienGiuaCacThe(khiDoi) {
  window.addEventListener('storage', (sk) => {
    if (sk.key !== KHOA_TOKEN) return;
    const tokenMoi = sk.newValue;
    if (tokenMoi === phien.token) return;

    phien.token = tokenMoi;
    phien.nguoiDung = null;
    khiDoi(tokenMoi);
  });
}

/** Dựng chuỗi truy vấn. Giá trị là mảng thì lặp lại tên tham số, đúng cách backend đọc. */
function chuoiTruyVan(thamSo) {
  const chuoi = new URLSearchParams();
  for (const [ten, gia] of Object.entries(thamSo)) {
    if (gia === null || gia === undefined || gia === '') continue;
    if (Array.isArray(gia)) {
      gia.forEach((mot) => chuoi.append(ten, mot));
    } else {
      chuoi.append(ten, gia);
    }
  }
  const ket = chuoi.toString();
  return ket ? `?${ket}` : '';
}

/** Đọc câu báo lỗi từ phản hồi. Backend cam kết trường detail luôn là một câu. */
// Câu nói thay cho mã lỗi, dùng khi máy chủ không kèm theo lời giải thích nào.
// Con số 500 hay 502 không giúp gì cho người đang dùng trang, nên mỗi nhóm mã
// được đổi thành một câu nói rõ chuyện gì vừa xảy ra và nên làm gì tiếp.
const CAU_THAY_MA_LOI = {
  400: 'Yêu cầu gửi lên không hợp lệ. Kiểm tra lại thông tin vừa nhập rồi thử lại.',
  401: 'Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi tiếp tục.',
  403: 'Tài khoản của bạn không có quyền làm việc này.',
  404: 'Không tìm thấy nội dung này. Có thể nó vừa bị đổi hoặc gỡ đi.',
  409: 'Thao tác này không thực hiện được vì trạng thái hiện tại đã khác.',
  413: 'Tệp hoặc nội dung gửi lên quá lớn.',
  422: 'Dữ liệu vừa nhập chưa đúng khuôn. Kiểm tra lại các ô rồi thử lại.',
  429: 'Bạn thao tác hơi nhanh. Chờ một chút rồi thử lại.',
};

async function docLoi(phanHoi) {
  try {
    const than = await phanHoi.json();
    if (typeof than.detail === 'string') return than.detail;
  } catch {
    // Phản hồi không phải JSON, ví dụ lỗi của máy chủ web.
  }
  if (CAU_THAY_MA_LOI[phanHoi.status]) return CAU_THAY_MA_LOI[phanHoi.status];
  if (phanHoi.status >= 500) {
    return 'Máy chủ đang gặp sự cố nên chưa xử lý được yêu cầu này. Thử lại sau ít phút.';
  }
  return 'Yêu cầu không thực hiện được. Tải lại trang rồi thử lại.';
}

/**
 * Gọi một endpoint của backend.
 *
 * Ném LoiApi khi backend trả về mã lỗi, nên nơi gọi chỉ cần bắt một loại lỗi
 * duy nhất rồi hiển thị thẳng phần thông điệp cho người dùng.
 */
export async function goi(duongDan, tuyChon = {}) {
  const { phuongThuc = 'GET', than = null, thamSo = {}, canToken = false } = tuyChon;

  const tieuDe = {};
  if (than !== null) tieuDe['Content-Type'] = 'application/json';
  if (canToken && phien.token) tieuDe.Authorization = `Bearer ${phien.token}`;

  let phanHoi;
  try {
    phanHoi = await fetch(GOC_API + duongDan + chuoiTruyVan(thamSo), {
      method: phuongThuc,
      headers: tieuDe,
      body: than === null ? undefined : JSON.stringify(than),
    });
  } catch {
    throw new LoiApi('Không kết nối được tới máy chủ. Kiểm tra đường truyền rồi tải lại trang.', 0);
  }

  if (phanHoi.status === 401 && canToken && phien.daDangNhap) {
    // Token hết hạn hoặc bị thu hồi. Bỏ phiên rồi báo ra ngoài, nếu không giao
    // diện vẫn hiện tên người dùng trong khi mọi lệnh gọi tiếp theo đều hỏng.
    // Câu báo là câu của giao diện, không phải câu kỹ thuật nói về token.
    phien.xoa();
    baoPhienHong();
    throw new LoiApi(CAU_THAY_MA_LOI[401], 401);
  }
  if (!phanHoi.ok) {
    throw new LoiApi(await docLoi(phanHoi), phanHoi.status);
  }
  return phanHoi.status === 204 ? null : phanHoi.json();
}

/**
 * Đọc hết một danh sách có phân trang.
 *
 * Backend giới hạn 100 bản ghi mỗi trang. Vài màn hình cần cả danh sách cùng
 * lúc, ví dụ kho project xếp theo level, nên hàm này gọi tiếp cho tới trang
 * cuối rồi ghép lại. Với kho vài trăm project thì chỉ tốn hai, ba lượt gọi.
 */
async function goiHetTrang(duongDan, tuyChon = {}) {
  const kichThuoc = 100;
  const tatCa = [];
  let trang = 1;
  let tongTrang = 1;

  do {
    const ket = await goi(duongDan, {
      ...tuyChon,
      thamSo: { ...(tuyChon.thamSo || {}), page: trang, page_size: kichThuoc },
    });
    tatCa.push(...ket.items);
    tongTrang = ket.pages;
    trang += 1;
  } while (trang <= tongTrang);

  return tatCa;
}

/**
 * Gửi một tệp lên backend.
 *
 * Trình duyệt tự đặt tiêu đề Content-Type kèm chuỗi ngăn cách khi thân yêu cầu
 * là FormData, nên ở đây không được tự đặt tiêu đề đó.
 */
async function guiTep(duongDan, tep) {
  const than = new FormData();
  than.append('file', tep);

  const tieuDe = {};
  if (phien.token) tieuDe.Authorization = `Bearer ${phien.token}`;

  let phanHoi;
  try {
    phanHoi = await fetch(GOC_API + duongDan, { method: 'PUT', headers: tieuDe, body: than });
  } catch {
    throw new LoiApi('Không kết nối được tới máy chủ. Kiểm tra đường truyền rồi tải lại trang.', 0);
  }
  // Phiên hết hạn giữa chừng cũng phải được xử lý giống hệt mọi lệnh gọi khác,
  // nếu không giao diện vẫn hiện tên người dùng trong khi token đã hết giá trị.
  if (phanHoi.status === 401 && phien.daDangNhap) {
    phien.xoa();
    baoPhienHong();
    throw new LoiApi(CAU_THAY_MA_LOI[401], 401);
  }
  if (!phanHoi.ok) throw new LoiApi(await docLoi(phanHoi), phanHoi.status);
  return phanHoi.json();
}

/* Các lệnh gọi cụ thể, gom theo đúng nhóm endpoint của backend. */

// Số liệu tổng quan không đổi trong một lần mở trang, mà có tới hai phần cùng
// cần nó ngay lúc mở: phần kho và câu gợi ý của ô tìm ở đầu trang. Hai phần dùng
// chung một lượt gọi. Lượt gọi hỏng thì bỏ lời hứa đã giữ, để lần sau gọi lại.
let huaThongKe = null;

export const apiCatalog = {
  thongKe: () => {
    huaThongKe ??= goi('/stats').catch((loi) => {
      huaThongKe = null;
      throw loi;
    });
    return huaThongKe;
  },
  danhSachGiangVien: () => goi('/mentors'),
  trangProject: (thamSo) => goi('/projects', { thamSo }),
  chiTietProject: (slug) => goi(`/projects/${slug}`),
  goiY: (slug, tangCaoNhat) => goi(`/projects/${slug}/hints`, { thamSo: { max_tier: tangCaoNhat } }),
  // Gửi kèm token khi đã đăng nhập: backend chỉ chọn project vừa sức người đó.
  projectNgauNhien: (thamSo = {}) => goi('/projects/random', { thamSo, canToken: true }),
  danhSachLoTrinh: () => goi('/roadmaps'),
  chiTietLoTrinh: (slug) => goi(`/roadmaps/${slug}`),
};

export const apiTaiKhoan = {
  dangKy: (than) => goi('/auth/register', { phuongThuc: 'POST', than }),
  dangNhap: (than) => goi('/auth/login', { phuongThuc: 'POST', than }),
  toiLaAi: () => goi('/auth/me', { canToken: true }),
  // Ảnh đại diện gửi lên dưới dạng biểu mẫu nhiều phần, không phải JSON, nên
  // lệnh gọi này tự dựng yêu cầu thay vì đi qua hàm goi.
  taiAnhLen: (tep) => guiTep('/me/avatar', tep),
  boAnh: () => goi('/me/avatar', { phuongThuc: 'DELETE', canToken: true }),
};

export const apiTienDo = {
  tienDo: () => goi('/me/progress', { canToken: true }),
  baiNopCuaToi: () => goiHetTrang('/me/submissions', { canToken: true }),
  deXuat: (soLuong) => goi('/me/recommendations', { thamSo: { limit: soLuong }, canToken: true }),
  nopBai: (slug, than) =>
    goi(`/projects/${slug}/submissions`, { phuongThuc: 'POST', than, canToken: true }),
  bangXepHang: (soLuong) => goi('/leaderboard', { thamSo: { limit: soLuong } }),
};

export const apiQuanTri = {
  baiNopChoCham: () => goiHetTrang('/submissions', { thamSo: { status: 'pending' }, canToken: true }),
  // Chỉ cần con số, nên hỏi trang một bản ghi và đọc tổng.
  soBaiChoCham: () =>
    goi('/submissions', { thamSo: { status: 'pending', page_size: 1 }, canToken: true }).then(
      (trang) => trang.total
    ),
  chamBai: (maBaiNop, than) =>
    goi(`/submissions/${maBaiNop}/review`, { phuongThuc: 'PATCH', than, canToken: true }),
};

/**
 * Khôi phục phiên từ token đã lưu.
 *
 * Chỉ có token là chưa đủ, vì token có thể đã hết hạn. Hàm hỏi lại backend xem
 * token còn dùng được không rồi mới coi là đã đăng nhập.
 */
export async function khoiPhucPhien() {
  const token = docTokenDaLuu();
  if (!token) return false;

  const kho = khoLuu();
  let laPhienLau = false;
  try {
    laPhienLau = kho.lau?.getItem(KHOA_TOKEN) === token;
  } catch {
    laPhienLau = false;
  }

  phien.token = token;
  phien.ghiNho = laPhienLau;
  try {
    phien.nguoiDung = await apiTaiKhoan.toiLaAi();
    return true;
  } catch (loi) {
    // Chỉ bỏ token khi backend nói thẳng là nó không dùng được nữa. Máy chủ tạm
    // thời không gọi được thì giữ nguyên, để lần mở trang sau còn đăng nhập lại
    // được mà không phải gõ mật khẩu.
    if (loi instanceof LoiApi && loi.maTrangThai === 401) {
      phien.xoa();
    } else {
      phien.token = null;
      phien.nguoiDung = null;
    }
    return false;
  }
}
