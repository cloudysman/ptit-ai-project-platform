#!/usr/bin/env bash
# Dựng ba tệp cho khung video của phần mở đầu từ một đoạn video bất kỳ.
#
# Cách dùng: ./lam-video-mo-dau.sh <video vào> anh [giây bắt đầu] [độ dài] [bề ngang]
# Ví dụ đoạn đang dùng: PHONG=1.2 NEO_X=0.6 NEO_Y=0 ./lam-video-mo-dau.sh coverr-coding-technology-5974.1080.mp4 anh 0 10
# Kết quả: video-mo-dau.webm, video-mo-dau.mp4 (không tiếng, lặp liền mạch) và
# video-mo-dau.jpg (khung hình đầu, dùng làm ảnh chờ và làm ảnh tĩnh khi video
# không phát). Video nào đưa vào cũng ra cùng một sắc độ: bóng tối là xanh chàm
# đậm #3B3ED8, chỉ sẫm hơn màu khối một bậc, vùng sáng vừa là xanh da trời, vùng
# sáng nhất là xanh da trời nhạt; nhờ vậy cảnh nào cũng hợp với bảng màu của trang.
#
# Vòng lặp liền mạch: lấy đoạn [bắt đầu + 2, bắt đầu + độ dài] rồi nối thêm hai
# giây cuối hoà dần vào hai giây đầu, nên khung hình cuối trùng khung hình đầu.
set -euo pipefail
VAO="${1:?thiếu video vào}"
RA="${2:?thiếu thư mục ra}"
BAT_DAU="${3:-0}"
DO_DAI="${4:-10}"
# Khung video rộng khoảng 38% bề ngang nội dung, tối đa khoảng 420 điểm ảnh CSS,
# nên 960 điểm ảnh là đủ cho cả màn hình dày điểm ảnh gấp đôi. Khung cao theo
# khối chữ bên cạnh; đo từ 1101 tới 2560 điểm ảnh, bề ngang khung gấp 1,51 tới
# 1,58 lần bề cao, nên video dựng sẵn tỷ lệ 3:2 và trình duyệt chỉ cắt thêm vài
# điểm ảnh ở mép trên và mép dưới. Muốn tỷ lệ khác thì đặt CAO qua biến môi trường.
RONG="${5:-960}"
CAO="${CAO:-$((RONG * 2 / 3))}"
# Tuỳ chọn cắt, đặt qua biến môi trường: PHONG là mức phóng trước khi cắt (1 là
# vừa khít), NEO_X và NEO_Y từ 0 tới 1 là chỗ neo khung cắt (0.5 là giữa, 1 là
# mép phải hoặc mép dưới). Dùng khi mép nguồn có vật thừa, ví dụ bàn tay hay
# đốm sáng lọt vào góc.
PHONG="${PHONG:-1}"
NEO_X="${NEO_X:-0.5}"
NEO_Y="${NEO_Y:-0.5}"
mkdir -p "$RA"

# Làm mờ nhẹ rồi đổ sắc độ theo ba mốc: Y = 0 là MAU_TOI, Y = 128 là MAU_GIUA,
# Y = 255 là MAU_SANG, nội suy tuyến tính giữa các mốc. Mỗi mốc viết "đỏ,lục,lam".
#
# Mốc tối mặc định là xanh chàm đậm (59, 62, 216), đúng màu --xanh-dam của tệp
# kiểu. Bản trước dùng (30, 33, 140): khung khi đó là một mảng sẫm hẳn giữa dải
# chuyển, và kéo khung cao lên thì mảng sẫm càng to. Với mốc mới, phần lớn khung
# chỉ sẫm hơn màu khối một bậc, nên khung đọc như một màn hình sáng chứ không
# như một cái lỗ. Mốc giữa (60, 140, 220) giữ cho vùng sáng vừa vẫn no màu như
# dải chuyển của mẫu slide Trung tâm, từ xanh chàm #5154F5 sang xanh da trời
# #3CA7DE, thay vì ngả xám. Mốc sáng (205, 238, 250) là xanh da trời nhạt. Làm mờ
# để chữ trong cảnh thành vân chứ không đọc được, khỏi kéo mắt khỏi chữ thật của
# trang.
MAU_TOI="${MAU_TOI:-59,62,216}"
MAU_GIUA="${MAU_GIUA:-60,140,220}"
MAU_SANG="${MAU_SANG:-205,238,250}"
IFS=, read -r T0 T1 T2 <<< "$MAU_TOI"
IFS=, read -r G0 G1 G2 <<< "$MAU_GIUA"
IFS=, read -r S0 S1 S2 <<< "$MAU_SANG"
kenh() { echo "if(lt(val,128),$1+val*($2-$1)/128,$2+(val-128)*($3-$2)/127)"; }
HAI_MAU="gblur=sigma=1.4,format=gray,eq=contrast=1.3:brightness=-0.02,format=rgb24,lutrgb=r='$(kenh "$T0" "$G0" "$S0")':g='$(kenh "$T1" "$G1" "$S1")':b='$(kenh "$T2" "$G2" "$S2")',format=yuv420p"
LAP="[0:v]trim=$((BAT_DAU+2)):$((BAT_DAU+DO_DAI)),setpts=PTS-STARTPTS[a];
     [0:v]trim=$((BAT_DAU+DO_DAI)):$((BAT_DAU+DO_DAI+2)),setpts=PTS-STARTPTS[b];
     [0:v]trim=$BAT_DAU:$((BAT_DAU+2)),setpts=PTS-STARTPTS[c];
     [b][c]xfade=transition=fade:duration=2:offset=0[bc];
     [a][bc]concat=n=2:v=1:a=0,scale=w=trunc($RONG*$PHONG/2)*2:h=trunc($CAO*$PHONG/2)*2:force_original_aspect_ratio=increase,crop=$RONG:$CAO:(iw-ow)*$NEO_X:(ih-oh)*$NEO_Y,$HAI_MAU[v]"

ffmpeg -loglevel error -y -i "$VAO" -filter_complex "$LAP" -map "[v]" -an \
  -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -deadline good -cpu-used 2 "$RA/video-mo-dau.webm"
ffmpeg -loglevel error -y -i "$VAO" -filter_complex "$LAP" -map "[v]" -an \
  -c:v libx264 -crf 28 -preset slow -profile:v high -pix_fmt yuv420p -movflags +faststart "$RA/video-mo-dau.mp4"
ffmpeg -loglevel error -y -i "$RA/video-mo-dau.mp4" -frames:v 1 -q:v 4 "$RA/video-mo-dau.jpg"
ls -la "$RA"/video-mo-dau.*
