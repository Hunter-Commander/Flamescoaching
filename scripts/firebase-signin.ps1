$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$firebaseCli = Join-Path $projectRoot 'node_modules/firebase-tools/lib/bin/firebase.js'
& node $firebaseCli login --no-localhost
Write-Host 'Open the sign-in link above, verify the session ID, and approve access to your Firebase account.'
$authorizationCode = Read-Host 'Paste the resulting authorization code here (hidden)' -AsSecureString
$plainAuthorizationCode = [System.Net.NetworkCredential]::new('', $authorizationCode).Password
try { & node $firebaseCli login $plainAuthorizationCode }
finally { Remove-Variable plainAuthorizationCode, authorizationCode -ErrorAction SilentlyContinue }
