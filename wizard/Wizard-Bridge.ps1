# ASCII-only thin AQWizard bridge.
# Dotted from Start-Board.ps1. Owns data/wizard-settings.json plus a read-only
# Outlook status probe (GetActiveObject wrap). Never writes tasks.json / tokens.
# Never starts Outlook. Never calls approve-send.

$script:WizardBridgeVersion = '0.5.0-p12'

function Get-WizardSettingsPath {
  param([string]$DataDir)
  return (Join-Path $DataDir 'wizard-settings.json')
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
    bridge = [ordered]@{
      enabled = $false
      url = ''
      secretRef = 'wizard-bridge'
      agentId = ''
    }
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
      if ($cid -in @('secretary','old-wizard')) { $defaults.characterId = $cid }
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
    if ($obj.PSObject.Properties['bridge'] -and $null -ne $obj.bridge) {
      $defaults.bridge = ConvertTo-WizardBridgeConfig -Incoming $obj.bridge
    }
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
    if ($cid -in @('secretary','old-wizard')) { $Current.characterId = $cid }
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
  if ($Incoming.PSObject.Properties['bridge'] -and $null -ne $Incoming.bridge) {
    $Current.bridge = ConvertTo-WizardBridgeConfig -Incoming $Incoming.bridge
  }
  return $Current
}

function ConvertTo-WizardBridgeConfig {
  param($Incoming)
  $bridge = [ordered]@{
    enabled = $false
    url = ''
    secretRef = 'wizard-bridge'
    agentId = ''
  }
  if ($null -eq $Incoming) { return $bridge }
  if ($Incoming.PSObject.Properties['enabled']) { $bridge.enabled = [bool]$Incoming.enabled }
  if ($Incoming.PSObject.Properties['url'] -and $null -ne $Incoming.url) {
    $bridge.url = ([string]$Incoming.url).Trim()
  }
  if ($Incoming.PSObject.Properties['secretRef'] -and $null -ne $Incoming.secretRef) {
    $ref = ([string]$Incoming.secretRef).Trim()
    if ($ref.Length -gt 80) { $ref = $ref.Substring(0, 80) }
    if ($ref.Length -gt 0) { $bridge.secretRef = $ref }
  }
  if ($Incoming.PSObject.Properties['agentId'] -and $null -ne $Incoming.agentId) {
    $aid = ([string]$Incoming.agentId).Trim()
    if ($aid.Length -gt 80) { $aid = $aid.Substring(0, 80) }
    $bridge.agentId = $aid
  }
  return $bridge
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

  Write-Json $Res @{ ok = $false; error = 'not_found'; path = $Path } 404
  return $true
}
