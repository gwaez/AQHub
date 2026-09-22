# Setup-AQHub.ps1
# One-shot local setup for AQHub on Windows.
# ASCII-only. Shows progress. Does NOT auto-send email. Does NOT commit secrets.
# Real prompts only: Git/winget progress, GitHub login when cloning private repo,
# Outlook/Windows COM prompts when mail features are used.

$ErrorActionPreference = 'Continue'
$RepoUrl = 'https://github.com/gwaez/AQHub.git'
$BoardUrl = 'http://127.0.0.1:8766/'
$DefaultCloneParent = Join-Path $env:USERPROFILE 'Documents'
$DefaultClonePath = Join-Path $DefaultCloneParent 'AQHub'

function Write-Step {
  param(
    [string]$Message,
    [string]$Color = 'Cyan'
  )
  Write-Host ''
  Write-Host ('==> ' + $Message) -ForegroundColor $Color
}

function Write-Ok {
  param([string]$Message)
  Write-Host ('    OK: ' + $Message) -ForegroundColor Green
}

function Write-WarnLine {
  param([string]$Message)
  Write-Host ('    NOTE: ' + $Message) -ForegroundColor Yellow
}

function Write-Fail {
  param([string]$Message)
  Write-Host ('    ERROR: ' + $Message) -ForegroundColor Red
}

function Test-GitAvailable {
  try {
    $null = Get-Command git -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Ensure-Git {
  Write-Step 'Checking Git...'
  if (Test-GitAvailable) {
    try {
      $ver = (& git --version 2>$null)
      Write-Ok ("Git found: $ver")
    } catch {
      Write-Ok 'Git found'
    }
    return $true
  }

  Write-WarnLine 'Git not found. Trying winget install (you will see download progress)...'
  Write-Host '    Downloading Git via winget...' -ForegroundColor Yellow
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Fail 'winget is not available. Install Git from https://git-scm.com/download/win then reopen PowerShell.'
    return $false
  }

  & winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
  $code = $LASTEXITCODE

  # Refresh PATH for this session (common Git install locations)
  $gitCandidates = @(
    (Join-Path $env:ProgramFiles 'Git\cmd'),
    (Join-Path ${env:ProgramFiles(x86)} 'Git\cmd'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd')
  )
  foreach ($dir in $gitCandidates) {
    if ($dir -and (Test-Path $dir)) {
      if ($env:Path -notlike "*$dir*") {
        $env:Path = $dir + ';' + $env:Path
      }
    }
  }

  if (Test-GitAvailable) {
    Write-Ok 'Git is now available in this session'
    return $true
  }

  if ($code -eq 0) {
    Write-WarnLine 'Git may have installed, but this PowerShell session cannot see it yet.'
    Write-WarnLine 'Close PowerShell, open a new one, cd to the folder, and run this script again.'
  } else {
    Write-Fail ("winget exited with code $code. Install Git manually, reopen PowerShell, then retry.")
  }
  return $false
}

function Test-IsAqHubRoot {
  param([string]$Path)
  if (-not $Path) { return $false }
  $marker = Join-Path $Path 'Start-Board.ps1'
  $board = Join-Path $Path 'board.html'
  return ((Test-Path $marker) -and (Test-Path $board))
}

function Resolve-RepoRoot {
  Write-Step 'Locating AQHub folder...'

  # 1) Directory of this script (when already inside a clone)
  $scriptRoot = $null
  if ($PSScriptRoot) {
    $scriptRoot = $PSScriptRoot
  } elseif ($MyInvocation.MyCommand.Path) {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  }
  if (Test-IsAqHubRoot $scriptRoot) {
    Write-Ok ("Using script folder: $scriptRoot")
    return $scriptRoot
  }

  # 2) Current directory
  $cwd = (Get-Location).Path
  if (Test-IsAqHubRoot $cwd) {
    Write-Ok ("Using current folder: $cwd")
    return $cwd
  }

  # 3) Existing default clone
  if (Test-IsAqHubRoot $DefaultClonePath) {
    Write-Ok ("Using existing clone: $DefaultClonePath")
    return $DefaultClonePath
  }

  # 4) Clone into Documents\AQHub
  Write-WarnLine "Repo not found locally. Cloning into: $DefaultClonePath"
  Write-Host '    Cloning repo (if private, a browser / GitHub login window may open - approve access)...' -ForegroundColor Yellow

  if (-not (Test-Path $DefaultCloneParent)) {
    New-Item -ItemType Directory -Path $DefaultCloneParent -Force | Out-Null
  }

  if (Test-Path $DefaultClonePath) {
    Write-Fail ("Folder exists but does not look like AQHub: $DefaultClonePath")
    Write-Fail 'Move/rename that folder, or run this script from inside a valid AQHub clone.'
    return $null
  }

  Push-Location $DefaultCloneParent
  try {
    & git clone $RepoUrl
    if ($LASTEXITCODE -ne 0) {
      Write-Fail 'git clone failed. Sign in to GitHub if prompted, confirm you have access, then retry.'
      return $null
    }
  } finally {
    Pop-Location
  }

  if (Test-IsAqHubRoot $DefaultClonePath) {
    Write-Ok ("Cloned successfully: $DefaultClonePath")
    return $DefaultClonePath
  }

  Write-Fail 'Clone finished but Start-Board.ps1 / board.html were not found.'
  return $null
}

function Ensure-DataFiles {
  param([string]$Root)

  Write-Step 'Preparing local data files (samples if missing)...'
  $dataDir = Join-Path $Root 'data'
  if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    Write-Ok "Created data folder: $dataDir"
  }

  $tasksPath = Join-Path $dataDir 'tasks.json'
  $tasksSample = Join-Path $dataDir 'tasks.sample.json'
  if (-not (Test-Path $tasksPath)) {
    if (Test-Path $tasksSample) {
      Copy-Item $tasksSample $tasksPath -Force
      Write-Ok 'Created data\tasks.json from tasks.sample.json'
    } else {
      $seed = '{"version":1,"title":"Aqaar Command Board","updatedAt":null,"tasks":[]}'
      [IO.File]::WriteAllText($tasksPath, $seed, [Text.UTF8Encoding]::new($false))
      Write-Ok 'Created empty data\tasks.json'
    }
  } else {
    Write-Ok 'data\tasks.json already exists (left unchanged)'
  }

  $crmPath = Join-Path $dataDir 'crm-config.json'
  $crmSample = Join-Path $dataDir 'crm-config.sample.json'
  if (-not (Test-Path $crmPath)) {
    if (Test-Path $crmSample) {
      Copy-Item $crmSample $crmPath -Force
      Write-Ok 'Created data\crm-config.json from crm-config.sample.json'
    } else {
      $crmSeed = '{"connected":false,"note":"Configure Dynamics CRM locally; do not commit secrets."}'
      [IO.File]::WriteAllText($crmPath, $crmSeed, [Text.UTF8Encoding]::new($false))
      Write-Ok 'Created data\crm-config.json stub'
    }
  } else {
    Write-Ok 'data\crm-config.json already exists (left unchanged)'
  }

  Write-WarnLine 'Email never auto-sends. Approve send only when you choose to.'
  Write-WarnLine 'Do not commit data\tasks.json, data\crm-config.json, tokens, or .env files.'
}

function Start-BoardKeepAlive {
  param([string]$Root)

  Write-Step 'Starting board (hidden keepalive watchdog)...'
  Write-Host '    Starting board in the background (no PowerShell window). Outlook/Windows may show a COM security prompt later - Allow if you trust this run.' -ForegroundColor Yellow

  $bgVbs = Join-Path $Root 'Start-Board-Background.vbs'
  $keepAliveBat = Join-Path $Root 'Start-Board-KeepAlive.bat'
  $watchPs1 = Join-Path $Root 'Watch-Board.ps1'
  $startPs1 = Join-Path $Root 'Start-Board.ps1'

  if (Test-Path $bgVbs) {
    Start-Process -FilePath 'wscript.exe' -ArgumentList @('//nologo', $bgVbs) -WorkingDirectory $Root | Out-Null
    Write-Ok 'Launched Start-Board-Background.vbs (hidden Watch-Board)'
    return
  }

  if (Test-Path $keepAliveBat) {
    Start-Process -FilePath $keepAliveBat -WorkingDirectory $Root | Out-Null
    Write-Ok 'Launched Start-Board-KeepAlive.bat'
    return
  }

  if (Test-Path $watchPs1) {
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', $watchPs1
    ) -WorkingDirectory $Root -WindowStyle Hidden | Out-Null
    Write-Ok 'Launched Watch-Board.ps1 hidden'
    return
  }

  if (Test-Path $startPs1) {
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', $startPs1, '-NoBrowser'
    ) -WorkingDirectory $Root -WindowStyle Hidden | Out-Null
    Write-Ok 'Launched Start-Board.ps1 hidden'
    return
  }

  Write-Fail 'Could not find Start-Board-Background.vbs, Watch-Board.ps1, or Start-Board.ps1'
}

function Wait-And-OpenBrowser {
  Write-Step 'Waiting for local server, then opening the control homepage once...'
  Write-Host '    Opening homepage (not the task board)...' -ForegroundColor Yellow

  $ready = $false
  for ($i = 1; $i -le 20; $i++) {
    Start-Sleep -Seconds 1
    try {
      $r = Invoke-WebRequest -UseBasicParsing $BoardUrl -TimeoutSec 2
      if ($r.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {
      # still starting
    }
    Write-Host ("    Waiting for board... ($i/20)") -ForegroundColor DarkGray
  }

  try {
    Start-Process $BoardUrl | Out-Null
  } catch {
    Write-WarnLine "Could not auto-open browser. Open manually: $BoardUrl"
  }

  if ($ready) {
    Write-Ok ("Control home is responding at $BoardUrl")
  } else {
    Write-WarnLine "Server did not answer yet. Open $BoardUrl in a few seconds, or re-run Start-Board-Background.bat"
  }
}

# ---- main ----
Write-Host ''
Write-Host '========================================' -ForegroundColor Magenta
Write-Host '  AQHub local setup (Windows)' -ForegroundColor Magenta
Write-Host '  HTML + PowerShell HttpListener + Outlook COM' -ForegroundColor Magenta
Write-Host '  No npm / no cloud stack / no fake OAuth' -ForegroundColor Magenta
Write-Host '========================================' -ForegroundColor Magenta
Write-WarnLine 'If the repo is private, a GitHub browser login may appear during clone.'
Write-WarnLine 'Outlook must already be installed and signed in for mail features.'

if (-not (Ensure-Git)) {
  Write-Fail 'Setup stopped: Git is required.'
  exit 1
}

$root = Resolve-RepoRoot
if (-not $root) {
  Write-Fail 'Setup stopped: could not locate or clone AQHub.'
  exit 1
}

Set-Location $root
Ensure-DataFiles -Root $root
Start-BoardKeepAlive -Root $root
Wait-And-OpenBrowser

Write-Step 'Done' 'Green'
Write-Host "    Control home: $BoardUrl" -ForegroundColor Green
Write-Host "    Task board:   http://127.0.0.1:8766/board.html (not auto-opened)" -ForegroundColor Green
Write-Host '    Safety: email never auto-sends; approve only.' -ForegroundColor Green
Write-Host '    For Arabic steps see SETUP-AR.md' -ForegroundColor Green
Write-Host ''
exit 0
