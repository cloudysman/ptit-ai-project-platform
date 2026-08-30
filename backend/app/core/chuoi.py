"""Chuẩn hoá chuỗi tiếng Việt cho việc tìm kiếm và sắp xếp."""

from __future__ import annotations

import unicodedata

# Chữ đ không phải là chữ d mang dấu phụ mà là một chữ cái riêng trong bảng mã,
# nên bước tách dấu phụ ở dưới không đụng tới nó. Phải thay bằng tay.
_CHU_D = str.maketrans({"đ": "d", "Đ": "d"})


def bo_dau(chuoi: str) -> str:
    """Đưa một chuỗi tiếng Việt về chữ thường không dấu.

    Chuỗi được tách thành chữ cái gốc và dấu phụ theo dạng chuẩn NFD, sau đó mọi
    dấu phụ bị loại bỏ. Nhờ vậy "Nhận dạng ảnh" thành "nhan dang anh", nên người
    gõ không dấu vẫn tìm ra project, và thứ tự chữ cái khi sắp xếp theo tên đi
    theo chữ gốc thay vì theo vị trí của chữ có dấu trong bảng mã Unicode.
    """
    tach = unicodedata.normalize("NFD", chuoi.translate(_CHU_D))
    return "".join(ky_tu for ky_tu in tach if not unicodedata.combining(ky_tu)).lower()
