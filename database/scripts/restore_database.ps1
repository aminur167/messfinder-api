<#
    restore_database.ps1
    Puts a backup made by backup_database.ps1 back into MySQL.
    The backup file already contains the commands to create the tables, so the old
    mess_finder database is replaced. Use -TargetDatabase to restore into a different
    name and keep the old one untouched.

    Examples (from the backend\database folder):
        powershell -ExecutionPolicy Bypass -File .\scripts\restore_database.ps1 -BackupFile .\backups\mess_finder_2026-11-22_10-00-00.sql
        powershell -ExecutionPolicy Bypass -File .\scripts\restore_database.ps1 -BackupFile .\backups\mess_finder_2026-11-22_10-00-00.sql -TargetDatabase mess_finder_copy
#>
param(
    [Parameter(Mandatory = $true)] [string] $BackupFile,
    [string] $TargetDatabase = 'mess_finder',
    [string] $User       = 'root',
    [string] $DbHost     = 'localhost',
    [int]    $Port       = 3306,
    [switch] $NoPassword,
    [string] $MysqlPath  = ''
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $BackupFile)) { Write-Host "Backup file not found: $BackupFile" -ForegroundColor Red; exit 1 }
$BackupFile = (Resolve-Path $BackupFile).Path

# ---- find mysql.exe ----
if ($MysqlPath -eq '') {
    $found = Get-Command mysql -ErrorAction SilentlyContinue
    if ($found) { $MysqlPath = $found.Source }
    else {
        foreach ($g in @('C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe',
                         'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe',
                         'D:\MySQL\Server\bin\mysql.exe')) {
            if (Test-Path $g) { $MysqlPath = $g; break }
        }
    }
}
if ($MysqlPath -eq '' -or -not (Test-Path $MysqlPath)) {
    Write-Host 'mysql.exe was not found. Pass its location with -MysqlPath.' -ForegroundColor Red
    exit 1
}

$connection = @('-h', $DbHost, '-P', "$Port", '-u', $User, '--default-character-set=utf8mb4')
if (-not $NoPassword) { $connection += '-p' }

# Feed the backup file to mysql through standard input. This is more reliable for a
# mysqldump file than the "source" command (which can end with exit code 1 for no reason).
# The first two lines create the target database and select it.
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $MysqlPath
$startInfo.Arguments = ($connection -join ' ')
$startInfo.UseShellExecute = $false
$startInfo.RedirectStandardInput = $true

$process = [System.Diagnostics.Process]::Start($startInfo)
$input = $process.StandardInput.BaseStream

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$firstLines = $utf8NoBom.GetBytes("CREATE DATABASE IF NOT EXISTS ``$TargetDatabase`` DEFAULT CHARACTER SET utf8mb4;`nUSE ``$TargetDatabase``;`n")
$input.Write($firstLines, 0, $firstLines.Length)

$backupStream = [System.IO.File]::OpenRead($BackupFile)
$backupStream.CopyTo($input)
$backupStream.Close()
$input.Close()

$process.WaitForExit()
if ($process.ExitCode -ne 0) { Write-Host 'Restore failed.' -ForegroundColor Red; exit 1 }

Write-Host "Restored into database '$TargetDatabase'." -ForegroundColor Green
