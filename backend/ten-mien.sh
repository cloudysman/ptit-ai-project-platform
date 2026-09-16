#!/usr/bin/env bash
# Đưa nền tảng ra địa chỉ https://ptitai.org/projects/ bằng nginx.
#
# Backend và nginx phải khớp nhau về tiền tố đường dẫn, nếu không thư mục tài
# nguyên tĩnh sẽ trả về 404 trong khi trang HTML và API vẫn chạy, một kiểu hỏng
# rất khó nhận ra. Vì vậy lệnh cai từ chối chạy khi hai bên chưa khớp.
#
# Máy chủ này đang chạy nhiều project khác trên cùng một nginx, nên tập lệnh
# được viết theo hướng chạm vào ít nhất có thể:
#
#   - Chỉ thêm hai khối location vào đúng một file cấu hình của tên miền
#     ptitai.org. Không đụng tới file của bất kỳ tên miền nào khác.
#   - Sao lưu file gốc trước khi sửa, kèm mốc thời gian.
#   - Chạy nginx -t để kiểm tra cú pháp. Không đạt thì khôi phục ngay file gốc
#     và dừng lại, nginx chưa hề được nạp lại nên các project khác không việc gì.
#   - Nạp lại bằng reload chứ không restart, nên các kết nối đang mở không đứt.
#   - Có lệnh hoàn tác, đưa cấu hình về đúng bản sao lưu.
#
# Thứ tự ba bước:
#   ./ten-mien.sh bat-tien-to    đặt ROOT_PATH rồi chạy lại dịch vụ
#   sudo ./ten-mien.sh cai       thêm cấu hình nginx rồi nạp lại nginx
#   ./ten-mien.sh kiem-tra       thử địa chỉ công khai xem đã chạy chưa
#
# Gỡ ra thì làm ngược lại:
#   sudo ./ten-mien.sh hoan-tac  gỡ cấu hình nginx
#   ./ten-mien.sh tat-tien-to    xoá ROOT_PATH rồi chạy lại dịch vụ
#
# Xem trước mà không đổi gì:
#   ./ten-mien.sh xem            in ra phần sẽ được thêm vào nginx

set -euo pipefail

FILE_CAU_HINH="/etc/nginx/sites-available/ptitai.org"
DAU_MO="# === NEN TANG HOC TAP THEO PROJECT: bat dau ==="
DAU_DONG="# === NEN TANG HOC TAP THEO PROJECT: ket thuc ==="
DIA_CHI="https://ptitai.org/projects/"
CONG_NOI_BO="8421"
TIEN_TO="/projects"
THU_MUC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILE_ENV="$THU_MUC/.env"
TEN_DICH_VU="nen-tang-project"

khoi_cau_hinh() {
  cat <<CONF
    $DAU_MO
    # Nền tảng học tập theo project. Địa chỉ công khai: $DIA_CHI
    # Backend chạy ở 127.0.0.1:$CONG_NOI_BO, do dịch vụ systemd
    # nen-tang-project quản lý. Xem backend/dich-vu.sh.

    # Địa chỉ không có dấu gạch chéo cuối được đưa về dạng có dấu. Trang dùng
    # đường dẫn tương đối, mà đường dẫn tương đối chỉ giải đúng khi địa chỉ của
    # trang kết thúc bằng dấu gạch chéo.
    location = /projects {
        return 301 /projects/;
    }

    # Dạng số ít cũng đưa về đúng địa chỉ. Người gõ tay rất dễ quên chữ s ở cuối,
    # và khi đó yêu cầu rơi vào khối location / rồi nhận trang báo lỗi của một
    # project khác, thứ không nói được gì cho người đang tìm nền tảng này.
    # Dấu bằng nghĩa là chỉ khớp đúng một địa chỉ đó, không khớp gì thêm.
    location = /project {
        return 301 /projects/;
    }

    # proxy_pass cố ý viết KHÔNG có dấu gạch chéo ở cuối, nên tiền tố /projects
    # được giữ nguyên khi chuyển yêu cầu xuống. Backend biết tiền tố của mình
    # qua biến ROOT_PATH trong file .env và tự cắt lấy.
    #
    # Hai bên phải khớp nhau. Thêm dấu gạch chéo vào đây mà vẫn để ROOT_PATH thì
    # thư mục tài nguyên tĩnh sẽ trả về 404, trong khi trang HTML và API vẫn chạy,
    # nên lỗi rất khó nhận ra.
    location /projects/ {
        proxy_pass http://127.0.0.1:$CONG_NOI_BO;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Prefix /projects;
        # Thân request lớn nhất: ảnh đại diện 2 MB cộng phần dôi của multipart.
        # Backend đã từ chối theo Content-Length, nhưng nginx vẫn nhận trọn thân
        # rồi mới chuyển xuống nếu không đặt ở đây.
        client_max_body_size 3m;
        # Chính sách nội dung: mã và tài nguyên chỉ nạp từ chính nền tảng; kiểu
        # nội tuyến phải cho phép vì giao diện đặt biến CSS trong thuộc tính style
        # của từng dòng. Trang có hộp đăng nhập nên không cho trang khác nhúng.
        add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'self'" always;
    }

    # Trang tài liệu API nạp Swagger UI từ CDN kèm một đoạn mã nội tuyến, nên
    # không mang chính sách nội dung ở trên. Khối riêng vì add_header không kế
    # thừa: khối nào có add_header là chỉ dùng đúng những tiêu đề của khối đó.
    location = /projects/docs {
        proxy_pass http://127.0.0.1:$CONG_NOI_BO;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Prefix /projects;
    }
    $DAU_DONG
CONF
}

# Giá trị ROOT_PATH đang có trong file .env, chuỗi rỗng nếu chưa đặt.
doc_tien_to() {
  [ -f "$FILE_ENV" ] || { echo ""; return; }
  sed -n 's/^ROOT_PATH=//p' "$FILE_ENV" | tail -1 | tr -d '[:space:]'
}

# Ghi một giá trị vào dòng ROOT_PATH của file .env, thêm dòng đó nếu chưa có.
ghi_tien_to() {
  local gia_tri="$1"
  if [ ! -f "$FILE_ENV" ]; then
    echo "Không thấy file $FILE_ENV. Chạy trước: ./dev.sh setup" >&2
    exit 1
  fi
  if grep -q "^ROOT_PATH=" "$FILE_ENV"; then
    python3 -c '
import sys
from pathlib import Path

tep, gia_tri = Path(sys.argv[1]), sys.argv[2]
dong = [
    f"ROOT_PATH={gia_tri}" if d.startswith("ROOT_PATH=") else d
    for d in tep.read_text(encoding="utf-8").splitlines()
]
tep.write_text("\n".join(dong) + "\n", encoding="utf-8")
' "$FILE_ENV" "$gia_tri"
  else
    printf '\n# Tien to duong dan khi nen tang nam sau may chu trung gian.\nROOT_PATH=%s\n' "$gia_tri" >> "$FILE_ENV"
  fi
}

# Chạy lại dịch vụ nếu nó đang được systemd quản lý. Chạy bằng tmux hay bằng tay
# thì tập lệnh không tự động được, nên chỉ nhắc người dùng.
chay_lai_dich_vu() {
  if systemctl --user is-active --quiet "$TEN_DICH_VU.service" 2>/dev/null; then
    systemctl --user restart "$TEN_DICH_VU.service"
    echo "Đã chạy lại dịch vụ $TEN_DICH_VU."
  else
    echo "Dịch vụ $TEN_DICH_VU không chạy. Hãy tự khởi động lại backend để giá trị mới có tác dụng."
  fi
}

lam_bat_tien_to() {
  ghi_tien_to "$TIEN_TO"
  echo "Đã đặt ROOT_PATH=$TIEN_TO trong $FILE_ENV"
  chay_lai_dich_vu
  echo "Bước tiếp theo: sudo $0 cai"
}

lam_tat_tien_to() {
  ghi_tien_to ""
  echo "Đã xoá giá trị ROOT_PATH trong $FILE_ENV"
  chay_lai_dich_vu
}

can_quyen_quan_tri() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Lệnh này cần quyền quản trị. Chạy lại: sudo $0 $1" >&2
    exit 1
  fi
}

lam_cai() {
  # Kiểm tra sự khớp nhau trước cả bước hỏi quyền quản trị. Hai bên lệch nhau thì
  # thà dừng lại ngay còn hơn để nền tảng chạy nửa vời trên địa chỉ công khai, và
  # đặt kiểm tra này lên trước thì người dùng thấy vấn đề mà chưa cần gõ mật khẩu.
  local dang_co
  dang_co="$(doc_tien_to)"
  if [ "$dang_co" != "$TIEN_TO" ]; then
    echo "Trong $FILE_ENV, ROOT_PATH đang là \"$dang_co\" chứ không phải \"$TIEN_TO\"." >&2
    echo "Chạy trước lệnh này rồi quay lại: $0 bat-tien-to" >&2
    exit 1
  fi

  can_quyen_quan_tri cai

  if [ ! -f "$FILE_CAU_HINH" ]; then
    echo "Không thấy file $FILE_CAU_HINH." >&2
    exit 1
  fi

  if grep -qF "$DAU_MO" "$FILE_CAU_HINH"; then
    echo "Cấu hình đã có sẵn trong $FILE_CAU_HINH, không thêm lần nữa."
    echo "Muốn thay bằng bản mới thì chạy: sudo $0 hoan-tac rồi sudo $0 cai"
    exit 0
  fi

  local ban_sao
  ban_sao="$FILE_CAU_HINH.sao-luu.$(date +%Y%m%d-%H%M%S)"
  cp -p "$FILE_CAU_HINH" "$ban_sao"
  echo "Đã sao lưu file gốc thành $ban_sao"

  # Chèn ngay trước dòng mở đầu phần chứng chỉ, tức vẫn nằm trong khối server
  # của cổng 443. Thứ tự các khối location không ảnh hưởng tới cách nginx chọn
  # khối nào, vì nginx lấy khối có tiền tố dài nhất khớp được.
  khoi_cau_hinh > /tmp/khoi-nen-tang-project.conf
  python3 - "$FILE_CAU_HINH" /tmp/khoi-nen-tang-project.conf <<'PY'
import sys
from pathlib import Path

file_cau_hinh, file_khoi = Path(sys.argv[1]), Path(sys.argv[2])
noi_dung = file_cau_hinh.read_text(encoding="utf-8")
khoi = file_khoi.read_text(encoding="utf-8")

neo = "    # SSL (Certbot)"
if neo not in noi_dung:
    sys.exit("Không tìm thấy chỗ để chèn trong file cấu hình. Dừng lại, chưa sửa gì.")

file_cau_hinh.write_text(noi_dung.replace(neo, khoi + "\n" + neo, 1), encoding="utf-8")
PY
  rm -f /tmp/khoi-nen-tang-project.conf

  echo "Đang kiểm tra cú pháp nginx"
  if ! nginx -t; then
    cp -p "$ban_sao" "$FILE_CAU_HINH"
    echo "Cú pháp không đạt. Đã khôi phục file gốc, nginx chưa hề được nạp lại." >&2
    exit 1
  fi

  systemctl reload nginx
  echo "Đã nạp lại nginx. Địa chỉ: $DIA_CHI"
  echo "Kiểm tra: $0 kiem-tra"
}

lam_hoan_tac() {
  can_quyen_quan_tri hoan-tac

  if ! grep -qF "$DAU_MO" "$FILE_CAU_HINH"; then
    echo "Trong $FILE_CAU_HINH không có phần nào của nền tảng để gỡ."
    exit 0
  fi

  local ban_sao
  ban_sao="$FILE_CAU_HINH.truoc-khi-go.$(date +%Y%m%d-%H%M%S)"
  cp -p "$FILE_CAU_HINH" "$ban_sao"

  python3 - "$FILE_CAU_HINH" "$DAU_MO" "$DAU_DONG" <<'PY'
import re, sys
from pathlib import Path

file_cau_hinh, dau_mo, dau_dong = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
noi_dung = file_cau_hinh.read_text(encoding="utf-8")
# Phần đuôi (?:[ \t]*\n)? nuốt luôn dòng trống mà lúc chèn đã thêm vào để tách
# khối này với phần chứng chỉ bên dưới. Không nuốt thì mỗi lần cài rồi gỡ lại
# thừa ra một dòng trống, và file cấu hình dài dần ra sau vài lần thử.
mau = re.compile(
    r"[ \t]*" + re.escape(dau_mo) + r".*?" + re.escape(dau_dong) + r"[ \t]*\n(?:[ \t]*\n)?",
    re.DOTALL,
)
file_cau_hinh.write_text(mau.sub("", noi_dung, count=1), encoding="utf-8")
PY

  if ! nginx -t; then
    cp -p "$ban_sao" "$FILE_CAU_HINH"
    echo "Cú pháp không đạt sau khi gỡ. Đã khôi phục lại bản trước đó." >&2
    exit 1
  fi

  systemctl reload nginx
  echo "Đã gỡ phần cấu hình của nền tảng và nạp lại nginx."
  echo "Bản trước khi gỡ nằm ở $ban_sao"
  echo "Bước cuối, chạy không cần quyền quản trị: $0 tat-tien-to"
}

lam_kiem_tra() {
  echo "Backend ở cổng nội bộ $CONG_NOI_BO:"
  printf "  %-46s %s\n" "http://127.0.0.1:$CONG_NOI_BO/" \
    "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$CONG_NOI_BO/" || echo 'khong goi duoc')"

  echo "Địa chỉ công khai:"
  for duong in "" "kho.html" "api/v1/stats" "docs"; do
    printf "  %-46s %s\n" "$DIA_CHI$duong" \
      "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$DIA_CHI$duong" || echo 'khong goi duoc')"
  done
}

lenh="${1:-xem}"
case "$lenh" in
  xem)           khoi_cau_hinh ;;
  bat-tien-to)   lam_bat_tien_to ;;
  tat-tien-to)   lam_tat_tien_to ;;
  cai)           lam_cai ;;
  hoan-tac)      lam_hoan_tac ;;
  kiem-tra)      lam_kiem_tra ;;
  *)
    echo "Lệnh không có: $lenh" >&2
    echo "Các lệnh dùng được: xem, bat-tien-to, tat-tien-to, cai, hoan-tac, kiem-tra" >&2
    exit 1
    ;;
esac
