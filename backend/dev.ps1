<#
.SYNOPSIS
    Các lệnh hay dùng của backend nền tảng học tập theo project.

.DESCRIPTION
    Mọi lệnh đều gọi Python trong .venv của project, không dùng Python toàn cục.

.EXAMPLE
    .\dev.ps1 run
    .\dev.ps1 seed -AdminPassword "matkhau-quan-tri"
    .\dev.ps1 test
    .\dev.ps1 lint
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('run', 'seed', 'test', 'lint', 'format')]
    [string]$Command = 'run',

    [string]$AdminPassword
)

$ErrorActionPreference = 'Stop'
$Python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'

if (-not (Test-Path $Python)) {
    Write-Error "Chưa có môi trường .venv. Chạy: python -m venv .venv"
}

$env:PYTHONIOENCODING = 'utf-8'
Push-Location $PSScriptRoot
try {
    switch ($Command) {
        'run' {
            & $Python -m app --reload
        }
        'seed' {
            if ($AdminPassword) {
                & $Python -m app.seed --admin-password $AdminPassword
            }
            else {
                & $Python -m app.seed
            }
        }
        'test' { & $Python -m pytest }
        'lint' { & $Python -m ruff check . }
        'format' { & $Python -m ruff format . }
    }
}
finally {
    Pop-Location
}
