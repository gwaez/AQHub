# Setup-AQWizard.ps1
# Clean-machine helper for the AQWizard Windows companion (Tauri 2).
# ASCII-only. Does NOT embed secrets, tokens, or CRM config.
# Does NOT auto-send email. Does NOT enable autostart unless -Autostart is passed.
# Does NOT install Visual Studio Build Tools automatically (heavy; known path below).

[CmdletBinding()]
param(
  [switch]$SkipNpmInstall,
  [switch]$Autostart,
  [switch]$DisableAutostart,
  [switch]$UseRegistryRunKey,
  [switch]$LaunchDev
)

$ErrorActionPreference = 'Continue'
$BoardUrl = 'http://127.0.0.1:8766/board.html'
$MinNodeMajor = 20

function Write-Step {
  param([string]$Message, [string]$Color = 'Cyan')
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

function Write-Hint {
  param([string]$Message)
  Write-Host ('    ' + $Message) -ForegroundColor DarkGray
}

function Test-IsAqHubRoot {
  param([string]$Path)
  if (-not $Path) { return $false }
  return ((Test-Path (Join-Path $Path 'Start-Board.ps1')) -and (Test-Path (Join-Path $Path 'board.html')))
}

function Resolve-AqHubRoot {
  $scriptRoot = $null
  if ($PSScriptRoot) { $scriptRoot = $PSScriptRoot }
  elseif ($MyInvocation.MyCommand.Path) { $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
  if (Test-IsAqHubRoot $scriptRoot) { return $scriptRoot }
  if ($scriptRoot) {
    $parent = Split-Path -Parent $scriptRoot
    if (Test-IsAqHubRoot $parent) { return $parent }
  }
  $cwd = (Get-Location).Path
  if (Test-IsAqHubRoot $cwd) { return $cwd }
  $docs = Join-Path $env:USERPROFILE 'Documents\AQHub'
  if (Test-IsAqHubRoot $docs) { return $docs }
  return $null
}

function Get-CommandVersion {
  param([string]$Name)
  try {
    $cmd = Get-Command $Name -ErrorAction Stop
    return $cmd.Source
  } catch {
    return $null
  }
}

function Test-NodeVersion {
  Write-Step 'Checking Node.js 20+...'
  $node = Get-CommandVersion 'node'
  if (-not $node) {
    Write-Fail 'node.exe not on PATH.'
    Write-Hint 'Install LTS: winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements'
    Write-Hint 'Then close and reopen PowerShell.'
    return $false
  }
  $raw = (& node -v 2>$null)
  $major = 0
  if ($raw -match 'v?(\d+)') { $major = [int]$Matches[1] }
  if ($major -lt $MinNodeMajor) {
    Write-Fail ("Node $raw found; need v$MinNodeMajor or newer.")
    Write-Hint 'winget install --id OpenJS.NodeJS.LTS -e --source winget'
    return $false
  }
  $npm = Get-CommandVersion 'npm'
  Write-Ok ("Node $raw ($node)")
  if ($npm) { Write-Ok ("npm at $npm") } else { Write-WarnLine 'npm not on PATH (usually ships with Node).' }
  return $true
}

function Test-RustToolchain {
  Write-Step 'Checking Rust / cargo...'
  $cargo = Get-CommandVersion 'cargo'
  $rustc = Get-CommandVersion 'rustc'
  if (-not $cargo -or -not $rustc) {
    Write-Fail 'Rust toolchain missing (need rustc + cargo).'
    Write-Hint 'winget install --id Rustlang.Rustup -e --source winget --accept-package-agreements --accept-source-agreements'
    Write-Hint 'Then: rustup default stable'
    Write-Hint 'Tauri 2 on this repo wants Rust stable >= 1.88.'
    return $false
  }
  $cv = (& cargo --version 2>$null)
  $rv = (& rustc --version 2>$null)
  Write-Ok $cv
  Write-Ok $rv
  return $true
}

function Test-WebView2 {
  Write-Step 'Checking WebView2 runtime...'
  $keys = @(
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
  )
  foreach ($k in $keys) {
    if (Test-Path $k) {
      Write-Ok ("WebView2 registry key present: $k")
      return $true
    }
  }
  $candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\EdgeWebView\Application\msedgewebview2.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\EdgeWebView\Application\msedgewebview2.exe')
  )
  foreach ($p in $candidates) {
    if ($p -and (Test-Path $p)) {
      Write-Ok ("WebView2 exe: $p")
      return $true
    }
  }
  Write-WarnLine 'WebView2 runtime not detected. Windows 10/11 usually has it; if tauri windows are blank, install:'
  Write-Hint 'https://developer.microsoft.com/microsoft-edge/webview2/'
  Write-Hint 'winget install --id Microsoft.EdgeWebView2Runtime -e --source winget'
  return $false
}

function Test-MsvcLinker {
  Write-Step 'Checking MSVC linker (link.exe) / VS Build Tools...'
  $link = Get-CommandVersion 'link'
  if ($link) {
    Write-Ok ("link.exe on PATH: $link")
    return $true
  }
  $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  if (Test-Path $vswhere) {
    $inst = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    if ($inst) {
      Write-Ok ("VS C++ tools at: $inst")
      Write-WarnLine 'link.exe is not on this PowerShell PATH. Open "x64 Native Tools Command Prompt for VS" or launch from a Developer PowerShell.'
      return $true
    }
    Write-WarnLine 'vswhere found Visual Studio, but the VC Tools component is missing.'
  } else {
    Write-WarnLine 'vswhere.exe not found. Visual Studio Build Tools may be missing.'
  }
  Write-Host '    Build Tools (do this on the Windows machine; this script will NOT auto-install):' -ForegroundColor Yellow
  Write-Hint '1. Visual Studio Installer -> Modify -> workload "Desktop development with C++"'
  Write-Hint '   Typical path: C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools'
  Write-Hint '2. Or: winget install --id Microsoft.VisualStudio.2022.BuildTools -e --source winget'
  Write-Hint '   Then add workload Microsoft.VisualStudio.Workload.VCTools + Windows SDK (includeRecommended).'
  Write-Hint 'Tauri / cargo cannot link aqwizard.exe without MSVC. Magic Wand/UIA also waits on this.'
  return $false
}

function Find-AQWizardExe {
  param([string]$Root)
  $direct = Join-Path $Root 'desktop-wizard\src-tauri\target\release\aqwizard.exe'
  if (Test-Path $direct) { return $direct }
  $bundle = Join-Path $Root 'desktop-wizard\src-tauri\target\release\bundle'
  if (Test-Path $bundle) {
    $hit = Get-ChildItem -Path $bundle -Recurse -Filter 'aqwizard.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  return $null
}

function Get-AQWizardStartupShortcutPath {
  $startup = [Environment]::GetFolderPath('Startup')
  if (-not $startup) { $startup = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup' }
  return (Join-Path $startup 'AQWizard.lnk')
}

# Opt-in only. Default is off. Creates a current-user Startup folder shortcut.
# Never writes HKLM. HKCU Run key only if -UseRegistryRunKey is also passed.
function Enable-AQWizardAutostart {
  param(
    [string]$Root,
    [switch]$UseRegistry
  )
  Write-Step 'Autostart (opt-in)...'
  $exe = Find-AQWizardExe -Root $Root
  if (-not $exe) {
    Write-Fail 'No aqwizard.exe yet. Autostart was NOT enabled.'
    Write-Hint 'Build on Windows: cd desktop-wizard ; npm run tauri build'
    Write-Hint 'Then re-run: powershell -ExecutionPolicy Bypass -File .\Setup-AQWizard.ps1 -Autostart'
    return $false
  }
  $lnkPath = Get-AQWizardStartupShortcutPath
  try {
    $w = New-Object -ComObject WScript.Shell
    $sc = $w.CreateShortcut($lnkPath)
    $sc.TargetPath = $exe
    $sc.WorkingDirectory = $Root
    $sc.WindowStyle = 7
    $sc.Description = 'AQWizard companion (local AQHub). No cloud. No auto-send.'
    $sc.Save()
    Write-Ok ("Startup shortcut: $lnkPath")
  } catch {
    Write-Fail ("Could not write Startup shortcut: " + $_.Exception.Message)
    return $false
  }
  if ($UseRegistry) {
    $run = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    try {
      New-Item -Path $run -Force | Out-Null
      Set-ItemProperty -Path $run -Name 'AQWizard' -Value ('"' + $exe + '"')
      Write-Ok 'Also wrote HKCU Run value AQWizard (current user only).'
    } catch {
      Write-WarnLine ("HKCU Run key failed: " + $_.Exception.Message)
    }
  } else {
    Write-Hint 'Registry Run key skipped (pass -UseRegistryRunKey to add HKCU only).'
  }
  return $true
}

function Disable-AQWizardAutostart {
  Write-Step 'Removing autostart (if any)...'
  $lnkPath = Get-AQWizardStartupShortcutPath
  if (Test-Path $lnkPath) {
    Remove-Item $lnkPath -Force
    Write-Ok ("Removed $lnkPath")
  } else {
    Write-Ok 'No Startup shortcut present'
  }
  $run = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
  try {
    $prop = Get-ItemProperty -Path $run -Name 'AQWizard' -ErrorAction SilentlyContinue
    if ($prop) {
      Remove-ItemProperty -Path $run -Name 'AQWizard' -ErrorAction SilentlyContinue
      Write-Ok 'Removed HKCU Run value AQWizard'
    }
  } catch {
    # ignore
  }
}

function Ensure-WizardSettingsSample {
  param([string]$Root)
  $data = Join-Path $Root 'data'
  $live = Join-Path $data 'wizard-settings.json'
  $sample = Join-Path $data 'wizard-settings.sample.json'
  if (Test-Path $live) {
    Write-Ok 'data\wizard-settings.json already exists (left unchanged)'
    return
  }
  if (Test-Path $sample) {
    Copy-Item $sample $live -Force
    Write-Ok 'Created data\wizard-settings.json from sample (first-run bubble can greet once)'
  }
}

function Invoke-WizardNpmInstall {
  param([string]$WizardDir)
  Write-Step 'npm install in desktop-wizard (no secrets)...'
  Push-Location $WizardDir
  try {
    & npm install
    if ($LASTEXITCODE -ne 0) {
      Write-Fail ("npm install exited $LASTEXITCODE")
      return $false
    }
    Write-Ok 'npm install finished'
    return $true
  } finally {
    Pop-Location
  }
}

# ---- main ----
Write-Host ''
Write-Host '========================================' -ForegroundColor Magenta
Write-Host '  AQWizard setup (Windows companion)' -ForegroundColor Magenta
Write-Host '  Tauri 2 + local AQHub on 127.0.0.1:8766' -ForegroundColor Magenta
Write-Host '  No Electron / no cloud AI / no auto-send' -ForegroundColor Magenta
Write-Host '========================================' -ForegroundColor Magenta
Write-WarnLine 'Full signed NSIS/MSI is not produced here. Use npm run tauri build on Windows when ready.'
Write-WarnLine 'Autostart stays OFF unless you pass -Autostart after a successful tauri build.'

$root = Resolve-AqHubRoot
if (-not $root) {
  Write-Fail 'Could not find AQHub (Start-Board.ps1 + board.html). Run Setup-AQHub.ps1 first, or cd to the clone.'
  exit 1
}
Write-Ok ("AQHub root: $root")
Set-Location $root

$wizardDir = Join-Path $root 'desktop-wizard'
if (-not (Test-Path (Join-Path $wizardDir 'package.json'))) {
  Write-Fail "desktop-wizard\package.json missing under $root"
  exit 1
}

$nodeOk = Test-NodeVersion
$rustOk = Test-RustToolchain
$wvOk = Test-WebView2
$msvcOk = Test-MsvcLinker

Ensure-WizardSettingsSample -Root $root

if ($DisableAutostart) {
  Disable-AQWizardAutostart
}

$npmOk = $true
if ($SkipNpmInstall) {
  Write-WarnLine 'Skipping npm install (-SkipNpmInstall).'
} elseif ($nodeOk) {
  $npmOk = Invoke-WizardNpmInstall -WizardDir $wizardDir
} else {
  $npmOk = $false
  Write-Fail 'Skipping npm install because Node is missing.'
}

if ($Autostart) {
  $null = Enable-AQWizardAutostart -Root $root -UseRegistry:$UseRegistryRunKey
} else {
  Write-Step 'Autostart'
  Write-Ok 'Left OFF (default). Later: Setup-AQWizard.ps1 -Autostart'
}

Write-Step 'How to run'
Write-Host '    1. Start AQHub first:  powershell -ExecutionPolicy Bypass -File .\Setup-AQHub.ps1' -ForegroundColor Green
Write-Host "       or double-click Start-Board-Background.bat  -> $BoardUrl" -ForegroundColor Green
Write-Host '    2. Dev companion:     cd desktop-wizard ; npm run tauri dev' -ForegroundColor Green
Write-Host '    3. Windows exe:       cd desktop-wizard ; npm run tauri build' -ForegroundColor Green
Write-Host '       Output (unsigned): desktop-wizard\src-tauri\target\release\aqwizard.exe' -ForegroundColor DarkGray
Write-Host '       NSIS bundle if enabled in tauri.conf.json (currently bundle.active = false).' -ForegroundColor DarkGray
Write-Host '    Docs: desktop-wizard\docs\WINDOWS-SETUP.md' -ForegroundColor Green
Write-Host '    Safety: wizard never calls /api/task/approve-send. Do not commit data\wizard-settings.json.' -ForegroundColor Green

if ($LaunchDev) {
  if (-not ($nodeOk -and $rustOk -and $npmOk)) {
    Write-Fail '-LaunchDev requested but Node/Rust/npm install is not ready.'
    exit 1
  }
  Write-Step 'Launching npm run tauri dev (blocking)...'
  Set-Location $wizardDir
  & npm run tauri dev
  exit $LASTEXITCODE
}

$ready = $nodeOk -and $rustOk -and $npmOk
if (-not $msvcOk) {
  Write-WarnLine 'MSVC linker missing: tauri build / tauri dev will fail until Build Tools C++ workload is installed.'
}
if (-not $wvOk) {
  Write-WarnLine 'WebView2 missing: install the runtime before tauri windows will render.'
}

Write-Step 'Done' 'Green'
if ($ready -and $msvcOk) {
  Write-Host '    Toolchain looks ready for npm run tauri dev / build on this PC.' -ForegroundColor Green
  exit 0
}
Write-Host '    Setup finished with missing pieces (see NOTES above). Docs still apply.' -ForegroundColor Yellow
exit 0
