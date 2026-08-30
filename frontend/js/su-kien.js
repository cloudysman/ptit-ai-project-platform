/* Ba tin nhắn mà các phần của trang gửi cho nhau.

   Dùng sự kiện thay vì gọi thẳng hàm của nhau vì luồng ở đây là hai chiều: bảng
   chi tiết project cần mở hộp đăng nhập, còn phần tài khoản lại cần mở bảng chi
   tiết project. Nếu hai bên nhập khẩu lẫn nhau thì sinh ra phụ thuộc vòng. */

export const SU_KIEN = {
  /** Người dùng bấm một việc đòi hỏi đăng nhập trong khi chưa đăng nhập. */
  CAN_DANG_NHAP: 'can-dang-nhap',
  /** Vừa nộp bài hoặc vừa chấm bài, mọi phần đang hiển thị tiến độ phải tải lại. */
  TIEN_DO_THAY_DOI: 'tien-do-thay-doi',
  /** Vừa đăng nhập hoặc vừa đăng xuất. */
  PHIEN_THAY_DOI: 'phien-thay-doi',
};

export const phat = (ten, chiTiet = null) =>
  document.dispatchEvent(new CustomEvent(ten, { detail: chiTiet }));

export const nghe = (ten, xuLy) => document.addEventListener(ten, (sk) => xuLy(sk.detail));
