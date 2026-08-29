@echo off
REM Lop bao ngoai cua dev.ps1.
REM Chinh sach chay script cua Windows chan file .ps1 cuc bo, nen goi qua day de
REM khong phai doi cai dat cua may.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
