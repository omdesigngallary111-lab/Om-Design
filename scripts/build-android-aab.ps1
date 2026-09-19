# Builds a signed Play Store AAB with JAVA_HOME pointed at Android Studio's JBR.
# Usage (from repo root): npm run cap:aab

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$jbrCandidates = @(
  # Prefer JDK 17/21 — Android Studio's bundled JBR may be Java 25 (unsupported by Gradle 8.14)
  'C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot',
  (Get-ChildItem 'C:\Program Files\Microsoft\jdk-21*' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName),
  (Get-ChildItem 'C:\Program Files\Eclipse Adoptium\jdk-21*' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName),
  $env:JAVA_HOME,
  'D:\Harsh\Android\Android Studio\jbr',
  "$env:LOCALAPPDATA\Programs\Android Studio\jbr",
  'C:\Program Files\Android\Android Studio\jbr'
)

$javaHome = $jbrCandidates | Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\java.exe')) } | Select-Object -First 1
if (-not $javaHome) {
  throw 'No JDK found. Install Android Studio or set JAVA_HOME to a JDK with bin\java.exe.'
}

$env:JAVA_HOME = $javaHome
$env:Path = "$(Join-Path $javaHome 'bin');$env:Path"

Write-Host "JAVA_HOME=$env:JAVA_HOME"
& "$javaHome\bin\java.exe" -version

if (-not (Test-Path 'android\key.properties')) {
  throw 'Missing android\key.properties. Run: .\scripts\create-android-keystore.ps1'
}

npm run cap:build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location (Join-Path $repoRoot 'android')
.\gradlew.bat bundleRelease
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$aab = Join-Path $repoRoot 'android\app\build\outputs\bundle\release\app-release.aab'
Write-Host ''
Write-Host "AAB ready: $aab"
