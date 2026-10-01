# ASCII-only AQHub theme bridge.
# Dotted from Start-Board.ps1. Owns data/themes/*.json + data/themes-state.json.
# Never writes tasks.json / CRM tokens / wizard-settings.json.

$script:ThemeBridgeVersion = '1.0.0-themes'

function Get-ThemeDir {
  param([string]$DataDir)
  return (Join-Path $DataDir 'themes')
}

function Get-ThemeCustomDir {
  param([string]$DataDir)
  return (Join-Path (Get-ThemeDir $DataDir) 'custom')
}

function Get-ThemeStatePath {
  param([string]$DataDir)
  return (Join-Path $DataDir 'themes-state.json')
}

function Test-ThemeSafeId {
  param([string]$Id)
  if (-not $Id) { return $false }
  if ($Id -notmatch '^[a-z][a-z0-9-]{0,47}$') { return $false }
  if ($Id.Contains('..') -or $Id.Contains('/') -or $Id.Contains('\')) { return $false }
  if ($Id -in @('con','prn','aux','nul','com1','lpt1','custom','_schema')) { return $false }
  return $true
}

function ConvertTo-ThemeSlug {
  param([string]$Name)
  $raw = if ($null -eq $Name) { '' } else { [string]$Name }
  $s = $raw.Trim().ToLowerInvariant()
  $s = [regex]::Replace($s, '[\s_]+', '-')
  $s = [regex]::Replace($s, '[^a-z0-9-]', '')
  $s = [regex]::Replace($s, '-+', '-')
  $s = $s.Trim('-')
  if (-not $s) {
    $s = 'theme-' + ([guid]::NewGuid().ToString('n').Substring(0, 8))
  }
  if ($s.Length -gt 48) { $s = $s.Substring(0, 48).Trim('-') }
  if ($s -notmatch '^[a-z]') { $s = ('t-' + $s) }
  if ($s.Length -gt 48) { $s = $s.Substring(0, 48).Trim('-') }
  if (-not (Test-ThemeSafeId $s)) { $s = 'theme-custom' }
  return $s
}

function Initialize-ThemeStorage {
  param([string]$DataDir)
  $themesDir = Get-ThemeDir $DataDir
  $customDir = Get-ThemeCustomDir $DataDir
  New-Item -ItemType Directory -Force -Path $themesDir | Out-Null
  New-Item -ItemType Directory -Force -Path $customDir | Out-Null
  $statePath = Get-ThemeStatePath $DataDir
  if (-not (Test-Path $statePath)) {
    $sample = Join-Path $DataDir 'themes-state.sample.json'
    if (Test-Path $sample) {
      Copy-Item -Path $sample -Destination $statePath -Force
    } else {
      $seed = '{"version":1,"activeThemeId":"jarvis-hud","updatedAt":""}'
      [IO.File]::WriteAllText($statePath, $seed, [Text.UTF8Encoding]::new($false))
    }
  }
}

function Read-ThemeState {
  param([string]$DataDir)
  Initialize-ThemeStorage -DataDir $DataDir
  $path = Get-ThemeStatePath $DataDir
  try {
    $raw = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
    $obj = $raw | ConvertFrom-Json
    if (-not $obj.activeThemeId) { $obj | Add-Member -NotePropertyName activeThemeId -NotePropertyValue 'jarvis-hud' -Force }
    return $obj
  } catch {
    return [pscustomobject]@{ version = 1; activeThemeId = 'jarvis-hud'; updatedAt = '' }
  }
}

function Save-ThemeState {
  param(
    [string]$DataDir,
    $State
  )
  Initialize-ThemeStorage -DataDir $DataDir
  $State.updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  $json = $State | ConvertTo-Json -Depth 6 -Compress
  [IO.File]::WriteAllText((Get-ThemeStatePath $DataDir), $json, [Text.UTF8Encoding]::new($false))
  return $State
}

function Get-ThemeFilePath {
  param(
    [string]$DataDir,
    [string]$Id,
    [switch]$PreferCustom
  )
  if (-not (Test-ThemeSafeId $Id)) { return $null }
  $custom = Join-Path (Get-ThemeCustomDir $DataDir) ($Id + '.json')
  $preset = Join-Path (Get-ThemeDir $DataDir) ($Id + '.json')
  if ($PreferCustom) {
    if (Test-Path $custom) { return $custom }
    if (Test-Path $preset) { return $preset }
    return $custom
  }
  if (Test-Path $custom) { return $custom }
  if (Test-Path $preset) { return $preset }
  return $null
}

function Test-ThemeIsPreset {
  param(
    [string]$DataDir,
    [string]$Id
  )
  if (-not (Test-ThemeSafeId $Id)) { return $false }
  $preset = Join-Path (Get-ThemeDir $DataDir) ($Id + '.json')
  $custom = Join-Path (Get-ThemeCustomDir $DataDir) ($Id + '.json')
  return ((Test-Path $preset) -and -not (Test-Path $custom))
}

function ConvertTo-ThemeHashtable {
  param($Theme)
  # Normalize PSCustomObject -> nested hashtables for safe re-serialize
  $json = $Theme | ConvertTo-Json -Depth 20 -Compress
  return ($json | ConvertFrom-Json)
}

function Repair-ThemeDocument {
  param($Theme)
  if (-not $Theme) { return $null }
  if (-not $Theme.meta) {
    $Theme | Add-Member -NotePropertyName meta -NotePropertyValue ([pscustomobject]@{}) -Force
  }
  $id = [string]$Theme.meta.id
  if (-not (Test-ThemeSafeId $id)) {
    $name = [string]$(if ($Theme.meta.name) { $Theme.meta.name } else { 'imported-theme' })
    $id = ConvertTo-ThemeSlug $name
    $Theme.meta | Add-Member -NotePropertyName id -NotePropertyValue $id -Force
  }
  if (-not $Theme.meta.name) { $Theme.meta | Add-Member -NotePropertyName name -NotePropertyValue $id -Force }
  if (-not $Theme.meta.version) { $Theme.meta | Add-Member -NotePropertyName version -NotePropertyValue '1.0.0' -Force }
  if (-not $Theme.meta.mode) { $Theme.meta | Add-Member -NotePropertyName mode -NotePropertyValue 'custom' -Force }
  if (-not $Theme.color) { $Theme | Add-Member -NotePropertyName color -NotePropertyValue ([pscustomobject]@{}) -Force }
  if (-not $Theme.typography) { $Theme | Add-Member -NotePropertyName typography -NotePropertyValue ([pscustomobject]@{}) -Force }
  if (-not $Theme.shape) { $Theme | Add-Member -NotePropertyName shape -NotePropertyValue ([pscustomobject]@{}) -Force }
  if (-not $Theme.elevation) { $Theme | Add-Member -NotePropertyName elevation -NotePropertyValue ([pscustomobject]@{}) -Force }
  if (-not $Theme.motion) { $Theme | Add-Member -NotePropertyName motion -NotePropertyValue ([pscustomobject]@{}) -Force }
  if (-not $Theme.cssVariables) {
    $Theme | Add-Member -NotePropertyName cssVariables -NotePropertyValue (New-ThemeCssVariablesFromParts -Theme $Theme) -Force
  }
  return $Theme
}

function Set-ThemeTok {
  param($Obj, [string]$Key, $Val)
  if ($null -ne $Val -and [string]$Val -ne '') {
    $Obj | Add-Member -NotePropertyName $Key -NotePropertyValue ([string]$Val) -Force
  }
}

function New-ThemeCssVariablesFromParts {
  param($Theme)
  $c = $Theme.color
  $t = $Theme.typography
  $s = $Theme.shape
  $e = $Theme.elevation
  $m = $Theme.motion
  $scale = $null
  if ($t -and $t.PSObject.Properties['scale']) { $scale = $t.scale }
  $map = [pscustomobject]@{}
  if ($c) {
    Set-ThemeTok $map '--aq-bg' $c.bg
    Set-ThemeTok $map '--aq-bg-secondary' $c.bgSecondary
    Set-ThemeTok $map '--aq-surface' $c.surface
    Set-ThemeTok $map '--aq-surface-elevated' $c.surfaceElevated
    Set-ThemeTok $map '--aq-border' $c.border
    Set-ThemeTok $map '--aq-border-strong' $c.borderStrong
    Set-ThemeTok $map '--aq-text' $c.text
    Set-ThemeTok $map '--aq-text-muted' $c.textMuted
    Set-ThemeTok $map '--aq-text-faint' $c.textFaint
    Set-ThemeTok $map '--aq-accent' $c.accent
    Set-ThemeTok $map '--aq-accent-2' $c.accent2
    Set-ThemeTok $map '--aq-accent-3' $c.accent3
    Set-ThemeTok $map '--aq-success' $c.success
    Set-ThemeTok $map '--aq-warning' $c.warning
    Set-ThemeTok $map '--aq-danger' $c.danger
    Set-ThemeTok $map '--aq-glow' $c.glow
    Set-ThemeTok $map '--bg' $c.bg
    Set-ThemeTok $map '--bg0' $c.bg
    Set-ThemeTok $map '--bg1' $c.bgSecondary
    Set-ThemeTok $map '--panel' $c.surface
    Set-ThemeTok $map '--card' $c.surface
    Set-ThemeTok $map '--card-solid' $c.surfaceElevated
    Set-ThemeTok $map '--surface' $c.surface
    Set-ThemeTok $map '--surface-2' $c.surfaceElevated
    Set-ThemeTok $map '--stroke' $c.border
    Set-ThemeTok $map '--stroke-strong' $c.borderStrong
    Set-ThemeTok $map '--stroke-ui' $(if ($c.borderStrong) { $c.borderStrong } else { $c.border })
    Set-ThemeTok $map '--line' $c.border
    Set-ThemeTok $map '--text' $c.text
    Set-ThemeTok $map '--ink' $c.text
    Set-ThemeTok $map '--muted' $c.textMuted
    Set-ThemeTok $map '--faint' $c.textFaint
    Set-ThemeTok $map '--accent' $c.accent
    Set-ThemeTok $map '--accent-2' $c.accent2
    Set-ThemeTok $map '--accent-3' $c.accent3
    Set-ThemeTok $map '--cyan' $c.accent
    Set-ThemeTok $map '--teal' $c.accent
    Set-ThemeTok $map '--ok' $c.success
    Set-ThemeTok $map '--warn' $c.warning
    Set-ThemeTok $map '--danger' $c.danger
    Set-ThemeTok $map '--hot' $c.danger
    Set-ThemeTok $map '--glow' $c.glow
  }
  if ($t) {
    Set-ThemeTok $map '--aq-font' $t.fontFamily
    Set-ThemeTok $map '--aq-font-mono' $t.monoFamily
  }
  if ($scale) {
    Set-ThemeTok $map '--aq-fs-xs' $scale.xs
    Set-ThemeTok $map '--aq-fs-sm' $scale.sm
    Set-ThemeTok $map '--aq-fs-md' $scale.md
    Set-ThemeTok $map '--aq-fs-lg' $scale.lg
    Set-ThemeTok $map '--aq-fs-xl' $scale.xl
  }
  if ($s) {
    Set-ThemeTok $map '--aq-radius-sm' $s.radiusSm
    Set-ThemeTok $map '--aq-radius-md' $s.radiusMd
    Set-ThemeTok $map '--aq-radius-lg' $s.radiusLg
    Set-ThemeTok $map '--aq-border-width' $s.borderWidth
    Set-ThemeTok $map '--radius' $s.radiusLg
  }
  if ($e) {
    Set-ThemeTok $map '--aq-shadow-sm' $e.shadowSm
    Set-ThemeTok $map '--aq-shadow-md' $e.shadowMd
    Set-ThemeTok $map '--aq-glow-blur' $e.glowBlur
    Set-ThemeTok $map '--shadow' $e.shadowMd
  }
  if ($m) {
    Set-ThemeTok $map '--aq-motion-fast' $m.fast
    Set-ThemeTok $map '--aq-motion-normal' $m.normal
    Set-ThemeTok $map '--aq-motion-slow' $m.slow
  }
  return $map
}

function Read-ThemeDocument {
  param(
    [string]$DataDir,
    [string]$Id
  )
  $path = Get-ThemeFilePath -DataDir $DataDir -Id $Id
  if (-not $path -or -not (Test-Path $path)) { return $null }
  try {
    $raw = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
    $theme = $raw | ConvertFrom-Json
    return (Repair-ThemeDocument $theme)
  } catch {
    return $null
  }
}

function Save-ThemeDocument {
  param(
    [string]$DataDir,
    $Theme,
    [switch]$AsCustom
  )
  Initialize-ThemeStorage -DataDir $DataDir
  $Theme = Repair-ThemeDocument $Theme
  $id = [string]$Theme.meta.id
  if (-not (Test-ThemeSafeId $id)) { throw 'invalid_theme_id' }

  # Rebuild cssVariables from structured parts; keep any extra custom tokens.
  if ($Theme.color -and $Theme.color.bg) {
    $generated = New-ThemeCssVariablesFromParts -Theme $Theme
    $existing = $Theme.cssVariables
    if ($existing) {
      foreach ($prop in $existing.PSObject.Properties) {
        if (-not $generated.PSObject.Properties[$prop.Name]) {
          $generated | Add-Member -NotePropertyName $prop.Name -NotePropertyValue $prop.Value -Force
        }
      }
    }
    $Theme | Add-Member -NotePropertyName cssVariables -NotePropertyValue $generated -Force
  }

  $path = Join-Path (Get-ThemeCustomDir $DataDir) ($id + '.json')
  if (-not $AsCustom) {
    # Built-in presets stay in presets folder only when id already is a committed preset and caller forces overwrite of custom
    $presetPath = Join-Path (Get-ThemeDir $DataDir) ($id + '.json')
    if ((Test-Path $presetPath) -and -not (Test-Path $path)) {
      # Editing a preset always forks into custom/ with same id (custom wins on read)
      $path = Join-Path (Get-ThemeCustomDir $DataDir) ($id + '.json')
    }
  }

  $json = $Theme | ConvertTo-Json -Depth 20
  [IO.File]::WriteAllText($path, $json, [Text.UTF8Encoding]::new($false))
  return $Theme
}

function Get-ThemeSummary {
  param(
    [string]$DataDir,
    [string]$Path,
    [string]$Source
  )
  try {
    $raw = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
    $t = $raw | ConvertFrom-Json
    $id = [string]$t.meta.id
    if (-not $id) { $id = [IO.Path]::GetFileNameWithoutExtension($Path) }
    return [ordered]@{
      id = $id
      name = [string]$(if ($t.meta.name) { $t.meta.name } else { $id })
      version = [string]$(if ($t.meta.version) { $t.meta.version } else { '1.0.0' })
      author = [string]$t.meta.author
      description = [string]$t.meta.description
      styleKeywords = @($t.meta.styleKeywords)
      mode = [string]$(if ($t.meta.mode) { $t.meta.mode } else { 'custom' })
      source = $Source
      accent = [string]$t.color.accent
      bg = [string]$t.color.bg
    }
  } catch {
    return $null
  }
}

function List-ThemeSummaries {
  param([string]$DataDir)
  Initialize-ThemeStorage -DataDir $DataDir
  $byId = @{}
  $presetDir = Get-ThemeDir $DataDir
  Get-ChildItem -Path $presetDir -Filter '*.json' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike '*.sample.json' } |
    ForEach-Object {
      $sum = Get-ThemeSummary -DataDir $DataDir -Path $_.FullName -Source 'preset'
      if ($sum) { $byId[$sum.id] = $sum }
    }
  $customDir = Get-ThemeCustomDir $DataDir
  Get-ChildItem -Path $customDir -Filter '*.json' -File -ErrorAction SilentlyContinue |
    ForEach-Object {
      $sum = Get-ThemeSummary -DataDir $DataDir -Path $_.FullName -Source 'custom'
      if ($sum) { $byId[$sum.id] = $sum }
    }
  return @($byId.Values | Sort-Object { $_.name })
}

function Write-ThemeJson {
  param(
    $Res,
    $Obj,
    [int]$Code = 200
  )
  try {
    $json = $Obj | ConvertTo-Json -Depth 20 -Compress
  } catch {
    $json = (@{ ok = $false; error = 'json_serialize_failed'; message = $_.Exception.Message } | ConvertTo-Json -Compress)
    $Code = 500
  }
  Write-Text $Res $Code 'application/json; charset=utf-8' $json
}

function Invoke-ThemeBridge {
  param(
    $Req,
    $Res,
    [string]$Path,
    [string]$DataDir
  )
  if (-not $Path.StartsWith('/api/themes')) { return $false }

  Initialize-ThemeStorage -DataDir $DataDir

  if ($Path -eq '/api/themes' -and $Req.HttpMethod -eq 'GET') {
    $state = Read-ThemeState -DataDir $DataDir
    $list = List-ThemeSummaries -DataDir $DataDir
    Write-ThemeJson $Res @{
      ok = $true
      activeThemeId = $state.activeThemeId
      themes = @($list)
      bridgeVersion = $script:ThemeBridgeVersion
    }
    return $true
  }

  if ($Path -eq '/api/themes/active' -and $Req.HttpMethod -eq 'GET') {
    $state = Read-ThemeState -DataDir $DataDir
    $id = [string]$state.activeThemeId
    $theme = Read-ThemeDocument -DataDir $DataDir -Id $id
    if (-not $theme) {
      $theme = Read-ThemeDocument -DataDir $DataDir -Id 'jarvis-hud'
      $id = 'jarvis-hud'
    }
    if (-not $theme) {
      Write-ThemeJson $Res @{ ok = $false; error = 'no_themes' } 404
      return $true
    }
    Write-ThemeJson $Res @{
      ok = $true
      activeThemeId = $id
      theme = $theme
    }
    return $true
  }

  if ($Path -eq '/api/themes/active' -and $Req.HttpMethod -eq 'PUT') {
    $body = Read-Body $Req
    try { $incoming = $body | ConvertFrom-Json } catch {
      Write-ThemeJson $Res @{ ok = $false; error = 'bad_json' } 400
      return $true
    }
    $id = [string]$(if ($incoming.id) { $incoming.id } elseif ($incoming.activeThemeId) { $incoming.activeThemeId } else { '' })
    if (-not (Test-ThemeSafeId $id)) {
      Write-ThemeJson $Res @{ ok = $false; error = 'invalid_theme_id' } 400
      return $true
    }
    $theme = Read-ThemeDocument -DataDir $DataDir -Id $id
    if (-not $theme) {
      Write-ThemeJson $Res @{ ok = $false; error = 'theme_not_found' } 404
      return $true
    }
    $state = Read-ThemeState -DataDir $DataDir
    $state.activeThemeId = $id
    $null = Save-ThemeState -DataDir $DataDir -State $state
    Write-ThemeJson $Res @{ ok = $true; activeThemeId = $id; theme = $theme }
    return $true
  }

  if ($Path -eq '/api/themes/import' -and $Req.HttpMethod -eq 'POST') {
    $body = Read-Body $Req
    try { $incoming = $body | ConvertFrom-Json } catch {
      Write-ThemeJson $Res @{ ok = $false; error = 'bad_json' } 400
      return $true
    }
    $theme = $incoming
    if ($incoming.PSObject.Properties['theme'] -and $incoming.theme) { $theme = $incoming.theme }
    try {
      $saved = Save-ThemeDocument -DataDir $DataDir -Theme $theme -AsCustom
    } catch {
      Write-ThemeJson $Res @{ ok = $false; error = $_.Exception.Message } 400
      return $true
    }
    $activate = $false
    if ($incoming.PSObject.Properties['activate'] -and $incoming.activate) { $activate = $true }
    if ($activate) {
      $state = Read-ThemeState -DataDir $DataDir
      $state.activeThemeId = [string]$saved.meta.id
      $null = Save-ThemeState -DataDir $DataDir -State $state
    }
    $state = Read-ThemeState -DataDir $DataDir
    Write-ThemeJson $Res @{
      ok = $true
      theme = $saved
      activeThemeId = $state.activeThemeId
    }
    return $true
  }

  if ($Path -eq '/api/themes' -and $Req.HttpMethod -eq 'POST') {
    $body = Read-Body $Req
    try { $incoming = $body | ConvertFrom-Json } catch {
      Write-ThemeJson $Res @{ ok = $false; error = 'bad_json' } 400
      return $true
    }
    $theme = $incoming
    if ($incoming.PSObject.Properties['theme'] -and $incoming.theme) { $theme = $incoming.theme }
    # Optional rename / save-as
    if ($incoming.PSObject.Properties['saveAsName'] -and $incoming.saveAsName) {
      $newId = ConvertTo-ThemeSlug ([string]$incoming.saveAsName)
      if (-not $theme.meta) { $theme | Add-Member -NotePropertyName meta -NotePropertyValue ([pscustomobject]@{}) -Force }
      $theme.meta | Add-Member -NotePropertyName id -NotePropertyValue $newId -Force
      $theme.meta | Add-Member -NotePropertyName name -NotePropertyValue ([string]$incoming.saveAsName) -Force
    }
    try {
      $saved = Save-ThemeDocument -DataDir $DataDir -Theme $theme -AsCustom
    } catch {
      Write-ThemeJson $Res @{ ok = $false; error = $_.Exception.Message } 400
      return $true
    }
    $activate = $false
    if ($incoming.PSObject.Properties['activate'] -and $incoming.activate) { $activate = $true }
    if ($activate) {
      $state = Read-ThemeState -DataDir $DataDir
      $state.activeThemeId = [string]$saved.meta.id
      $null = Save-ThemeState -DataDir $DataDir -State $state
    }
    $state = Read-ThemeState -DataDir $DataDir
    Write-ThemeJson $Res @{
      ok = $true
      theme = $saved
      activeThemeId = $state.activeThemeId
    }
    return $true
  }

  if ($Path -match '^/api/themes/([a-z][a-z0-9-]{0,47})/export$' -and $Req.HttpMethod -eq 'GET') {
    $id = $Matches[1]
    $theme = Read-ThemeDocument -DataDir $DataDir -Id $id
    if (-not $theme) {
      Write-ThemeJson $Res @{ ok = $false; error = 'theme_not_found' } 404
      return $true
    }
    $json = $theme | ConvertTo-Json -Depth 20
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    try {
      $Res.StatusCode = 200
      $Res.ContentType = 'application/json; charset=utf-8'
      $Res.Headers['Cache-Control'] = 'no-store'
      $Res.Headers['Access-Control-Allow-Origin'] = '*'
      $Res.Headers['Content-Disposition'] = "attachment; filename=`"$id.theme.json`""
      $Res.SendChunked = $false
      $Res.ContentLength64 = [int64]$bytes.LongLength
      $Res.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
    } finally {
      try { $Res.OutputStream.Close() } catch {}
      try { $Res.Close() } catch {}
    }
    return $true
  }

  if ($Path -match '^/api/themes/([a-z][a-z0-9-]{0,47})$' -and $Req.HttpMethod -eq 'GET') {
    $id = $Matches[1]
    $theme = Read-ThemeDocument -DataDir $DataDir -Id $id
    if (-not $theme) {
      Write-ThemeJson $Res @{ ok = $false; error = 'theme_not_found' } 404
      return $true
    }
    $state = Read-ThemeState -DataDir $DataDir
    Write-ThemeJson $Res @{
      ok = $true
      theme = $theme
      active = ($state.activeThemeId -eq $id)
      source = $(if (Test-ThemeIsPreset -DataDir $DataDir -Id $id) { 'preset' } else { 'custom' })
    }
    return $true
  }

  if ($Path -match '^/api/themes/([a-z][a-z0-9-]{0,47})$' -and $Req.HttpMethod -eq 'DELETE') {
    $id = $Matches[1]
    $custom = Join-Path (Get-ThemeCustomDir $DataDir) ($id + '.json')
    if (-not (Test-Path $custom)) {
      Write-ThemeJson $Res @{ ok = $false; error = 'cannot_delete_preset_or_missing' } 400
      return $true
    }
    Remove-Item -Path $custom -Force
    $state = Read-ThemeState -DataDir $DataDir
    if ($state.activeThemeId -eq $id) {
      $state.activeThemeId = 'jarvis-hud'
      $null = Save-ThemeState -DataDir $DataDir -State $state
    }
    Write-ThemeJson $Res @{ ok = $true; deleted = $id; activeThemeId = (Read-ThemeState -DataDir $DataDir).activeThemeId }
    return $true
  }

  return $false
}
