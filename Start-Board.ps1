# Aqaar Command Board server (ASCII-only script)
# Does not auto-open a browser. Pass -OpenBrowser or set AQHUB_OPEN_BROWSER=1
# to open the control homepage once (index.html / /), never the task board.
# -NoBrowser / AQHUB_NO_BROWSER=1 always wins (watchdog / hidden restarts).
param(
  [switch]$OpenBrowser,
  [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Root) { $Root = (Get-Location).Path }
$Port = 8766
$dataDir = Join-Path $Root 'data'
$tasksPath = Join-Path $dataDir 'tasks.json'
$eisenhowerPath = Join-Path $dataDir 'eisenhower.json'
$dashboardLayoutPath = Join-Path $dataDir 'dashboard-layout.json'
$notesPath = Join-Path $dataDir 'notes.json'
$auditPath = Join-Path $dataDir 'audit.jsonl'
$jobsDir = Join-Path $dataDir 'jobs'
$crmConfigPath = Join-Path $dataDir 'crm-config.json'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
if (-not (Test-Path $eisenhowerPath)) {
  [IO.File]::WriteAllText($eisenhowerPath, '{"items":[],"updatedAt":""}', [Text.UTF8Encoding]::new($false))
}
New-Item -ItemType Directory -Force -Path $jobsDir | Out-Null
if (-not (Test-Path $crmConfigPath)) {
  $crmSeed = '{"orgUrl":"https://aqaar.crm15.dynamics.com","appId":"944e68b1-308d-4e3a-86c7-cf0452397938","environment":"prod","uatOrgUrl":"https://operations-aqaaruat-1.crm15.dynamics.com","tenantId":"cd686870-f362-4a4a-9a97-23d4437aadb7","clientId":"9cee029c-6210-4654-90bb-17e6e9d36617","redirectUri":"http://localhost","accessToken":"","refreshToken":"","tokenExpiresAt":"","authMode":"pac","authStatus":"pending_auth","deviceCode":"","deviceCodeExpiresAt":"","userCode":"","verificationUrl":"","lastSyncAt":"","lastError":"pending_auth","lastPreviewAt":"","pacUser":"Ahmed.Mahmoud@aqaar.com","defaultEntities":"md_units,md_offers,md_approvaltransactions,aqr_legalcases,leads,opportunities,accounts"}'
  [IO.File]::WriteAllText($crmConfigPath, $crmSeed, [Text.UTF8Encoding]::new($false))
} else {
  # Ensure known prod org is present when config exists but orgUrl empty
  try {
    $existingCfg = [IO.File]::ReadAllText($crmConfigPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
    $changed = $false
    if (-not $existingCfg.orgUrl) { $existingCfg | Add-Member -NotePropertyName orgUrl -NotePropertyValue 'https://aqaar.crm15.dynamics.com' -Force; $changed = $true }
    if (-not ($existingCfg.PSObject.Properties['appId']) -or -not $existingCfg.appId) { $existingCfg | Add-Member -NotePropertyName appId -NotePropertyValue '944e68b1-308d-4e3a-86c7-cf0452397938' -Force; $changed = $true }
    if (-not ($existingCfg.PSObject.Properties['environment']) -or -not $existingCfg.environment) { $existingCfg | Add-Member -NotePropertyName environment -NotePropertyValue 'prod' -Force; $changed = $true }
    if (-not ($existingCfg.PSObject.Properties['clientId']) -or -not $existingCfg.clientId) { $existingCfg | Add-Member -NotePropertyName clientId -NotePropertyValue '9cee029c-6210-4654-90bb-17e6e9d36617' -Force; $changed = $true }
    if (-not ($existingCfg.PSObject.Properties['tenantId']) -or -not $existingCfg.tenantId -or $existingCfg.tenantId -eq 'common') { $existingCfg | Add-Member -NotePropertyName tenantId -NotePropertyValue 'cd686870-f362-4a4a-9a97-23d4437aadb7' -Force; $changed = $true }
    if (-not ($existingCfg.PSObject.Properties['redirectUri']) -or -not $existingCfg.redirectUri) { $existingCfg | Add-Member -NotePropertyName redirectUri -NotePropertyValue 'http://localhost' -Force; $changed = $true }
    if ($changed) {
      $jsonFix = $existingCfg | ConvertTo-Json -Depth 6 -Compress
      [IO.File]::WriteAllText($crmConfigPath, $jsonFix, [Text.UTF8Encoding]::new($false))
    }
  } catch {}
}
if (-not (Test-Path $tasksPath)) {
  Set-Content -Path $tasksPath -Value '{"version":1,"title":"Aqaar Command","tasks":[]}' -Encoding Ascii
}
if (-not (Test-Path $auditPath)) { New-Item -ItemType File -Path $auditPath | Out-Null }

Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
  Where-Object { $_.CommandLine -match 'Start-Board\.ps1' -and $_.ProcessId -ne $PID } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
try { $listener.Start() } catch {
  Write-Host "Could not bind port $Port"
  throw
}
$homeUrl = "http://127.0.0.1:$Port/"
$boardUrl = "http://127.0.0.1:$Port/board.html"
Write-Host "Aqaar Control home: $homeUrl"
Write-Host "Task board:         $boardUrl"
$envOpen = [string]$env:AQHUB_OPEN_BROWSER
$wantOpen = [bool]$OpenBrowser
if (-not $wantOpen -and $envOpen) {
  if ($envOpen.Trim().ToLowerInvariant() -in @('1','true','yes')) { $wantOpen = $true }
}
if ($NoBrowser -or ($args -contains '-NoBrowser') -or ($env:AQHUB_NO_BROWSER -eq '1')) { $wantOpen = $false }
if ($wantOpen) {
  Write-Host "Opening homepage in browser (-OpenBrowser / AQHUB_OPEN_BROWSER)."
  try { Start-Process $homeUrl } catch { Write-Host "Could not open browser. Open $homeUrl manually." }
} else {
  Write-Host "Browser not opened. Pass -OpenBrowser or set AQHUB_OPEN_BROWSER=1 to open the homepage once."
}

function Get-Mime($path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.js' { 'application/javascript; charset=utf-8' }
    '.css' { 'text/css; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.jsonl' { 'text/plain; charset=utf-8' }
    default { 'application/octet-stream' }
  }
}
function Read-Body($req) {
  $reader = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}
function Write-Text($res, $code, $ctype, $text) {
  $bytes = [Text.Encoding]::UTF8.GetBytes([string]$text)
  try {
    $res.StatusCode = $code
    $res.ContentType = $ctype
    $res.Headers['Cache-Control'] = 'no-store'
    $res.Headers['Access-Control-Allow-Origin'] = '*'
    $res.SendChunked = $false
    $res.ContentLength64 = [int64]$bytes.LongLength
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    # swallow write errors so one bad client does not kill the listener
  } finally {
    try { $res.OutputStream.Close() } catch {}
    try { $res.Close() } catch {}
  }
}
function Write-FileResp($res, $path) {
  $bytes = [IO.File]::ReadAllBytes($path)
  try {
    $res.StatusCode = 200
    $res.ContentType = (Get-Mime $path)
    $res.Headers['Cache-Control'] = 'no-store'
    $res.Headers['Access-Control-Allow-Origin'] = '*'
    $res.SendChunked = $false
    $res.ContentLength64 = [int64]$bytes.LongLength
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
  } finally {
    try { $res.OutputStream.Close() } catch {}
    try { $res.Close() } catch {}
  }
}
function Write-Json($res, $obj, $code = 200) {
  try {
    $json = $obj | ConvertTo-Json -Depth 8 -Compress
  } catch {
    $json = (@{ ok = $false; error = 'json_serialize_failed'; message = $_.Exception.Message } | ConvertTo-Json -Compress)
    $code = 500
  }
  if ($null -eq $json) { $json = '{"ok":false,"error":"empty_json"}'; $code = 500 }
  Write-Text $res $code 'application/json; charset=utf-8' $json
}
function Get-OutlookApp {
  try { return [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') }
  catch { return New-Object -ComObject Outlook.Application }
}
function Show-Toast([string]$title, [string]$body) {
  try {
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    Add-Type -AssemblyName System.Drawing | Out-Null
    $n = New-Object System.Windows.Forms.NotifyIcon
    $n.Icon = [System.Drawing.SystemIcons]::Information
    $n.Visible = $true
    $n.BalloonTipTitle = $title
    $n.BalloonTipText = $body
    $n.ShowBalloonTip(5000)
    Start-Sleep -Milliseconds 700
    $n.Dispose()
  } catch {}
}
function Write-Audit([hashtable]$entry) {
  try {
    $line = ($entry | ConvertTo-Json -Compress -Depth 6)
    [IO.File]::AppendAllText($auditPath, $line + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
  } catch {}
}
function Get-JobPath([string]$id) {
  $safe = ($id -replace '[^A-Za-z0-9_\-]', '_')
  return (Join-Path $jobsDir ($safe + '.json'))
}
function Save-JobObj($job) {
  $path = Get-JobPath ([string]$job.id)
  $json = $job | ConvertTo-Json -Depth 12
  [IO.File]::WriteAllText($path, $json, [Text.UTF8Encoding]::new($false))
}
function Load-JobObj([string]$id) {
  $path = Get-JobPath $id
  if (-not (Test-Path $path)) { return $null }
  return ([IO.File]::ReadAllText($path, [Text.Encoding]::UTF8) | ConvertFrom-Json)
}
function New-JobId {
  return ('J-' + (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss') + '-' + ([guid]::NewGuid().ToString('N').Substring(0, 8)))
}


# Background bot runner scriptblock (runs in Start-Job)
$script:BotRunnerSb = {
  param($JobId, $JobsDir, $TasksPath, $AuditPath)

  function Get-JP([string]$id) { Join-Path $JobsDir (($id -replace '[^A-Za-z0-9_\-]', '_') + '.json') }
  function Load-J {
    $p = Get-JP $JobId
    return ([IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) | ConvertFrom-Json)
  }
  function Save-J($j) {
    $p = Get-JP $JobId
    $json = $j | ConvertTo-Json -Depth 12
    [IO.File]::WriteAllText($p, $json, [Text.UTF8Encoding]::new($false))
  }
  function Add-Log([string]$msg) {
    $j = Load-J
    $entry = [pscustomobject]@{ t = (Get-Date).ToUniversalTime().ToString('o'); msg = $msg }
    $logs = @($j.log)
    if (-not $logs) { $logs = @() }
    $j.log = @($logs) + @($entry)
    Save-J $j
  }
  function Test-Cancel {
    $j = Load-J
    return [bool]$j.cancel
  }
  function Set-Status([string]$st, $result = $null) {
    $j = Load-J
    $j.status = $st
    if ($null -ne $result) { $j.result = $result }
    if ($st -eq 'done' -or $st -eq 'stopped' -or $st -eq 'error') {
      $j.finishedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    Save-J $j
  }
  function Write-Aud([hashtable]$entry) {
    try {
      $line = ($entry | ConvertTo-Json -Compress -Depth 6)
      [IO.File]::AppendAllText($AuditPath, $line + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    } catch {}
  }
  function Load-Tasks {
    $raw = [IO.File]::ReadAllText($TasksPath, [Text.Encoding]::UTF8)
    return ($raw | ConvertFrom-Json)
  }
  function Save-Tasks($data) {
    $data.updatedAt = (Get-Date).ToUniversalTime().ToString('o')
    $json = $data | ConvertTo-Json -Depth 12
    [IO.File]::WriteAllText($TasksPath, $json, [Text.UTF8Encoding]::new($false))
  }
  function Find-Task($data, [string]$tid) {
    foreach ($t in @($data.tasks)) {
      if ([string]$t.id -eq $tid) { return $t }
    }
    return $null
  }
  function Get-Outlook {
    try { return [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') }
    catch { return New-Object -ComObject Outlook.Application }
  }

  try {
    $job = Load-J
    $job.status = 'running'
    $job.startedAt = (Get-Date).ToUniversalTime().ToString('o')
    Save-J $job
    Add-Log 'Job started'
    Write-Aud @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'bot.run.start'; jobId = $JobId; taskId = [string]$job.taskId; mode = [string]$job.mode }

    $action = ([string]$job.action).ToLowerInvariant()
    $taskId = [string]$job.taskId
    $instruction = [string]$job.instruction

    if (Test-Cancel) { Add-Log 'Cancelled before work'; Set-Status 'stopped' @{ reason = 'cancelled' }; return }

    Add-Log ("Loading task " + $taskId)
    Start-Sleep -Milliseconds 200
    $data = Load-Tasks
    $task = Find-Task $data $taskId
    if (-not $task) {
      Add-Log 'Task not found'
      Set-Status 'error' @{ error = 'task_not_found' }
      Write-Aud @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'bot.run.error'; jobId = $JobId; error = 'task_not_found' }
      return
    }
    Add-Log ("Task loaded: " + [string]$task.title)
    if (Test-Cancel) { Add-Log 'Cancelled after load'; Set-Status 'stopped' @{ reason = 'cancelled' }; Write-Aud @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'bot.run.stopped'; jobId = $JobId }; return }

    # Normalize aliases
    if ($action -eq 'draft_reply' -or $action -eq 'prepare_reply' -or $action -eq 'jehez_rad') { $action = 'prepare_reply' }
    if ($action -eq 'move_trash' -or $action -eq 'trash' -or $action -eq 'delete_mail') { $action = 'move_trash' }

    if ($action -eq 'none' -or [string]::IsNullOrWhiteSpace($action)) {
      Add-Log 'No action set on task'
      Set-Status 'error' @{ error = 'no action set' }
      Write-Aud @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'bot.run.error'; jobId = $JobId; error = 'no_action' }
      return
    }

    if ($action -eq 'prepare_reply') {
      Add-Log 'Action: prepare_reply (draft only, will NOT send mail)'
      Start-Sleep -Milliseconds 250
      if (Test-Cancel) { Add-Log 'Cancelled'; Set-Status 'stopped' @{ reason = 'cancelled' }; return }
      Add-Log 'Reading bot instruction and task context'
      Start-Sleep -Milliseconds 200
      $fromHint = [string]$task.sourceRef
      if (-not $fromHint) { $fromHint = [string]$task.title }
      $title = [string]$task.title
      $instr = $instruction
      if (-not $instr) { $instr = [string]$task.botInstruction }
      if (-not $instr) { $instr = 'Prepare a short professional reply for review.' }
      Add-Log 'Drafting English + Arabic short reply into suggestedReply'
      Start-Sleep -Milliseconds 300
      if (Test-Cancel) { Add-Log 'Cancelled before save'; Set-Status 'stopped' @{ reason = 'cancelled' }; return }

      $en = "Hello,`n`nThank you for your message regarding '" + $title + "'. I have reviewed it and will follow up shortly.`n`nBest regards"
      $ar = "[AR] Shukran ala risalatikum bikhusus '" + $title + "'. Sa-uraajea wa aruddu alaikum qareeban.`n`nMa'a altahiya"
      if ($instr) {
        $en = $en + "`n`n(Note for reviewer: " + $instr + ")"
      }
      $draft = $en + "`n`n---`n`n" + $ar

      $data = Load-Tasks
      $task = Find-Task $data $taskId
      if (-not $task) { Set-Status 'error' @{ error = 'task_not_found' }; return }
      $task | Add-Member -NotePropertyName suggestedReply -NotePropertyValue $draft -Force
      $task | Add-Member -NotePropertyName updatedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o')) -Force
      Save-Tasks $data
      Add-Log 'Saved suggestedReply on task (mail NOT sent)'
      Set-Status 'done' @{ suggestedReply = $draft; sent = $false }
      Write-Aud @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'bot.run.done'; jobId = $JobId; taskId = $taskId; kind = 'prepare_reply' }
      return
    }

    if ($action -eq 'remind') {
      Add-Log 'Action: remind - appending timestamped note to comments'
      Start-Sleep -Milliseconds 200
      if (Test-Cancel) { Add-Log 'Cancelled'; Set-Status 'stopped' @{ reason = 'cancelled' }; return }
      $stamp = (Get-Date).ToUniversalTime().ToString('o')
      $noteText = 'Reminder set by bot'
      if ($instruction) { $noteText = 'Reminder: ' + $instruction }
      $data = Load-Tasks
      $task = Find-Task $data $taskId
      if (-not $task) { Set-Status 'error' @{ error = 'task_not_found' }; return }
      $comments = @()
      if ($task.comments) { $comments = @($task.comments) }
      $comments += [pscustomobject]@{ text = $noteText; by = 'bot'; at = $stamp }
      $task | Add-Member -NotePropertyName comments -NotePropertyValue $comments -Force
      $task | Add-Member -NotePropertyName updatedAt -NotePropertyValue $stamp -Force
      Save-Tasks $data
      Add-Log 'Comment appended'
      Set-Status 'done' @{ note = $noteText }
      Write-Aud @{ at = $stamp; actor = 'Bot'; action = 'bot.run.done'; jobId = $JobId; taskId = $taskId; kind = 'remind' }
      return
    }

    if ($action -eq 'move_trash') {
      Add-Log 'Action: move_trash (Outlook Deleted Items)'
      Start-Sleep -Milliseconds 200
      if (Test-Cancel) { Add-Log 'Cancelled before Outlook'; Set-Status 'stopped' @{ reason = 'cancelled' }; return }
      $entryId = [string]$task.entryId
      if (-not $entryId) { $entryId = [string]$task.entryID }
      if (-not $entryId) {
        Add-Log 'No entryId on task - cannot move mail'
        Set-Status 'error' @{ error = 'no_entryId'; message = 'Task has no Outlook entryId' }
        Write-Aud @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'bot.run.error'; jobId = $JobId; error = 'no_entryId' }
        return
      }
      Add-Log 'Connecting to Outlook COM'
      Start-Sleep -Milliseconds 250
      if (Test-Cancel) { Add-Log 'Cancelled before GetItem'; Set-Status 'stopped' @{ reason = 'cancelled' }; return }
      try {
        $outlook = Get-Outlook
        $ns = $outlook.GetNamespace('MAPI')
        Add-Log 'Resolving mail item by entryId'
        Start-Sleep -Milliseconds 200
        if (Test-Cancel) { Add-Log 'Cancelled before Move - mail left alone'; Set-Status 'stopped' @{ reason = 'cancelled' }; return }
        $item = $ns.GetItemFromID($entryId)
        if (-not $item) {
          Add-Log 'Mail item not found'
          Set-Status 'error' @{ error = 'mail_not_found' }
          return
        }
        Add-Log ('Found: ' + [string]$item.Subject)
        if (Test-Cancel) { Add-Log 'Cancelled before Move - mail left alone'; Set-Status 'stopped' @{ reason = 'cancelled' }; return }
        $deleted = $ns.GetDefaultFolder(3)
        Add-Log 'Moving to Deleted Items'
        $null = $item.Move($deleted)
        Add-Log 'Move completed'
        $data = Load-Tasks
        $task = Find-Task $data $taskId
        if ($task) {
          $stamp = (Get-Date).ToUniversalTime().ToString('o')
          $comments = @()
          if ($task.comments) { $comments = @($task.comments) }
          $comments += [pscustomobject]@{ text = 'Bot moved mail to Deleted Items'; by = 'bot'; at = $stamp }
          $task | Add-Member -NotePropertyName comments -NotePropertyValue $comments -Force
          $task | Add-Member -NotePropertyName updatedAt -NotePropertyValue $stamp -Force
          Save-Tasks $data
        }
        Set-Status 'done' @{ moved = $true }
        Write-Aud @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'bot.run.done'; jobId = $JobId; taskId = $taskId; kind = 'move_trash' }
      } catch {
        Add-Log ('Outlook error: ' + $_.Exception.Message)
        Set-Status 'error' @{ error = $_.Exception.Message }
        Write-Aud @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'bot.run.error'; jobId = $JobId; error = $_.Exception.Message }
      }
      return
    }

    # follow_up / research / custom / other -> note append only
    Add-Log ('Action: ' + $action + ' - recording instruction for human/bot follow-up (no Outlook ops)')
    Start-Sleep -Milliseconds 200
    if (Test-Cancel) { Add-Log 'Cancelled'; Set-Status 'stopped' @{ reason = 'cancelled' }; return }
    $stamp = (Get-Date).ToUniversalTime().ToString('o')
    $noteText = 'Manual instruction recorded for human/bot follow-up'
    if ($instruction) { $noteText = $noteText + ': ' + $instruction }
    elseif ([string]$task.botInstruction) { $noteText = $noteText + ': ' + [string]$task.botInstruction }
    $data = Load-Tasks
    $task = Find-Task $data $taskId
    if (-not $task) { Set-Status 'error' @{ error = 'task_not_found' }; return }
    $comments = @()
    if ($task.comments) { $comments = @($task.comments) }
    $comments += [pscustomobject]@{ text = $noteText; by = 'bot'; at = $stamp }
    $task | Add-Member -NotePropertyName comments -NotePropertyValue $comments -Force
    $task | Add-Member -NotePropertyName updatedAt -NotePropertyValue $stamp -Force
    Save-Tasks $data
    Add-Log 'Note appended; no dangerous ops invented'
    Set-Status 'done' @{ note = $noteText; kind = 'custom' }
    Write-Aud @{ at = $stamp; actor = 'Bot'; action = 'bot.run.done'; jobId = $JobId; taskId = $taskId; kind = $action }
  } catch {
    try {
      Add-Log ('Fatal: ' + $_.Exception.Message)
      Set-Status 'error' @{ error = $_.Exception.Message }
      Write-Aud @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'bot.run.error'; jobId = $JobId; error = $_.Exception.Message }
    } catch {}
  }
}


function Start-BotRun([string]$taskId, [string]$mode) {
  $data = [IO.File]::ReadAllText($tasksPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
  $task = $null
  foreach ($t in @($data.tasks)) {
    if ([string]$t.id -eq $taskId) { $task = $t; break }
  }
  if (-not $task) {
    return @{ ok = $false; error = 'task_not_found' }
  }
  $action = [string]$task.botAction
  if (-not $action) { $action = 'none' }
  $instruction = [string]$task.botInstruction
  if (-not $mode) { $mode = 'live' }
  $mode = $mode.ToLowerInvariant()
  if ($mode -ne 'background') { $mode = 'live' }

  $jobId = New-JobId
  $job = [ordered]@{
    id = $jobId
    taskId = $taskId
    action = $action
    instruction = $instruction
    mode = $mode
    status = 'queued'
    log = @([pscustomobject]@{ t = (Get-Date).ToUniversalTime().ToString('o'); msg = 'Queued' })
    result = $null
    startedAt = $null
    finishedAt = $null
    cancel = $false
  }
  Save-JobObj ([pscustomobject]$job)
  Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'User'; action = 'bot.run.request'; jobId = $jobId; taskId = $taskId; mode = $mode; botAction = $action }

  $null = Start-Job -Name ("AqaarBot-" + $jobId) -ScriptBlock $script:BotRunnerSb -ArgumentList @($jobId, $jobsDir, $tasksPath, $auditPath)

  return @{ ok = $true; id = $jobId; job = (Load-JobObj $jobId) }
}

function Stop-BotJob([string]$id) {
  $job = Load-JobObj $id
  if (-not $job) { return @{ ok = $false; error = 'job_not_found' } }
  $job.cancel = $true
  if ([string]$job.status -eq 'queued') {
    $job.status = 'stopped'
    $job.finishedAt = (Get-Date).ToUniversalTime().ToString('o')
    $logs = @($job.log)
    $logs += [pscustomobject]@{ t = (Get-Date).ToUniversalTime().ToString('o'); msg = 'Stop requested (was queued)' }
    $job.log = $logs
  } else {
    $logs = @($job.log)
    $logs += [pscustomobject]@{ t = (Get-Date).ToUniversalTime().ToString('o'); msg = 'Stop requested' }
    $job.log = $logs
  }
  Save-JobObj $job
  Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'User'; action = 'bot.run.stop'; jobId = $id }
  return @{ ok = $true; job = (Load-JobObj $id) }
}

function List-RecentJobs([int]$take = 20) {
  $files = Get-ChildItem -Path $jobsDir -Filter '*.json' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First $take
  $list = New-Object System.Collections.Generic.List[object]
  foreach ($f in @($files)) {
    try {
      $j = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8) | ConvertFrom-Json
      [void]$list.Add($j)
    } catch {}
  }
  return @{ ok = $true; jobs = $list }
}

function Open-Mail([string]$entryId, [string]$query) {
  $outlook = Get-OutlookApp
  $ns = $outlook.GetNamespace('MAPI')
  if ($entryId) {
    try {
      $item = $ns.GetItemFromID($entryId)
      if ($item) { $item.Display(); return @{ ok = $true; method = 'entryId' } }
    } catch {}
  }
  if ($query) {
    $inbox = $ns.GetDefaultFolder(6)
    $items = $inbox.Items
    $items.Sort('[ReceivedTime]', $true)
    $q = $query.ToLowerInvariant()
    $n = 0
    foreach ($it in $items) {
      if ($n -gt 250) { break }
      $n++
      try {
        $subj = [string]$it.Subject
        $from = [string]$it.SenderName
        $blob = ($subj + ' ' + $from).ToLowerInvariant()
        $prefixLen = [Math]::Min(20, $q.Length)
        if ($blob.Contains($q) -or ($subj -and $q.Length -gt 6 -and $subj.ToLowerInvariant().Contains($q.Substring(0, $prefixLen)))) {
          $it.Display()
          return @{ ok = $true; method = 'search'; subject = $subj; entryId = [string]$it.EntryID }
        }
      } catch {}
    }
  }
  return @{ ok = $false; error = 'not_found' }
}
function Sync-MailToTasks {
  $raw = [IO.File]::ReadAllText($tasksPath, [Text.Encoding]::UTF8)
  $data = $raw | ConvertFrom-Json
  if (-not $data.tasks) { $data | Add-Member -NotePropertyName tasks -NotePropertyValue @() -Force }
  $existing = @{}
  foreach ($t in @($data.tasks)) {
    if ($t.entryId) { $existing[[string]$t.entryId] = $true }
    if ($t.entryID) { $existing[[string]$t.entryID] = $true }
  }
  $outlook = Get-OutlookApp
  $ns = $outlook.GetNamespace('MAPI')
  $inbox = $ns.GetDefaultFolder(6)
  $items = $inbox.Items
  try { $items = $items.Restrict('[UnRead] = true') } catch {}
  try { $items.Sort('[ReceivedTime]', $true) } catch {}
  $unreadTotal = 0
  try { $unreadTotal = [int]$items.Count } catch { $unreadTotal = -1 }
  $added = New-Object System.Collections.Generic.List[object]
  $maxId = 0
  foreach ($t in @($data.tasks)) {
    if ([string]$t.id -match '^T-?(\d+)$') {
      $v = [int]$Matches[1]
      if ($v -gt $maxId) { $maxId = $v }
    }
  }
  $scanned = 0
  $maxNew = 25
  $maxScan = 200
  foreach ($it in $items) {
    if ($added.Count -ge $maxNew) { break }
    if ($scanned -ge $maxScan) { break }
    $scanned++
    try {
      $eid = [string]$it.EntryID
      if (-not $eid) { continue }
      if ($existing.ContainsKey($eid)) { continue }
      $maxId++
      $subj = [string]$it.Subject
      if (-not $subj) { $subj = '(no subject)' }
      $from = [string]$it.SenderName
      $fromEmail = ''
      try {
        $fromEmail = [string]$it.SenderEmailAddress
        if ($fromEmail -like '/O=*') {
          try {
            $ex = $it.Sender
            if ($ex) { $fromEmail = [string]$ex.GetExchangeUser().PrimarySmtpAddress }
          } catch {}
        }
        if ($fromEmail -like '/O=*') {
          try {
            $pa = $it.PropertyAccessor
            $fromEmail = [string]$pa.GetProperty('http://schemas.microsoft.com/mapi/proptag/0x5D01001E')
          } catch {}
        }
      } catch {}
      $preview = ''
      try {
        $preview = [string]$it.Body
        if ($preview.Length -gt 280) { $preview = $preview.Substring(0, 280) }
      } catch {}
      $importance = 'medium'
      try { if ([int]$it.Importance -ge 2) { $importance = 'high' } } catch {}
      $toHint = $fromEmail
      if (-not $toHint) { $toHint = $from }
      $suggest = "Draft reply to ${toHint} about '${subj}': Thanks for your email. I will review and get back within one business day."
      $received = ''
      try { $received = ([datetime]$it.ReceivedTime).ToUniversalTime().ToString('o') } catch {}
      $task = [ordered]@{
        id = ('T-' + $maxId.ToString('000'))
        title = $subj
        status = 'todo'
        priority = $importance
        source = 'email'
        sourceRef = $(if ($fromEmail) { "$from <$fromEmail> / $subj" } else { "$from / $subj" })
        entryId = $eid
        fromEmail = $fromEmail
        tags = @('email','inbox','new')
        notes = $preview
        botAction = 'draft_reply'
        botInstruction = 'Prepare a short professional reply for me to review before sending.'
        comments = @()
        suggestedReply = $suggest
        due = $null
        assignee = ''
        checklist = @()
        progress = 0
        createdAt = (Get-Date).ToUniversalTime().ToString('o')
        updatedAt = (Get-Date).ToUniversalTime().ToString('o')
        createdBy = 'Mail Sync'
        receivedAt = $received
        chat = @()
        timeline = @()
        pendingSend = $null
        pendingTrash = $false
      }
      $data.tasks = @([pscustomobject]$task) + @($data.tasks)
      $existing[$eid] = $true
      [void]$added.Add([pscustomobject]$task)
    } catch {}
  }
  if ($added.Count -gt 0) {
    $data.updatedAt = (Get-Date).ToUniversalTime().ToString('o')
    $json = $data | ConvertTo-Json -Depth 12
    [IO.File]::WriteAllText($tasksPath, $json, [Text.UTF8Encoding]::new($false))
  }
  if ($added.Count -gt 0) {
    $first = [string]$added[0].title
    if ($added.Count -eq 1) { Show-Toast 'Aqaar mail' ('New task: ' + $first) }
    else { Show-Toast 'Aqaar mail' (($added.Count).ToString() + ' new email tasks') }
  }
  return @{ ok = $true; added = $added.Count; scanned = $scanned; unreadTotal = $unreadTotal; items = @($added) }
}

function U8([string]$b64) {
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64))
}
function Load-TasksData {
  $raw = [IO.File]::ReadAllText($tasksPath, [Text.Encoding]::UTF8)
  return ($raw | ConvertFrom-Json)
}
function Save-TasksData($data) {
  $data.updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  $json = $data | ConvertTo-Json -Depth 14
  [IO.File]::WriteAllText($tasksPath, $json, [Text.UTF8Encoding]::new($false))
}
function Find-TaskObj($data, [string]$tid) {
  foreach ($t in @($data.tasks)) {
    if ([string]$t.id -eq $tid) { return $t }
  }
  return $null
}
function New-RoomId([string]$prefix) {
  return ($prefix + (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss') + '-' + ([guid]::NewGuid().ToString('N').Substring(0, 6)))
}
function Ensure-TaskRoom($task) {
  $stamp = (Get-Date).ToUniversalTime().ToString('o')
  $chatProp = $task.PSObject.Properties['chat']
  if (-not $chatProp) {
    $task | Add-Member -NotePropertyName chat -NotePropertyValue @() -Force
  } elseif ($null -eq $task.chat) {
    $task.chat = @()
  } else {
    $task.chat = @($task.chat)
  }
  $tlProp = $task.PSObject.Properties['timeline']
  if (-not $tlProp) {
    $task | Add-Member -NotePropertyName timeline -NotePropertyValue @() -Force
  } elseif ($null -eq $task.timeline) {
    $task.timeline = @()
  } else {
    $task.timeline = @($task.timeline)
  }
  if (-not $task.PSObject.Properties['pendingSend']) {
    $task | Add-Member -NotePropertyName pendingSend -NotePropertyValue $null -Force
  }
  if (-not $task.PSObject.Properties['pendingTrash']) {
    $task | Add-Member -NotePropertyName pendingTrash -NotePropertyValue $false -Force
  }
  if (@($task.timeline).Count -eq 0) {
    $createdAt = [string]$task.createdAt
    if (-not $createdAt) { $createdAt = $stamp }
    $actor0 = [string]$task.createdBy
    if (-not $actor0) { $actor0 = 'system' }
    $tl = @()
    $tl += [pscustomobject]@{ id = (New-RoomId 'TL-'); type = 'created'; text = ('Task created: ' + [string]$task.title); at = $createdAt; actor = $actor0; meta = $null }
    foreach ($c in @($task.comments)) {
      if (-not $c) { continue }
      $cat = [string]$c.at
      if (-not $cat) { $cat = $createdAt }
      $cby = [string]$c.by
      if (-not $cby) { $cby = 'user' }
      $tl += [pscustomobject]@{
        id = (New-RoomId 'TL-')
        type = 'comment'
        text = [string]$c.text
        at = $cat
        actor = $cby
        meta = $null
      }
    }
    $task.timeline = $tl
  }
  return $true
}
function Add-Timeline($task, [string]$type, [string]$text, [string]$actor, $meta = $null) {
  $ev = [pscustomobject]@{
    id = (New-RoomId 'TL-')
    type = $type
    text = $text
    at = (Get-Date).ToUniversalTime().ToString('o')
    actor = $actor
    meta = $meta
  }
  $list = New-Object System.Collections.ArrayList
  foreach ($x in @($task.timeline)) { if ($null -ne $x) { [void]$list.Add($x) } }
  [void]$list.Add($ev)
  $task.timeline = @($list.ToArray())
  return $ev
}
function Add-Chat($task, [string]$role, [string]$text, $meta = $null) {
  $msg = [pscustomobject]@{
    id = (New-RoomId 'CH-')
    role = $role
    text = $text
    at = (Get-Date).ToUniversalTime().ToString('o')
    meta = $meta
  }
  $list = New-Object System.Collections.ArrayList
  foreach ($x in @($task.chat)) { if ($null -ne $x) { [void]$list.Add($x) } }
  [void]$list.Add($msg)
  $task.chat = @($list.ToArray())
  return $msg
}
function Test-TextHas([string]$hay, [string]$needle) {
  if ([string]::IsNullOrEmpty($hay) -or [string]::IsNullOrEmpty($needle)) { return $false }
  return ($hay.ToLowerInvariant().Contains($needle.ToLowerInvariant()))
}
function Test-AnyToken([string]$hay, [string[]]$tokens) {
  foreach ($t in $tokens) {
    if (Test-TextHas $hay $t) { return $true }
  }
  return $false
}
function Get-DraftBody($task, [string]$extra) {
  $title = [string]$task.title
  $instr = [string]$task.botInstruction
  if ($extra) { $instr = $extra }
  if (-not $instr) { $instr = 'Prepare a short professional reply for review.' }
  $en = "Hello,`n`nThank you for your message regarding '" + $title + "'. I have reviewed it and will follow up shortly.`n`nBest regards"
  $ar = "[AR] Shukran ala risalatikum bikhusus '" + $title + "'. Sa-uraajea wa aruddu alaikum qareeban.`n`nMa'a altahiya"
  if ($instr) { $en = $en + "`n`n(Note for reviewer: " + $instr + ")" }
  return ($en + "`n`n---`n`n" + $ar)
}
function Invoke-MoveTrashNow($task) {
  $entryId = [string]$task.entryId
  if (-not $entryId) { $entryId = [string]$task.entryID }
  if (-not $entryId) {
    return @{ ok = $false; error = 'no_entryId'; message = 'Task has no Outlook entryId' }
  }
  try {
    $outlook = Get-OutlookApp
    $ns = $outlook.GetNamespace('MAPI')
    $item = $ns.GetItemFromID($entryId)
    if (-not $item) { return @{ ok = $false; error = 'mail_not_found' } }
    $deleted = $ns.GetDefaultFolder(3)
    $null = $item.Move($deleted)
    $stamp = (Get-Date).ToUniversalTime().ToString('o')
    $comments = @()
    if ($task.comments) { $comments = @($task.comments) }
    $comments += [pscustomobject]@{ text = 'Bot moved mail to Deleted Items'; by = 'bot'; at = $stamp }
    $task | Add-Member -NotePropertyName comments -NotePropertyValue $comments -Force
    return @{ ok = $true; moved = $true }
  } catch {
    return @{ ok = $false; error = $_.Exception.Message }
  }
}

function Get-EmailFromText([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return '' }
  $m = [regex]::Match($text, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
  if ($m.Success) { return $m.Value }
  return ''
}
function Resolve-SendTo($task, [string]$userText) {
  $to = Get-EmailFromText $userText
  if ($to) { return $to }
  $fe = [string]$task.fromEmail
  if ($fe -and $fe.Contains('@')) { return $fe }
  $to = Get-EmailFromText ([string]$task.sourceRef)
  if ($to) { return $to }
  if ($task.pendingSend -and $task.pendingSend.to) {
    $to = Get-EmailFromText ([string]$task.pendingSend.to)
    if (-not $to) { $to = [string]$task.pendingSend.to }
    if ($to -and $to.Contains('@')) { return $to }
  }
  foreach ($msg in @($task.chat)) {
    if (-not $msg) { continue }
    $to = Get-EmailFromText ([string]$msg.text)
    if ($to) { return $to }
  }
  $to = Get-EmailFromText ([string]$task.sourceRef)
  if ($to) { return $to }
  $to = Get-EmailFromText ([string]$task.title)
  if ($to) { return $to }
  $instr = [string]$task.botInstruction
  if (-not $instr) { $instr = [string]$task.botInstruction }
  $to = Get-EmailFromText $instr
  if ($to) { return $to }
  return ''
}

function Invoke-SendPending($task) {
  $ps = $task.pendingSend
  if (-not $ps) { return @{ ok = $false; error = 'no_pendingSend' } }
  $body = [string]$ps.body
  $to = [string]$ps.to
  if (-not $to -or -not $to.Contains('@')) {
    $to = Resolve-SendTo $task ''
  }
  if ($to -and $to.Contains('@')) {
    $ps | Add-Member -NotePropertyName to -NotePropertyValue $to -Force
    $task | Add-Member -NotePropertyName pendingSend -NotePropertyValue $ps -Force
  }
  $subject = [string]$ps.subject
  if (-not $subject) { $subject = 'Re: ' + [string]$task.title }
  $entryId = [string]$task.entryId
  if (-not $entryId) { $entryId = [string]$task.entryID }
  try {
    $outlook = Get-OutlookApp
    # Prefer explicit To address for new mail when we have a real email
    if ($to -and $to.Contains('@')) {
      $mail = $outlook.CreateItem(0)
      $mail.To = $to
      $mail.Subject = $subject
      $mail.Body = $body
      $mail.Send()
      return @{ ok = $true; method = 'new'; to = $to }
    }
    if ($entryId) {
      $ns = $outlook.GetNamespace('MAPI')
      $item = $ns.GetItemFromID($entryId)
      if (-not $item) { return @{ ok = $false; error = 'mail_not_found' } }
      $reply = $item.Reply()
      try { $reply.Body = $body } catch {}
      try { $reply.HTMLBody = ('<pre>' + [Net.WebUtility]::HtmlEncode($body) + '</pre>') } catch {}
      $reply.Send()
      return @{ ok = $true; method = 'reply' }
    }
    return @{ ok = $false; error = 'no_recipient'; message = 'No entryId and no To address for new mail' }
  } catch {
    return @{ ok = $false; error = $_.Exception.Message }
  }
}
function Invoke-TaskChatBrain($task, [string]$userText) {
  $added = New-Object System.Collections.ArrayList
  $lower = ([string]$userText).ToLowerInvariant()
  $arJehez = U8 '2KzZh9iy'
  $arJehez2 = U8 '2KzZh9mR2LI='
  $arRad = U8 '2LHYrw=='
  $arFakr = U8 '2YHZg9ix2YbZig=='
  $arFakr2 = U8 '2YHZg9mR2LHZhtmK'
  $arImsah = U8 '2KfZhdiz2K0='
  $arTrash = U8 '2KrYsdin2LQ='
  $arIb3at = U8 '2KfYqNi52Ko='
  $arIb3ath = U8 '2KfYqNi52KrZhw=='
  $arMowafiq = U8 '2YXZiNin2YHZgg=='
  $arRayak = U8 '2LHYo9mK2YM='
  $arRayak2 = U8 '2LHYp9mK2YM='
  $arWaqaf = U8 '2YjZgtmB'
  $arLa = U8 '2YTYpw=='
  $arNaam = U8 '2YbYudmF'
  $arIhzif = U8 '2KfYrdiw2YE='

    # If user pasted an email, attach it to pendingSend
  $emailInMsg = Get-EmailFromText $userText
  if ($emailInMsg -and $task.pendingSend) {
    $ps = $task.pendingSend
    $ps | Add-Member -NotePropertyName to -NotePropertyValue $emailInMsg -Force
    $task | Add-Member -NotePropertyName pendingSend -NotePropertyValue $ps -Force
  }
  if ($userText -match '(?is)^\s*(?:update\s*draft\s*body|UPDATE_DRAFT_BODY)\s*:?\s*([\s\S]+)$') {
    $newBody = $Matches[1].Trim()
    if ($newBody -and $task.pendingSend) {
      $ps = $task.pendingSend
      $ps | Add-Member -NotePropertyName body -NotePropertyValue $newBody -Force
      $task | Add-Member -NotePropertyName pendingSend -NotePropertyValue $ps -Force
      $task | Add-Member -NotePropertyName suggestedReply -NotePropertyValue $newBody -Force
      $ev = Add-Timeline $task 'draft_ready' 'Pending send body updated from editor' 'user' $null
      $bot = Add-Chat $task 'bot' 'Updated the pending draft body. Approve with the button when ready.' @{ intent = 'draft_update' }
      return ,@{ botMessage = $bot; timelineAdded = @($ev) }
    }
  }
  if ($userText -match '(?is)---\s*([\s\S]{20,})$') {
    $maybe = $Matches[1].Trim()
    if ($userText -match '(?i)send|draft|propose|approve|mail') {
      $task | Add-Member -NotePropertyName suggestedReply -NotePropertyValue $maybe -Force
    }
  }

$isApprove = (Test-AnyToken $lower @('approve','yes','ok','send it','confirm')) -or (Test-TextHas $userText $arMowafiq) -or (Test-TextHas $userText $arIb3ath) -or (Test-TextHas $userText $arNaam)
  $isCancel = (Test-AnyToken $lower @('cancel','no','stop','nevermind','never mind')) -or (Test-TextHas $userText $arLa) -or (Test-TextHas $userText $arWaqaf)
  $isDraft = (Test-AnyToken $lower @('draft','prepare','reply','jehez','prepare reply')) -or (Test-TextHas $userText $arJehez) -or (Test-TextHas $userText $arJehez2) -or ((Test-TextHas $userText $arRad) -and -not $isApprove)
  $isRemind = (Test-AnyToken $lower @('remind','fakrni','reminder','think of me')) -or (Test-TextHas $userText $arFakr) -or (Test-TextHas $userText $arFakr2)
  $isTrash = (Test-AnyToken $lower @('trash','delete','move_trash','delete mail')) -or (Test-TextHas $userText $arTrash) -or (Test-TextHas $userText $arImsah) -or (Test-TextHas $userText $arIhzif)
  $isSend = (Test-AnyToken $lower @('send','ib3at','dispatch','propose send','propose sending')) -or (Test-TextHas $userText $arIb3at)
  $isOpinion = (Test-AnyToken $lower @('opinion','what do you think','your take','rayak')) -or (Test-TextHas $userText $arRayak) -or (Test-TextHas $userText $arRayak2)

  if ($task.pendingSend -and $isApprove -and -not $isCancel) {
    $ev = Add-Timeline $task 'send_approved' 'User approved pending send' 'user' $null
    [void]$added.Add($ev)
    $sendResult = Invoke-SendPending $task
    if ($sendResult.ok) {
      $task.pendingSend = $null
      $ev2 = Add-Timeline $task 'send_sent' ('Mail sent via Outlook (' + $sendResult.method + ')') 'bot' $sendResult
      [void]$added.Add($ev2)
      $bot = Add-Chat $task 'bot' 'Sent. Outlook accepted the message.' @{ intent = 'approve_send'; ok = $true }
      Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'task.send.sent'; taskId = [string]$task.id }
      return ,@{ botMessage = $bot; timelineAdded = @($added.ToArray()); send = $sendResult }
    } else {
      $err = [string]$sendResult.error
      if ($sendResult.message) { $err = $err + ' - ' + $sendResult.message }
      $ev2 = Add-Timeline $task 'system' ('Send failed: ' + $err) 'system' $sendResult
      [void]$added.Add($ev2)
      $bot = Add-Chat $task 'bot' ('Could not send: ' + $err + '. pendingSend kept. Fix then approve again, or cancel.') @{ intent = 'approve_send'; ok = $false }
      Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'task.send.error'; taskId = [string]$task.id; error = $err }
      return ,@{ botMessage = $bot; timelineAdded = @($added.ToArray()); send = $sendResult }
    }
  }
  if ($task.pendingSend -and $isCancel) {
    $task.pendingSend = $null
    $ev = Add-Timeline $task 'send_cancelled' 'Pending send cancelled' 'user' $null
    [void]$added.Add($ev)
    $bot = Add-Chat $task 'bot' 'Cancelled. Nothing was sent.' @{ intent = 'cancel_send' }
    Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'User'; action = 'task.send.cancelled'; taskId = [string]$task.id }
    return ,@{ botMessage = $bot; timelineAdded = @($added.ToArray()) }
  }

  if ($task.pendingTrash -and $isApprove -and -not $isCancel) {
    $move = Invoke-MoveTrashNow $task
    $task.pendingTrash = $false
    if ($move.ok) {
      $ev = Add-Timeline $task 'trash' 'Mail moved to Deleted Items' 'bot' $move
      [void]$added.Add($ev)
      $bot = Add-Chat $task 'bot' 'Done. Mail moved to Deleted Items.' @{ intent = 'trash_confirm'; ok = $true }
    } else {
      $err = [string]$move.error
      if ($move.message) { $err = $err + ' - ' + $move.message }
      $ev = Add-Timeline $task 'system' ('Trash failed: ' + $err) 'system' $move
      [void]$added.Add($ev)
      $bot = Add-Chat $task 'bot' ('Could not move to trash: ' + $err) @{ intent = 'trash_confirm'; ok = $false }
    }
    Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'task.trash'; taskId = [string]$task.id; ok = [bool]$move.ok }
    return ,@{ botMessage = $bot; timelineAdded = @($added.ToArray()); trash = $move }
  }
  if ($task.pendingTrash -and $isCancel) {
    $task.pendingTrash = $false
    $ev = Add-Timeline $task 'system' 'Trash proposal cancelled' 'user' $null
    [void]$added.Add($ev)
    $bot = Add-Chat $task 'bot' 'OK, left the mail alone.' @{ intent = 'trash_cancel' }
    return ,@{ botMessage = $bot; timelineAdded = @($added.ToArray()) }
  }

  if ($isDraft) {
    $draft = Get-DraftBody $task $userText
    $task | Add-Member -NotePropertyName suggestedReply -NotePropertyValue $draft -Force
    $task | Add-Member -NotePropertyName botAction -NotePropertyValue 'draft_reply' -Force
    $ev = Add-Timeline $task 'draft_ready' 'Draft reply prepared into suggestedReply (NOT sent)' 'bot' $null
    [void]$added.Add($ev)
    $bot = Add-Chat $task 'bot' ("Draft ready in suggestedReply. Review it, then say 'send' to propose sending (I will ask for approval first).`n`n--- preview ---`n" + $draft) @{ intent = 'draft' }
    return ,@{ botMessage = $bot; timelineAdded = @($added.ToArray()) }
  }

  if ($isRemind) {
    $stamp = (Get-Date).ToUniversalTime().ToString('o')
    $noteText = 'Reminder set by bot from chat'
    if ($userText) { $noteText = 'Reminder: ' + $userText }
    $comments = @()
    if ($task.comments) { $comments = @($task.comments) }
    $comments += [pscustomobject]@{ text = $noteText; by = 'bot'; at = $stamp }
    $task | Add-Member -NotePropertyName comments -NotePropertyValue @($comments) -Force
    $ev = Add-Timeline $task 'remind' $noteText 'bot' $null
    [void]$added.Add($ev)
    $bot = Add-Chat $task 'bot' ('Reminder noted: ' + $noteText) @{ intent = 'remind' }
    return ,@{ botMessage = $bot; timelineAdded = @($added.ToArray()) }
  }

  if ($isTrash) {
    $task | Add-Member -NotePropertyName pendingTrash -NotePropertyValue $true -Force
    $ev = Add-Timeline $task 'trash' 'Proposed move to Deleted Items - waiting for confirm' 'bot' $null
    [void]$added.Add($ev)
    $bot = Add-Chat $task 'bot' "I can move the source mail to Deleted Items. Reply 'yes' / approve to confirm, or 'no' / cancel to abort." @{ intent = 'trash_propose' }
    return ,@{ botMessage = $bot; timelineAdded = @($added.ToArray()) }
  }

  if ($isSend) {
    $body = [string]$task.suggestedReply
    if ([string]::IsNullOrWhiteSpace($body)) {
      $body = Get-DraftBody $task ''
      $task | Add-Member -NotePropertyName suggestedReply -NotePropertyValue $body -Force
      $ev0 = Add-Timeline $task 'draft_ready' 'Auto-drafted before send proposal' 'bot' $null
      [void]$added.Add($ev0)
    }
    $to = Resolve-SendTo $task $userText
    if (-not $to) {
      $src = [string]$task.sourceRef
      if ($src -match '^\s*([^/]+)\s*/') {
        $cand = $Matches[1].Trim()
        if ($cand.Contains('@')) { $to = $cand }
      }
    }
    $subject = 'Re: ' + [string]$task.title
    $pending = [pscustomobject]@{
      to = $to
      subject = $subject
      body = $body
      createdAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    $task | Add-Member -NotePropertyName pendingSend -NotePropertyValue $pending -Force
    $ev = Add-Timeline $task 'send_proposed' 'Send proposed - awaiting user approval' 'bot' @{ to = $to; subject = $subject }
    [void]$added.Add($ev)
    $toLabel = $to
    if (-not $toLabel) { $toLabel = '(reply to source mail)' }
    $bot = Add-Chat $task 'bot' ("Ready to send.`nTo: " + $toLabel + "`nSubject: " + $subject + "`n`nApprove? Say 'yes' / mowafiq, or 'no' to cancel. I will NOT send until you approve.") @{ intent = 'send_propose' }
    Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'Bot'; action = 'task.send.proposed'; taskId = [string]$task.id }
    return ,@{ botMessage = $bot; timelineAdded = @($added.ToArray()) }
  }

  if ($isOpinion) {
    $pri = [string]$task.priority
    if (-not $pri) { $pri = [string]$task.importance }
    $src = [string]$task.source
    $st = [string]$task.status
    $title = [string]$task.title
    $opinion = 'Quick take: '
    if ($pri -eq 'urgent' -or $pri -eq 'high') { $opinion += 'Priority is high - handle today. ' }
    elseif ($pri -eq 'low') { $opinion += 'Low priority - can wait. ' }
    else { $opinion += 'Medium priority - schedule soon. ' }
    if ($src -eq 'email') { $opinion += 'Source is email; a short professional reply is usually enough. ' }
    if ($st -eq 'blocked') { $opinion += 'Status is blocked - clear the blocker before drafting. ' }
    if ($task.suggestedReply) { $opinion += 'There is already a draft - review then propose send. ' }
    else { $opinion += 'No draft yet - ask me to prepare one. ' }
    $opinion += "Title: '" + $title + "'."
    $ev = Add-Timeline $task 'chat' 'Bot shared opinion' 'bot' $null
    [void]$added.Add($ev)
    $bot = Add-Chat $task 'bot' $opinion @{ intent = 'opinion' }
    return ,@{ botMessage = $bot; timelineAdded = @($added.ToArray()) }
  }

  $bot = Add-Chat $task 'bot' "Not sure what you need. Try: prepare draft / remind me / trash / send (asks approval) / your opinion - or use the suggestion chips." @{ intent = 'unknown' }
  $ev = Add-Timeline $task 'chat' 'Bot asked for clarification' 'bot' $null
  [void]$added.Add($ev)
  return ,@{ botMessage = $bot; timelineAdded = @($added.ToArray()) }
}

# --- Dynamics 365 / Dataverse CRM (read/sync only) ---
function Get-DefaultCrmConfig {
  return [ordered]@{
    orgUrl = 'https://aqaar.crm15.dynamics.com'
    appId = '944e68b1-308d-4e3a-86c7-cf0452397938'
    environment = 'prod'
    uatOrgUrl = 'https://operations-aqaaruat-1.crm15.dynamics.com'
    tenantId = 'cd686870-f362-4a4a-9a97-23d4437aadb7'
    clientId = '9cee029c-6210-4654-90bb-17e6e9d36617'
    redirectUri = 'http://localhost'
    accessToken = ''
    refreshToken = ''
    tokenExpiresAt = ''
    authMode = 'pac'
    authStatus = 'pending_auth'
    deviceCode = ''
    deviceCodeExpiresAt = ''
    userCode = ''
    verificationUrl = ''
    lastSyncAt = ''
    lastError = ''
    lastPreviewAt = ''
    pacUser = 'Ahmed.Mahmoud@aqaar.com'
    defaultEntities = 'md_units,md_offers,md_approvaltransactions,aqr_legalcases,leads,opportunities,accounts'
  }
}
function Load-CrmConfig {
  if (-not (Test-Path $crmConfigPath)) {
    $c = Get-DefaultCrmConfig
    Save-CrmConfig $c
    return $c
  }
  try {
    $raw = [IO.File]::ReadAllText($crmConfigPath, [Text.Encoding]::UTF8)
    $obj = $raw | ConvertFrom-Json
  } catch {
    return (Get-DefaultCrmConfig)
  }
  $c = Get-DefaultCrmConfig
  foreach ($k in @($c.Keys)) {
    if ($obj.PSObject.Properties[$k]) { $c[$k] = [string]$obj.$k }
  }
  return $c
}
function Save-CrmConfig($cfg) {
  $json = ($cfg | ConvertTo-Json -Depth 6 -Compress)
  [IO.File]::WriteAllText($crmConfigPath, $json, [Text.UTF8Encoding]::new($false))
}
function Normalize-CrmOrgUrl([string]$url) {
  if ([string]::IsNullOrWhiteSpace($url)) { return '' }
  $u = $url.Trim().TrimEnd('/')
  if ($u -notmatch '^https?://') { $u = 'https://' + $u }
  return $u
}
function Get-CrmPublicConfig($cfg) {
  $hasToken = -not [string]::IsNullOrWhiteSpace([string]$cfg.accessToken)
  $tokenHint = ''
  if ($hasToken) {
    $t = [string]$cfg.accessToken
    if ($t.Length -gt 8) { $tokenHint = '...' + $t.Substring($t.Length - 4) }
    else { $tokenHint = '****' }
  }
  $org = Normalize-CrmOrgUrl ([string]$cfg.orgUrl)
  $configured = -not [string]::IsNullOrWhiteSpace($org)
  $authReady = $configured -and $hasToken
  $pendingAuth = $configured -and (-not $hasToken)
  $status = 'off'
  if ($authReady) { $status = 'on' }
  elseif ($pendingAuth) { $status = 'wait' }
  elseif ($configured) { $status = 'wait' }
  $authStatus = [string]$cfg.authStatus
  if (-not $authStatus) {
    if ($authReady) { $authStatus = 'ready' }
    elseif ($pendingAuth) { $authStatus = 'pending_auth' }
    else { $authStatus = 'off' }
  }
  if ($authReady) { $authStatus = 'ready' }
  elseif ($pendingAuth) { $authStatus = 'pending_auth' }
  return @{
    ok = $true
    orgUrl = $org
    appId = [string]$cfg.appId
    environment = [string]$cfg.environment
    uatOrgUrl = [string]$cfg.uatOrgUrl
    tenantId = [string]$cfg.tenantId
    clientId = [string]$cfg.clientId
    authMode = [string]$cfg.authMode
    authStatus = $authStatus
    hasToken = $hasToken
    tokenHint = $tokenHint
    tokenExpiresAt = [string]$cfg.tokenExpiresAt
    configured = $configured
    authReady = $authReady
    pendingAuth = $pendingAuth
    status = $status
    lastSyncAt = [string]$cfg.lastSyncAt
    lastError = [string]$cfg.lastError
    lastPreviewAt = [string]$cfg.lastPreviewAt
    verificationUrl = [string]$cfg.verificationUrl
    userCode = [string]$cfg.userCode
    devicePending = (-not [string]::IsNullOrWhiteSpace([string]$cfg.deviceCode))
    pacUser = [string]$cfg.pacUser
    defaultEntities = [string]$cfg.defaultEntities
  }
}
function Get-CrmStatus {
  $cfg = Load-CrmConfig
  $pub = Get-CrmPublicConfig $cfg
  $pub.ok = $true
  return $pub
}
function Get-CrmApiBase([string]$orgUrl) {
  $org = Normalize-CrmOrgUrl $orgUrl
  if (-not $org) { return '' }
  return ($org + '/api/data/v9.2')
}
function Get-CrmRecordUrl([string]$orgUrl, [string]$etn, [string]$id) {
  $org = Normalize-CrmOrgUrl $orgUrl
  if (-not $org -or -not $id) { return '' }
  return ($org + '/main.aspx?etn=' + $etn + '&id=' + $id)
}
function Invoke-DataverseGet([string]$orgUrl, [string]$accessToken, [string]$relativePath) {
  $base = Get-CrmApiBase $orgUrl
  if (-not $base) { throw 'orgUrl not configured' }
  if ([string]::IsNullOrWhiteSpace($accessToken)) { throw 'access token missing' }
  $url = $base + $relativePath
  $headers = @{
    Authorization = ('Bearer ' + $accessToken)
    Accept = 'application/json'
    'OData-MaxVersion' = '4.0'
    'OData-Version' = '4.0'
    Prefer = 'odata.include-annotations="*"'
  }
  return Invoke-RestMethod -Method Get -Uri $url -Headers $headers -TimeoutSec 60
}
function Test-CrmTokenExpiry($cfg) {
  $exp = [string]$cfg.tokenExpiresAt
  if ([string]::IsNullOrWhiteSpace($exp)) { return $false }
  try {
    $dt = [datetime]::Parse($exp, $null, [System.Globalization.DateTimeStyles]::RoundtripKind)
    if ($dt.ToUniversalTime() -lt (Get-Date).ToUniversalTime().AddMinutes(2)) { return $true }
  } catch {}
  return $false
}
function Start-CrmDeviceCodeFlow($cfg) {
  $org = Normalize-CrmOrgUrl ([string]$cfg.orgUrl)
  $clientId = [string]$cfg.clientId
  $tenant = [string]$cfg.tenantId
  if ([string]::IsNullOrWhiteSpace($tenant)) { $tenant = 'common' }
  if (-not $org) { return @{ ok = $false; error = 'orgUrl_required' } }
  if ([string]::IsNullOrWhiteSpace($clientId)) { return @{ ok = $false; error = 'clientId_required' } }
  $hostName = ([Uri]$org).Host
  $scope = ('https://' + $hostName + '/.default offline_access openid profile')
  $body = @{
    client_id = $clientId
    scope = $scope
  }
  $tokenUrlBase = ('https://login.microsoftonline.com/' + $tenant + '/oauth2/v2.0')
  try {
    $resp = Invoke-RestMethod -Method Post -Uri ($tokenUrlBase + '/devicecode') -Body $body -ContentType 'application/x-www-form-urlencoded' -TimeoutSec 30
  } catch {
    $cfg.lastError = ('device_code_failed: ' + $_.Exception.Message)
    Save-CrmConfig $cfg
    return @{ ok = $false; error = 'device_code_failed'; message = $_.Exception.Message }
  }
  $cfg.deviceCode = [string]$resp.device_code
  $cfg.userCode = [string]$resp.user_code
  $cfg.verificationUrl = [string]$resp.verification_uri
  if (-not $cfg.verificationUrl -and $resp.verification_url) { $cfg.verificationUrl = [string]$resp.verification_url }
  $expiresIn = 900
  try { if ($resp.expires_in) { $expiresIn = [int]$resp.expires_in } } catch {}
  $cfg.deviceCodeExpiresAt = (Get-Date).ToUniversalTime().AddSeconds($expiresIn).ToString('o')
  $cfg.authMode = 'device'
  $cfg.lastError = ''
  Save-CrmConfig $cfg
  return @{
    ok = $true
    userCode = $cfg.userCode
    verificationUrl = $cfg.verificationUrl
    expiresAt = $cfg.deviceCodeExpiresAt
    message = 'Open verification URL, enter user code, then poll /api/crm/auth/device/poll'
  }
}
function Poll-CrmDeviceCodeFlow($cfg) {
  $org = Normalize-CrmOrgUrl ([string]$cfg.orgUrl)
  $clientId = [string]$cfg.clientId
  $tenant = [string]$cfg.tenantId
  $deviceCode = [string]$cfg.deviceCode
  if ([string]::IsNullOrWhiteSpace($tenant)) { $tenant = 'common' }
  if ([string]::IsNullOrWhiteSpace($deviceCode)) { return @{ ok = $false; error = 'no_device_code'; pending = $false } }
  if ([string]::IsNullOrWhiteSpace($clientId)) { return @{ ok = $false; error = 'clientId_required' } }
  $hostName = ([Uri]$org).Host
  $scope = ('https://' + $hostName + '/.default offline_access openid profile')
  $body = @{
    grant_type = 'urn:ietf:params:oauth:grant-type:device_code'
    client_id = $clientId
    device_code = $deviceCode
    scope = $scope
  }
  $tokenUrl = ('https://login.microsoftonline.com/' + $tenant + '/oauth2/v2.0/token')
  try {
    $resp = Invoke-RestMethod -Method Post -Uri $tokenUrl -Body $body -ContentType 'application/x-www-form-urlencoded' -TimeoutSec 30
  } catch {
    $msg = $_.Exception.Message
    $errBody = ''
    try {
      $respErr = $_.ErrorDetails.Message
      if ($respErr) { $errBody = $respErr }
    } catch {}
    if ($errBody -match 'authorization_pending' -or $msg -match 'authorization_pending') {
      return @{ ok = $false; pending = $true; error = 'authorization_pending'; userCode = [string]$cfg.userCode; verificationUrl = [string]$cfg.verificationUrl }
    }
    if ($errBody -match 'slow_down' -or $msg -match 'slow_down') {
      return @{ ok = $false; pending = $true; error = 'slow_down' }
    }
    $cfg.lastError = ('device_poll_failed: ' + $msg)
    Save-CrmConfig $cfg
    return @{ ok = $false; pending = $false; error = 'device_poll_failed'; message = $msg }
  }
  $cfg.accessToken = [string]$resp.access_token
  if ($resp.refresh_token) { $cfg.refreshToken = [string]$resp.refresh_token }
  $expiresIn = 3600
  try { if ($resp.expires_in) { $expiresIn = [int]$resp.expires_in } } catch {}
  $cfg.tokenExpiresAt = (Get-Date).ToUniversalTime().AddSeconds($expiresIn).ToString('o')
  $cfg.deviceCode = ''
  $cfg.userCode = ''
  $cfg.verificationUrl = ''
  $cfg.deviceCodeExpiresAt = ''
  $cfg.authMode = 'device'
  $cfg.authStatus = 'ready'
  $cfg.lastError = ''
  Save-CrmConfig $cfg
  return @{ ok = $true; pending = $false; authReady = $true; tokenExpiresAt = $cfg.tokenExpiresAt }
}
function Get-CrmEntitySpec([string]$name) {
  $n = $name.ToLowerInvariant().Trim()
  # Accept logical name or set name (plural)
  switch ($n) {
    { $_ -in @('leads','lead') } {
      return @{
        key = 'leads'; set = 'leads'; idField = 'leadid'; etn = 'lead'; kind = 'standard'
        select = 'leadid,subject,fullname,companyname,emailaddress1,telephone1,statuscode,createdon,modifiedon'
      }
    }
    { $_ -in @('opportunities','opportunity') } {
      return @{
        key = 'opportunities'; set = 'opportunities'; idField = 'opportunityid'; etn = 'opportunity'; kind = 'standard'
        select = 'opportunityid,name,estimatedvalue,closeprobability,statuscode,createdon,modifiedon,_parentaccountid_value'
      }
    }
    { $_ -in @('accounts','account') } {
      return @{
        key = 'accounts'; set = 'accounts'; idField = 'accountid'; etn = 'account'; kind = 'standard'
        select = 'accountid,name,telephone1,emailaddress1,address1_city,statuscode,createdon,modifiedon'
      }
    }
    { $_ -in @('contacts','contact') } {
      return @{
        key = 'contacts'; set = 'contacts'; idField = 'contactid'; etn = 'contact'; kind = 'standard'
        select = 'contactid,fullname,emailaddress1,telephone1,jobtitle,statuscode,createdon,modifiedon'
      }
    }
    { $_ -in @('md_units','md_unit') } {
      return @{
        key = 'md_units'; set = 'md_units'; idField = 'md_unitid'; etn = 'md_unit'; kind = 'custom'
        select = 'md_unitid,md_name,statuscode,createdon,modifiedon'
        nameFields = @('md_name','aqr_ajreunitno','aqr_tasdeequnitnumber','md_productnumber','md_code')
      }
    }
    { $_ -in @('md_offers','md_offer') } {
      return @{
        key = 'md_offers'; set = 'md_offers'; idField = 'md_offerid'; etn = 'md_offer'; kind = 'custom'
        select = 'md_offerid,md_name,md_offernumber,statuscode,createdon,modifiedon'
        nameFields = @('md_name','md_offernumber')
      }
    }
    { $_ -in @('md_approvaltransactions','md_approvaltransaction') } {
      return @{
        key = 'md_approvaltransactions'; set = 'md_approvaltransactions'; idField = 'md_approvaltransactionid'; etn = 'md_approvaltransaction'; kind = 'custom'
        select = 'md_approvaltransactionid,md_name,statuscode,createdon,modifiedon'
        nameFields = @('md_name','md_approvaltransaction')
      }
    }
    { $_ -in @('aqr_legalcases','aqr_legalcase') } {
      return @{
        key = 'aqr_legalcases'; set = 'aqr_legalcases'; idField = 'aqr_legalcaseid'; etn = 'aqr_legalcase'; kind = 'custom'
        select = 'aqr_legalcaseid,aqr_name,aqr_casenumber,statuscode,createdon,modifiedon'
        nameFields = @('aqr_name','aqr_casenumber','md_name')
      }
    }
    default { return $null }
  }
}
function Get-CrmEntityTitle($spec, $row) {
  $idField = $spec.idField
  if ($spec.key -eq 'leads') {
    $subj = [string]$row.subject
    $name = [string]$row.fullname
    $co = [string]$row.companyname
    if ($subj) { return $subj }
    if ($name -and $co) { return ($name + ' - ' + $co) }
    if ($name) { return $name }
    if ($co) { return $co }
    return ('Lead ' + [string]$row.$idField)
  }
  if ($spec.key -eq 'opportunities') {
    $n = [string]$row.name
    if ($n) { return $n }
    return ('Opportunity ' + [string]$row.$idField)
  }
  if ($spec.key -eq 'accounts') {
    $n = [string]$row.name
    if ($n) { return $n }
    return ('Account ' + [string]$row.$idField)
  }
  if ($spec.key -eq 'contacts') {
    $n = [string]$row.fullname
    if ($n) { return $n }
    return ('Contact ' + [string]$row.$idField)
  }
  if ($spec.nameFields) {
    foreach ($nf in @($spec.nameFields)) {
      if ($row.PSObject.Properties[$nf] -and $row.$nf) { return [string]$row.$nf }
    }
  }
  foreach ($nf in @('md_name','aqr_name','name','subject','fullname')) {
    if ($row.PSObject.Properties[$nf] -and $row.$nf) { return [string]$row.$nf }
  }
  $label = $spec.etn
  if (-not $label) { $label = $spec.key }
  return ($label + ' ' + [string]$row.$idField)
}
function Get-CrmEntityNotes($spec, $row) {
  $parts = New-Object System.Collections.Generic.List[string]
  if ($spec.key -eq 'leads') {
    if ($row.fullname) { [void]$parts.Add('Contact: ' + $row.fullname) }
    if ($row.companyname) { [void]$parts.Add('Company: ' + $row.companyname) }
    if ($row.emailaddress1) { [void]$parts.Add('Email: ' + $row.emailaddress1) }
    if ($row.telephone1) { [void]$parts.Add('Phone: ' + $row.telephone1) }
  } elseif ($spec.key -eq 'opportunities') {
    if ($null -ne $row.estimatedvalue) { [void]$parts.Add('Est: ' + $row.estimatedvalue) }
    if ($null -ne $row.closeprobability) { [void]$parts.Add('Prob: ' + $row.closeprobability + '%') }
  } elseif ($spec.key -eq 'accounts') {
    if ($row.emailaddress1) { [void]$parts.Add('Email: ' + $row.emailaddress1) }
    if ($row.telephone1) { [void]$parts.Add('Phone: ' + $row.telephone1) }
    if ($row.address1_city) { [void]$parts.Add('City: ' + $row.address1_city) }
  } elseif ($spec.key -eq 'contacts') {
    if ($row.jobtitle) { [void]$parts.Add('Title: ' + $row.jobtitle) }
    if ($row.emailaddress1) { [void]$parts.Add('Email: ' + $row.emailaddress1) }
    if ($row.telephone1) { [void]$parts.Add('Phone: ' + $row.telephone1) }
  }
  return ($parts -join ' | ')
}
function Get-NextTaskIdNum($data) {
  $maxId = 0
  foreach ($t in @($data.tasks)) {
    if ([string]$t.id -match '^T-?(\d+)$') {
      $v = [int]$Matches[1]
      if ($v -gt $maxId) { $maxId = $v }
    }
  }
  return $maxId
}
function Find-CrmTask($data, [string]$crmId) {
  if ([string]::IsNullOrWhiteSpace($crmId)) { return $null }
  foreach ($t in @($data.tasks)) {
    if ($t.PSObject.Properties['crmId'] -and [string]$t.crmId -eq $crmId) { return $t }
    $sr = [string]$t.sourceRef
    if ($sr -and $sr.EndsWith('/' + $crmId)) { return $t }
    if ($sr -eq $crmId) { return $t }
  }
  return $null
}
function Fetch-CrmEntityRows($cfg, $spec, [int]$top = 50) {
  $basePath = ('/' + $spec.set + '?$top=' + $top + '&$orderby=modifiedon desc')
  $path = $basePath
  if ($spec.select) { $path = ('/' + $spec.set + '?$select=' + $spec.select + '&$top=' + $top + '&$orderby=modifiedon desc') }
  try {
    $resp = Invoke-DataverseGet ([string]$cfg.orgUrl) ([string]$cfg.accessToken) $path
  } catch {
    # Custom entity column guesses may be wrong - retry without $select
    if ($spec.select) {
      $resp = Invoke-DataverseGet ([string]$cfg.orgUrl) ([string]$cfg.accessToken) $basePath
    } else { throw }
  }
  if ($null -eq $resp.value) { return @() }
  return @($resp.value)
}

function Invoke-CrmWhoAmI {
  $cfg = Load-CrmConfig
  $org = Normalize-CrmOrgUrl ([string]$cfg.orgUrl)
  if (-not $org) { return @{ ok = $false; error = 'orgUrl_required'; status = 'off' } }
  if ([string]::IsNullOrWhiteSpace([string]$cfg.accessToken)) {
    return @{ ok = $false; error = 'pending_auth'; status = 'wait'; authStatus = 'pending_auth' }
  }
  try {
    $resp = Invoke-DataverseGet $org ([string]$cfg.accessToken) '/WhoAmI'
    $cfg.lastError = ''
    $cfg.authStatus = 'ready'
    Save-CrmConfig $cfg
    return @{
      ok = $true
      authStatus = 'ready'
      orgUrl = $org
      UserId = [string]$resp.UserId
      BusinessUnitId = [string]$resp.BusinessUnitId
      OrganizationId = [string]$resp.OrganizationId
      raw = $resp
    }
  } catch {
    $msg = $_.Exception.Message
    $cfg.lastError = ('WhoAmI: ' + $msg)
    if ($msg -match '401|Unauthorized') { $cfg.authStatus = 'pending_auth' }
    Save-CrmConfig $cfg
    return @{ ok = $false; error = 'whoami_failed'; message = $msg; status = 'wait' }
  }
}

function Sync-CrmToTasks([string[]]$entities) {
  $cfg = Load-CrmConfig
  $org = Normalize-CrmOrgUrl ([string]$cfg.orgUrl)
  if (-not $org) {
    return @{ ok = $false; error = 'orgUrl_required'; status = 'off' }
  }
  if ([string]::IsNullOrWhiteSpace([string]$cfg.accessToken)) {
    $cfg.lastError = 'pending_auth'
    Save-CrmConfig $cfg
    return @{ ok = $false; error = 'pending_auth'; status = 'wait'; message = 'Configure a bearer token or complete device-code auth first' }
  }
  if (-not $entities -or $entities.Count -eq 0) {
    $def = [string]$cfg.defaultEntities
    if ($def) { $entities = @($def.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
    else { $entities = @('md_units','md_offers','md_approvaltransactions','aqr_legalcases','leads','opportunities','accounts') }
  }
  $data = Load-TasksData
  if (-not $data.tasks) { $data | Add-Member -NotePropertyName tasks -NotePropertyValue @() -Force }
  $maxId = Get-NextTaskIdNum $data
  $added = 0
  $updated = 0
  $errors = New-Object System.Collections.Generic.List[object]
  $byEntity = @{}
  foreach ($ename in $entities) {
    $spec = Get-CrmEntitySpec $ename
    if (-not $spec) {
      [void]$errors.Add(@{ entity = $ename; error = 'unknown_entity' })
      continue
    }
    try {
      $rows = Fetch-CrmEntityRows $cfg $spec 50
    } catch {
      $msg = $_.Exception.Message
      $cfg.lastError = ('sync_' + $spec.key + ': ' + $msg)
      [void]$errors.Add(@{ entity = $spec.key; error = $msg })
      $byEntity[$spec.key] = @{ added = 0; updated = 0; error = $msg }
      continue
    }
    $eAdded = 0
    $eUpdated = 0
    foreach ($row in $rows) {
      $idField = $spec.idField
      $crmId = [string]$row.$idField
      if (-not $crmId) { continue }
      $title = Get-CrmEntityTitle $spec $row
      $notes = Get-CrmEntityNotes $spec $row
      $crmUrl = Get-CrmRecordUrl $org $spec.etn $crmId
      $sourceRef = ($spec.key + '/' + $crmId)
      $tagList = @('crm', $spec.etn)
      $existing = Find-CrmTask $data $crmId
      if ($existing) {
        $existing.title = $title
        $existing.notes = $notes
        $existing.source = 'crm'
        $existing.sourceRef = $sourceRef
        $existing | Add-Member -NotePropertyName crmId -NotePropertyValue $crmId -Force
        $existing | Add-Member -NotePropertyName crmEntity -NotePropertyValue $spec.key -Force
        $existing | Add-Member -NotePropertyName crmUrl -NotePropertyValue $crmUrl -Force
        $existing | Add-Member -NotePropertyName updatedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o')) -Force
        try {
          $tags = @($existing.tags)
          foreach ($tg in $tagList) { if ($tags -notcontains $tg) { $tags += $tg } }
          $existing.tags = $tags
        } catch {
          $existing | Add-Member -NotePropertyName tags -NotePropertyValue $tagList -Force
        }
        $eUpdated++
        $updated++
      } else {
        $maxId++
        $task = [ordered]@{
          id = ('T-' + $maxId.ToString('000'))
          title = $title
          status = 'todo'
          priority = 'medium'
          source = 'crm'
          sourceRef = $sourceRef
          crmId = $crmId
          crmEntity = $spec.key
          crmUrl = $crmUrl
          entryId = ''
          tags = $tagList
          notes = $notes
          botAction = 'none'
          botInstruction = ''
          comments = @()
          suggestedReply = ''
          due = $null
          assignee = ''
          checklist = @()
          progress = 0
          createdAt = (Get-Date).ToUniversalTime().ToString('o')
          updatedAt = (Get-Date).ToUniversalTime().ToString('o')
          createdBy = 'CRM Sync'
          chat = @()
          timeline = @()
          pendingSend = $null
          pendingTrash = $false
        }
        $data.tasks = @([pscustomobject]$task) + @($data.tasks)
        $eAdded++
        $added++
      }
    }
    $byEntity[$spec.key] = @{ added = $eAdded; updated = $eUpdated }
  }
  if ($added -gt 0 -or $updated -gt 0) {
    Save-TasksData $data
  }
  $cfg.lastSyncAt = (Get-Date).ToUniversalTime().ToString('o')
  if ($errors.Count -eq 0) { $cfg.lastError = '' }
  Save-CrmConfig $cfg
  $ok = ($errors.Count -eq 0)
  return @{
    ok = $ok
    added = $added
    updated = $updated
    entities = $byEntity
    errors = @($errors.ToArray())
    lastSyncAt = $cfg.lastSyncAt
    status = (Get-CrmPublicConfig $cfg).status
  }
}
function Get-CrmPreview([string[]]$entities) {
  $cfg = Load-CrmConfig
  $org = Normalize-CrmOrgUrl ([string]$cfg.orgUrl)
  if (-not $org) { return @{ ok = $false; error = 'orgUrl_required' } }
  if ([string]::IsNullOrWhiteSpace([string]$cfg.accessToken)) {
    return @{ ok = $false; error = 'pending_auth'; status = 'wait' }
  }
  if (-not $entities -or $entities.Count -eq 0) {
    $def = [string]$cfg.defaultEntities
    if ($def) { $entities = @($def.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
    else { $entities = @('md_units','md_offers','leads','opportunities','accounts') }
  }
  $out = @{}
  $errors = New-Object System.Collections.Generic.List[object]
  foreach ($ename in $entities) {
    $spec = Get-CrmEntitySpec $ename
    if (-not $spec) { continue }
    try {
      $rows = Fetch-CrmEntityRows $cfg $spec 10
      $items = @()
      foreach ($row in $rows) {
        $idField = $spec.idField
        $crmId = [string]$row.$idField
        $items += @{
          id = $crmId
          title = (Get-CrmEntityTitle $spec $row)
          notes = (Get-CrmEntityNotes $spec $row)
          entity = $spec.key
          url = (Get-CrmRecordUrl $org $spec.etn $crmId)
        }
      }
      $out[$spec.key] = $items
    } catch {
      [void]$errors.Add(@{ entity = $spec.key; error = $_.Exception.Message })
      $out[$spec.key] = @()
    }
  }
  $cfg.lastPreviewAt = (Get-Date).ToUniversalTime().ToString('o')
  Save-CrmConfig $cfg
  return @{
    ok = ($errors.Count -eq 0)
    preview = $out
    errors = @($errors.ToArray())
    lastPreviewAt = $cfg.lastPreviewAt
  }
}



# --- Mawjan CRM panel (Phase 1: summary counts) ---
function Ensure-CrmAccessToken {
  $cfg = Load-CrmConfig
  $hasToken = -not [string]::IsNullOrWhiteSpace([string]$cfg.accessToken)
  $expired = $false
  if ($hasToken) { $expired = Test-CrmTokenExpiry $cfg }
  if ($hasToken -and -not $expired) {
    $cfg.authStatus = 'ready'
    return @{ ok = $true; cfg = $cfg; source = 'cached' }
  }
  $clientId = [string]$cfg.clientId
  if ([string]::IsNullOrWhiteSpace($clientId)) { $clientId = '9cee029c-6210-4654-90bb-17e6e9d36617' }
  $tenantId = [string]$cfg.tenantId
  if ([string]::IsNullOrWhiteSpace($tenantId) -or $tenantId -eq 'common') { $tenantId = 'cd686870-f362-4a4a-9a97-23d4437aadb7' }
  $redirect = 'http://localhost'
  if ($cfg.PSObject.Properties['redirectUri'] -and $cfg.redirectUri) { $redirect = [string]$cfg.redirectUri }
  $org = Normalize-CrmOrgUrl ([string]$cfg.orgUrl)
  if (-not $org) { $org = 'https://aqaar.crm15.dynamics.com' }
  $scope = ($org.TrimEnd('/') + '/.default')
  $msalOk = $false
  try {
    $mod = Get-Module -ListAvailable -Name MSAL.PS | Select-Object -First 1
    if ($mod) {
      Import-Module MSAL.PS -ErrorAction Stop
      $msalOk = $true
    }
  } catch { $msalOk = $false }
  if (-not $msalOk) {
    if (-not $hasToken) {
      $cfg.authStatus = 'pending_auth'
      $cfg.lastError = 'pending_auth: no token and MSAL.PS not available'
      Save-CrmConfig $cfg
      return @{ ok = $false; error = 'pending_auth'; authStatus = 'pending_auth'; message = 'Token missing. Install/import MSAL.PS or paste token via /api/crm/auth/token'; cfg = $cfg }
    }
    $cfg.authStatus = 'pending_auth'
    $cfg.lastError = 'pending_auth: token expired and MSAL.PS not available'
    Save-CrmConfig $cfg
    return @{ ok = $false; error = 'pending_auth'; authStatus = 'pending_auth'; message = 'Token expired. Refresh via MSAL.PS or paste a new token'; cfg = $cfg }
  }
  $token = $null
  $source = 'msal_silent'
  try {
    $token = Get-MsalToken -ClientId $clientId -TenantId $tenantId -RedirectUri $redirect -Scopes @($scope) -Silent -ErrorAction Stop
  } catch {
    # Never Interactive inside the HTTP server loop (blocks/crashes listener).
    $cfg.authStatus = 'pending_auth'
    $cfg.lastError = ('pending_auth: MSAL silent failed: ' + $_.Exception.Message)
    Save-CrmConfig $cfg
    return @{ ok = $false; error = 'pending_auth'; authStatus = 'pending_auth'; message = $_.Exception.Message; cfg = $cfg }
  }
  if (-not $token -or -not $token.AccessToken) {
    $cfg.authStatus = 'pending_auth'
    $cfg.lastError = 'pending_auth: MSAL returned empty token'
    Save-CrmConfig $cfg
    return @{ ok = $false; error = 'pending_auth'; authStatus = 'pending_auth'; cfg = $cfg }
  }
  $cfg.accessToken = [string]$token.AccessToken
  $cfg.clientId = $clientId
  $cfg.tenantId = $tenantId
  $cfg.authMode = 'msal'
  $cfg.authStatus = 'ready'
  $cfg.lastError = ''
  try {
    if ($token.ExpiresOn) {
      $cfg.tokenExpiresAt = ([datetime]$token.ExpiresOn).ToUniversalTime().ToString('o')
    } else {
      $cfg.tokenExpiresAt = (Get-Date).ToUniversalTime().AddHours(1).ToString('o')
    }
  } catch {
    $cfg.tokenExpiresAt = (Get-Date).ToUniversalTime().AddHours(1).ToString('o')
  }
  Save-CrmConfig $cfg
  return @{ ok = $true; cfg = $cfg; source = $source }
}

function Get-MawjanUnitAttributeMeta([string]$orgUrl, [string]$accessToken) {
  $path = "/EntityDefinitions(LogicalName='md_unit')/Attributes?`$select=LogicalName,DisplayName,AttributeType,SchemaName&`$filter=AttributeOf eq null"
  try {
    $resp = Invoke-DataverseGet $orgUrl $accessToken $path
    return @($resp.value)
  } catch {
    return @()
  }
}

function Get-MawjanSaleEntityHints([string]$orgUrl, [string]$accessToken) {
  $path = "/EntityDefinitions?`$select=LogicalName,DisplayName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute&`$filter=contains(LogicalName,'sale') or contains(LogicalName,'unit')"
  try {
    $resp = Invoke-DataverseGet $orgUrl $accessToken $path
    $rows = @()
    foreach ($e in @($resp.value)) {
      $ln = [string]$e.LogicalName
      if ($ln -match 'sale' -or $ln -match 'unit') {
        $dn = ''
        try { $dn = [string]$e.DisplayName.UserLocalizedLabel.Label } catch {}
        $rows += @{ logicalName = $ln; entitySetName = [string]$e.EntitySetName; primaryId = [string]$e.PrimaryIdAttribute; primaryName = [string]$e.PrimaryNameAttribute; displayName = $dn }
      }
    }
    return $rows
  } catch {
    return @()
  }
}

function Pick-MawjanProjectField($attrs) {
  $names = @($attrs | ForEach-Object { [string]$_.LogicalName })
  $preferred = @(
    'md_project','md_projectid','_md_project_value','md_projectname','md_projectnamear',
    'md_community','md_development','md_masterproject','aqr_project','md_scheme'
  )
  foreach ($p in $preferred) {
    if ($names -contains $p) { return $p }
    $lookup = '_' + $p.TrimStart('_') 
    if (-not $p.StartsWith('_') -and ($names -contains ('_' + $p + '_value'))) { return ('_' + $p + '_value') }
  }
  foreach ($n in $names) {
    if ($n -match 'project' -or $n -match 'mawjan' -or $n -match 'community' -or $n -match 'development') {
      if ($n -notmatch 'created|modified|owner|state|status') { return $n }
    }
  }
  return ''
}

function Pick-MawjanBedroomField($attrs) {
  $names = @($attrs | ForEach-Object { [string]$_.LogicalName })
  $preferred = @('md_bedroom','md_bedrooms','md_noofbedrooms','md_numberofbedrooms','md_unittype','md_type','md_propertytype','md_unitcategory','md_layout','md_rooms')
  foreach ($p in $preferred) {
    if ($names -contains $p) { return $p }
  }
  foreach ($n in $names) {
    if ($n -match 'bedroom' -or $n -match 'unittype' -or $n -match 'propertytype' -or $n -match 'layout') {
      if ($n -notmatch 'created|modified|owner') { return $n }
    }
  }
  return ''
}

function Pick-MawjanSoldField($attrs) {
  $names = @($attrs | ForEach-Object { [string]$_.LogicalName })
  $preferred = @('md_sold','md_issold','md_unitsold','md_availability','md_unitstatus','md_salestatus','statuscode','statecode')
  foreach ($p in $preferred) {
    if ($names -contains $p) { return $p }
  }
  foreach ($n in $names) {
    if ($n -match 'sold' -or $n -match 'availab' -or $n -match 'salestatus') { return $n }
  }
  if ($names -contains 'statuscode') { return 'statuscode' }
  return 'statuscode'
}

function Get-AttrFormatted($row, [string]$field) {
  if ([string]::IsNullOrWhiteSpace($field)) { return '' }
  $ann = $field + '@OData.Community.Display.V1.FormattedValue'
  if ($row.PSObject.Properties[$ann] -and $row.$ann) { return [string]$row.$ann }
  $ann2 = '_' + $field.TrimStart('_')
  if (-not $field.StartsWith('_') -and $field -notmatch '_value$') {
    $lv = '_' + $field + '_value'
    $annL = $lv + '@OData.Community.Display.V1.FormattedValue'
    if ($row.PSObject.Properties[$annL] -and $row.$annL) { return [string]$row.$annL }
    if ($row.PSObject.Properties[$lv] -and $row.$lv) { return [string]$row.$lv }
  }
  if ($row.PSObject.Properties[$field] -and $null -ne $row.$field) { return [string]$row.$field }
  return ''
}

function Test-MawjanProjectMatch([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return $false }
  $t = $text.ToLowerInvariant()
  if ($t -match 'mawjan') { return $true }
  # Arabic Mawjan (UTF-8 bytes as escaped in PS via char codes built at runtime)
  $ar = ([string]([char]0x0645) + [char]0x0648 + [char]0x062C + [char]0x0627 + [char]0x0646)
  if ($text.Contains($ar)) { return $true }
  return $false
}

function Classify-MawjanBedroom([string]$raw) {
  if ([string]::IsNullOrWhiteSpace($raw)) { return 'unknown' }
  $t = $raw.Trim().ToLowerInvariant()
  if ($t -match 'studio' -or $t -eq '0' -or $t -match '^0\s*bed') { return 'studio' }
  if ($t -match '2\s*bed' -or $t -eq '2' -or $t -match 'two') { return '2bedroom' }
  if ($t -match '1\s*bed' -or $t -eq '1' -or $t -match 'one' -or $t -match '1br') { return '1bedroom' }
  if ($t -match '3\s*bed' -or $t -eq '3') { return '3bedroom' }
  # Arabic studio / bedroom cues via codepoints
  $studioAr = ([string]([char]0x0633) + [char]0x062A)  # partial; also check english above
  if ($t -match 'studio') { return 'studio' }
  return ('other:' + $raw.Trim())
}

function Test-MawjanUnitSold($row, [string]$soldField) {
  $fmt = Get-AttrFormatted $row $soldField
  $raw = ''
  if ($row.PSObject.Properties[$soldField]) { $raw = [string]$row.$soldField }
  $blob = ($fmt + ' ' + $raw).ToLowerInvariant()
  if ($blob -match 'sold' -or $blob -match 'reserved' -and $blob -match 'sold') { return $true }
  if ($blob -match 'sold') { return $true }
  # Arabic sold
  $soldAr = ([string]([char]0x0645) + [char]0x0628 + [char]0x064A + [char]0x0639)
  if (($fmt + $raw).Contains($soldAr)) { return $true }
  if ($soldField -eq 'statecode' -and $raw -eq '1') { return $true }
  # Common Dataverse statuscode for inactive custom often 2; only treat as sold if formatted says sold
  if ($soldField -eq 'md_sold' -or $soldField -eq 'md_issold' -or $soldField -eq 'md_unitsold') {
    if ($raw -eq '1' -or $raw -eq 'True' -or $raw -eq 'true') { return $true }
  }
  if ($soldField -eq 'md_availability' -and ($blob -match 'sold' -or $blob -match 'unavailable' -or $blob -match 'not available')) { return $true }
  return $false
}

function Get-MawjanUnitsRaw([string]$orgUrl, [string]$accessToken, [string]$selectList) {
  $select = $selectList
  if ([string]::IsNullOrWhiteSpace($select)) { $select = 'md_unitid,md_name,statuscode,statecode' }
  $path = '/md_units?$select=' + [uri]::EscapeDataString($select) + '&$top=5000'
  $all = @()
  $next = $path
  $guard = 0
  while ($next -and $guard -lt 20) {
    $guard++
    $resp = Invoke-DataverseGet $orgUrl $accessToken $next
    if ($resp.value) { $all += @($resp.value) }
    $nextLink = $null
    if ($resp.PSObject.Properties['@odata.nextLink']) { $nextLink = [string]$resp.'@odata.nextLink' }
    if ($nextLink) {
      $base = Get-CrmApiBase $orgUrl
      if ($nextLink.StartsWith($base)) { $next = $nextLink.Substring($base.Length) }
      elseif ($nextLink -match '/api/data/v9\.2(.+)$') { $next = $Matches[1] }
      else { $next = $null }
    } else { $next = $null }
  }
  return $all
}

function Get-MawjanCrmSummary {
  $access = Ensure-CrmAccessToken
  if (-not $access.ok) {
    return @{ ok = $false; error = [string]$access.error; authStatus = [string]$access.authStatus; message = [string]$access.message }
  }
  $cfg = $access.cfg
  $org = Normalize-CrmOrgUrl ([string]$cfg.orgUrl)
  if (-not $org) { $org = 'https://aqaar.crm15.dynamics.com' }
  $token = [string]$cfg.accessToken

  # Prefer cached live summary if fresh (< 30 min)
  $cachePath = Join-Path $dataDir 'mawjan-summary.json'
  if (Test-Path $cachePath) {
    try {
      $cached = [IO.File]::ReadAllText($cachePath, [Text.Encoding]::UTF8) | ConvertFrom-Json
      if ($cached.ok -and $cached.total -and -not $cached.demo) {
        $cached | Add-Member -NotePropertyName authStatus -NotePropertyValue 'ready' -Force
        $cached | Add-Member -NotePropertyName source -NotePropertyValue 'cache' -Force
        return $cached
      }
    } catch {}
  }

  $select = 'md_unitid,md_name,aqr_projectname,md_bedrooms,statuscode,md_subtype'
  $filter = [uri]::EscapeDataString("contains(aqr_projectname,'Mawjan')")
  $path = '/md_units?$select=' + $select + '&$filter=' + $filter
  $rows = @()
  $next = $path
  while ($next) {
    $page = Invoke-DataverseGet $org $token $next
    if ($page.value) { $rows += @($page.value) }
    if ($page.PSObject.Properties['@odata.nextLink'] -and $page.'@odata.nextLink') {
      $full = [string]$page.'@odata.nextLink'
      $idx = $full.IndexOf('/api/data/v9.2/')
      if ($idx -ge 0) { $next = $full.Substring($idx + '/api/data/v9.2'.Length) } else { $next = $null }
    } else { $next = $null }
  }

  function Get-SubLabel($u) {
    $ann = 'md_subtype@OData.Community.Display.V1.FormattedValue'
    if ($u.PSObject.Properties[$ann] -and $u.$ann) { return [string]$u.$ann }
    return [string]$u.md_subtype
  }
  function Test-Res($u) {
    $s = (Get-SubLabel $u).ToUpperInvariant()
    return ($s -match 'STUDIO|BEDROOM|PENT')
  }
  function Get-Bucket($u) {
    $s = (Get-SubLabel $u).ToUpperInvariant()
    if ($s -match 'STUDIO') { return 'studio' }
    if ($s -match '1 BEDROOM') { return 'br1' }
    if ($s -match '2 BEDROOM') { return 'br2' }
    if ($s -match '3 BEDROOM') { return 'br3' }
    if ($s -match 'PENT') { return 'pent' }
    return 'other'
  }

  $res = @($rows | Where-Object { Test-Res $_ })
  $soldRes = @($res | Where-Object { $_.statuscode -eq 100000004 })
  $availRes = @($res | Where-Object { $_.statuscode -eq 100000000 })
  $b = @{ studio = 0; br1 = 0; br2 = 0; br3 = 0; pent = 0; other = 0 }
  foreach ($u in $availRes) { $k = Get-Bucket $u; $b[$k] = [int]$b[$k] + 1 }

  $total = $res.Count
  $sold = $soldRes.Count
  $remaining = $availRes.Count
  $result = @{
    ok = $true
    demo = $false
    authStatus = 'ready'
    project = 'Mawjan'
    projectFilterField = 'aqr_projectname'
    bedroomTypeField = 'md_subtype'
    soldField = 'statuscode'
    soldRule = 'Sold (100000004) / Available (100000000) / residential only'
    total = $total
    sold = $sold
    remaining = $remaining
    totalAllIncludingParking = $rows.Count
    occupancyPct = $(if ($total) { [math]::Round(100.0 * $sold / $total, 1) } else { 0 })
    remainingBreakdown = @{
      studio = [int]$b.studio
      '1bedroom' = [int]$b.br1
      '2bedroom' = [int]$b.br2
      other = @{ '3bedroom' = [int]$b.br3 }
    }
    remainingByType = @{ studio = [int]$b.studio; br1 = [int]$b.br1; br2 = [int]$b.br2; br3 = [int]$b.br3 }
    fetchedAt = (Get-Date).ToUniversalTime().ToString('o')
    source = 'live'
  }
  try {
    $json = $result | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText($cachePath, $json, [Text.UTF8Encoding]::new($false))
  } catch {}
  return $result
}

function Get-MawjanCrmUnits([string]$statusFilter) {
  $st = $statusFilter
  if ($st -eq 'remaining') { $st = 'available' }
  return Get-CrmUnitsList -project 'Mawjan' -statusFilter $st
}

function Get-AttrNames($attrs) {
  $names = @()
  foreach ($a in @($attrs)) {
    $n = [string]$a.LogicalName
    if ($n) { $names += $n }
  }
  return $names
}

function Pick-FieldByPatterns($names, [string[]]$patterns, [string[]]$preferred) {
  foreach ($p in @($preferred)) {
    if ($names -contains $p) { return $p }
  }
  foreach ($n in @($names)) {
    $nl = $n.ToLowerInvariant()
    foreach ($pat in @($patterns)) {
      if ($nl -match $pat) {
        if ($nl -match 'created|modified|owner|version|import|traversed') { continue }
        return $n
      }
    }
  }
  return ''
}

function Invoke-DataverseGetPaged([string]$orgUrl, [string]$accessToken, [string]$relativePath, [int]$maxPages = 40) {
  $all = @()
  $next = $relativePath
  $guard = 0
  while ($next -and $guard -lt $maxPages) {
    $guard++
    $resp = Invoke-DataverseGet $orgUrl $accessToken $next
    if ($resp.value) { $all += @($resp.value) }
    $nextLink = $null
    if ($resp.PSObject.Properties['@odata.nextLink']) { $nextLink = [string]$resp.'@odata.nextLink' }
    if ($nextLink) {
      $idx = $nextLink.IndexOf('/api/data/v9.2')
      if ($idx -ge 0) { $next = $nextLink.Substring($idx + '/api/data/v9.2'.Length) }
      else { $next = $null }
    } else { $next = $null }
  }
  return $all
}

function Get-EntityAttributeMeta([string]$orgUrl, [string]$accessToken, [string]$logicalName) {
  $path = "/EntityDefinitions(LogicalName='" + $logicalName + "')/Attributes?`$select=LogicalName,DisplayName,AttributeType,SchemaName&`$filter=AttributeOf eq null"
  try {
    $resp = Invoke-DataverseGet $orgUrl $accessToken $path
    return @($resp.value)
  } catch {
    return @()
  }
}

function Resolve-UnitSaleEntity([string]$orgUrl, [string]$accessToken) {
  $candidates = @()
  $path = "/EntityDefinitions?`$select=LogicalName,DisplayName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute&`$filter=contains(LogicalName,'sale')"
  try {
    $resp = Invoke-DataverseGet $orgUrl $accessToken $path
    foreach ($e in @($resp.value)) {
      $ln = [string]$e.LogicalName
      $dn = ''
      try { $dn = [string]$e.DisplayName.UserLocalizedLabel.Label } catch {}
      $candidates += @{
        logicalName = $ln
        entitySetName = [string]$e.EntitySetName
        primaryId = [string]$e.PrimaryIdAttribute
        primaryName = [string]$e.PrimaryNameAttribute
        displayName = $dn
      }
    }
  } catch {}

  $prefer = @('md_unitsale','aqr_unitsale','md_sale','aqr_sale')
  foreach ($p in $prefer) {
    foreach ($c in $candidates) {
      if ([string]$c.logicalName -eq $p) {
        return @{ ok = $true; entity = $c; candidates = $candidates }
      }
    }
  }
  foreach ($c in $candidates) {
    $ln = ([string]$c.logicalName).ToLowerInvariant()
    if ($ln -match 'unitsale' -or $ln -match 'unit_sale' -or $ln -match 'saleunit') {
      return @{ ok = $true; entity = $c; candidates = $candidates }
    }
  }

  try {
    $relPath = "/EntityDefinitions(LogicalName='md_unit')/ManyToOneRelationships?`$select=ReferencingAttribute,ReferencedEntity,ReferencedAttribute,SchemaName"
    $rel = Invoke-DataverseGet $orgUrl $accessToken $relPath
    foreach ($r in @($rel.value)) {
      $ra = [string]$r.ReferencingAttribute
      if ($ra -match 'relatedunitsale' -or $ra -match 'unitsale') {
        $target = [string]$r.ReferencedEntity
        if ($target) {
          $ed = Invoke-DataverseGet $orgUrl $accessToken ("/EntityDefinitions(LogicalName='" + $target + "')?`$select=LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute,DisplayName")
          $dn = ''
          try { $dn = [string]$ed.DisplayName.UserLocalizedLabel.Label } catch {}
          $ent = @{
            logicalName = [string]$ed.LogicalName
            entitySetName = [string]$ed.EntitySetName
            primaryId = [string]$ed.PrimaryIdAttribute
            primaryName = [string]$ed.PrimaryNameAttribute
            displayName = $dn
          }
          return @{ ok = $true; entity = $ent; candidates = $candidates; via = 'md_unit.relationship'; referencingAttribute = $ra }
        }
      }
    }
  } catch {}

  if ($candidates.Count -gt 0) {
    return @{ ok = $true; entity = $candidates[0]; candidates = $candidates; note = 'first sale entity' }
  }
  return @{ ok = $false; error = 'unitsale_entity_not_found'; candidates = $candidates }
}

function Map-SaleFields($attrNames) {
  # Aqaar-live proven / preferred logical names first, then tight patterns
  $unit = Pick-FieldByPatterns $attrNames @('^md_unitid$') @('md_unitid','md_unit','aqr_unit','md_relatedunit')
  $customer = Pick-FieldByPatterns $attrNames @('^md_customercontact$','^md_contact$','md_md_customercompany') @('md_customercontact','md_contact','md_md_customercompany','md_customer','aqr_customer')
  $pct = Pick-FieldByPatterns $attrNames @('aqr_collectionpercentage','aqr_realizedpercentage') @('aqr_collectionpercentage','aqr_realizedpercentage','md_percentpaid','aqr_percentpaid')
  $cheque = Pick-FieldByPatterns $attrNames @('aqr_chequeundertakingattached') @('aqr_chequeundertakingattached','md_guaranteecheque','aqr_guaranteecheque','md_securitycheque')
  $inst = Pick-FieldByPatterns $attrNames @('aqr_realizedinstallments','aqr_numberofoverdueinstallments') @('aqr_realizedinstallments','md_installments','aqr_installments','md_installmentcount')
  $contract = Pick-FieldByPatterns $attrNames @('aqr_reservationcontractsigned','new_signed','aqr_signedcontractupload') @('aqr_reservationcontractsigned','new_signed','aqr_signedcontractupload','md_contractsigned')
  $resident = Pick-FieldByPatterns $attrNames @('md_countryofresidenceid','md_nationalityid','^md_resident$','isresident') @('md_countryofresidenceid','md_nationalityid','md_resident','aqr_resident')
  $project = Pick-FieldByPatterns $attrNames @('^md_projectid$','aqr_projectname') @('md_projectid','aqr_projectname','md_projectname')
  return @{
    unit = $unit
    customer = $customer
    percentPaid = $pct
    guaranteeCheque = $cheque
    installments = $inst
    contractSigned = $contract
    resident = $resident
    project = $project
  }
}

function Get-CrmUnitsList([string]$project, [string]$statusFilter) {
  $access = Ensure-CrmAccessToken
  if (-not $access.ok) {
    return @{ ok = $false; error = [string]$access.error; authStatus = [string]$access.authStatus; message = [string]$access.message }
  }
  $cfg = $access.cfg
  $org = Normalize-CrmOrgUrl ([string]$cfg.orgUrl)
  if (-not $org) { $org = 'https://aqaar.crm15.dynamics.com' }
  $token = [string]$cfg.accessToken
  if ([string]::IsNullOrWhiteSpace($project)) { $project = 'Mawjan' }
  $st = ([string]$statusFilter).Trim().ToLowerInvariant()
  if (-not $st) { $st = 'all' }

  $selectFull = 'md_unitid,md_name,aqr_projectname,md_subtype,statuscode,statecode,_md_relatedunitsaleid_value,_aqr_holdbysalesperson_value,_aqr_assistedbysalesperson_value,_ownerid_value'
  $selectBasic = 'md_unitid,md_name,aqr_projectname,md_subtype,statuscode,statecode,_md_relatedunitsaleid_value,_ownerid_value'
  $filter = "contains(aqr_projectname,'" + ($project -replace "'","''") + "')"
  if ($st -eq 'sold') { $filter += ' and statuscode eq 100000004' }
  elseif ($st -eq 'available') { $filter += ' and statuscode eq 100000000' }
  # Do not $orderby (can be heavy); page cap keeps HttpListener alive
  $path = '/md_units?$select=' + $selectFull + '&$filter=' + [uri]::EscapeDataString($filter)
  $rows = @()
  $fieldNote = ''
  try { $rows = Invoke-DataverseGetPaged $org $token $path 8 } catch {
    $path2 = '/md_units?$select=' + $selectBasic + '&$filter=' + [uri]::EscapeDataString($filter)
    try {
      $rows = Invoke-DataverseGetPaged $org $token $path2 8
      $fieldNote = 'salesperson lookups missing; used basic select'
    } catch {
      return @{ ok = $false; error = 'units_fetch_failed'; message = $_.Exception.Message }
    }
  }
  if ($rows.Count -gt 400) {
    $rows = $rows[0..399]
    if ($fieldNote) { $fieldNote += '; ' }
    $fieldNote += 'truncated to 400 rows'
  }

  $out = @()
  foreach ($r in $rows) {
    $sub = Get-AttrFormatted $r 'md_subtype'
    $subU = $sub.ToUpperInvariant()
    $isRes = ($subU -match 'STUDIO|BEDROOM|PENT')
    $code = 0
    try { $code = [int]$r.statuscode } catch {}
    $status = 'other'
    if ($code -eq 100000004) { $status = 'sold' }
    elseif ($code -eq 100000000) { $status = 'available' }
    $id = [string]$r.md_unitid
    $out += @{
      id = $id
      name = (Get-AttrFormatted $r 'md_name')
      unitNumber = (Get-AttrFormatted $r 'md_name')
      project = (Get-AttrFormatted $r 'aqr_projectname')
      subtype = $sub
      residential = $isRes
      status = $status
      statuscode = [string]$r.statuscode
      statusLabel = (Get-AttrFormatted $r 'statuscode')
      relatedUnitSaleId = (Get-AttrFormatted $r '_md_relatedunitsaleid_value')
      holdBySalesperson = (Get-AttrFormatted $r '_aqr_holdbysalesperson_value')
      assistedBySalesperson = (Get-AttrFormatted $r '_aqr_assistedbysalesperson_value')
      owner = (Get-AttrFormatted $r '_ownerid_value')
      url = (Get-CrmRecordUrl $org 'md_unit' $id)
    }
  }

  return @{
    ok = $true
    project = $project
    status = $st
    count = $out.Count
    projectFilterField = 'aqr_projectname'
    bedroomTypeField = 'md_subtype'
    soldField = 'statuscode'
    soldRule = 'Sold=100000004 Available=100000000'
    units = $out
    fieldNote = $fieldNote
    fetchedAt = (Get-Date).ToUniversalTime().ToString('o')
  }
}


function Get-CrmCachePath([string]$kind, [string]$project) {
  $safe = ($project -replace '[^A-Za-z0-9_\-]', '')
  if ([string]::IsNullOrWhiteSpace($safe)) { $safe = 'Mawjan' }
  return (Join-Path $dataDir ('crm-cache-' + $kind + '-' + $safe + '.json'))
}
function Read-CrmCacheFile([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  try {
    $obj = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8) | ConvertFrom-Json
    if ($obj -and $obj.ok) { return $obj }
  } catch {}
  return $null
}
function Write-CrmCacheFile([string]$path, $obj) {
  try {
    $json = $obj | ConvertTo-Json -Depth 10 -Compress
    [IO.File]::WriteAllText($path, $json, [Text.UTF8Encoding]::new($false))
    return $true
  } catch {
    return $false
  }
}
function Get-CrmSalesListCached([string]$project, [bool]$forceRefresh = $false) {
  if ([string]::IsNullOrWhiteSpace($project)) { $project = 'Mawjan' }
  $cachePath = Get-CrmCachePath 'sales' $project
  if (-not $forceRefresh) {
    $cached = Read-CrmCacheFile $cachePath
    if ($cached) {
      try { $cached | Add-Member -NotePropertyName source -NotePropertyValue 'cache' -Force } catch {}
      try { $cached | Add-Member -NotePropertyName cachePath -NotePropertyValue $cachePath -Force } catch {}
      return $cached
    }
  }
  $result = Get-CrmSalesList -project $project
  if ($result -and $result.ok) {
    if ($result -is [hashtable]) {
      $result['source'] = 'live'
      $result['cachedAt'] = (Get-Date).ToUniversalTime().ToString('o')
    } else {
      try { $result | Add-Member -NotePropertyName source -NotePropertyValue 'live' -Force } catch {}
      try { $result | Add-Member -NotePropertyName cachedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o')) -Force } catch {}
    }
    $cnt = 0
    try { $cnt = [int]$result.count } catch {}
    # Avoid clobbering a good cache with an empty live pull
    $prev = Read-CrmCacheFile $cachePath
    $prevCnt = 0
    try { if ($prev) { $prevCnt = [int]$prev.count } } catch {}
    if ($cnt -gt 0 -or $prevCnt -le 0) {
      [void](Write-CrmCacheFile $cachePath $result)
    }
  }
  return $result
}
function Get-CrmUnitsListCached([string]$project, [string]$statusFilter, [bool]$forceRefresh = $false) {
  if ([string]::IsNullOrWhiteSpace($project)) { $project = 'Mawjan' }
  if ([string]::IsNullOrWhiteSpace($statusFilter)) { $statusFilter = 'all' }
  $cachePath = Get-CrmCachePath ('units-' + $statusFilter) $project
  if (-not $forceRefresh) {
    $cached = Read-CrmCacheFile $cachePath
    if ($cached) {
      try { $cached | Add-Member -NotePropertyName source -NotePropertyValue 'cache' -Force } catch {}
      return $cached
    }
  }
  $result = Get-CrmUnitsList -project $project -statusFilter $statusFilter
  if ($result -and $result.ok) {
    if ($result -is [hashtable]) {
      $result['source'] = 'live'
      $result['cachedAt'] = (Get-Date).ToUniversalTime().ToString('o')
    } else {
      try { $result | Add-Member -NotePropertyName source -NotePropertyValue 'live' -Force } catch {}
      try { $result | Add-Member -NotePropertyName cachedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o')) -Force } catch {}
    }
    [void](Write-CrmCacheFile $cachePath $result)
  }
  return $result
}
function Get-CrmPeopleListCached([bool]$forceRefresh = $false) {
  $cachePath = Get-CrmCachePath 'people' 'Mawjan'
  if (-not $forceRefresh) {
    $cached = Read-CrmCacheFile $cachePath
    if ($cached) {
      try { $cached | Add-Member -NotePropertyName source -NotePropertyValue 'cache' -Force } catch {}
      return $cached
    }
  }
  $result = Get-CrmPeopleList
  if ($result -and $result.ok) {
    if ($result -is [hashtable]) {
      $result['source'] = 'live'
      $result['cachedAt'] = (Get-Date).ToUniversalTime().ToString('o')
    } else {
      try { $result | Add-Member -NotePropertyName source -NotePropertyValue 'live' -Force } catch {}
      try { $result | Add-Member -NotePropertyName cachedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o')) -Force } catch {}
    }
    [void](Write-CrmCacheFile $cachePath $result)
  }
  return $result
}

function Get-CrmSalesList([string]$project) {
  $access = Ensure-CrmAccessToken
  if (-not $access.ok) {
    return @{ ok = $false; error = [string]$access.error; authStatus = [string]$access.authStatus; message = [string]$access.message }
  }
  $cfg = $access.cfg
  $org = Normalize-CrmOrgUrl ([string]$cfg.orgUrl)
  if (-not $org) { $org = 'https://aqaar.crm15.dynamics.com' }
  $token = [string]$cfg.accessToken
  if ([string]::IsNullOrWhiteSpace($project)) { $project = 'Mawjan' }

  $resolved = Resolve-UnitSaleEntity $org $token
  if (-not $resolved.ok) {
    return @{
      ok = $false
      error = 'unitsale_entity_not_found'
      message = 'No EntityDefinitions LogicalName containing sale matched unitsale'
      candidates = $resolved.candidates
    }
  }
  $ent = $resolved.entity
  $attrs = Get-EntityAttributeMeta $org $token ([string]$ent.logicalName)
  $names = Get-AttrNames $attrs
  $fmap = Map-SaleFields $names

  # Build OData $select carefully: lookups only as _x_value (never bare lookup logical name)
  $selectParts = @([string]$ent.primaryId)
  if ($ent.primaryName) { $selectParts += [string]$ent.primaryName }
  # Prefer md_unitsaleno if present (USL-*)
  if (($names -contains 'md_unitsaleno') -and ($selectParts -notcontains 'md_unitsaleno')) { $selectParts += 'md_unitsaleno' }
  foreach ($f in @($fmap.percentPaid, $fmap.guaranteeCheque, $fmap.installments, $fmap.contractSigned, 'statuscode', 'statecode', 'createdon', 'modifiedon', 'md_finalprice', 'aqr_realizedpercentage')) {
    if ($f -and ($names -contains $f) -and ($selectParts -notcontains $f)) { $selectParts += $f }
  }
  foreach ($f in @($fmap.unit, $fmap.customer, $fmap.resident, $fmap.project)) {
    if (-not $f) { continue }
    if ($f.StartsWith('_') -and $f.EndsWith('_value')) {
      if (($names -contains $f) -and ($selectParts -notcontains $f)) { $selectParts += $f }
      continue
    }
    $lv = '_' + $f + '_value'
    if (($names -contains $lv) -and ($selectParts -notcontains $lv)) { $selectParts += $lv }
    elseif (($names -contains $f) -and ($f -notmatch 'id$') -and ($selectParts -notcontains $f)) { $selectParts += $f }
  }
  $select = [string]::Join(',', ($selectParts | Select-Object -Unique))
  $selectMinimal = [string]::Join(',', (@([string]$ent.primaryId, [string]$ent.primaryName, 'md_unitsaleno', 'statuscode', $fmap.percentPaid, $fmap.guaranteeCheque, $fmap.contractSigned) | Where-Object { $_ } | Select-Object -Unique))

  $unitSelect = 'md_unitid,md_name,aqr_projectname,md_subtype,statuscode,_md_relatedunitsaleid_value,_aqr_holdbysalesperson_value,_aqr_assistedbysalesperson_value'
  $unitFilter = "contains(aqr_projectname,'" + ($project -replace "'","''") + "') and _md_relatedunitsaleid_value ne null"
  $unitPath = '/md_units?$select=' + $unitSelect + '&$filter=' + [uri]::EscapeDataString($unitFilter)
  $units = @()
  try { $units = Invoke-DataverseGetPaged $org $token $unitPath 50 } catch { $units = @() }

  $saleIds = @()
  $unitBySale = @{}
  foreach ($u in $units) {
    $sid = ''
    if ($u.PSObject.Properties['_md_relatedunitsaleid_value']) { $sid = [string]$u._md_relatedunitsaleid_value }
    if (-not $sid) { continue }
    if ($saleIds -notcontains $sid) { $saleIds += $sid }
    $unitBySale[$sid] = @{
      unitId = [string]$u.md_unitid
      unitName = (Get-AttrFormatted $u 'md_name')
      unitNumber = (Get-AttrFormatted $u 'md_name')
      subtype = (Get-AttrFormatted $u 'md_subtype')
      unitStatus = (Get-AttrFormatted $u 'statuscode')
      unitStatusCode = [string]$u.statuscode
      holdBy = (Get-AttrFormatted $u '_aqr_holdbysalesperson_value')
      assistedBy = (Get-AttrFormatted $u '_aqr_assistedbysalesperson_value')
      unitUrl = (Get-CrmRecordUrl $org 'md_unit' ([string]$u.md_unitid))
    }
  }

  $salesRows = @()
  $set = [string]$ent.entitySetName
  $idField = [string]$ent.primaryId
  $fetchMode = 'by_related_lookup'
  $selectUsed = $select
  $saleFetchErrors = @()
  if ($saleIds.Count -gt 0) {
    $chunkSize = 20
    for ($i = 0; $i -lt $saleIds.Count; $i += $chunkSize) {
      $end = [Math]::Min($i + $chunkSize - 1, $saleIds.Count - 1)
      $chunk = $saleIds[$i..$end]
      $ors = @()
      foreach ($sid in $chunk) { $ors += ($idField + ' eq ' + $sid) }
      $f = '(' + ([string]::Join(' or ', $ors)) + ')'
      $p = '/' + $set + '?$select=' + $selectUsed + '&$filter=' + [uri]::EscapeDataString($f)
      try {
        $page = Invoke-DataverseGetPaged $org $token $p 5
        if ($page) { $salesRows += @($page) }
      } catch {
        $saleFetchErrors += $_.Exception.Message
        # Retry this chunk with minimal select once
        try {
          $selectUsed = $selectMinimal
          $p2 = '/' + $set + '?$select=' + $selectUsed + '&$filter=' + [uri]::EscapeDataString($f)
          $page2 = Invoke-DataverseGetPaged $org $token $p2 5
          if ($page2) { $salesRows += @($page2) }
        } catch {
          $saleFetchErrors += $_.Exception.Message
        }
      }
    }
  } else {
    $fetchMode = 'entity_scan'
    $saleFilter = ''
    if ($fmap.project) {
      $saleFilter = 'contains(' + $fmap.project + ",'" + ($project -replace "'","''") + "')"
    }
    $p = '/' + $set + '?$select=' + [uri]::EscapeDataString($select) + '&$top=200'
    if ($saleFilter) { $p += '&$filter=' + [uri]::EscapeDataString($saleFilter) }
    try { $salesRows = Invoke-DataverseGetPaged $org $token $p 10 } catch { $salesRows = @() }
  }

  $out = @()
  $incomplete = @()
  foreach ($key in @('percentPaid','guaranteeCheque','installments','contractSigned','resident')) {
    if (-not $fmap.$key) { $incomplete += $key }
  }

  foreach ($s in $salesRows) {
    $sid = ''
    if ($s.PSObject.Properties[$idField]) { $sid = [string]$s.$idField }
    $uinfo = $null
    if ($sid -and $unitBySale.ContainsKey($sid)) { $uinfo = $unitBySale[$sid] }

    $raw = @{}
    foreach ($f in @($selectParts)) {
      if (-not $f) { continue }
      $val = Get-AttrFormatted $s $f
      if ($val) { $raw[$f] = $val }
    }

    $name = ''
    if ($s.PSObject.Properties['md_unitsaleno'] -and $s.md_unitsaleno) { $name = [string]$s.md_unitsaleno }
    elseif ($ent.primaryName) { $name = Get-AttrFormatted $s ([string]$ent.primaryName) }

    $out += @{
      id = $sid
      name = $name
      url = (Get-CrmRecordUrl $org ([string]$ent.logicalName) $sid)
      unitId = $(if ($uinfo) { $uinfo.unitId } else { Get-AttrFormatted $s $fmap.unit })
      unitName = $(if ($uinfo) { $uinfo.unitName } else { '' })
      unitNumber = $(if ($uinfo) { $uinfo.unitNumber } else { '' })
      unitSubtype = $(if ($uinfo) { $uinfo.subtype } else { '' })
      unitStatus = $(if ($uinfo) { $uinfo.unitStatus } else { '' })
      unitUrl = $(if ($uinfo) { $uinfo.unitUrl } else { '' })
      customer = $(if ($fmap.customer) { Get-AttrFormatted $s $fmap.customer } else { '' })
      percentPaid = $(if ($fmap.percentPaid) { Get-AttrFormatted $s $fmap.percentPaid } else { '' })
      guaranteeCheque = $(if ($fmap.guaranteeCheque) { Get-AttrFormatted $s $fmap.guaranteeCheque } else { '' })
      installments = $(if ($fmap.installments) { Get-AttrFormatted $s $fmap.installments } else { '' })
      contractSigned = $(if ($fmap.contractSigned) { Get-AttrFormatted $s $fmap.contractSigned } else { '' })
      resident = $(if ($fmap.resident) { Get-AttrFormatted $s $fmap.resident } else { '' })
      holdBySalesperson = $(if ($uinfo) { $uinfo.holdBy } else { '' })
      assistedBySalesperson = $(if ($uinfo) { $uinfo.assistedBy } else { '' })
      statusLabel = (Get-AttrFormatted $s 'statuscode')
      statuscode = $(if ($s.PSObject.Properties['statuscode']) { [string]$s.statuscode } else { '' })
      raw = $raw
      completion = @{
        ruleHint = 'Target: 5pct paid + guarantee cheque OR 6 installments + contract signed (fields TBD if blank)'
        percentPaidField = $fmap.percentPaid
        guaranteeChequeField = $fmap.guaranteeCheque
        installmentsField = $fmap.installments
        contractSignedField = $fmap.contractSigned
        residentField = $fmap.resident
        incompleteFields = $incomplete
      }
    }
  }

  $candOut = @()
  foreach ($c in @($resolved.candidates)) {
    $candOut += @{
      logicalName = [string]$c.logicalName
      entitySetName = [string]$c.entitySetName
      displayName = [string]$c.displayName
    }
  }

  return @{
    ok = $true
    project = $project
    count = $out.Count
    relatedUnitCount = $units.Count
    fetchMode = $fetchMode
    entity = @{
      logicalName = [string]$ent.logicalName
      entitySetName = [string]$ent.entitySetName
      primaryId = [string]$ent.primaryId
      primaryName = [string]$ent.primaryName
      displayName = [string]$ent.displayName
    }
    fieldMap = $fmap
    incompleteForCompletionRules = $incomplete
    saleEntityCandidates = $candOut
    sales = $out
    fetchedAt = (Get-Date).ToUniversalTime().ToString('o')
  }
}

function Get-CrmPeopleList {
  $access = Ensure-CrmAccessToken
  if (-not $access.ok) {
    return @{ ok = $false; error = [string]$access.error; authStatus = [string]$access.authStatus; message = [string]$access.message }
  }
  $cfg = $access.cfg
  $org = Normalize-CrmOrgUrl ([string]$cfg.orgUrl)
  if (-not $org) { $org = 'https://aqaar.crm15.dynamics.com' }
  $token = [string]$cfg.accessToken

  $select = 'md_unitid,md_name,aqr_projectname,md_subtype,statuscode,_aqr_holdbysalesperson_value,_aqr_assistedbysalesperson_value,_ownerid_value'
  $filter = "contains(aqr_projectname,'Mawjan')"
  $path = '/md_units?$select=' + [uri]::EscapeDataString($select) + '&$filter=' + [uri]::EscapeDataString($filter)
  $rows = @()
  try { $rows = Invoke-DataverseGetPaged $org $token $path 50 } catch { $rows = @() }

  $people = @{}
  foreach ($u in $rows) {
    $entries = @()
    $holdId = ''
    $holdName = Get-AttrFormatted $u '_aqr_holdbysalesperson_value'
    if ($u.PSObject.Properties['_aqr_holdbysalesperson_value'] -and $u._aqr_holdbysalesperson_value) {
      $holdId = [string]$u._aqr_holdbysalesperson_value
    }
    if ($holdId -or $holdName) { $entries += @{ id = $holdId; name = $holdName; role = 'hold' } }

    $assistId = ''
    $assistName = Get-AttrFormatted $u '_aqr_assistedbysalesperson_value'
    if ($u.PSObject.Properties['_aqr_assistedbysalesperson_value'] -and $u._aqr_assistedbysalesperson_value) {
      $assistId = [string]$u._aqr_assistedbysalesperson_value
    }
    if ($assistId -or $assistName) { $entries += @{ id = $assistId; name = $assistName; role = 'assist' } }

    $ownerId = ''
    $ownerName = Get-AttrFormatted $u '_ownerid_value'
    if ($u.PSObject.Properties['_ownerid_value'] -and $u._ownerid_value) {
      $ownerId = [string]$u._ownerid_value
    }
    if ($ownerId -or $ownerName) { $entries += @{ id = $ownerId; name = $ownerName; role = 'owner' } }

    foreach ($e in $entries) {
      $id = [string]$e.id
      $name = [string]$e.name
      $role = [string]$e.role
      if (-not $id -and -not $name) { continue }
      $key = $(if ($id) { $id } else { 'name:' + $name })
      if (-not $people.ContainsKey($key)) {
        $people[$key] = @{
          id = $id
          name = $name
          roles = @{}
          holdCount = 0
          assistCount = 0
          ownerCount = 0
          soldHold = 0
          availableHold = 0
          sampleUnits = @()
          url = $(if ($id) { Get-CrmRecordUrl $org 'systemuser' $id } else { '' })
        }
      }
      $p = $people[$key]
      if ($name -and -not $p.name) { $p.name = $name }
      if (-not $p.roles.ContainsKey($role)) { $p.roles[$role] = 0 }
      $p.roles[$role] = [int]$p.roles[$role] + 1
      $code = ''
      if ($u.PSObject.Properties['statuscode']) { $code = [string]$u.statuscode }
      if ($role -eq 'hold') {
        $p.holdCount++
        if ($code -eq '100000004') { $p.soldHold++ }
        elseif ($code -eq '100000000') { $p.availableHold++ }
      } elseif ($role -eq 'assist') { $p.assistCount++ }
      elseif ($role -eq 'owner') { $p.ownerCount++ }
      if ($p.sampleUnits.Count -lt 5) {
        $p.sampleUnits += @{
          id = [string]$u.md_unitid
          name = (Get-AttrFormatted $u 'md_name')
          status = (Get-AttrFormatted $u 'statuscode')
          role = $role
        }
      }
    }
  }

  $list = @()
  foreach ($k in $people.Keys) {
    $p = $people[$k]
    $roleList = @()
    foreach ($rk in $p.roles.Keys) { $roleList += ($rk + ':' + $p.roles[$rk]) }
    $list += @{
      id = $p.id
      name = $p.name
      holdCount = $p.holdCount
      assistCount = $p.assistCount
      ownerCount = $p.ownerCount
      soldHold = $p.soldHold
      availableHold = $p.availableHold
      roles = $roleList
      sampleUnits = $p.sampleUnits
      url = $p.url
      totalTouches = ([int]$p.holdCount + [int]$p.assistCount + [int]$p.ownerCount)
    }
  }
  $list = @($list | Sort-Object @{Expression={ -$_.holdCount }}, @{Expression={ -$_.assistCount }}, @{Expression={ $_.name }})

  $hasSales = @($list | Where-Object { $_.holdCount -gt 0 -or $_.assistCount -gt 0 }).Count -gt 0
  if ($hasSales) {
    $list = @($list | Where-Object { $_.holdCount -gt 0 -or $_.assistCount -gt 0 })
  }

  return @{
    ok = $true
    project = 'Mawjan'
    count = $list.Count
    unitRowsScanned = $rows.Count
    sourceFields = @('aqr_holdbysalesperson','aqr_assistedbysalesperson','ownerid')
    people = $list
    fetchedAt = (Get-Date).ToUniversalTime().ToString('o')
    note = 'Best-effort from md_unit salesperson lookups for Mawjan units'
  }
}



# Optional AQWizard companion bridge (health + wizard-settings.json only).
$wizardBridgePath = Join-Path (Join-Path $Root 'wizard') 'Wizard-Bridge.ps1'
if (Test-Path $wizardBridgePath) {
  . $wizardBridgePath
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
    if ($req.HttpMethod -eq 'OPTIONS') {
      $res.AddHeader('Access-Control-Allow-Origin','*')
      $res.AddHeader('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS')
      $res.AddHeader('Access-Control-Allow-Headers','Content-Type')
      Write-Text $res 204 'text/plain' ''
      continue
    }
    if ($path.StartsWith('/api/v1/wizard/')) {
      if (Get-Command Invoke-WizardBridge -ErrorAction SilentlyContinue) {
        $handled = Invoke-WizardBridge -Req $req -Res $res -Path $path -DataDir $dataDir -Root $Root
        if ($handled) { continue }
      }
    }
    if ($path -eq '/api/tasks' -and $req.HttpMethod -eq 'GET') { Write-FileResp $res $tasksPath; continue }
    if ($path -eq '/api/tasks' -and $req.HttpMethod -eq 'POST') {
      $body = Read-Body $req
      $null = $body | ConvertFrom-Json
      [IO.File]::WriteAllText($tasksPath, $body, [Text.UTF8Encoding]::new($false))
      Write-Json $res @{ ok = $true }
      continue
    }
    
function Get-TaskIndex {
  $tasksPath = Join-Path $dataDir 'tasks.json'
  $map = @{}
  if (-not (Test-Path $tasksPath)) { return $map }
  try {
    $tj = [IO.File]::ReadAllText($tasksPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
    foreach ($t in @($tj.tasks)) {
      if ($t.id) { $map[[string]$t.id] = $t }
    }
  } catch {}
  return $map
}

function ConvertTo-EisItemFromTask($t, [string]$quad = 'inbox') {
  if (-not $t) { return $null }
  $src = ([string]$t.source).ToLowerInvariant()
  if (-not $src) { $src = 'task' }
  $title = [string]$(if ($t.title) { $t.title } elseif ($t.subject) { $t.subject } else { $t.id })
  $entry = [string]$(if ($t.entryId) { $t.entryId } else { $t.entryID })
  $mailQuery = ''
  $sref = [string]$t.sourceRef
  if ($sref -match '/\s*(.+)$') { $mailQuery = $Matches[1].Trim() }
  elseif ($title) { $mailQuery = $title }
  $crmUrl = [string]$t.crmUrl
  $sourceUrl = [string]$t.sourceUrl
  $teamsUrl = [string]$t.teamsUrl
  if ($src -eq 'crm' -and -not $crmUrl -and $sref -match '^([a-z0-9_]+):([0-9a-fA-F-]{36})$') {
    $crmUrl = "https://aqaar.crm15.dynamics.com/main.aspx?pagetype=entityrecord&etn=$($Matches[1])&id=$($Matches[2])"
    $sourceUrl = $crmUrl
  }
  $now = (Get-Date).ToUniversalTime().ToString('o')
  return [pscustomobject]@{
    id = ('E-' + [guid]::NewGuid().ToString('n').Substring(0,12))
    taskId = [string]$t.id
    title = $title
    source = $src
    quad = $quad
    done = $false
    note = ''
    entryId = $entry
    sourceRef = $sref
    fromEmail = [string]$t.fromEmail
    mailQuery = $mailQuery
    sourceUrl = $sourceUrl
    crmUrl = $crmUrl
    teamsUrl = $teamsUrl
    url = [string]$t.url
    createdAt = $now
    updatedAt = $now
  }
}

function Merge-EisItemWithTask($item, $t) {
  if (-not $item -or -not $t) { return $item }
  $isHash = $item -is [hashtable] -or $item -is [System.Collections.Specialized.OrderedDictionary]
  function Set-Prop($o, $name, $val) {
    if ($null -eq $val -or [string]$val -eq '') { return }
    if ($o -is [hashtable] -or $o -is [System.Collections.Specialized.OrderedDictionary]) { $o[$name] = $val }
    else { try { $o | Add-Member -NotePropertyName $name -NotePropertyValue $val -Force } catch {} }
  }
  $src = ([string]$t.source).ToLowerInvariant()
  if ($src) { Set-Prop $item 'source' $src }
  $entry = [string]$(if ($t.entryId) { $t.entryId } else { $t.entryID })
  if ($entry) { Set-Prop $item 'entryId' $entry }
  if ($t.sourceRef) { Set-Prop $item 'sourceRef' ([string]$t.sourceRef) }
  if ($t.fromEmail) { Set-Prop $item 'fromEmail' ([string]$t.fromEmail) }
  $mq = ''
  $sref = [string]$t.sourceRef
  if ($sref -match '/\s*(.+)$') { $mq = $Matches[1].Trim() }
  elseif ($t.title) { $mq = [string]$t.title }
  if ($mq) { Set-Prop $item 'mailQuery' $mq }
  if ($t.sourceUrl) { Set-Prop $item 'sourceUrl' ([string]$t.sourceUrl) }
  if ($t.crmUrl) { Set-Prop $item 'crmUrl' ([string]$t.crmUrl) }
  if ($t.teamsUrl) { Set-Prop $item 'teamsUrl' ([string]$t.teamsUrl) }
  if ($t.url) { Set-Prop $item 'url' ([string]$t.url) }
  if ($src -eq 'crm') {
    $crm = if ($isHash) { [string]$item['crmUrl'] } else { [string]$item.crmUrl }
    if (-not $crm -and $sref -match '^([a-z0-9_]+):([0-9a-fA-F-]{36})$') {
      $u = "https://aqaar.crm15.dynamics.com/main.aspx?pagetype=entityrecord&etn=$($Matches[1])&id=$($Matches[2])"
      Set-Prop $item 'crmUrl' $u
      Set-Prop $item 'sourceUrl' $u
    }
  }
  return $item
}

function Enrich-EisPayload($payload) {
  $map = Get-TaskIndex
  $items = @()
  if ($payload.items) { $items = @($payload.items) }
  $out = @()
  foreach ($it in $items) {
    $tid = [string]$(if ($it.taskId) { $it.taskId } elseif ($it.PSObject.Properties['taskId']) { $it.taskId } else { '' })
    if ($tid -and $map.ContainsKey($tid)) {
      $it = Merge-EisItemWithTask $it $map[$tid]
    }
    $out += $it
  }
  if ($payload -is [hashtable]) { $payload['items'] = $out }
  else { try { $payload | Add-Member -NotePropertyName items -NotePropertyValue $out -Force } catch { $payload.items = $out } }
  return $payload
}

function Invoke-EisAutoFeed([bool]$force = $false) {
  $map = Get-TaskIndex
  $payload = @{ items = @(); updatedAt = ''; lastFeedAt = '' }
  if (Test-Path $eisenhowerPath) {
    try { $payload = [IO.File]::ReadAllText($eisenhowerPath, [Text.Encoding]::UTF8) | ConvertFrom-Json } catch {}
  }
  $items = New-Object System.Collections.Generic.List[object]
  foreach ($it in @($payload.items)) { [void]$items.Add($it) }

  $existingTask = @{}
  $trashedTask = @{}
  foreach ($it in $items) {
    $tid = [string]$it.taskId
    if (-not $tid) { continue }
    if ([string]$it.quad -eq 'trash') { $trashedTask[$tid] = $true }
    else { $existingTask[$tid] = $true }
  }

  $added = 0
  $tasksPath = Join-Path $dataDir 'tasks.json'
  if (-not (Test-Path $tasksPath)) {
    return @{ ok = $true; added = 0; total = $items.Count; message = 'no_tasks' }
  }
  $tj = [IO.File]::ReadAllText($tasksPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
  foreach ($t in @($tj.tasks)) {
    $st = ([string]$(if ($t.status) { $t.status } else { $t.state })).ToLowerInvariant()
    if ($st -match 'done|closed|complet|archive') { continue }
    $tid = [string]$t.id
    if (-not $tid) { continue }
    if ($existingTask.ContainsKey($tid) -or $trashedTask.ContainsKey($tid)) { continue }
    $row = ConvertTo-EisItemFromTask $t 'inbox'
    if ($row) {
      if ($row -is [hashtable] -or $row -is [System.Collections.Specialized.OrderedDictionary]) { $row = [pscustomobject]$row }; [void]$items.Insert(0, $row)
      $existingTask[$tid] = $true
      $added++
    }
  }

  $now = (Get-Date).ToUniversalTime().ToString('o')
  $arr = New-Object object[] $items.Count
  for ($i = 0; $i -lt $items.Count; $i++) { $arr[$i] = $items[$i] }
  $outObj = @{
    items = $arr
    updatedAt = $now
    lastFeedAt = $now
    lastFeedAdded = $added
  }
  $json = ($outObj | ConvertTo-Json -Depth 10 -Compress)
  [IO.File]::WriteAllText($eisenhowerPath, $json, [Text.UTF8Encoding]::new($false))
  return @{ ok = $true; added = $added; total = $items.Count; lastFeedAt = $now; source = 'feed' }
}


    if ($path -eq '/api/signing-platforms' -and $req.HttpMethod -eq 'GET') {
      $sp = Join-Path $dataDir 'signing-platforms.json'
      if (Test-Path $sp) { Write-FileResp $res $sp; continue }
      Write-Json $res @{ ok = $true; platforms = @(
        @{ id = 'digiapi'; url = 'https://digiapi.aqaar.com:4443/reports/all'; kind = 'spa_contracts' },
        @{ id = 'digisign'; url = 'https://digisign.aqaar.com/'; kind = 'internal_sign' }
      ) }
      continue
    }if ($path -eq '/api/eisenhower/feed' -and $req.HttpMethod -eq 'POST') {
  $force = $false
  try {
    $qb = [string]$req.QueryString['force']
    if ($qb -and ($qb.Trim().ToLowerInvariant() -in @('1','true','yes'))) { $force = $true }
  } catch {}
  $result = Invoke-EisAutoFeed -force $force
  Write-Json $res $result
  continue
}
if ($path -eq '/api/eisenhower' -and $req.HttpMethod -eq 'GET') {
  try {
    $payload = $null
    if (Test-Path $eisenhowerPath) { $payload = [IO.File]::ReadAllText($eisenhowerPath, [Text.Encoding]::UTF8) | ConvertFrom-Json }
    if (-not $payload) { $payload = [pscustomobject]@{ items = @(); updatedAt = '' } }
    $payload = Enrich-EisPayload $payload
    try {
      $payload | Add-Member -NotePropertyName enrichedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o')) -Force
      [IO.File]::WriteAllText($eisenhowerPath, ($payload | ConvertTo-Json -Depth 10 -Compress), [Text.UTF8Encoding]::new($false))
    } catch {}
    Write-Json $res $payload
  } catch { Write-FileResp $res $eisenhowerPath }
  continue
}
    if ($path -eq '/api/eisenhower' -and $req.HttpMethod -eq 'POST') {
      $body = Read-Body $req
      $incoming = $null
      try { $incoming = $body | ConvertFrom-Json } catch { Write-Json $res @{ ok = $false; error = 'bad_json' }; continue }
      # Preserve source linkage if browser posted older items without entryId/crmUrl
      $prevMap = @{}
      if (Test-Path $eisenhowerPath) {
        try {
          $prev = [IO.File]::ReadAllText($eisenhowerPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
          foreach ($p in @($prev.items)) {
            if ($p.id) { $prevMap[[string]$p.id] = $p }
            elseif ($p.taskId) { $prevMap[('task:' + [string]$p.taskId)] = $p }
          }
        } catch {}
      }
      $merged = @()
      foreach ($it in @($incoming.items)) {
        $old = $null
        if ($it.id -and $prevMap.ContainsKey([string]$it.id)) { $old = $prevMap[[string]$it.id] }
        elseif ($it.taskId -and $prevMap.ContainsKey(('task:' + [string]$it.taskId))) { $old = $prevMap[('task:' + [string]$it.taskId)] }
        if ($old) {
          foreach ($k in @('entryId','sourceUrl','crmUrl','teamsUrl','sourceRef','mailQuery','fromEmail','source')) {
            $cur = [string]$it.$k
            $prv = [string]$old.$k
            if ((-not $cur) -and $prv) { try { $it | Add-Member -NotePropertyName $k -NotePropertyValue $prv -Force } catch {} }
          }
        }
        $merged += $it
      }
      $incoming = Enrich-EisPayload ([pscustomobject]@{ items = $merged; updatedAt = (Get-Date).ToUniversalTime().ToString('o') })
      $outJson = ($incoming | ConvertTo-Json -Depth 10 -Compress)
      [IO.File]::WriteAllText($eisenhowerPath, $outJson, [Text.UTF8Encoding]::new($false))
      Write-Json $res @{ ok = $true; count = @($incoming.items).Count }
      continue
    }
    if ($path -eq '/api/audit' -and $req.HttpMethod -eq 'GET') { Write-FileResp $res $auditPath; continue }
    if ($path -eq '/api/audit' -and $req.HttpMethod -eq 'POST') {
      $body = (Read-Body $req).Trim()
      if ($body) { [IO.File]::AppendAllText($auditPath, $body + [Environment]::NewLine, [Text.UTF8Encoding]::new($false)) }
      Write-Json $res @{ ok = $true }
      continue
    }
    if ($path -eq '/api/open' -and $req.HttpMethod -eq 'POST') {
      $body = (Read-Body $req) | ConvertFrom-Json
      $type = [string]$body.type
      if ($type -eq 'url' -and $body.url) {
        Start-Process ([string]$body.url)
        Write-Json $res @{ ok = $true; method = 'url' }
      } else {
        $result = Open-Mail -entryId ([string]$body.entryId) -query ([string]$body.query)
        Write-Json $res $result
      }
      continue
    }
    if ($path -eq '/api/mail/sync' -and $req.HttpMethod -eq 'POST') {
      $result = Sync-MailToTasks
      Write-Json $res $result
      continue
    }
    if ($path -eq '/api/bot/run' -and $req.HttpMethod -eq 'POST') {
      $body = (Read-Body $req) | ConvertFrom-Json
      $tid = [string]$body.taskId
      $mode = [string]$body.mode
      if (-not $tid) { Write-Json $res @{ ok = $false; error = 'taskId required' } 400; continue }
      $result = Start-BotRun -taskId $tid -mode $mode
      $code = 200
      if (-not $result.ok) { $code = 404 }
      Write-Json $res $result $code
      continue
    }
    if ($path -eq '/api/bot/stop' -and $req.HttpMethod -eq 'POST') {
      $body = (Read-Body $req) | ConvertFrom-Json
      $jid = [string]$body.id
      if (-not $jid) { Write-Json $res @{ ok = $false; error = 'id required' } 400; continue }
      $result = Stop-BotJob -id $jid
      $code = 200
      if (-not $result.ok) { $code = 404 }
      Write-Json $res $result $code
      continue
    }
    if ($path -eq '/api/bot/job' -and $req.HttpMethod -eq 'GET') {
      $jid = [string]$req.QueryString['id']
      if (-not $jid) { Write-Json $res @{ ok = $false; error = 'id required' } 400; continue }
      $job = Load-JobObj $jid
      if (-not $job) { Write-Json $res @{ ok = $false; error = 'job_not_found' } 404; continue }
      Write-Json $res $job
      continue
    }
    if ($path -eq '/api/bot/jobs' -and $req.HttpMethod -eq 'GET') {
      Write-Json $res (List-RecentJobs 30)
      continue
    }
    
    if ($path -eq '/api/dashboard-layout' -and $req.HttpMethod -eq 'GET') {
      if (Test-Path $dashboardLayoutPath) { Write-FileResp $res $dashboardLayoutPath; continue }
      Write-Json $res @{ ok = $true; layout = $null }
      continue
    }
    if ($path -eq '/api/dashboard-layout' -and $req.HttpMethod -eq 'POST') {
      $body = Read-Body $req
      $parsed = $null
      try { $parsed = $body | ConvertFrom-Json } catch { Write-Json $res @{ ok = $false; error = 'bad_json' }; continue }
      if (-not $parsed) { Write-Json $res @{ ok = $false; error = 'bad_json' }; continue }
      [IO.File]::WriteAllText($dashboardLayoutPath, $body, [Text.UTF8Encoding]::new($false))
      Write-Json $res @{ ok = $true }
      continue
    }
    if ($path -eq '/api/notes' -and $req.HttpMethod -eq 'GET') {
      if (Test-Path $notesPath) { Write-FileResp $res $notesPath; continue }
      Write-Json $res @{ ok = $true; notes = @(); updatedAt = '' }
      continue
    }
    if ($path -eq '/api/notes' -and $req.HttpMethod -eq 'POST') {
      $body = Read-Body $req
      $parsed = $null
      try { $parsed = $body | ConvertFrom-Json } catch { Write-Json $res @{ ok = $false; error = 'bad_json' }; continue }
      if (-not $parsed) { Write-Json $res @{ ok = $false; error = 'bad_json' }; continue }
      [IO.File]::WriteAllText($notesPath, $body, [Text.UTF8Encoding]::new($false))
      Write-Json $res @{ ok = $true }
      continue
    }
        if ($path -eq '/api/task/box-note' -and $req.HttpMethod -eq 'POST') {
      $bodyRaw = Read-Body $req
      $body = $null
      try { $body = $bodyRaw | ConvertFrom-Json } catch { Write-Json $res @{ ok = $false; error = 'bad_json' }; continue }
      $taskId = [string]$body.taskId
      $note = [string]$body.note
      if (-not $taskId) { Write-Json $res @{ ok = $false; error = 'taskId_required' }; continue }
      if (-not (Test-Path $tasksPath)) { Write-Json $res @{ ok = $false; error = 'no_tasks' }; continue }
      $tj = [IO.File]::ReadAllText($tasksPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
      $found = $false
      $now = (Get-Date).ToUniversalTime().ToString('o')
      $newTasks = @()
      foreach ($t in @($tj.tasks)) {
        if ([string]$t.id -eq $taskId) {
          $found = $true
          try { $t | Add-Member -NotePropertyName boxNote -NotePropertyValue $note -Force } catch {}
          try { $t | Add-Member -NotePropertyName updatedAt -NotePropertyValue $now -Force } catch {}
          if (-not $t.timeline) { try { $t | Add-Member -NotePropertyName timeline -NotePropertyValue @() -Force } catch {} }
          $noteText = if ($note) { 'Box note: ' + $note } else { 'Box note cleared' }
          $ev = [pscustomobject]@{ id = ('TL-' + [guid]::NewGuid().ToString('n').Substring(0,10)); type = 'note'; text = $noteText; at = $now; actor = 'User' }
          $tl = @($t.timeline) + @($ev)
          try { $t | Add-Member -NotePropertyName timeline -NotePropertyValue $tl -Force } catch { $t.timeline = $tl }
          if (-not $t.comments) { try { $t | Add-Member -NotePropertyName comments -NotePropertyValue @() -Force } catch {} }
          $cm = @($t.comments) + @([pscustomobject]@{ text = $noteText; by = 'user'; at = $now })
          try { $t | Add-Member -NotePropertyName comments -NotePropertyValue $cm -Force } catch { $t.comments = $cm }
        }
        $newTasks += $t
      }
      if (-not $found) { Write-Json $res @{ ok = $false; error = 'task_not_found' }; continue }
      try { $tj | Add-Member -NotePropertyName tasks -NotePropertyValue $newTasks -Force } catch { $tj.tasks = $newTasks }
      $json = ($tj | ConvertTo-Json -Depth 12 -Compress)
      [IO.File]::WriteAllText($tasksPath, $json, [Text.UTF8Encoding]::new($false))
      Write-Json $res @{ ok = $true; taskId = $taskId }
      continue
    }
if ($path -eq '/api/task' -and $req.HttpMethod -eq 'GET') {
      $tid = [string]$req.QueryString['id']
      if (-not $tid) { Write-Json $res @{ ok = $false; error = 'id required' } 400; continue }
      $data = Load-TasksData
      $task = Find-TaskObj $data $tid
      if (-not $task) { Write-Json $res @{ ok = $false; error = 'not_found' } 404; continue }
      $null = Ensure-TaskRoom $task
      Save-TasksData $data
      Write-Json $res @{ ok = $true; task = (Find-TaskObj (Load-TasksData) $tid) }
      continue
    }
    if ($path -eq '/api/task/chat' -and $req.HttpMethod -eq 'POST') {
      $body = (Read-Body $req) | ConvertFrom-Json
      $tid = [string]$body.taskId
      $text = [string]$body.text
      if (-not $tid) { Write-Json $res @{ ok = $false; error = 'taskId required' } 400; continue }
      if ([string]::IsNullOrWhiteSpace($text)) { Write-Json $res @{ ok = $false; error = 'text required' } 400; continue }
      $data = Load-TasksData
      $task = Find-TaskObj $data $tid
      if (-not $task) { Write-Json $res @{ ok = $false; error = 'not_found' } 404; continue }
      $null = Ensure-TaskRoom $task
      $userMsg = Add-Chat $task 'user' $text $null
      $null = Add-Timeline $task 'chat' ('User: ' + $text) 'user' $null
      Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'User'; action = 'task.chat'; taskId = $tid; text = $text }
      $brain = Invoke-TaskChatBrain $task $text
      if ($brain -is [System.Collections.IEnumerable] -and -not ($brain -is [hashtable]) -and -not ($brain -is [string])) {
        $map = @{}
        foreach ($e in @($brain)) {
          if ($e -is [System.Collections.DictionaryEntry]) { $map[$e.Key] = $e.Value }
          elseif ($e.PSObject -and $e.PSObject.Properties['Key']) { $map[[string]$e.Key] = $e.Value }
        }
        if ($map.Count -gt 0) { $brain = $map }
      }
      $task | Add-Member -NotePropertyName updatedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o')) -Force
      Save-TasksData $data
      $fresh = Find-TaskObj (Load-TasksData) $tid
      Write-Json $res @{
        ok = $true
        task = $fresh
        botMessage = $brain.botMessage
        timelineAdded = $brain.timelineAdded
        userMessage = $userMsg
      }
      continue
    }
    if ($path -eq '/api/task/approve-send' -and $req.HttpMethod -eq 'POST') {
      $body = (Read-Body $req) | ConvertFrom-Json
      $tid = [string]$body.taskId
      if (-not $tid) { Write-Json $res @{ ok = $false; error = 'taskId required' } 400; continue }
      $data = Load-TasksData
      $task = Find-TaskObj $data $tid
      if (-not $task) { Write-Json $res @{ ok = $false; error = 'not_found' } 404; continue }
      $null = Ensure-TaskRoom $task
      if (-not $task.pendingSend) { Write-Json $res @{ ok = $false; error = 'no_pendingSend'; task = $task } 400; continue }
      $null = Add-Timeline $task 'send_approved' 'User approved via /api/task/approve-send' 'user' $null
      $sendResult = Invoke-SendPending $task
      if ($sendResult.ok) {
        $task.pendingSend = $null
        $null = Add-Timeline $task 'send_sent' ('Mail sent via Outlook (' + $sendResult.method + ')') 'bot' $sendResult
        $null = Add-Chat $task 'system' 'Mail sent after approval.' @{ intent = 'approve_send' }
        $task | Add-Member -NotePropertyName updatedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o')) -Force
        Save-TasksData $data
        Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'User'; action = 'task.send.approved'; taskId = $tid; method = $sendResult.method }
        Write-Json $res @{ ok = $true; task = (Find-TaskObj (Load-TasksData) $tid); message = 'sent'; method = $sendResult.method }
      } else {
        $err = [string]$sendResult.error
        if ($sendResult.message) { $err = $err + ' - ' + $sendResult.message }
        $null = Add-Timeline $task 'system' ('Send failed: ' + $err) 'system' $sendResult
        $null = Add-Chat $task 'system' ('Send failed: ' + $err) @{ intent = 'approve_send'; ok = $false }
        Save-TasksData $data
        Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'User'; action = 'task.send.error'; taskId = $tid; error = $err }
        Write-Json $res @{ ok = $false; error = $err; task = (Find-TaskObj (Load-TasksData) $tid) } 500
      }
      continue
    }
    if ($path -eq '/api/task/cancel-send' -and $req.HttpMethod -eq 'POST') {
      $body = (Read-Body $req) | ConvertFrom-Json
      $tid = [string]$body.taskId
      if (-not $tid) { Write-Json $res @{ ok = $false; error = 'taskId required' } 400; continue }
      $data = Load-TasksData
      $task = Find-TaskObj $data $tid
      if (-not $task) { Write-Json $res @{ ok = $false; error = 'not_found' } 404; continue }
      $null = Ensure-TaskRoom $task
      $task.pendingSend = $null
      $null = Add-Timeline $task 'send_cancelled' 'Pending send cancelled via API' 'user' $null
      $null = Add-Chat $task 'system' 'Pending send cancelled.' @{ intent = 'cancel_send' }
      $task | Add-Member -NotePropertyName updatedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString('o')) -Force
      Save-TasksData $data
      Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'User'; action = 'task.send.cancelled'; taskId = $tid }
      Write-Json $res @{ ok = $true; task = (Find-TaskObj (Load-TasksData) $tid) }
      continue
    }


    if ($path -eq '/api/crm/config' -and $req.HttpMethod -eq 'GET') {
      $cfg = Load-CrmConfig
      Write-Json $res (Get-CrmPublicConfig $cfg)
      continue
    }
    if ($path -eq '/api/crm/config' -and $req.HttpMethod -eq 'POST') {
      $body = (Read-Body $req) | ConvertFrom-Json
      $cfg = Load-CrmConfig
      if ($null -ne $body.orgUrl) { $cfg.orgUrl = (Normalize-CrmOrgUrl ([string]$body.orgUrl)) }
      if ($null -ne $body.tenantId) {
        $tid = [string]$body.tenantId
        if ([string]::IsNullOrWhiteSpace($tid)) { $tid = 'common' }
        $cfg.tenantId = $tid
      }
      if ($null -ne $body.clientId) { $cfg.clientId = ([string]$body.clientId).Trim() }
      if ($null -ne $body.appId) { $cfg.appId = ([string]$body.appId).Trim() }
      if ($null -ne $body.environment) { $cfg.environment = [string]$body.environment }
      if ($null -ne $body.authMode) { $cfg.authMode = [string]$body.authMode }
      if ($body.PSObject.Properties['accessToken'] -and $null -ne $body.accessToken) {
        $tok = [string]$body.accessToken
        if (-not [string]::IsNullOrWhiteSpace($tok)) {
          $cfg.accessToken = $tok.Trim()
          $cfg.authMode = 'token'
          $cfg.authStatus = 'ready'
          $cfg.lastError = ''
          if ($body.PSObject.Properties['tokenExpiresAt'] -and $body.tokenExpiresAt) {
            $cfg.tokenExpiresAt = [string]$body.tokenExpiresAt
          } elseif (-not $cfg.tokenExpiresAt) {
            $cfg.tokenExpiresAt = (Get-Date).ToUniversalTime().AddHours(1).ToString('o')
          }
        }
      }
      if ($body.PSObject.Properties['clearToken'] -and $body.clearToken) {
        $cfg.accessToken = ''
        $cfg.refreshToken = ''
        $cfg.tokenExpiresAt = ''
        $cfg.deviceCode = ''
        $cfg.userCode = ''
        $cfg.verificationUrl = ''
      }
      Save-CrmConfig $cfg
      Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'User'; action = 'crm.config.save'; orgUrl = [string]$cfg.orgUrl; hasToken = (-not [string]::IsNullOrWhiteSpace([string]$cfg.accessToken)) }
      Write-Json $res (Get-CrmPublicConfig $cfg)
      continue
    }

    if ($path -eq '/api/crm/whoami' -and $req.HttpMethod -eq 'GET') {
      $result = Invoke-CrmWhoAmI
      $code = 200
      if (-not $result.ok) {
        if ($result.error -eq 'pending_auth') { $code = 401 }
        elseif ($result.error -eq 'orgUrl_required') { $code = 400 }
        else { $code = 502 }
      }
      Write-Json $res $result $code
      continue
    }

    if ($path -eq '/api/crm/status' -and $req.HttpMethod -eq 'GET') {
      Write-Json $res (Get-CrmStatus)
      continue
    }
    if ($path -eq '/api/crm/preview' -and $req.HttpMethod -eq 'GET') {
      $entQ = [string]$req.QueryString['entities']
      $ents = @()
      if ($entQ) { $ents = @($entQ.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
      $result = Get-CrmPreview $ents
      $code = 200
      if (-not $result.ok) {
        if ($result.error -eq 'pending_auth') { $code = 401 }
        elseif ($result.error -eq 'orgUrl_required') { $code = 400 }
        else { $code = 502 }
      }
      Write-Json $res $result $code
      continue
    }
    if ($path -eq '/api/crm/sync' -and $req.HttpMethod -eq 'POST') {
      $raw = Read-Body $req
      $ents = @()
      if ($raw) {
        try {
          $body = $raw | ConvertFrom-Json
          if ($body.entities) { $ents = @($body.entities | ForEach-Object { [string]$_ }) }
        } catch {}
      }
      $result = Sync-CrmToTasks $ents
      $code = 200
      if (-not $result.ok) {
        if ($result.error -eq 'pending_auth') { $code = 401 }
        elseif ($result.error -eq 'orgUrl_required') { $code = 400 }
        else { $code = 502 }
      }
      Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'User'; action = 'crm.sync'; ok = $result.ok; added = $result.added; updated = $result.updated }
      Write-Json $res $result $code
      continue
    }
    if ($path -eq '/api/crm/auth/token' -and $req.HttpMethod -eq 'POST') {
      $body = (Read-Body $req) | ConvertFrom-Json
      $tok = [string]$body.accessToken
      if ([string]::IsNullOrWhiteSpace($tok)) { Write-Json $res @{ ok = $false; error = 'accessToken_required' } 400; continue }
      $cfg = Load-CrmConfig
      $cfg.accessToken = $tok.Trim()
      $cfg.authMode = 'token'
      $cfg.authStatus = 'ready'
      $cfg.lastError = ''
      if ($body.tokenExpiresAt) { $cfg.tokenExpiresAt = [string]$body.tokenExpiresAt }
      else { $cfg.tokenExpiresAt = (Get-Date).ToUniversalTime().AddHours(1).ToString('o') }
      Save-CrmConfig $cfg
      Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'User'; action = 'crm.auth.token' }
      Write-Json $res (Get-CrmPublicConfig $cfg)
      continue
    }
    if ($path -eq '/api/crm/auth/device/start' -and $req.HttpMethod -eq 'POST') {
      $cfg = Load-CrmConfig
      $raw = Read-Body $req
      if ($raw) {
        try {
          $body = $raw | ConvertFrom-Json
          if ($body.orgUrl) { $cfg.orgUrl = (Normalize-CrmOrgUrl ([string]$body.orgUrl)) }
          if ($body.clientId) { $cfg.clientId = ([string]$body.clientId).Trim() }
          if ($body.tenantId) { $cfg.tenantId = [string]$body.tenantId }
          Save-CrmConfig $cfg
        } catch {}
      }
      $result = Start-CrmDeviceCodeFlow (Load-CrmConfig)
      $code = 200
      if (-not $result.ok) { $code = 400 }
      Write-Json $res $result $code
      continue
    }
    if ($path -eq '/api/crm/auth/device/poll' -and $req.HttpMethod -eq 'POST') {
      $result = Poll-CrmDeviceCodeFlow (Load-CrmConfig)
      $code = 200
      if (-not $result.ok -and -not $result.pending) { $code = 400 }
      Write-Json $res $result $code
      continue
    }
    if ($path -eq '/api/crm/auth/clear' -and $req.HttpMethod -eq 'POST') {
      $cfg = Load-CrmConfig
      $cfg.accessToken = ''
      $cfg.refreshToken = ''
      $cfg.tokenExpiresAt = ''
      $cfg.deviceCode = ''
      $cfg.userCode = ''
      $cfg.verificationUrl = ''
      $cfg.deviceCodeExpiresAt = ''
      $cfg.lastError = ''
      $cfg.authStatus = 'pending_auth'
      Save-CrmConfig $cfg
      Write-Audit @{ at = (Get-Date).ToUniversalTime().ToString('o'); actor = 'User'; action = 'crm.auth.clear' }
      Write-Json $res (Get-CrmPublicConfig $cfg)
      continue
    }



    if ($path -eq '/api/crm/mawjan/summary' -and $req.HttpMethod -eq 'GET') {
      $result = Get-MawjanCrmSummary
      $code = 200
      if (-not $result.ok) {
        if ($result.error -eq 'pending_auth') { $code = 401 }
        else { $code = 502 }
      }
      Write-Json $res $result $code
      continue
    }
    if ($path -eq '/api/crm/mawjan/units' -and $req.HttpMethod -eq 'GET') {
      $st = [string]$req.QueryString['status']
      if ($st) { $st = $st.Trim().ToLowerInvariant() }
      $result = Get-MawjanCrmUnits $st
      $code = 200
      if (-not $result.ok) {
        if ($result.error -eq 'pending_auth') { $code = 401 }
        else { $code = 502 }
      }
      Write-Json $res $result $code
      continue
    }

    if ($path -eq '/api/crm/units' -and $req.HttpMethod -eq 'GET') {
      $proj = [string]$req.QueryString['project']
      if (-not $proj) { $proj = 'Mawjan' }
      $st = [string]$req.QueryString['status']
      if ($st) { $st = $st.Trim().ToLowerInvariant() } else { $st = 'all' }
      $force = $false
      $rf = [string]$req.QueryString['refresh']
      if ($rf -and ($rf.Trim().ToLowerInvariant() -in @('1','true','yes','force'))) { $force = $true }
      $result = Get-CrmUnitsListCached -project $proj -statusFilter $st -forceRefresh $force
      $code = 200
      if (-not $result.ok) {
        if ($result.error -eq 'pending_auth') { $code = 401 }
        else { $code = 502 }
      }
      Write-Json $res $result $code
      continue
    }

    if ($path -eq '/api/crm/sales' -and $req.HttpMethod -eq 'GET') {
      $proj = [string]$req.QueryString['project']
      if (-not $proj) { $proj = 'Mawjan' }
      $force = $false
      $rf = [string]$req.QueryString['refresh']
      if ($rf -and ($rf.Trim().ToLowerInvariant() -in @('1','true','yes','force'))) { $force = $true }
      $result = Get-CrmSalesListCached -project $proj -forceRefresh $force
      $code = 200
      if (-not $result.ok) {
        if ($result.error -eq 'pending_auth') { $code = 401 }
        else { $code = 502 }
      }
      Write-Json $res $result $code
      continue
    }

    if ($path -eq '/api/crm/people' -and $req.HttpMethod -eq 'GET') {
      $force = $false
      $rf = [string]$req.QueryString['refresh']
      if ($rf -and ($rf.Trim().ToLowerInvariant() -in @('1','true','yes','force'))) { $force = $true }
      $result = Get-CrmPeopleListCached -forceRefresh $force
      $code = 200
      if (-not $result.ok) {
        if ($result.error -eq 'pending_auth') { $code = 401 }
        else { $code = 502 }
      }
      Write-Json $res $result $code
      continue
    }

$rel = $path.TrimStart('/').Replace('/','\')
    if ($rel.Contains('..')) { Write-Text $res 400 'text/plain' 'bad path'; continue }
    $full = [IO.Path]::GetFullPath((Join-Path $Root $rel))
    if (-not $full.StartsWith([IO.Path]::GetFullPath($Root))) { Write-Text $res 403 'text/plain' 'forbidden'; continue }
    if (-not (Test-Path $full -PathType Leaf)) { Write-Text $res 404 'text/plain' 'not found'; continue }
    Write-FileResp $res $full
  } catch {
    $msg = $_.Exception.Message
    try {
      if ($res -and -not $res.OutputStream.CanWrite) { }
      Write-Json $res @{ ok = $false; error = $msg } 500
    } catch {
      try { $res.Abort() } catch {}
    }
  }
}
