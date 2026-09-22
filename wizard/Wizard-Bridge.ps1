# ASCII-only thin AQWizard bridge.
# Dotted from Start-Board.ps1. Owns ONLY data/wizard-settings.json.
# Never reads or writes tasks.json, eisenhower.json, crm-config, or tokens.

$script:WizardBridgeVersion = '0.1.0-p1'

function Get-WizardSettingsPath {
  param([string]$DataDir)
  return (Join-Path $DataDir 'wizard-settings.json')
}

function Get-WizardDefaultSettings {
  return [ordered]@{
    version = 1
    characterId = 'old-wizard'
    technicalId = 'AQWizard'
    displayName = 'Old Wizard'
    window = [ordered]@{
      x = $null
      y = $null
      scale = 1
    }
    visible = $true
    updatedAt = ''
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
    if ($obj.characterId) { $defaults.characterId = [string]$obj.characterId }
    if ($obj.technicalId) { $defaults.technicalId = [string]$obj.technicalId }
    if ($obj.PSObject.Properties['visible']) { $defaults.visible = [bool]$obj.visible }
    if ($obj.version) { $defaults.version = [int]$obj.version }
    if ($obj.window) {
      if ($null -ne $obj.window.x -and [string]$obj.window.x -ne '') { $defaults.window.x = [int]$obj.window.x }
      if ($null -ne $obj.window.y -and [string]$obj.window.y -ne '') { $defaults.window.y = [int]$obj.window.y }
      if ($null -ne $obj.window.scale) { $defaults.window.scale = [double]$obj.window.scale }
    }
    if ($obj.updatedAt) { $defaults.updatedAt = [string]$obj.updatedAt }
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
  $json = ($Settings | ConvertTo-Json -Depth 6 -Compress)
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
  # characterId / technicalId stay pack/app ids; ignore rename attempts
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
  return $Current
}

function Invoke-WizardBridge {
  param(
    $Req,
    $Res,
    [string]$Path,
    [string]$DataDir
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

  Write-Json $Res @{ ok = $false; error = 'not_found'; path = $Path } 404
  return $true
}
