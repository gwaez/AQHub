# ASCII-only Outlook unread -> board tasks helper.
# Dotted from Start-Board.ps1. GetActiveObject only (never New-Object, never Send).
# HttpListener threads can be MTA; Outlook COM is STA. Scan runs on an STA runspace
# when needed. Response items stay slim. Body is never read.

$script:MailSyncMaxNew = 25
$script:MailSyncMaxScan = 120
$script:MailSyncTimeoutMs = 45000

function New-MailSyncError {
  param(
    [string]$ErrorId,
    [string]$Message,
    [int]$Status = 500
  )
  if (-not $ErrorId) { $ErrorId = 'mail_sync_failed' }
  if (-not $Message) { $Message = $ErrorId }
  return [ordered]@{
    ok = $false
    error = $ErrorId
    message = $Message
    status = [int]$Status
    added = 0
    scanned = 0
    unreadTotal = -1
    items = @()
  }
}

function ConvertTo-SlimMailSyncItem {
  param($Task)
  if ($null -eq $Task) { return $null }
  $id = ''
  $title = ''
  $entryId = ''
  $fromEmail = ''
  try { $id = [string]$Task.id } catch {}
  try { $title = [string]$Task.title } catch {}
  try {
    $entryId = [string]$Task.entryId
    if (-not $entryId) { $entryId = [string]$Task.entryID }
  } catch {}
  try { $fromEmail = [string]$Task.fromEmail } catch {}
  return [pscustomobject]@{
    id = $id
    title = $title
    entryId = $entryId
    fromEmail = $fromEmail
  }
}

function Ensure-AqHubComType {
  if ('AqHub.ComRunning' -as [type]) { return $true }
  try {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace AqHub {
  public static class ComRunning {
    [DllImport("ole32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    private static extern void CLSIDFromProgID(string progId, out Guid clsid);
    [DllImport("oleaut32.dll", PreserveSig = false)]
    private static extern void GetActiveObject(ref Guid rclsid, IntPtr reserved, [MarshalAs(UnmanagedType.IUnknown)] out object unk);
    public static object GetActive(string progId) {
      Guid clsid;
      CLSIDFromProgID(progId, out clsid);
      object unk;
      GetActiveObject(ref clsid, IntPtr.Zero, out unk);
      return unk;
    }
  }
}
'@ -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Get-ActiveComObject {
  param([string]$ProgId)
  if ([string]::IsNullOrWhiteSpace($ProgId)) { return $null }
  try {
    return [Runtime.InteropServices.Marshal]::GetActiveObject($ProgId)
  } catch {}
  try {
    if (Ensure-AqHubComType) {
      return [AqHub.ComRunning]::GetActive($ProgId)
    }
  } catch {}
  try {
    Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction SilentlyContinue | Out-Null
    return [Microsoft.VisualBasic.Interaction]::GetObject($null, $ProgId)
  } catch {}
  return $null
}

function New-MailArrayList {
  # WinPS 5.1: generic List[T] via New-Object throws "Argument types do not match"
  # because the type argument is parsed as a constructor argument.
  return (New-Object System.Collections.ArrayList)
}

function ConvertTo-MailSyncResponseJson {
  param($Result)
  $ok = $true
  try { if ($Result.ok -eq $false) { $ok = $false } } catch { $ok = $false }
  if (-not $ok) {
    $err = 'mail_sync_failed'
    $msg = 'mail_sync_failed'
    try { if ($Result.error) { $err = [string]$Result.error } } catch {}
    try { if ($Result.message) { $msg = [string]$Result.message } elseif ($err) { $msg = $err } } catch { $msg = $err }
    $errJ = ($err | ConvertTo-Json -Compress)
    $msgJ = ($msg | ConvertTo-Json -Compress)
    $added = 0
    $scanned = 0
    $unread = -1
    try { $added = [int]$Result.added } catch {}
    try { $scanned = [int]$Result.scanned } catch {}
    try { if ($null -ne $Result.unreadTotal) { $unread = [int]$Result.unreadTotal } } catch {}
    return ('{"ok":false,"error":' + $errJ + ',"message":' + $msgJ + ',"added":' + $added + ',"scanned":' + $scanned + ',"unreadTotal":' + $unread + ',"items":[]}')
  }
  $parts = New-MailArrayList
  foreach ($it in @($Result.items)) {
    if ($null -eq $it) { continue }
    $one = [ordered]@{
      id = [string]$it.id
      title = [string]$it.title
      entryId = [string]$it.entryId
      fromEmail = [string]$it.fromEmail
    }
    [void]$parts.Add(($one | ConvertTo-Json -Compress -Depth 3))
  }
  $itemsJson = '[' + (@($parts) -join ',') + ']'
  $added = 0
  $scanned = 0
  $unread = -1
  try { $added = [int]$Result.added } catch {}
  try { $scanned = [int]$Result.scanned } catch {}
  try { if ($null -ne $Result.unreadTotal) { $unread = [int]$Result.unreadTotal } } catch {}
  return ('{"ok":true,"added":' + $added + ',"scanned":' + $scanned + ',"unreadTotal":' + $unread + ',"items":' + $itemsJson + ',"adapter":"GetActiveObject"}')
}

function Invoke-InSta {
  param(
    [scriptblock]$ScriptBlock,
    [hashtable]$Parameters = @{},
    [int]$TimeoutMs = 45000
  )
  if ($null -eq $ScriptBlock) { return $null }
  $apt = [Threading.Thread]::CurrentThread.GetApartmentState()
  if ($apt -eq [Threading.ApartmentState]::STA) {
    try {
      if ($Parameters -and $Parameters.Count -gt 0) { return & $ScriptBlock @Parameters }
      return & $ScriptBlock
    } catch {
      return (New-MailSyncError -ErrorId 'outlook_com' -Message ([string]$_.Exception.Message) -Status 500)
    }
  }

  $iss = $null
  try {
    $iss = [Management.Automation.Runspaces.InitialSessionState]::CreateDefault2()
  } catch {
    $iss = [Management.Automation.Runspaces.InitialSessionState]::CreateDefault()
  }
  $iss.ApartmentState = [Threading.ApartmentState]::STA
  $iss.ThreadOptions = [Management.Automation.Runspaces.PSThreadOptions]::ReuseThread
  foreach ($name in @('Ensure-AqHubComType','Get-ActiveComObject','Read-OutlookUnreadMailDtos','Test-OutlookRunning')) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.CommandType -eq 'Function') {
      [void]$iss.Commands.Add((New-Object Management.Automation.Runspaces.SessionStateFunctionEntry($name, $cmd.Definition)))
    }
  }
  $rs = [runspacefactory]::CreateRunspace($iss)
  $ps = $null
  try {
    $rs.Open()
    $ps = [powershell]::Create()
    $ps.Runspace = $rs
    [void]$ps.AddScript([string]$ScriptBlock)
    if ($Parameters) {
      foreach ($k in $Parameters.Keys) {
        [void]$ps.AddParameter([string]$k, $Parameters[$k])
      }
    }
    $iar = $ps.BeginInvoke()
    if (-not $iar.AsyncWaitHandle.WaitOne([int]$TimeoutMs)) {
      try { $ps.Stop() } catch {}
      return (New-MailSyncError -ErrorId 'outlook_timeout' -Message ("Outlook COM timed out after " + $TimeoutMs + "ms") -Status 504)
    }
    $out = $ps.EndInvoke($iar)
    if ($ps.HadErrors -and $ps.Streams.Error.Count -gt 0) {
      $e = [string]$ps.Streams.Error[0].Exception.Message
      if (-not $e) { $e = [string]$ps.Streams.Error[0] }
      return (New-MailSyncError -ErrorId 'outlook_com' -Message $e -Status 500)
    }
    if ($null -eq $out) { return $null }
    if ($out.Count -eq 0) { return $null }
    if ($out.Count -eq 1) { return $out[0] }
    return @($out)
  } catch {
    return (New-MailSyncError -ErrorId 'outlook_com' -Message ([string]$_.Exception.Message) -Status 500)
  } finally {
    try { if ($ps) { $ps.Dispose() } } catch {}
    try { if ($rs) { $rs.Dispose() } } catch {}
  }
}

function Test-OutlookRunning {
  try {
    $app = Get-ActiveComObject 'Outlook.Application'
    if ($app) { return $true }
  } catch {}
  return $false
}

function Get-MailSenderSmtp {
  param($MailItem)
  $addr = ''
  try { $addr = [string]$MailItem.SenderEmailAddress } catch { $addr = '' }
  if ($addr -and $addr.Contains('@') -and ($addr -notlike '/O=*')) { return $addr }
  try {
    $typ = [string]$MailItem.SenderEmailType
    if ($typ -eq 'SMTP' -and $addr -and $addr.Contains('@')) { return $addr }
  } catch {}
  try {
    $pa = $MailItem.PropertyAccessor
    foreach ($tag in @(
      'http://schemas.microsoft.com/mapi/proptag/0x5D01001F',
      'http://schemas.microsoft.com/mapi/proptag/0x5D01001E'
    )) {
      try {
        $smtp = [string]$pa.GetProperty($tag)
        if ($smtp -and $smtp.Contains('@')) { return $smtp }
      } catch {}
    }
  } catch {}
  if ($addr -and $addr.Contains('@')) { return $addr }
  return ''
}

function ConvertTo-MailDto {
  param($MailItem)
  $eid = ''
  try { $eid = [string]$MailItem.EntryID } catch { $eid = '' }
  if (-not $eid) { return $null }
  $subj = ''
  try { $subj = [string]$MailItem.Subject } catch { $subj = '' }
  if (-not $subj) { $subj = '(no subject)' }
  if ($subj.Length -gt 240) { $subj = $subj.Substring(0, 240) }
  $from = ''
  try { $from = [string]$MailItem.SenderName } catch { $from = '' }
  $fromEmail = Get-MailSenderSmtp $MailItem
  $importance = 1
  try { $importance = [int]$MailItem.Importance } catch { $importance = 1 }
  $received = ''
  try { $received = ([datetime]$MailItem.ReceivedTime).ToUniversalTime().ToString('o') } catch { $received = '' }
  return [pscustomobject]@{
    entryId = $eid
    subject = $subj
    fromName = $from
    fromEmail = $fromEmail
    importance = $importance
    received = $received
  }
}

function Read-OutlookUnreadMailDtos {
  param([int]$MaxScan = 120)
  $step = 'start'
  try {
    if ($MaxScan -lt 1) { $MaxScan = 1 }
    if ($MaxScan -gt 200) { $MaxScan = 200 }
    $step = 'getactive'
    $app = $null
    try { $app = Get-ActiveComObject 'Outlook.Application' } catch { $app = $null }
    if (-not $app) {
      return (New-MailSyncError -ErrorId 'outlook_not_running' -Message 'Outlook desktop is not running. Open Outlook and retry.' -Status 503)
    }
    $ns = $null
    $inbox = $null
    $items = $null
    $step = 'mapi'
    try { $ns = $app.GetNamespace([string]'MAPI') } catch {
      try { $ns = $app.Session } catch {
        return (New-MailSyncError -ErrorId 'outlook_mapi' -Message ('MAPI namespace failed: ' + $_.Exception.Message) -Status 500)
      }
    }
    $step = 'inbox'
    $folderInbox = [int]6
    try { $inbox = $ns.GetDefaultFolder($folderInbox) } catch {
      return (New-MailSyncError -ErrorId 'outlook_inbox' -Message ('Inbox folder failed: ' + $_.Exception.Message) -Status 500)
    }
    $step = 'items'
    try { $items = $inbox.Items } catch {
      return (New-MailSyncError -ErrorId 'outlook_items' -Message ('Inbox items failed: ' + $_.Exception.Message) -Status 500)
    }
    $step = 'restrict'
    $restricted = $null
    $gotRestrict = $false
    $filter = [string]'[UnRead] = true'
    try {
      $restricted = $items.Restrict($filter)
      $gotRestrict = $true
    } catch {
      return (New-MailSyncError -ErrorId 'outlook_restrict_failed' -Message ('Unread Restrict failed: ' + $_.Exception.Message) -Status 500)
    }
    if (-not $gotRestrict) {
      return (New-MailSyncError -ErrorId 'outlook_restrict_failed' -Message 'Unread Restrict returned no collection.' -Status 500)
    }
    $step = 'sort'
    try {
      $desc = [System.Boolean]$true
      [void]$restricted.Sort([string]'[ReceivedTime]', $desc)
    } catch {
      try { [void]$restricted.Sort([string]'[ReceivedTime]') } catch {}
    }
    $step = 'count'
    $unreadTotal = -1
    try { $unreadTotal = [int]$restricted.Count } catch { $unreadTotal = -1 }
    $step = 'list'
    $list = New-MailArrayList
    $scanned = 0
    $step = 'enum'
    foreach ($it in $restricted) {
      if ($scanned -ge $MaxScan) { break }
      $scanned++
      try {
        $dto = ConvertTo-MailDto $it
        if ($dto) { [void]$list.Add($dto) }
      } catch {}
    }
    $step = 'done'
    $mails = @()
    try { if ($list.Count -gt 0) { $mails = @($list.ToArray()) } } catch { $mails = @($list) }
    return [ordered]@{
      ok = $true
      error = ''
      message = ''
      unreadTotal = $unreadTotal
      scanned = $scanned
      mails = $mails
      apartment = [string][Threading.Thread]::CurrentThread.GetApartmentState()
      adapter = 'GetActiveObject'
    }
  } catch {
    $msg = [string]$_.Exception.Message
    if (-not $msg) { $msg = 'outlook_com' }
    return (New-MailSyncError -ErrorId 'outlook_com' -Message ($step + ': ' + $msg) -Status 500)
  }
}

function Get-NextTaskIdNumber {
  param($Tasks)
  $maxId = 0
  foreach ($t in @($Tasks)) {
    if ([string]$t.id -match '^T-?(\d+)$') {
      $v = [int]$Matches[1]
      if ($v -gt $maxId) { $maxId = $v }
    }
  }
  return $maxId
}

function New-TaskFromMailDto {
  param($Dto, [int]$NextId)
  $subj = [string]$Dto.subject
  if (-not $subj) { $subj = '(no subject)' }
  $from = [string]$Dto.fromName
  $fromEmail = [string]$Dto.fromEmail
  $importance = 'medium'
  try { if ([int]$Dto.importance -ge 2) { $importance = 'high' } } catch {}
  $toHint = $fromEmail
  if (-not $toHint) { $toHint = $from }
  $suggest = "Draft reply to ${toHint} about '${subj}': Thanks for your email. I will review and get back within one business day."
  if ($suggest.Length -gt 400) { $suggest = $suggest.Substring(0, 400) }
  $notes = 'Unread email'
  if ($from) { $notes = 'Unread email from ' + $from }
  $stamp = (Get-Date).ToUniversalTime().ToString('o')
  $id = 'T-' + $NextId.ToString('000')
  return [ordered]@{
    id = $id
    title = $subj
    status = 'todo'
    priority = $importance
    source = 'email'
    sourceRef = $(if ($fromEmail) { "$from <$fromEmail> / $subj" } else { "$from / $subj" })
    entryId = [string]$Dto.entryId
    fromEmail = $fromEmail
    tags = @('email','inbox','new')
    notes = $notes
    botAction = 'draft_reply'
    botInstruction = 'Prepare a short professional reply for me to review before sending.'
    comments = @()
    suggestedReply = $suggest
    due = $null
    assignee = ''
    checklist = @()
    progress = 0
    createdAt = $stamp
    updatedAt = $stamp
    createdBy = 'Mail Sync'
    receivedAt = [string]$Dto.received
    chat = @()
    timeline = @()
    pendingSend = $null
    pendingTrash = $false
  }
}

function Merge-UnreadMailIntoTasks {
  param(
    $Data,
    $Mails,
    [int]$MaxNew = 25
  )
  if ($MaxNew -lt 1) { $MaxNew = 1 }
  if ($MaxNew -gt 25) { $MaxNew = 25 }
  if (-not $Data) { $Data = [pscustomobject]@{ version = 1; title = 'Aqaar Command'; tasks = @() } }
  if (-not $Data.PSObject.Properties['tasks'] -or $null -eq $Data.tasks) {
    $Data | Add-Member -NotePropertyName tasks -NotePropertyValue @() -Force
  }
  $existing = @{}
  foreach ($t in @($Data.tasks)) {
    if ($t.entryId) { $existing[[string]$t.entryId] = $true }
    if ($t.entryID) { $existing[[string]$t.entryID] = $true }
  }
  $maxId = Get-NextTaskIdNumber -Tasks @($Data.tasks)
  $added = New-MailArrayList
  $newTasks = New-MailArrayList
  foreach ($m in @($Mails)) {
    if ($added.Count -ge $MaxNew) { break }
    $eid = [string]$m.entryId
    if (-not $eid) { continue }
    if ($existing.ContainsKey($eid)) { continue }
    $maxId++
    $task = New-TaskFromMailDto -Dto $m -NextId $maxId
    [void]$newTasks.Add([pscustomobject]$task)
    [void]$added.Add([pscustomobject]$task)
    $existing[$eid] = $true
  }
  if ($newTasks.Count -gt 0) {
    $Data.tasks = @($newTasks.ToArray()) + @($Data.tasks)
    try { $Data | Add-Member -NotePropertyName updatedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o')) -Force } catch { $Data.updatedAt = (Get-Date).ToUniversalTime().ToString('o') }
  }
  $slim = New-MailArrayList
  foreach ($t in @($added)) {
    $s = ConvertTo-SlimMailSyncItem $t
    if ($s) { [void]$slim.Add($s) }
  }
  $slimArr = @()
  try { if ($slim.Count -gt 0) { $slimArr = @($slim.ToArray()) } } catch { $slimArr = @($slim) }
  $addedArr = @()
  try { if ($added.Count -gt 0) { $addedArr = @($added.ToArray()) } } catch { $addedArr = @($added) }
  return [ordered]@{
    data = $Data
    added = $addedArr
    slim = $slimArr
    addedCount = $added.Count
  }
}

function Save-TasksJsonSafe {
  param($Data, [string]$Path)
  $json = $null
  try {
    $json = $Data | ConvertTo-Json -Depth 12
  } catch {
    throw ("tasks_json_serialize_failed: " + $_.Exception.Message)
  }
  if ([string]::IsNullOrWhiteSpace($json)) { throw 'tasks_json_empty' }
  $tmp = $Path + '.tmp'
  [IO.File]::WriteAllText($tmp, $json, [Text.UTF8Encoding]::new($false))
  try {
    $null = [IO.File]::ReadAllText($tmp, [Text.Encoding]::UTF8) | ConvertFrom-Json
  } catch {
    try { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue } catch {}
    throw ("tasks_json_roundtrip_failed: " + $_.Exception.Message)
  }
  [IO.File]::Copy($tmp, $Path, $true)
  try { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue } catch {}
}

function Get-OutlookRunningStatus {
  param([string]$DataDir = '')
  $outlook = $false
  $reason = 'outlook_not_running'
  $apt = [string][Threading.Thread]::CurrentThread.GetApartmentState()
  try {
    $probe = Invoke-InSta -ScriptBlock { Test-OutlookRunning } -TimeoutMs 8000
    if ($probe -is [bool] -and $probe) { $outlook = $true; $reason = '' }
    elseif ($probe -and $probe.PSObject.Properties['error'] -and $probe.error -eq 'outlook_timeout') {
      $reason = 'outlook_timeout'
    }
    elseif ($probe -eq $true) { $outlook = $true; $reason = '' }
  } catch {
    $reason = 'outlook_not_running'
  }
  $last = ''
  try {
    if ($DataDir -and (Get-Command Read-WizardSettings -ErrorAction SilentlyContinue)) {
      $settings = Read-WizardSettings -DataDir $DataDir
      $last = [string]$settings.mailLastSyncAt
    }
  } catch {}
  return [ordered]@{
    ok = $true
    aqhub = $true
    outlook = [bool]$outlook
    reason = $reason
    lastSyncAt = $last
    adapter = 'GetActiveObject'
    apartment = $apt
    note = 'Unread import remains POST /api/mail/sync. Recent mail is email-sourced tasks via GET /api/tasks. Wizard never calls /api/task/approve-send.'
  }
}

function Sync-MailToTasksCore {
  param(
    [string]$TasksPath,
    [string]$DataDir = '',
    [int]$MaxNew = 25,
    [int]$MaxScan = 120
  )
  try {
    if ($MaxNew -gt 25) { $MaxNew = 25 }
    if ($MaxNew -lt 1) { $MaxNew = 1 }
    if ($MaxScan -gt 200) { $MaxScan = 200 }
    if ($MaxScan -lt 1) { $MaxScan = 1 }
    if (-not $TasksPath -or -not (Test-Path -LiteralPath $TasksPath)) {
      return (New-MailSyncError -ErrorId 'no_tasks' -Message 'data/tasks.json is missing' -Status 500)
    }
    $raw = [IO.File]::ReadAllText($TasksPath, [Text.Encoding]::UTF8)
    $data = $null
    try { $data = $raw | ConvertFrom-Json } catch {
      return (New-MailSyncError -ErrorId 'tasks_json_invalid' -Message ('Could not parse tasks.json: ' + $_.Exception.Message) -Status 500)
    }
    if (-not $data) {
      return (New-MailSyncError -ErrorId 'tasks_json_invalid' -Message 'tasks.json parsed empty' -Status 500)
    }
    $scan = $null
    $aptNow = [Threading.Thread]::CurrentThread.GetApartmentState()
    if ($aptNow -eq [Threading.ApartmentState]::STA) {
      $scan = Read-OutlookUnreadMailDtos -MaxScan ([int]$MaxScan)
    } else {
      $scan = Invoke-InSta -ScriptBlock {
        param($MaxScan)
        Read-OutlookUnreadMailDtos -MaxScan $MaxScan
      } -Parameters @{ MaxScan = [int]$MaxScan } -TimeoutMs ([int]$script:MailSyncTimeoutMs)
    }
    if ($null -eq $scan) {
      return (New-MailSyncError -ErrorId 'outlook_com' -Message 'Outlook scan returned nothing' -Status 500)
    }
    $scanOk = $true
    try { if ($scan.ok -eq $false) { $scanOk = $false } } catch {}
    if (-not $scanOk) {
      $err = 'outlook_com'
      $msg = 'Outlook scan failed'
      $st = 500
      try { if ($scan.error) { $err = [string]$scan.error } } catch {}
      try { if ($scan.message) { $msg = [string]$scan.message } } catch {}
      try { if ($scan.status) { $st = [int]$scan.status } } catch {}
      return (New-MailSyncError -ErrorId $err -Message $msg -Status $st)
    }
    $mails = @()
    try { $mails = @($scan.mails) } catch { $mails = @() }
    $merged = Merge-UnreadMailIntoTasks -Data $data -Mails $mails -MaxNew $MaxNew
    $addedCount = 0
    try { $addedCount = [int]$merged.addedCount } catch { $addedCount = 0 }
    if ($addedCount -gt 0) {
      try {
        Save-TasksJsonSafe -Data $merged.data -Path $TasksPath
      } catch {
        return (New-MailSyncError -ErrorId 'tasks_json_write_failed' -Message ([string]$_.Exception.Message) -Status 500)
      }
    }
    try {
      if ($DataDir -and (Get-Command Read-WizardSettings -ErrorAction SilentlyContinue) -and (Get-Command Save-WizardSettings -ErrorAction SilentlyContinue)) {
        $ws = Read-WizardSettings -DataDir $DataDir
        $ws.mailLastSyncAt = (Get-Date).ToUniversalTime().ToString('o')
        [void](Save-WizardSettings -DataDir $DataDir -Settings $ws)
      }
    } catch {}
    $unreadTotal = -1
    try { $unreadTotal = [int]$scan.unreadTotal } catch { $unreadTotal = -1 }
    $scanned = 0
    try { $scanned = [int]$scan.scanned } catch { $scanned = 0 }
    $slim = @()
    try { $slim = @($merged.slim) } catch { $slim = @() }
    return [ordered]@{
      ok = $true
      added = $addedCount
      scanned = $scanned
      unreadTotal = $unreadTotal
      items = $slim
      adapter = 'GetActiveObject'
      apartment = [string][Threading.Thread]::CurrentThread.GetApartmentState()
    }
  } catch {
    return (New-MailSyncError -ErrorId 'mail_sync_failed' -Message ([string]$_.Exception.Message) -Status 500)
  }
}
