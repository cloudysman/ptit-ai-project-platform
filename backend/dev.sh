#!/usr/bin/env bash
# Các lệnh hay dùng của backend nền tảng học tập theo project, bản cho Linux và macOS.
#
# Bản tương ứng cho Windows là dev.ps1 và dev.cmd. Cả ba đều gọi Python trong
# .venv của project chứ không gọi Python toàn cục, để phiên bản thư viện luôn
# đúng bản đã ghim trong requirements.txt.
#
# Cách dùng:
#   ./dev.sh setup                       tạo .venv rồi cài thư viện
#   ./dev.sh run                         chạy máy chủ, tự khởi động lại khi sửa mã
#   ./dev.sh seed "matkhau-quan-tri"     nạp dữ liệu mẫu và tạo tài khoản giảng viên
#   ./dev.sh test                        chạy bộ kiểm thử
#   ./dev.sh lint                        kiểm tra chất lượng mã nguồn
#   ./dev.sh format                      định dạng lại mã nguồn

set -euo pipefail

THU_MUC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$THU_MUC"

PYTHON="$THU_MUC/.venv/bin/python"
export PYTHONIOENCODING=utf-8

# Chuẩn bị môi trường ảo và cài thư viện. Tách riêng khỏi các lệnh còn lại vì đây
# là việc chỉ làm một lần, còn những lệnh kia thì chạy hằng ngày.
lam_setup() {
  if [ ! -x "$PYTHON" ]; then
    echo "Đang tạo môi trường ảo trong .venv"
    python3 -m venv .venv
  fi
  "$PYTHON" -m pip install --upgrade pip
  "$PYTHON" -m pip install -r requirements-dev.txt

  if [ ! -f .env ]; then
    cp .env.example .env
    khoa="$("$PYTHON" -c 'import secrets; print(secrets.token_urlsafe(48))')"
    # Khoá ký được sinh ngẫu nhiên ngay tại đây. Backend từ chối khởi động khi
    # khoá vẫn là giá trị mặc định trong .env.example, nên bỏ bước này thì lệnh
    # chạy tiếp theo sẽ dừng lại.
    python3 - "$khoa" <<'PY'
import sys
from pathlib import Path

khoa = sys.argv[1]
tep = Path(".env")
dong_moi = [
    f"SECRET_KEY={khoa}" if dong.startswith("SECRET_KEY=") else dong
    for dong in tep.read_text(encoding="utf-8").splitlines()
]
tep.write_text("\n".join(dong_moi) + "\n", encoding="utf-8")
PY
    echo "Đã tạo .env kèm một khoá ký ngẫu nhiên."
  fi
  echo "Xong. Bước tiếp theo: ./dev.sh seed \"matkhau-quan-tri\" rồi ./dev.sh run"
}

can_venv() {
  if [ ! -x "$PYTHON" ]; then
    echo "Chưa có môi trường .venv. Chạy trước: ./dev.sh setup" >&2
    exit 1
  fi
}

lenh="${1:-run}"
case "$lenh" in
  setup)
    lam_setup
    ;;
  run)
    can_venv
    "$PYTHON" -m app --reload
    ;;
  seed)
    can_venv
    if [ "$#" -ge 2 ] && [ -n "$2" ]; then
      "$PYTHON" -m app.seed --admin-password "$2"
    else
      "$PYTHON" -m app.seed
    fi
    ;;
  test)
    can_venv
    "$PYTHON" -m pytest
    ;;
  lint)
    can_venv
    "$PYTHON" -m ruff check .
    # Kiểm tra cả định dạng, để mã chưa qua ./dev.sh format không lọt qua lint.
    "$PYTHON" -m ruff format --check .
    ;;
  format)
    can_venv
    "$PYTHON" -m ruff format .
    ;;
  *)
    echo "Lệnh không có: $lenh" >&2
    echo "Các lệnh dùng được: setup, run, seed, test, lint, format" >&2
    exit 1
    ;;
esac
