<#
    backup_database.ps1
    Saves the whole mess_finder database (tables, data, views, procedures, triggers
    and events) into one .sql file with mysqldump.

    Example (from the backend\database folder):
        powershell -ExecutionPolicy Bypass -File .\scripts\backup_database.ps1

    The file is saved in database\backups\ with the date and time in its name.
    To get the data back, see restore_database.ps1.
#>
param(
    [string] $User       = 'root',
    [string] $DbHost     = 'localhost',
    [int]    $Port       = 3306,
    [switch] $NoPassword,
    [string] $MysqldumpPath = ''
)

$ErrorActionPreference = 'Stop'
$databaseFolder = Split-Path -Parent $PSScriptRoot
$backupFolder   = Join-Path $databaseFolder 'backups'
if (-not (Test-Path $backupFolder)) { New-Item -ItemType Directory -Path $backupFolder | Out-Null }

# ---- find mysqldump.exe ----
if ($MysqldumpPath -eq '') {
    $found = Get-Command mysqldump -ErrorAction SilentlyContinue
    if ($found) { $MysqldumpPath = $found.Source }
    else {
        foreach ($g in @('C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe',
                         'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe',
                         'D:\MySQL\Server\bin\mysqldump.exe')) {
            if (Test-Path $g) { $MysqldumpPath = $g; break }
        }
    }
}
if ($MysqldumpPath -eq '' -or -not (Test-Path $MysqldumpPath)) {
    Write-Host 'mysqldump.exe was not found. Pass its location with -MysqldumpPath.' -ForegroundColor Red
    exit 1
}

$stamp  = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$target = Join-Path $backupFolder "mess_finder_$stamp.sql"

$arguments = @('-h', $DbHost, '-P', "$Port", '-u', $User,
               '--default-character-set=utf8mb4',
               '--routines', '--triggers', '--events',    # keep procedures, triggers and events too
               '--single-transaction',                    # a consistent copy without locking the tables
               "--result-file=$target")
if (-not $NoPassword) { $arguments += '-p' }
$arguments += 'mess_finder'

& $MysqldumpPath @arguments
if ($LASTEXITCODE -ne 0) { Write-Host 'Backup failed.' -ForegroundColor Red; exit 1 }

Write-Host "Backup saved: $target" -ForegroundColor Green
