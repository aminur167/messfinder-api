<#
    setup_database.ps1
    Builds the whole mess_finder database with the mysql command line tool:
    schema, demo data, and (in later phases) views, procedures, triggers and events.

    Examples (run from the backend\database folder):
        powershell -ExecutionPolicy Bypass -File .\scripts\setup_database.ps1
        powershell -ExecutionPolicy Bypass -File .\scripts\setup_database.ps1 -Reset

    -Reset       delete the old mess_finder database first (asks you to type YES)
    -User        MySQL user, default root
    -DbHost      server name, default localhost
    -Port        server port, default 3306
    -NoPassword  use this only for a local server that has no password
    -MysqlPath   full path of mysql.exe if it is not found automatically
#>
param(
    [string] $User      = 'root',
    [string] $DbHost    = 'localhost',
    [int]    $Port      = 3306,
    [switch] $Reset,
    [switch] $Force,
    [switch] $NoPassword,
    [string] $MysqlPath = ''
)

$ErrorActionPreference = 'Stop'
$scriptsFolder  = $PSScriptRoot
$databaseFolder = Split-Path -Parent $scriptsFolder

# ---- find mysql.exe ----
if ($MysqlPath -eq '') {
    $found = Get-Command mysql -ErrorAction SilentlyContinue
    if ($found) { $MysqlPath = $found.Source }
    else {
        $guesses = @(
            'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe',
            'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe',
            'D:\MySQL\Server\bin\mysql.exe'
        )
        foreach ($g in $guesses) { if (Test-Path $g) { $MysqlPath = $g; break } }
    }
}
if ($MysqlPath -eq '' -or -not (Test-Path $MysqlPath)) {
    Write-Host 'mysql.exe was not found. Pass its location with -MysqlPath "C:\...\bin\mysql.exe".' -ForegroundColor Red
    exit 1
}

# ---- common mysql arguments ----
$connection = @('-h', $DbHost, '-P', "$Port", '-u', $User, '--default-character-set=utf8mb4')
if (-not $NoPassword) { $connection += '-p' }   # mysql asks for the password once

# ---- optional reset ----
if ($Reset) {
    if (-not $Force) {
        Write-Host 'This will DELETE the mess_finder database and all its data.' -ForegroundColor Yellow
        $answer = Read-Host 'Type YES to continue'
        if ($answer -ne 'YES') { Write-Host 'Cancelled.'; exit 0 }
    }
    $resetFile = (Join-Path $scriptsFolder 'reset_database.sql') -replace '\\', '/'
    & $MysqlPath @connection "--execute=source $resetFile"
    if ($LASTEXITCODE -ne 0) { Write-Host 'Reset failed.' -ForegroundColor Red; exit 1 }
    Write-Host 'Old database deleted.'
}

# ---- build one combined file and run it ----
& (Join-Path $scriptsFolder 'build_full_script.ps1')
$fullFile = (Join-Path $databaseFolder 'build\mess_finder_full.sql') -replace '\\', '/'

Write-Host 'Running the database script...'
& $MysqlPath @connection "--execute=source $fullFile"
if ($LASTEXITCODE -ne 0) {
    Write-Host 'The script stopped with an error. If the database already exists, run again with -Reset.' -ForegroundColor Red
    exit 1
}
Write-Host 'Done. The mess_finder database is ready.' -ForegroundColor Green
