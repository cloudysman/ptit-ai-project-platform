/* Đường dẫn gốc của giao diện.

   Nền tảng chạy được ở hai chỗ: ngay tại gốc tên miền khi phát triển, ví dụ
   http://127.0.0.1:8421/, và dưới một tiền tố khi đứng sau máy chủ trung gian,
   ví dụ https://ptitai.org/projects/. Nếu viết cứng dấu gạch chéo đầu vào mọi
   đường dẫn thì bản chạy dưới tiền tố sẽ gọi nhầm ra gốc tên miền và hỏng hết.

   Gốc được suy ra từ chính địa chỉ của tệp này chứ không lấy từ một biến cấu
   hình. Trình duyệt đặt địa chỉ đầy đủ của mỗi module vào import.meta.url, mà
   tệp này nằm trong thư mục js ngay dưới gốc, nên lùi lại một cấp là ra gốc.
   Cách này không cần khai báo gì, và không thể lệch với nơi tệp thật sự nằm. */

/** Đường dẫn gốc của giao diện, luôn kết thúc bằng dấu gạch chéo. */
export const GOC = new URL('../', import.meta.url).pathname;

/** Ghép một đường dẫn tương đối vào gốc, ví dụ 'kho.html' thành '/projects/kho.html'. */
export const duongDan = (phanSau = '') => GOC + String(phanSau).replace(/^\/+/, '');
