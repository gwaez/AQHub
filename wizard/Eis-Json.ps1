# ASCII-only Eisenhower JSON helper.
# Dotted from Start-Board.ps1. Windows PowerShell 5.1 ConvertTo-Json wraps
# object[] / List[object] as {"value":[...],"Count":N} or [{"value":[...]}].
# This module always writes items as a JSON array of item objects.

function New-EisArrayList {
  return (New-Object System.Collections.ArrayList)
}

function Get-EisProp {
  param($Obj, [string]$Name)
  if ($null -eq $Obj) { return $null }
  if ([string]::IsNullOrWhiteSpace($Name)) { return $null }
  if ($Obj -is [hashtable] -or $Obj -is [System.Collections.Specialized.OrderedDictionary] -or $Obj -is [System.Collections.IDictionary]) {
    try {
      if ($Obj.Contains($Name)) { return $Obj[$Name] }
    } catch {}
    try {
      if ($Obj.ContainsKey($Name)) { return $Obj[$Name] }
    } catch {}
    return $null
  }
  try {
    $p = $Obj.PSObject.Properties[$Name]
    if ($null -ne $p) { return $p.Value }
  } catch {}
  return $null
}

function Test-EisList {
  param($Obj)
  if ($null -eq $Obj) { return $false }
  if ($Obj -is [string]) { return $false }
  if ($Obj -is [hashtable] -or $Obj -is [System.Collections.IDictionary]) { return $false }
  if ($Obj -is [System.Array]) { return $true }
  if ($Obj -is [System.Collections.IList]) { return $true }
  if ($Obj -is [System.Collections.ArrayList]) { return $true }
  return $false
}

function Test-EisRealItem {
  param($Item)
  if ($null -eq $Item) { return $false }
  if ($Item -is [string]) { return $false }
  $id = [string](Get-EisProp $Item 'id')
  if ($id) { return $true }
  $taskId = [string](Get-EisProp $Item 'taskId')
  $title = [string](Get-EisProp $Item 'title')
  if ($taskId -and $title) { return $true }
  return $false
}

function Get-EisValueBag {
  param($Obj)
  if ($null -eq $Obj) { return $null }
  if ($Obj -is [string]) { return $null }
  return (Get-EisProp $Obj 'value')
}

function Add-EisNormalizedValue {
  param($Out, $Val, [int]$Depth = 0)
  if ($null -eq $Out) { return }
  if ($Depth -gt 6) { return }
  if ($null -eq $Val) { return }
  if ($Val -is [string]) {
    $trim = ([string]$Val).Trim()
    if (-not $trim) { return }
    $c0 = $trim.Substring(0,1)
    if ($c0 -eq '[' -or [int][char]$c0 -eq 123) {
      try {
        $parsed = $trim | ConvertFrom-Json
        Add-EisNormalizedValue $Out $parsed ($Depth + 1)
      } catch {}
    }
    return
  }
  if (Test-EisList $Val) {
    foreach ($one in @($Val)) {
      Add-EisNormalizedValue $Out $one ($Depth + 1)
    }
    return
  }
  if (Test-EisRealItem $Val) {
    [void]$Out.Add($Val)
    return
  }
  $inner = Get-EisValueBag $Val
  if ($null -ne $inner) {
    Add-EisNormalizedValue $Out $inner ($Depth + 1)
  }
}

function Get-EisRawItems {
  param($Payload)
  if ($null -eq $Payload) { return $null }
  return (Get-EisProp $Payload 'items')
}

function Get-EisNormalizedItems {
  param($Payload)
  $out = New-EisArrayList
  $raw = Get-EisRawItems $Payload
  if ($null -eq $raw) {
    if (Test-EisRealItem $Payload) { [void]$out.Add($Payload) }
    elseif ($null -ne (Get-EisValueBag $Payload)) { Add-EisNormalizedValue $out (Get-EisValueBag $Payload) 0 }
    return @($out)
  }
  if (Test-EisRealItem $raw) {
    [void]$out.Add($raw)
    return @($out)
  }
  $bag = Get-EisValueBag $raw
  if ($null -ne $bag -and -not (Test-EisList $raw)) {
    Add-EisNormalizedValue $out $bag 0
    return @($out)
  }
  Add-EisNormalizedValue $out $raw 0
  return @($out)
}

function Test-EisRawCorrupt {
  param($Raw)
  if ($null -eq $Raw) { return $false }
  if ($Raw -is [string]) { return $true }
  if (-not (Test-EisList $Raw)) {
    if ($null -ne (Get-EisValueBag $Raw) -and -not (Test-EisRealItem $Raw)) { return $true }
    return $false
  }
  $arr = @($Raw)
  if ($arr.Count -eq 0) { return $false }
  if ($arr.Count -eq 1) {
    $one = $arr[0]
    if (Test-EisRealItem $one) { return $false }
    if ($null -ne (Get-EisValueBag $one)) { return $true }
    if ($one -is [string]) { return $true }
  }
  return $false
}

function Set-EisPayloadItems {
  param($Payload, $Items)
  $arr = @($Items)
  if ($null -eq $Payload) {
    return [pscustomobject]@{ items = $arr; updatedAt = '' }
  }
  if ($Payload -is [hashtable] -or $Payload -is [System.Collections.Specialized.OrderedDictionary] -or $Payload -is [System.Collections.IDictionary]) {
    $Payload['items'] = $arr
    return $Payload
  }
  try { $Payload | Add-Member -NotePropertyName items -NotePropertyValue $arr -Force } catch {
    try { $Payload.items = $arr } catch {}
  }
  return $Payload
}

function ConvertTo-EisItemHashtable {
  param($Item)
  if ($null -eq $Item) { return $null }
  $skip = @('Count', 'Capacity', 'SyncRoot', 'IsReadOnly', 'IsFixedSize', 'IsSynchronized')
  $h = [ordered]@{}
  $names = @()
  if ($Item -is [hashtable] -or $Item -is [System.Collections.Specialized.OrderedDictionary] -or $Item -is [System.Collections.IDictionary]) {
    foreach ($k in @($Item.Keys)) { $names += [string]$k }
  } else {
    try {
      foreach ($p in $Item.PSObject.Properties) {
        if ($p.MemberType -eq 'NoteProperty') { $names += [string]$p.Name }
      }
    } catch {}
  }
  foreach ($name in $names) {
    if (-not $name) { continue }
    if ($skip -contains $name) { continue }
    $val = Get-EisProp $Item $name
    if ($name -eq 'value' -and -not (Get-EisProp $Item 'id')) {
      if (($val -is [string]) -or (Test-EisList $val)) { continue }
    }
    if ($null -eq $val) { continue }
    if (Test-EisList $val) { continue }
    $h[$name] = $val
  }
  if (-not $h.Contains('id') -and -not $h.Contains('taskId')) { return $null }
  $title = ''
  if ($h.Contains('title')) { $title = [string]$h['title'] }
  if ([string]::IsNullOrWhiteSpace($title) -or $title -eq 'undefined' -or $title -eq 'null') {
    if ($h.Contains('subject') -and [string]$h['subject']) { $h['title'] = [string]$h['subject'] }
    elseif ($h.Contains('taskId') -and [string]$h['taskId']) { $h['title'] = [string]$h['taskId'] }
    else { $h['title'] = '' }
  }
  return $h
}

function ConvertTo-EisJsonScalar {
  param($Val)
  if ($null -eq $Val) { return 'null' }
  if ($Val -is [bool]) {
    if ($Val) { return 'true' } else { return 'false' }
  }
  try {
    if ($Val -is [Nullable[bool]] -and $Val.HasValue) {
      if ($Val.Value) { return 'true' } else { return 'false' }
    }
  } catch {}
  if ($Val -is [byte] -or $Val -is [int16] -or $Val -is [uint16] -or $Val -is [int] -or $Val -is [uint32] -or $Val -is [long] -or $Val -is [uint64] -or $Val -is [decimal] -or $Val -is [double] -or $Val -is [float] -or $Val -is [single]) {
    return ([string]$Val)
  }
  return ([string]$Val | ConvertTo-Json -Compress)
}

function ConvertTo-EisJson {
  param($Payload)
  $items = @(Get-EisNormalizedItems $Payload)
  $parts = New-EisArrayList
  foreach ($it in $items) {
    $h = ConvertTo-EisItemHashtable $it
    if ($null -eq $h) { continue }
    [void]$parts.Add(($h | ConvertTo-Json -Compress -Depth 8))
  }
  $itemsJson = '[' + (@($parts) -join ',') + ']'
  $chunks = New-EisArrayList
  [void]$chunks.Add('"items":' + $itemsJson)
  $seen = @{ items = $true }
  $keys = @('updatedAt', 'lastFeedAt', 'lastFeedAdded', 'enrichedAt')
  foreach ($k in $keys) {
    $v = Get-EisProp $Payload $k
    if ($null -eq $v) { continue }
    [void]$chunks.Add(('"' + $k + '":' + (ConvertTo-EisJsonScalar $v)))
    $seen[$k] = $true
  }
  if ($null -ne $Payload) {
    $extraNames = @()
    if ($Payload -is [hashtable] -or $Payload -is [System.Collections.IDictionary]) {
      foreach ($k in @($Payload.Keys)) { $extraNames += [string]$k }
    } else {
      try {
        foreach ($p in $Payload.PSObject.Properties) {
          if ($p.MemberType -eq 'NoteProperty') { $extraNames += [string]$p.Name }
        }
      } catch {}
    }
    foreach ($k in $extraNames) {
      if (-not $k) { continue }
      if ($seen.ContainsKey($k)) { continue }
      $v = Get-EisProp $Payload $k
      if ($null -eq $v) { continue }
      if (Test-EisList $v) { continue }
      if ($v -is [hashtable] -or $v -is [System.Collections.IDictionary]) { continue }
      try {
        if ($v.PSObject -and $v.PSObject.Properties['value'] -and -not $v.PSObject.Properties['id']) { continue }
      } catch {}
      [void]$chunks.Add(('"' + $k + '":' + (ConvertTo-EisJsonScalar $v)))
      $seen[$k] = $true
    }
  }
  return ('{' + (@($chunks) -join ',') + '}')
}

function Test-EisJsonItemsArray {
  param([string]$Json)
  if ([string]::IsNullOrWhiteSpace($Json)) { return $false }
  if ($Json -notmatch '"items"\s*:\s*\[') { return $false }
  $obj = $null
  try { $obj = $Json | ConvertFrom-Json } catch { return $false }
  if ($null -eq $obj) { return $false }
  $raw = Get-EisRawItems $obj
  if (Test-EisRawCorrupt $raw) { return $false }
  $items = @(Get-EisNormalizedItems $obj)
  if ($raw -and (Test-EisList $raw)) {
    $rawCount = @($raw).Count
    if ($rawCount -eq 1 -and $items.Count -gt 1) { return $false }
  }
  return $true
}

function Save-EisDoc {
  param($Payload, [string]$Path)
  if (-not $Path) { throw 'eis_path_required' }
  $json = ConvertTo-EisJson $Payload
  if (-not (Test-EisJsonItemsArray $json)) {
    $clean = Set-EisPayloadItems ([pscustomobject]@{
      updatedAt = [string](Get-EisProp $Payload 'updatedAt')
      lastFeedAt = [string](Get-EisProp $Payload 'lastFeedAt')
      lastFeedAdded = (Get-EisProp $Payload 'lastFeedAdded')
      enrichedAt = [string](Get-EisProp $Payload 'enrichedAt')
    }) @(Get-EisNormalizedItems $Payload)
    $json = ConvertTo-EisJson $clean
  }
  [IO.File]::WriteAllText($Path, $json, [Text.UTF8Encoding]::new($false))
  return $json
}

function Read-EisDoc {
  param([string]$Path)
  $payload = [pscustomobject]@{ items = @(); updatedAt = '' }
  if ($Path -and (Test-Path -LiteralPath $Path)) {
    try {
      $txt = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
      if (-not [string]::IsNullOrWhiteSpace($txt)) {
        $payload = $txt | ConvertFrom-Json
      }
    } catch {
      $payload = [pscustomobject]@{ items = @(); updatedAt = '' }
    }
  }
  $raw = Get-EisRawItems $payload
  $corrupt = Test-EisRawCorrupt $raw
  $items = @(Get-EisNormalizedItems $payload)
  $payload = Set-EisPayloadItems $payload $items
  $repaired = $false
  if ($corrupt) { $repaired = $true }
  if ($Path -and $repaired) {
    try { [void](Save-EisDoc $payload $Path) } catch {}
  }
  return $payload
}
