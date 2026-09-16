#!/usr/bin/env bash
# Chạy backend như một dịch vụ của systemd, thay cho cách chạy trong tmux.
#
# Khác nhau giữa hai cách:
#   tmux    máy chủ chạy trong một cửa sổ, xem nhật ký trực tiếp được, nhưng
#           không tự chạy lại khi máy khởi động lại hay khi tiến trình chết.
#   systemd máy chủ chạy nền, tự chạy lại sau khi máy khởi động lại và sau mỗi
#           lần tiến trình chết, nhật ký do journalctl giữ.
#
# Cả hai cách đều cần bật linger cho tài khoản, nếu không systemd sẽ tắt mọi
# tiến trình còn lại của tài khoản ngay khi phiên đăng nhập cuối cùng đóng lại.
# Lệnh cai ở dưới bật sẵn linger.
#
# Cách dùng:
#   ./dich-vu.sh cai          cài dịch vụ, bật linger, chạy luôn
#   ./dich-vu.sh chay         chạy dịch vụ
#   ./dich-vu.sh dung         dừng dịch vụ
#   ./dich-vu.sh chay-lai     chạy lại dịch vụ
#   ./dich-vu.sh trang-thai   xem dịch vụ còn sống không
#   ./dich-vu.sh nhat-ky      xem nhật ký, bám theo dòng mới
#   ./dich-vu.sh tmux         mở một phiên tmux bám theo nhật ký của dịch vụ
#   ./dich-vu.sh go           dừng hẳn và gỡ dịch vụ

set -euo pipefail

THU_MUC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEN_DICH_VU="nen-tang-project"
THU_MUC_UNIT="$HOME/.config/systemd/user"
FILE_UNIT="$THU_MUC_UNIT/$TEN_DICH_VU.service"
PYTHON="$THU_MUC/.venv/bin/python"

lam_cai() {
  if [ ! -x "$PYTHON" ]; then
    echo "Chưa có môi trường .venv. Chạy trước: ./dev.sh setup" >&2
    exit 1
  fi

  # Không bật linger thì systemd tắt mọi tiến trình của tài khoản ngay khi phiên
  # đăng nhập cuối cùng đóng lại, và dịch vụ chết theo lúc người dùng ngắt kết nối.
  loginctl enable-linger "$USER"

  mkdir -p "$THU_MUC_UNIT"
  cat > "$FILE_UNIT" <<UNIT
[Unit]
Description=Backend nen tang hoc tap theo project
Documentation=file://$THU_MUC/README.md
# After chỉ xếp thứ tự; phải có Wants thì mục tiêu network-online mới thật sự
# được kéo lên trước khi dịch vụ chạy.
Wants=network-online.target
After=network-online.target
# Cửa sổ đếm số lần chạy lại. Chết quá năm lần trong sáu mươi giây thì dừng hẳn,
# để một lỗi cấu hình không biến thành vòng lặp chạy lại vô tận. Hai khoá này
# thuộc mục Unit chứ không thuộc mục Service.
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
WorkingDirectory=$THU_MUC
ExecStart=$PYTHON -m app
Environment=PYTHONIOENCODING=utf-8
Environment=PYTHONUNBUFFERED=1
# Tiến trình chết vì bất cứ lý do gì cũng được chạy lại sau ba giây.
Restart=always
RestartSec=3
# Vài chốt an toàn: không được nâng quyền, tệp tạo ra (cơ sở dữ liệu, ảnh đại
# diện) chỉ chủ dịch vụ đọc được, và một rò rỉ bộ nhớ không kéo cả máy đi theo
# (đo được đỉnh khoảng 430 MB khi 200 request nặng chạy song song, nên trần 768 MB).
NoNewPrivileges=yes
UMask=0077
MemoryMax=768M

[Install]
WantedBy=default.target
UNIT

  systemctl --user daemon-reload
  systemctl --user enable --now "$TEN_DICH_VU.service"
  echo "Đã cài và chạy dịch vụ $TEN_DICH_VU."
  echo "Xem trạng thái: ./dich-vu.sh trang-thai"
}

lam_go() {
  systemctl --user disable --now "$TEN_DICH_VU.service" 2>/dev/null || true
  rm -f "$FILE_UNIT"
  systemctl --user daemon-reload
  echo "Đã gỡ dịch vụ $TEN_DICH_VU. Linger vẫn giữ nguyên."
  echo "Muốn tắt linger: loginctl disable-linger $USER"
}

# Mở một phiên tmux nằm ngoài phiên đăng nhập.
#
# tmux khởi động theo cách thông thường sẽ nằm trong session-....scope, tức cùng
# nhóm với phiên đăng nhập đã gõ lệnh. Khi phiên đăng nhập đó đóng lại, systemd
# tắt cả nhóm và tmux chết theo. Chạy qua systemd-run --user --scope thì tmux
# nằm dưới user@.service, nhóm này sống độc lập với mọi phiên đăng nhập, miễn là
# tài khoản đã bật linger.
lam_tmux() {
  local ten_phien="ptit-ai"

  if tmux has-session -t "$ten_phien" 2>/dev/null; then
    echo "Phiên tmux $ten_phien đã có sẵn. Vào xem: tmux attach -t $ten_phien"
    return
  fi

  systemd-run --user --scope --quiet --unit=ptit-ai-tmux.scope \
    tmux new-session -d -s "$ten_phien" -n nhat-ky -c "$THU_MUC" \
    "exec journalctl --user -u $TEN_DICH_VU.service -f -n 40 --no-hostname"
  tmux new-window -t "$ten_phien" -n dieu-khien -c "$THU_MUC"
  tmux select-window -t "$ten_phien":nhat-ky

  echo "Đã mở phiên tmux $ten_phien với hai cửa sổ: nhat-ky và dieu-khien."
  echo "Vào xem: tmux attach -t $ten_phien"
}

lenh="${1:-trang-thai}"
case "$lenh" in
  cai)        lam_cai ;;
  go)         lam_go ;;
  chay)       systemctl --user start "$TEN_DICH_VU.service" ;;
  dung)       systemctl --user stop "$TEN_DICH_VU.service" ;;
  chay-lai)   systemctl --user restart "$TEN_DICH_VU.service" ;;
  trang-thai) systemctl --user status "$TEN_DICH_VU.service" --no-pager ;;
  nhat-ky)    journalctl --user -u "$TEN_DICH_VU.service" -f ;;
  tmux)       lam_tmux ;;
  *)
    echo "Lệnh không có: $lenh" >&2
    echo "Các lệnh dùng được: cai, chay, dung, chay-lai, trang-thai, nhat-ky, tmux, go" >&2
    exit 1
    ;;
esac
