@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "ENV_FILE=%SCRIPT_DIR%.env"

if not exist "%ENV_FILE%" (
  echo .env file not found at "%ENV_FILE%"
  exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$route=Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric,ifMetric | Select-Object -First 1; if($route){$ip=Get-NetIPAddress -InterfaceIndex $route.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '169.254*' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1 -ExpandProperty IPAddress}; if(-not $ip){$ip=Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '169.254*' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1 -ExpandProperty IPAddress}; if($ip){$ip}"`) do set "LOCAL_IP=%%I"

if not defined LOCAL_IP (
  echo Could not detect a local IPv4 address.
  exit /b 1
)

set "NEW_URL=EXPO_PUBLIC_API_URL=http://%LOCAL_IP%:4000"

powershell -NoProfile -Command "$envFile='%ENV_FILE%'; $newLine='%NEW_URL%'; $lines=Get-Content -Path $envFile -ErrorAction Stop; if(($lines | Where-Object { $_ -match '^EXPO_PUBLIC_API_URL=' }).Count -gt 0){ $lines=$lines | ForEach-Object { if($_ -match '^EXPO_PUBLIC_API_URL='){ $newLine } else { $_ } } } else { $lines=@($newLine) + $lines }; Set-Content -Path $envFile -Value $lines -Encoding UTF8"
if errorlevel 1 (
  echo Failed to update EXPO_PUBLIC_API_URL in .env
  exit /b 1
)

echo Updated EXPO_PUBLIC_API_URL to http://%LOCAL_IP%:4000
exit /b 0
