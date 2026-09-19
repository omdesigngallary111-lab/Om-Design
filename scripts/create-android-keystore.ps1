# Creates android/release.keystore + android/key.properties (both gitignored).
# Run once from the repo root. Back up both files somewhere safe — losing them
# means you cannot update the Play Store listing under the same app ID.
#
# Usage (PowerShell):
#   .\scripts\create-android-keystore.ps1

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot 'android'
$store = Join-Path $androidDir 'release.keystore'
$props = Join-Path $androidDir 'key.properties'

$keytoolCandidates = @(
  'D:\Harsh\Android\Android Studio\jbr\bin\keytool.exe',
  "$env:JAVA_HOME\bin\keytool.exe"
)
$keytool = $keytoolCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $keytool) {
  $found = Get-Command keytool -ErrorAction SilentlyContinue
  if ($found) { $keytool = $found.Source }
}
if (-not $keytool) {
  throw 'keytool not found. Open Android Studio once, or set JAVA_HOME to a JDK that includes keytool.'
}

if (Test-Path $store) {
  Write-Host "Keystore already exists: $store"
  Write-Host "Delete it only if you intentionally want a NEW app signing identity."
  exit 0
}

function New-Pass {
  $bytes = New-Object byte[] 18
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { '{0:x2}' -f $_ })
}

$storePass = New-Pass
$keyPass = $storePass
$alias = 'omdesign'

& $keytool -genkeypair -v `
  -keystore $store `
  -alias $alias `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -storepass $storePass `
  -keypass $keyPass `
  -dname 'CN=Om Design and Classes, OU=Mobile, O=Om Design and Classes, L=Surat, ST=Gujarat, C=IN'

@"
storePassword=$storePass
keyPassword=$keyPass
keyAlias=$alias
storeFile=release.keystore
"@ | Set-Content -Path $props -Encoding ASCII

Write-Host ''
Write-Host 'Created:'
Write-Host "  $store"
Write-Host "  $props"
Write-Host ''
Write-Host 'Release SHA-256 (add to public/.well-known/assetlinks.json after deploy):'
& $keytool -list -v -keystore $store -alias $alias -storepass $storePass -keypass $keyPass |
  Select-String -Pattern 'SHA256:'
Write-Host ''
Write-Host 'IMPORTANT: back up release.keystore + key.properties offline. Do not commit them.'
