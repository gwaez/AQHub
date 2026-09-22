$ErrorActionPreference = 'Stop'
$Root = 'C:\Users\AMahmoud\Documents\AqaarWorkBoard'
Set-Location $Root
Import-Module MSAL.PS -ErrorAction Stop

$clientId = '9cee029c-6210-4654-90bb-17e6e9d36617'
$tenantId = 'cd686870-f362-4a4a-9a97-23d4437aadb7'
$redirect = 'http://localhost'
$scope = 'https://aqaar.crm15.dynamics.com/.default'
$hint = 'Ahmed.Mahmoud@aqaar.com'

Write-Host 'Trying silent with LoginHint...'
$token = $null
try {
  $token = Get-MsalToken -ClientId $clientId -TenantId $tenantId -RedirectUri $redirect -Scopes $scope -LoginHint $hint -Silent -ErrorAction Stop
  Write-Host 'Silent OK'
} catch {
  Write-Host ('Silent failed: ' + $_.Exception.Message)
  Write-Host 'Opening interactive login (system browser)...'
  $token = Get-MsalToken -ClientId $clientId -TenantId $tenantId -RedirectUri $redirect -Scopes $scope -LoginHint $hint -Interactive -ErrorAction Stop
}

if (-not $token -or -not $token.AccessToken) { throw 'Empty token' }

# ExpiresOn is DateTimeOffset — never cast with [datetime]
$expiresUtc = $null
try {
  if ($token.ExpiresOn -is [DateTimeOffset]) {
    $expiresUtc = ([DateTimeOffset]$token.ExpiresOn).UtcDateTime
  } else {
    $expiresUtc = [DateTime]::SpecifyKind(([DateTime]$token.ExpiresOn), [DateTimeKind]::Utc)
  }
} catch {
  $expiresUtc = (Get-Date).ToUniversalTime().AddHours(1)
}
$expiresStr = $expiresUtc.ToString('o')

$cfgPath = Join-Path $Root 'data\crm-config.json'
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
$cfg.accessToken = [string]$token.AccessToken
$cfg.tokenExpiresAt = $expiresStr
$cfg.authStatus = 'ready'
$cfg.lastError = ''
$cfg.authMode = 'msal'
$cfg.clientId = $clientId
$cfg.tenantId = $tenantId
$cfg.redirectUri = $redirect

# Persist refresh token if MSAL returned one (field name varies by MSAL.PS version)
$rt = $null
try { if ($token.RefreshToken) { $rt = [string]$token.RefreshToken } } catch {}
if (-not $rt) {
  try {
    if ($token.PSObject.Properties['TokenCache'] -and $token.TokenCache) { }
  } catch {}
}
if ($rt) { $cfg.refreshToken = $rt }

$cfg | ConvertTo-Json -Depth 8 | Set-Content $cfgPath -Encoding UTF8
Write-Host ('Saved token expires=' + $cfg.tokenExpiresAt + ' len=' + $cfg.accessToken.Length)

$uri = 'https://aqaar.crm15.dynamics.com/api/data/v9.2/WhoAmI'
$r = Invoke-RestMethod -Uri $uri -Headers @{ Authorization = ('Bearer ' + $token.AccessToken); Accept='application/json' }
Write-Host ('WhoAmI OK UserId=' + $r.UserId)
Set-Content -Path (Join-Path $Root 'data\token-refresh-ok.txt') -Value ('ok ' + (Get-Date).ToUniversalTime().ToString('o')) -Encoding UTF8
Write-Host 'SUCCESS'
