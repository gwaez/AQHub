# ASCII-only thin AQWizard bridge.
# Dotted from Start-Board.ps1. Owns data/wizard-settings.json plus a read-only
# Outlook status probe (GetActiveObject wrap). Never writes tasks.json / tokens.
# Never starts Outlook. Never calls approve-send.

$script:WizardBridgeVersion = '0.6.0-characters'

function Get-WizardSettingsPath {
  param([string]$DataDir)
  return (Join-Path $DataDir 'wizard-settings.json')
}

function Test-WizardSafeCharacterId {
  param([string]$Id)
  if (-not $Id) { return $false }
  if ($Id -notmatch '^[a-z][a-z0-9-]{0,47}$') { return $false }
  if ($Id.Contains('..') -or $Id.Contains('/') -or $Id.Contains('\')) { return $false }
  if ($Id -in @('con','prn','aux','nul','com1','lpt1')) { return $false }
  return $true
}

function ConvertTo-WizardCharacterSlug {
  param([string]$Name)
  $raw = if ($null -eq $Name) { '' } else { [string]$Name }
  $s = $raw.Trim().ToLowerInvariant()
  $s = [regex]::Replace($s, '[\s_]+', '-')
  $s = [regex]::Replace($s, '[^a-z0-9-]', '')
  $s = [regex]::Replace($s, '-+', '-')
  $s = $s.Trim('-')
  if (-not $s) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
      $bytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($raw))
      $hex = ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
      $s = 'char-' + $hex.Substring(0, 8)
    } finally {
      $sha.Dispose()
    }
  }
  if ($s.Length -gt 48) { $s = $s.Substring(0, 48).Trim('-') }
  if ($s -notmatch '^[a-z]') { $s = ('c-' + $s) }
  if ($s.Length -gt 48) { $s = $s.Substring(0, 48).Trim('-') }
  if (-not (Test-WizardSafeCharacterId $s)) { $s = 'char-pack' }
  return $s
}

function Get-WizardRepoRoot {
  param(
    [string]$Root,
    [string]$DataDir
  )
  if ($Root) { return [IO.Path]::GetFullPath($Root) }
  if ($DataDir) { return [IO.Path]::GetFullPath((Split-Path $DataDir -Parent)) }
  return $null
}

function Get-WizardCharactersRoot {
  param(
    [string]$Root,
    [string]$DataDir
  )
  $repo = Get-WizardRepoRoot -Root $Root -DataDir $DataDir
  if (-not $repo) { return $null }
  return [IO.Path]::GetFullPath((Join-Path $repo (Join-Path 'desktop-wizard' 'characters')))
}

function Test-WizardPathUnder {
  param(
    [string]$Child,
    [string]$Parent
  )
  if (-not $Child -or -not $Parent) { return $false }
  $parentFull = [IO.Path]::GetFullPath($Parent)
  $sep = [string][IO.Path]::DirectorySeparatorChar
  if (-not $parentFull.EndsWith($sep)) { $parentFull = $parentFull + $sep }
  $childFull = [IO.Path]::GetFullPath($Child)
  return $childFull.StartsWith($parentFull, [StringComparison]::OrdinalIgnoreCase)
}

function Get-WizardPoseCatalog {
  return @(
    [ordered]@{ id = 'idle'; file = 'idle.png'; state = 'IDLE'; required = $true; motion = 'breathe'; loop = $true }
    [ordered]@{ id = 'watch'; file = 'watch.png'; state = 'WATCHING'; required = $false; motion = 'glance'; loop = $true }
    [ordered]@{ id = 'think'; file = 'think.png'; state = 'THINKING'; required = $true; motion = 'ponder'; loop = $true }
    [ordered]@{ id = 'speak'; file = 'speak.png'; state = 'SPEAKING'; required = $false; motion = 'speak'; loop = $true }
    [ordered]@{ id = 'work'; file = 'work.png'; state = 'WORKING'; required = $false; motion = 'work'; loop = $true }
    [ordered]@{ id = 'success'; file = 'success.png'; state = 'SUCCESS'; required = $false; motion = 'success'; loop = $false }
    [ordered]@{ id = 'error'; file = 'error.png'; state = 'ERROR'; required = $false; motion = 'error'; loop = $false }
    [ordered]@{ id = 'drag'; file = 'drag.png'; state = 'DRAGGING'; required = $false; motion = 'lift'; loop = $false }
    [ordered]@{ id = 'sleep'; file = 'sleep.png'; state = 'SLEEPING'; required = $true; motion = 'sleep'; loop = $true }
  )
}

function Test-WizardPngBytes {
  param([byte[]]$Bytes)
  if ($null -eq $Bytes -or $Bytes.Length -lt 24) { return $false }
  if ($Bytes.Length -gt 2097152) { return $false }
  return (
    $Bytes[0] -eq 0x89 -and $Bytes[1] -eq 0x50 -and $Bytes[2] -eq 0x4E -and $Bytes[3] -eq 0x47 -and
    $Bytes[4] -eq 0x0D -and $Bytes[5] -eq 0x0A -and $Bytes[6] -eq 0x1A -and $Bytes[7] -eq 0x0A
  )
}

function ConvertFrom-WizardPngData {
  param([string]$Data)
  if (-not $Data) { throw 'empty_png' }
  $raw = $Data.Trim()
  if ($raw -match '^data:image/png;base64,(.+)$') {
    $raw = $Matches[1]
  } elseif ($raw -match '^data:image/') {
    throw 'png_only'
  }
  try {
    $bytes = [Convert]::FromBase64String($raw)
  } catch {
    throw 'bad_base64'
  }
  if (-not (Test-WizardPngBytes $bytes)) { throw 'not_png' }
  return $bytes
}

function Get-WizardPackDir {
  param(
    [string]$Root,
    [string]$DataDir,
    [string]$Id
  )
  if (-not (Test-WizardSafeCharacterId $Id)) { return $null }
  $chars = Get-WizardCharactersRoot -Root $Root -DataDir $DataDir
  if (-not $chars) { return $null }
  $pack = [IO.Path]::GetFullPath((Join-Path $chars $Id))
  if (-not (Test-WizardPathUnder -Child $pack -Parent $chars)) { return $null }
  return $pack
}

function Copy-WizardCharacterToPublic {
  param(
    [string]$Root,
    [string]$DataDir,
    [string]$Id
  )
  $src = Get-WizardPackDir -Root $Root -DataDir $DataDir -Id $Id
  $repo = Get-WizardRepoRoot -Root $Root -DataDir $DataDir
  if (-not $src -or -not (Test-Path $src) -or -not $repo) { return }
  $pubRoot = [IO.Path]::GetFullPath((Join-Path $repo (Join-Path 'desktop-wizard' (Join-Path 'public' 'characters'))))
  if (-not (Test-Path $pubRoot)) {
    New-Item -ItemType Directory -Force -Path $pubRoot | Out-Null
  }
  if (-not (Test-WizardPathUnder -Child $pubRoot -Parent (Join-Path $repo 'desktop-wizard'))) { return }
  $dest = [IO.Path]::GetFullPath((Join-Path $pubRoot $Id))
  if (-not (Test-WizardPathUnder -Child $dest -Parent $pubRoot)) { return }
  if (Test-Path $dest) {
    Remove-Item -Recurse -Force -LiteralPath $dest
  }
  Copy-Item -Recurse -Force -LiteralPath $src -Destination $dest
}

function New-WizardPackManifest {
  param(
    [string]$Id,
    [string]$DisplayName,
    $Have
  )
  $haveSet = @{}
  foreach ($k in @($Have)) { if ($k) { $haveSet[[string]$k] = $true } }
  function PoseFile([string]$Key) {
    if ($haveSet.ContainsKey($Key)) {
      switch ($Key) {
        'idle' { return 'idle.png' }
        'watch' { return 'watch.png' }
        'think' { return 'think.png' }
        'speak' { return 'speak.png' }
        'work' { return 'work.png' }
        'success' { return 'success.png' }
        'error' { return 'error.png' }
        'drag' { return 'drag.png' }
        'sleep' { return 'sleep.png' }
      }
    }
    return 'idle.png'
  }
  $speakFile = if ($haveSet.ContainsKey('speak')) { 'speak.png' } else { (PoseFile 'idle') }
  $workFile = if ($haveSet.ContainsKey('work')) { 'work.png' } else { (PoseFile 'idle') }
  $name = if ($DisplayName) { [string]$DisplayName } else { $Id }
  return [ordered]@{
    id = $Id
    technicalId = 'AQWizard'
    version = '0.1.0'
    defaultDisplayName = $name
    displayNameAr = $name
    displayNameEn = $name
    license = 'user-upload'
    tone = 'custom'
    states = [ordered]@{
      IDLE = [ordered]@{ asset = (PoseFile 'idle'); loop = $true; motion = 'breathe' }
      WATCHING = [ordered]@{ asset = (PoseFile 'watch'); loop = $true; motion = 'glance' }
      THINKING = [ordered]@{ asset = (PoseFile 'think'); loop = $true; motion = 'ponder' }
      SPEAKING = [ordered]@{ asset = (PoseFile 'speak'); loop = $true; motion = 'speak' }
      ALERT = [ordered]@{ asset = $speakFile; loop = $false; motion = 'alert' }
      WORKING = [ordered]@{ asset = (PoseFile 'work'); loop = $true; motion = 'work' }
      SUCCESS = [ordered]@{ asset = (PoseFile 'success'); loop = $false; motion = 'success' }
      ERROR = [ordered]@{ asset = (PoseFile 'error'); loop = $false; motion = 'error' }
      DRAGGING = [ordered]@{ asset = (PoseFile 'drag'); loop = $false; motion = 'lift' }
      SLEEPING = [ordered]@{ asset = (PoseFile 'sleep'); loop = $true; motion = 'sleep' }
      HIDDEN = [ordered]@{ asset = $null; loop = $false; motion = 'fade-out' }
      WAND = [ordered]@{ asset = $workFile; stub = $true }
      NOTE = [ordered]@{ asset = $workFile; stub = $true }
      MATRIX = [ordered]@{ asset = $workFile; loop = $true; motion = 'work' }
      TRASH = [ordered]@{ asset = $workFile; loop = $false; motion = 'work' }
    }
    anchors = [ordered]@{
      bubble = [ordered]@{ x = 430; y = 210; dir = 'rtl' }
      wand = [ordered]@{ x = 780; y = 620 }
    }
    bubble = [ordered]@{
      dir = 'rtl'
      lang = 'ar'
      side = 'start'
    }
  }
}

function Get-WizardCharacterSummary {
  param(
    [string]$Root,
    [string]$DataDir,
    [string]$Id
  )
  $pack = Get-WizardPackDir -Root $Root -DataDir $DataDir -Id $Id
  if (-not $pack -or -not (Test-Path $pack)) { return $null }
  $manifestPath = Join-Path $pack 'manifest.json'
  $display = $Id
  $builtin = $Id -in @('secretary','old-wizard')
  $poses = @()
  foreach ($slot in Get-WizardPoseCatalog) {
    if (Test-Path (Join-Path $pack $slot.file)) { $poses += $slot.id }
  }
  if (Test-Path $manifestPath) {
    try {
      $m = [IO.File]::ReadAllText($manifestPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
      if ($m.defaultDisplayName) { $display = [string]$m.defaultDisplayName }
      elseif ($m.displayNameAr) { $display = [string]$m.displayNameAr }
      if ($m.id) { $Id = [string]$m.id }
    } catch {}
  }
  return [ordered]@{
    id = $Id
    displayName = $display
    defaultDisplayName = $display
    builtin = $builtin
    poses = $poses
    previewUrl = "/api/v1/wizard/characters/$Id/idle.png"
  }
}

function Get-WizardCharacterList {
  param(
    [string]$Root,
    [string]$DataDir
  )
  $chars = Get-WizardCharactersRoot -Root $Root -DataDir $DataDir
  $out = @()
  $seen = @{}
  foreach ($id in @('secretary','old-wizard')) {
    $row = Get-WizardCharacterSummary -Root $Root -DataDir $DataDir -Id $id
    if ($row) { $out += $row; $seen[$id] = $true }
  }
  if ($chars -and (Test-Path $chars)) {
    Get-ChildItem -LiteralPath $chars -Directory -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object {
      $id = $_.Name
      if ($seen.ContainsKey($id)) { return }
      if (-not (Test-WizardSafeCharacterId $id)) { return }
      $row = Get-WizardCharacterSummary -Root $Root -DataDir $DataDir -Id $id
      if ($row) { $out += $row; $seen[$id] = $true }
    }
  }
  return $out
}

function Save-WizardUploadedPack {
  param(
    [string]$Root,
    [string]$DataDir,
    $Payload
  )
  $name = [string]$Payload.name
  $id = [string]$Payload.id
  if (-not $id) { $id = ConvertTo-WizardCharacterSlug $name }
  $id = $id.Trim().ToLowerInvariant()
  if (-not (Test-WizardSafeCharacterId $id)) { throw 'bad_id' }
  if ($id -in @('secretary','old-wizard')) { throw 'builtin_pack' }
  $posesObj = $Payload.poses
  if ($null -eq $posesObj) { throw 'idle_required' }
  $have = @()
  $files = @{}
  foreach ($slot in Get-WizardPoseCatalog) {
    $entry = $null
    if ($posesObj.PSObject.Properties[$slot.id]) { $entry = $posesObj.($slot.id) }
    if ($null -eq $entry) { continue }
    $data = $null
    if ($entry -is [string]) { $data = [string]$entry }
    elseif ($entry.PSObject.Properties['data']) { $data = [string]$entry.data }
    elseif ($entry.PSObject.Properties['png']) { $data = [string]$entry.png }
    if (-not $data) { continue }
    $bytes = ConvertFrom-WizardPngData $data
    $files[$slot.id] = @{ file = $slot.file; bytes = $bytes }
    $have += $slot.id
  }
  if (-not ($have -contains 'idle')) { throw 'idle_required' }
  $pack = Get-WizardPackDir -Root $Root -DataDir $DataDir -Id $id
  if (-not $pack) { throw 'bad_path' }
  $chars = Get-WizardCharactersRoot -Root $Root -DataDir $DataDir
  if (-not (Test-Path $chars)) {
    New-Item -ItemType Directory -Force -Path $chars | Out-Null
  }
  if (-not (Test-Path $pack)) {
    New-Item -ItemType Directory -Force -Path $pack | Out-Null
  }
  if (-not (Test-WizardPathUnder -Child $pack -Parent $chars)) { throw 'bad_path' }
  foreach ($key in $files.Keys) {
    $row = $files[$key]
    $dest = Join-Path $pack $row.file
    if (-not (Test-WizardPathUnder -Child $dest -Parent $pack)) { throw 'bad_path' }
    [IO.File]::WriteAllBytes($dest, $row.bytes)
  }
  $display = if ($name) { $name.Trim() } else { $id }
  if ($display.Length -gt 80) { $display = $display.Substring(0, 80) }
  $manifest = New-WizardPackManifest -Id $id -DisplayName $display -Have $have
  $manifestPath = Join-Path $pack 'manifest.json'
  if ([IO.Path]::GetFileName($manifestPath) -ne 'manifest.json') { throw 'bad_path' }
  $json = ($manifest | ConvertTo-Json -Depth 8)
  [IO.File]::WriteAllText($manifestPath, $json, [Text.UTF8Encoding]::new($false))
  Copy-WizardCharacterToPublic -Root $Root -DataDir $DataDir -Id $id
  return Get-WizardCharacterSummary -Root $Root -DataDir $DataDir -Id $id
}

function Get-WizardDefaultPermissions {
  return [ordered]@{
    'character.window' = 'allow'
    'aqhub.open' = 'allow'
    'settings.local' = 'allow'
    'board.create_task' = 'allow'
    'board.create_note' = 'allow'
    'board.reminder' = 'allow'
    'eisenhower.move' = 'allow'
    'eisenhower.trash' = 'ask'
    'outlook.read' = 'ask'
    'outlook.draft' = 'ask'
    'outlook.send' = 'never'
    'delete.external' = 'never'
    'uia.magic_wand' = 'never'
    'crm.tokens' = 'never'
  }
}

function Get-WizardCapabilityCatalog {
  return @(
    [ordered]@{ id = 'character.window'; defaultMode = 'allow'; modes = @('allow','ask','never'); implemented = $true; alwaysConfirmOrDeny = $false }
    [ordered]@{ id = 'aqhub.open'; defaultMode = 'allow'; modes = @('allow','ask','never'); implemented = $true; alwaysConfirmOrDeny = $false }
    [ordered]@{ id = 'settings.local'; defaultMode = 'allow'; modes = @('allow'); implemented = $true; alwaysConfirmOrDeny = $false }
    [ordered]@{ id = 'board.create_task'; defaultMode = 'allow'; modes = @('allow','ask','never'); implemented = $true; alwaysConfirmOrDeny = $false }
    [ordered]@{ id = 'board.create_note'; defaultMode = 'allow'; modes = @('allow','ask','never'); implemented = $true; alwaysConfirmOrDeny = $false }
    [ordered]@{ id = 'board.reminder'; defaultMode = 'allow'; modes = @('allow','ask','never'); implemented = $true; alwaysConfirmOrDeny = $false }
    [ordered]@{ id = 'eisenhower.move'; defaultMode = 'allow'; modes = @('allow','ask','never'); implemented = $true; alwaysConfirmOrDeny = $false }
    [ordered]@{ id = 'eisenhower.trash'; defaultMode = 'ask'; modes = @('allow','ask','never'); implemented = $true; alwaysConfirmOrDeny = $false }
    [ordered]@{ id = 'outlook.read'; defaultMode = 'ask'; modes = @('allow','ask','never'); implemented = $true; alwaysConfirmOrDeny = $false }
    [ordered]@{ id = 'outlook.draft'; defaultMode = 'ask'; modes = @('allow','ask','never'); implemented = $true; alwaysConfirmOrDeny = $false }
    [ordered]@{ id = 'outlook.send'; defaultMode = 'never'; modes = @('ask','never'); implemented = $true; alwaysConfirmOrDeny = $true }
    [ordered]@{ id = 'delete.external'; defaultMode = 'never'; modes = @('ask','never'); implemented = $true; alwaysConfirmOrDeny = $true }
    [ordered]@{ id = 'uia.magic_wand'; defaultMode = 'never'; modes = @('never'); implemented = $false; alwaysConfirmOrDeny = $false }
    [ordered]@{ id = 'crm.tokens'; defaultMode = 'never'; modes = @('never'); implemented = $false; alwaysConfirmOrDeny = $false }
  )
}

function ConvertTo-WizardPermissionMap {
  param($Incoming, $Base)
  $perms = Get-WizardDefaultPermissions
  foreach ($src in @($Base, $Incoming)) {
    if ($null -eq $src) { continue }
    $props = @()
    if ($src -is [hashtable] -or $src -is [System.Collections.IDictionary]) {
      foreach ($k in $src.Keys) {
        $props += [pscustomobject]@{ Name = [string]$k; Value = $src[$k] }
      }
    } else {
      $props = @($src.PSObject.Properties)
    }
    foreach ($p in $props) {
      $name = [string]$p.Name
      $val = [string]$p.Value
      if ($val -notin @('allow','ask','never')) { continue }
      if (-not $perms.Contains($name)) { continue }
      $perms[$name] = $val
    }
  }
  if ($perms['outlook.send'] -eq 'allow') { $perms['outlook.send'] = 'ask' }
  if ($perms['delete.external'] -eq 'allow') { $perms['delete.external'] = 'ask' }
  $perms['settings.local'] = 'allow'
  $perms['uia.magic_wand'] = 'never'
  $perms['crm.tokens'] = 'never'
  return $perms
}

function Get-WizardDefaultSettings {
  return [ordered]@{
    version = 1
    characterId = 'secretary'
    technicalId = 'AQWizard'
    displayName = 'Secretary'
    window = [ordered]@{
      x = $null
      y = $null
      scale = 1
    }
    visible = $true
    animationLevel = 'normal'
    idleSleepMs = 90000
    reminders = @()
    updatedAt = ''
    language = 'ar'
    startMinimized = $false
    alwaysOnTop = $true
    opacity = 1
    followPointer = $true
    roamEnabled = $true
    preferredCorner = 'bottom-end'
    proactiveBubbles = 'normal'
    bubbleScale = 1
    bubbleFontSize = 13
    closeAction = 'hide'
    mailLastSyncAt = ''
    mailIgnored = @()
    firstRunComplete = $false
    permissions = Get-WizardDefaultPermissions
  }
}

function Read-WizardSettings {
  param([string]$DataDir)
  $path = Get-WizardSettingsPath -DataDir $DataDir
  $defaults = Get-WizardDefaultSettings
  if (-not (Test-Path $path)) {
    return $defaults
  }
  try {
    $raw = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
    $obj = $raw | ConvertFrom-Json
    if (-not $obj) { return $defaults }
    if ($obj.displayName) { $defaults.displayName = [string]$obj.displayName }
    if ($obj.characterId) {
      $cid = [string]$obj.characterId
      if (Test-WizardSafeCharacterId $cid) { $defaults.characterId = $cid }
    }
    if ($obj.technicalId) { $defaults.technicalId = [string]$obj.technicalId }
    if ($obj.PSObject.Properties['visible']) { $defaults.visible = [bool]$obj.visible }
    if ($obj.version) { $defaults.version = [int]$obj.version }
    if ($obj.window) {
      if ($null -ne $obj.window.x -and [string]$obj.window.x -ne '') { $defaults.window.x = [int]$obj.window.x }
      if ($null -ne $obj.window.y -and [string]$obj.window.y -ne '') { $defaults.window.y = [int]$obj.window.y }
      if ($null -ne $obj.window.scale) { $defaults.window.scale = [double]$obj.window.scale }
    }
    if ($obj.updatedAt) { $defaults.updatedAt = [string]$obj.updatedAt }
    if ($obj.animationLevel -and ([string]$obj.animationLevel -in @('normal','reduced','off'))) {
      $defaults.animationLevel = [string]$obj.animationLevel
    }
    if ($null -ne $obj.idleSleepMs) {
      $ms = [int]$obj.idleSleepMs
      if ($ms -lt 5000) { $ms = 5000 }
      if ($ms -gt 600000) { $ms = 600000 }
      $defaults.idleSleepMs = $ms
    }
    if ($null -ne $obj.reminders) { $defaults.reminders = @($obj.reminders) }
    if ($obj.language -and ([string]$obj.language -in @('ar','en'))) { $defaults.language = [string]$obj.language }
    if ($obj.PSObject.Properties['startMinimized']) { $defaults.startMinimized = [bool]$obj.startMinimized }
    if ($obj.PSObject.Properties['alwaysOnTop']) { $defaults.alwaysOnTop = [bool]$obj.alwaysOnTop }
    if ($null -ne $obj.opacity) {
      $op = [double]$obj.opacity
      if ($op -lt 0.35) { $op = 0.35 }
      if ($op -gt 1) { $op = 1 }
      $defaults.opacity = $op
    }
    if ($obj.PSObject.Properties['followPointer']) { $defaults.followPointer = [bool]$obj.followPointer }
    if ($obj.PSObject.Properties['roamEnabled']) { $defaults.roamEnabled = [bool]$obj.roamEnabled }
    if ($obj.preferredCorner -and ([string]$obj.preferredCorner -in @('bottom-end','bottom-start','top-end','top-start'))) {
      $defaults.preferredCorner = [string]$obj.preferredCorner
    }
    if ($obj.proactiveBubbles -and ([string]$obj.proactiveBubbles -in @('high','normal','low','off'))) {
      $defaults.proactiveBubbles = [string]$obj.proactiveBubbles
    }
    if ($null -ne $obj.bubbleScale) {
      $bs = [double]$obj.bubbleScale
      if ($bs -lt 0.7) { $bs = 0.7 }
      if ($bs -gt 1.8) { $bs = 1.8 }
      $defaults.bubbleScale = $bs
    }
    if ($null -ne $obj.bubbleFontSize) {
      $bf = [int]$obj.bubbleFontSize
      if ($bf -lt 11) { $bf = 11 }
      if ($bf -gt 22) { $bf = 22 }
      $defaults.bubbleFontSize = $bf
    }
    if ($obj.closeAction -and ([string]$obj.closeAction -in @('hide','exit'))) {
      $defaults.closeAction = [string]$obj.closeAction
    }
    if ($obj.PSObject.Properties['permissions']) {
      $defaults.permissions = ConvertTo-WizardPermissionMap -Incoming $obj.permissions
    }
    if ($obj.mailLastSyncAt) { $defaults.mailLastSyncAt = [string]$obj.mailLastSyncAt }
    if ($null -ne $obj.mailIgnored) { $defaults.mailIgnored = @($obj.mailIgnored | ForEach-Object { [string]$_ }) }
    if ($obj.PSObject.Properties['firstRunComplete']) { $defaults.firstRunComplete = [bool]$obj.firstRunComplete }
    return $defaults
  } catch {
    return $defaults
  }
}

function Save-WizardSettings {
  param(
    [string]$DataDir,
    $Settings
  )
  $path = Get-WizardSettingsPath -DataDir $DataDir
  $name = [IO.Path]::GetFileName($path)
  if ($name -ne 'wizard-settings.json') {
    throw 'Refusing to write a non wizard-settings.json path'
  }
  $dir = [IO.Path]::GetDirectoryName($path)
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $Settings.updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  $json = ($Settings | ConvertTo-Json -Depth 8 -Compress)
  [IO.File]::WriteAllText($path, $json, [Text.UTF8Encoding]::new($false))
  return $Settings
}

function Merge-WizardSettings {
  param($Current, $Incoming)
  if ($null -eq $Incoming) { return $Current }
  if ($Incoming.PSObject.Properties['displayName'] -and $null -ne $Incoming.displayName) {
    $dn = ([string]$Incoming.displayName).Trim()
    if ($dn.Length -gt 80) { $dn = $dn.Substring(0, 80) }
    if ($dn.Length -gt 0) { $Current.displayName = $dn }
  }
  # technicalId stays the app id. characterId may switch among known packs.
  if ($Incoming.PSObject.Properties['characterId'] -and $null -ne $Incoming.characterId) {
    $cid = [string]$Incoming.characterId
    if (Test-WizardSafeCharacterId $cid) { $Current.characterId = $cid }
  }
  if ($Incoming.PSObject.Properties['visible'] -and $null -ne $Incoming.visible) {
    $Current.visible = [bool]$Incoming.visible
  }
  if ($Incoming.window) {
    if ($Incoming.window.PSObject.Properties['x']) {
      if ($null -eq $Incoming.window.x -or [string]$Incoming.window.x -eq '') { $Current.window.x = $null }
      else { $Current.window.x = [int]$Incoming.window.x }
    }
    if ($Incoming.window.PSObject.Properties['y']) {
      if ($null -eq $Incoming.window.y -or [string]$Incoming.window.y -eq '') { $Current.window.y = $null }
      else { $Current.window.y = [int]$Incoming.window.y }
    }
    if ($Incoming.window.PSObject.Properties['scale'] -and $null -ne $Incoming.window.scale) {
      $scale = [double]$Incoming.window.scale
      if ($scale -lt 0.5) { $scale = 0.5 }
      if ($scale -gt 3) { $scale = 3 }
      $Current.window.scale = $scale
    }
  }
  if ($Incoming.PSObject.Properties['animationLevel'] -and $Incoming.animationLevel) {
    $lvl = [string]$Incoming.animationLevel
    if ($lvl -in @('normal','reduced','off')) { $Current.animationLevel = $lvl }
  }
  if ($Incoming.PSObject.Properties['idleSleepMs'] -and $null -ne $Incoming.idleSleepMs) {
    $ms = [int]$Incoming.idleSleepMs
    if ($ms -lt 5000) { $ms = 5000 }
    if ($ms -gt 600000) { $ms = 600000 }
    $Current.idleSleepMs = $ms
  }
  if ($Incoming.PSObject.Properties['reminders'] -and $null -ne $Incoming.reminders) {
    $Current.reminders = @($Incoming.reminders)
  }
  if ($Incoming.PSObject.Properties['language'] -and $Incoming.language) {
    $lang = [string]$Incoming.language
    if ($lang -in @('ar','en')) { $Current.language = $lang }
  }
  if ($Incoming.PSObject.Properties['startMinimized'] -and $null -ne $Incoming.startMinimized) {
    $Current.startMinimized = [bool]$Incoming.startMinimized
  }
  if ($Incoming.PSObject.Properties['alwaysOnTop'] -and $null -ne $Incoming.alwaysOnTop) {
    $Current.alwaysOnTop = [bool]$Incoming.alwaysOnTop
  }
  if ($Incoming.PSObject.Properties['opacity'] -and $null -ne $Incoming.opacity) {
    $op = [double]$Incoming.opacity
    if ($op -lt 0.35) { $op = 0.35 }
    if ($op -gt 1) { $op = 1 }
    $Current.opacity = $op
  }
  if ($Incoming.PSObject.Properties['followPointer'] -and $null -ne $Incoming.followPointer) {
    $Current.followPointer = [bool]$Incoming.followPointer
  }
  if ($Incoming.PSObject.Properties['roamEnabled'] -and $null -ne $Incoming.roamEnabled) {
    $Current.roamEnabled = [bool]$Incoming.roamEnabled
  }
  if ($Incoming.PSObject.Properties['preferredCorner'] -and $Incoming.preferredCorner) {
    $c = [string]$Incoming.preferredCorner
    if ($c -in @('bottom-end','bottom-start','top-end','top-start')) { $Current.preferredCorner = $c }
  }
  if ($Incoming.PSObject.Properties['proactiveBubbles'] -and $Incoming.proactiveBubbles) {
    $p = [string]$Incoming.proactiveBubbles
    if ($p -in @('high','normal','low','off')) { $Current.proactiveBubbles = $p }
  }
  if ($Incoming.PSObject.Properties['bubbleScale'] -and $null -ne $Incoming.bubbleScale) {
    $bs = [double]$Incoming.bubbleScale
    if ($bs -lt 0.7) { $bs = 0.7 }
    if ($bs -gt 1.8) { $bs = 1.8 }
    $Current.bubbleScale = $bs
  }
  if ($Incoming.PSObject.Properties['bubbleFontSize'] -and $null -ne $Incoming.bubbleFontSize) {
    $bf = [int]$Incoming.bubbleFontSize
    if ($bf -lt 11) { $bf = 11 }
    if ($bf -gt 22) { $bf = 22 }
    $Current.bubbleFontSize = $bf
  }
  if ($Incoming.PSObject.Properties['closeAction'] -and $Incoming.closeAction) {
    $ca = [string]$Incoming.closeAction
    if ($ca -in @('hide','exit')) { $Current.closeAction = $ca }
  }
  if ($Incoming.PSObject.Properties['permissions'] -and $null -ne $Incoming.permissions) {
    $Current.permissions = ConvertTo-WizardPermissionMap -Incoming $Incoming.permissions -Base $Current.permissions
  }
  if ($Incoming.PSObject.Properties['mailLastSyncAt'] -and $null -ne $Incoming.mailLastSyncAt) {
    $Current.mailLastSyncAt = [string]$Incoming.mailLastSyncAt
  }
  if ($Incoming.PSObject.Properties['mailIgnored'] -and $null -ne $Incoming.mailIgnored) {
    $Current.mailIgnored = @($Incoming.mailIgnored | ForEach-Object { [string]$_ })
  }
  if ($Incoming.PSObject.Properties['firstRunComplete'] -and $null -ne $Incoming.firstRunComplete) {
    $Current.firstRunComplete = [bool]$Incoming.firstRunComplete
  }
  return $Current
}

function Invoke-WizardBridge {
  param(
    $Req,
    $Res,
    [string]$Path,
    [string]$DataDir,
    [string]$Root = ''
  )
  if (-not $Path.StartsWith('/api/v1/wizard/')) {
    return $false
  }

  if ($Path -eq '/api/v1/wizard/health' -and $Req.HttpMethod -eq 'GET') {
    Write-Json $Res @{
      ok = $true
      aqhub = $true
      version = $script:WizardBridgeVersion
      wizard = 'AQWizard'
    }
    return $true
  }

  if ($Path -eq '/api/v1/wizard/settings' -and $Req.HttpMethod -eq 'GET') {
    $settings = Read-WizardSettings -DataDir $DataDir
    Write-Json $Res @{ ok = $true; settings = $settings }
    return $true
  }

  if ($Path -eq '/api/v1/wizard/settings' -and $Req.HttpMethod -eq 'PUT') {
    $bodyRaw = Read-Body $Req
    $incoming = $null
    try { $incoming = $bodyRaw | ConvertFrom-Json } catch {
      Write-Json $Res @{ ok = $false; error = 'bad_json' } 400
      return $true
    }
    $payload = $incoming
    if ($incoming.PSObject.Properties['settings'] -and $incoming.settings) {
      $payload = $incoming.settings
    }
    $current = Read-WizardSettings -DataDir $DataDir
    $merged = Merge-WizardSettings -Current $current -Incoming $payload
    $saved = Save-WizardSettings -DataDir $DataDir -Settings $merged
    Write-Json $Res @{ ok = $true; settings = $saved }
    return $true
  }

  if ($Path -eq '/api/v1/wizard/permissions' -and $Req.HttpMethod -eq 'GET') {
    $settings = Read-WizardSettings -DataDir $DataDir
    Write-Json $Res @{
      ok = $true
      permissions = $settings.permissions
      capabilities = Get-WizardCapabilityCatalog
      version = $script:WizardBridgeVersion
    }
    return $true
  }

  if ($Path -eq '/api/v1/wizard/mail/status' -and $Req.HttpMethod -eq 'GET') {
    $settings = Read-WizardSettings -DataDir $DataDir
    $outlook = $false
    $reason = 'outlook_not_running'
    try {
      $app = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application')
      if ($app) { $outlook = $true; $reason = '' }
    } catch {
      $reason = 'outlook_not_running'
    }
    Write-Json $Res @{
      ok = $true
      aqhub = $true
      outlook = $outlook
      reason = $reason
      lastSyncAt = $settings.mailLastSyncAt
      adapter = 'GetActiveObject'
      note = 'Unread import remains POST /api/mail/sync. Recent mail is email-sourced tasks via GET /api/tasks. Wizard never calls /api/task/approve-send.'
    }
    return $true
  }

  if ($Path -eq '/api/v1/wizard/characters' -and $Req.HttpMethod -eq 'GET') {
    $settings = Read-WizardSettings -DataDir $DataDir
    $list = @(Get-WizardCharacterList -Root $Root -DataDir $DataDir)
    Write-Json $Res @{
      ok = $true
      characters = $list
      activeCharacterId = $settings.characterId
      poses = Get-WizardPoseCatalog
    }
    return $true
  }

  if ($Path -eq '/api/v1/wizard/characters' -and $Req.HttpMethod -eq 'POST') {
    $bodyRaw = Read-Body $Req
    $incoming = $null
    try { $incoming = $bodyRaw | ConvertFrom-Json } catch {
      Write-Json $Res @{ ok = $false; error = 'bad_json' } 400
      return $true
    }
    $payload = $incoming
    if ($incoming.PSObject.Properties['character'] -and $incoming.character) {
      $payload = $incoming.character
    }
    try {
      $savedPack = Save-WizardUploadedPack -Root $Root -DataDir $DataDir -Payload $payload
      $activate = $false
      if ($payload.PSObject.Properties['activate'] -and $payload.activate) { $activate = [bool]$payload.activate }
      $settings = Read-WizardSettings -DataDir $DataDir
      if ($activate -and $savedPack) {
        $settings = Merge-WizardSettings -Current $settings -Incoming ([pscustomobject]@{
          characterId = $savedPack.id
          displayName = $savedPack.displayName
        })
        $settings = Save-WizardSettings -DataDir $DataDir -Settings $settings
      }
      Write-Json $Res @{
        ok = $true
        character = $savedPack
        settings = $settings
      }
    } catch {
      $err = [string]$_.Exception.Message
      $code = 400
      if ($err -eq 'builtin_pack') { $code = 409 }
      Write-Json $Res @{ ok = $false; error = $err } $code
    }
    return $true
  }

  if ($Path -match '^/api/v1/wizard/characters/([a-z][a-z0-9-]{0,47})$' -and $Req.HttpMethod -eq 'GET') {
    $id = $Matches[1]
    if (-not (Test-WizardSafeCharacterId $id)) {
      Write-Json $Res @{ ok = $false; error = 'bad_id' } 400
      return $true
    }
    $row = Get-WizardCharacterSummary -Root $Root -DataDir $DataDir -Id $id
    if (-not $row) {
      Write-Json $Res @{ ok = $false; error = 'not_found' } 404
      return $true
    }
    Write-Json $Res @{ ok = $true; character = $row }
    return $true
  }

  if ($Path -match '^/api/v1/wizard/characters/([a-z][a-z0-9-]{0,47})/([a-z0-9][a-z0-9._-]*\.(png|svg|json))$' -and $Req.HttpMethod -eq 'GET') {
    $id = $Matches[1]
    $file = $Matches[2]
    $pack = Get-WizardPackDir -Root $Root -DataDir $DataDir -Id $id
    if (-not $pack) {
      Write-Json $Res @{ ok = $false; error = 'bad_id' } 400
      return $true
    }
    $full = [IO.Path]::GetFullPath((Join-Path $pack $file))
    if (-not (Test-WizardPathUnder -Child $full -Parent $pack)) {
      Write-Json $Res @{ ok = $false; error = 'bad_path' } 400
      return $true
    }
    if (-not (Test-Path $full -PathType Leaf)) {
      Write-Json $Res @{ ok = $false; error = 'not_found' } 404
      return $true
    }
    if ($file -eq 'manifest.json') {
      $raw = [IO.File]::ReadAllText($full, [Text.Encoding]::UTF8)
      Write-Text $Res 200 'application/json; charset=utf-8' $raw
      return $true
    }
    Write-FileResp $Res $full
    return $true
  }

  Write-Json $Res @{ ok = $false; error = 'not_found'; path = $Path } 404
  return $true
}
