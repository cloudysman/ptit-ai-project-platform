/* Năm tin nhắn mà các phần của trang gửi cho nhau.

   Dùng sự kiện thay vì gọi thẳng hàm của nhau vì luồng ở đây là hai chiều: bảng
   chi tiết project cần mở hộp đăng nhập, còn phần tài khoản lại cần mở bảng chi
   tiết project. Nếu hai bên nhập khẩu lẫn nhau thì sinh ra phụ thuộc vòng. */

export const SU_KIEN = {
  /** Người dùng bấm một việc đòi hỏi đăng nhập trong khi chưa đăng nhập. Chi tiết là
      { project } khi việc đó gắn với một project, để hộp đăng nhập nêu tên project. */
  CAN_DANG_NHAP: 'can-dang-nhap',
  /** Vừa nộp bài hoặc vừa chấm bài, mọi phần đang hiển thị tiến độ phải tải lại. */
  TIEN_DO_THAY_DOI: 'tien-do-thay-doi',
  /** Lượt tải tiến độ vừa về với số liệu khác lần trước, ví dụ một bài vừa được
      chấm ở nơi khác; mọi phần đang vẽ tiến độ vẽ lại từ dữ liệu đã có, không gọi API. */
  TIEN_DO_DA_NAP: 'tien-do-da-nap',
  /** Vừa đăng nhập hoặc vừa đăng xuất. */
  PHIEN_THAY_DOI: 'phien-thay-doi',
  /** Trang chủ vừa tải xong số liệu tổng quan và vài project đầu của từng level.
      Chi tiết là { thongKe, theoLevel }, để phần khác dùng lại mà không gọi API lần nữa. */
  KHO_DA_NAP: 'kho-da-nap',
};

export const phat = (ten, chiTiet = null) =>
  document.dispatchEvent(new CustomEvent(ten, { detail: chiTiet }));

export const nghe = (ten, xuLy) => document.addEventListener(ten, (sk) => xuLy(sk.detail));
