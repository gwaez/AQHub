# ASCII-only watchdog: keeps Start-Board.ps1 alive on http://127.0.0.1:8766
# Does not open a browser. Start-Board.ps1 is launched without -OpenBrowser.
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Root) { $Root = (Get-Location).Path }
$BoardPs1 = Join-Path $Root 'Start-Board.ps1'
$LogDir = Join-Path $Root 'data'
$Log = Join-Path $LogDir 'watchdog.log'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

function Write-Log([string]$msg) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $Log -Value $line -Encoding UTF8
}

function Test-BoardUp {
  try {
    $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8766/' -TimeoutSec 3
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}

function Stop-BoardProcs {
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match 'Start-Board\.ps1') -and ($_.CommandLine -notmatch 'Watch-Board') } |
    ForEach-Object {
      try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
    }
}

function Start-BoardServer {
  Write-Log 'Starting Start-Board.ps1 (hidden, no browser)'
  Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile','-STA','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File', $BoardPs1, '-NoBrowser'
  ) -WorkingDirectory $Root -WindowStyle Hidden | Out-Null
}

Write-Log 'Watchdog started'
$dup = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and ($_.CommandLine -match 'Watch-Board\.ps1') -and $_.ProcessId -ne $PID }
if ($dup) {
  Write-Log 'Another watchdog already running - exiting'
  exit 0
}
Start-BoardServer
Start-Sleep -Seconds 4

while ($true) {
  if (-not (Test-BoardUp)) {
    Write-Log 'Board down - restarting'
    Stop-BoardProcs
    Start-Sleep -Seconds 2
    Start-BoardServer
    Start-Sleep -Seconds 5
    if (Test-BoardUp) { Write-Log 'Board back UP' } else { Write-Log 'Board still DOWN after restart' }
  }
  Start-Sleep -Seconds 8
}
