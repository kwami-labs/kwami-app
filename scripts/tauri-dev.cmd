@echo off
rem La unica forma de arrancar KWAMI en local: la app de escritorio (Tauri) contra la API de :8081.
rem Levanta lo que falte (API, agente local e hilo de trabajo si este equipo tiene ~\.jarvis) y
rem reutiliza lo que ya este abierto, tambien un Vite en :5173. No depende del PATH de la terminal.
setlocal
cd /d "%~dp0.."
set "PATH=%USERPROFILE%\.cargo\bin;%USERPROFILE%\.local\bin;%APPDATA%\npm;%PATH%"
set "JARVIS=%USERPROFILE%\.jarvis"

rem Con la ventana abierta cargo no puede reescribir app.exe y falla con "Acceso denegado".
powershell -NoProfile -Command "if (Get-Process app -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '%CD%\src-tauri\target*' }) { exit 1 }"
if %errorlevel%==1 (
  echo KWAMI ya esta abierta. Cierra su ventana y vuelve a lanzar este script.
  exit /b 1
)

curl -fs -m 2 -o nul http://localhost:8081/health
if %errorlevel%==0 (
  echo API ya esta en :8081, la reutilizo.
) else if exist "%JARVIS%\api-local.cmd" (
  echo Arrancando la API local en :8081...
  start "Jarvis API local" /min cmd /k "%JARVIS%\api-local.cmd"
) else if exist "..\api\pyproject.toml" (
  echo Arrancando la API local en :8081...
  start "kwami-api" /min cmd /k "set API_PORT=8081&& set PORT=8081&& uv run --directory ..\api python -X utf8 -m src.main"
) else (
  echo Aviso: no hay API en :8081 ni carpeta ..\api. La app abrira sin creditos, voces ni canales.
)

if exist "%JARVIS%\agent-local.cmd" (
  powershell -NoProfile -Command "if (Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*src.main dev*' }) { exit 0 } else { exit 1 }"
  if errorlevel 1 start "Jarvis agente local" /min cmd /k "%JARVIS%\agent-local.cmd"
)

if exist "%JARVIS%\worker-local.cmd" (
  powershell -NoProfile -Command "if (Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*src.brain.worker*' }) { exit 0 } else { exit 1 }"
  if errorlevel 1 start "Jarvis worker" /min cmd /k "%JARVIS%\worker-local.cmd"
)

call :wait_api

rem La app lee de Vite la direccion de la API: las llamadas van a la local y de ella al agente local.
set "VITE_API_URL=http://localhost:8081"
netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if %errorlevel%==0 (
  echo Vite ya esta en :5173, lo reutilizo.
  call bun run tauri dev --config "{\"build\":{\"beforeDevCommand\":\"\"}}"
) else (
  call bun run tauri dev
)
exit /b %errorlevel%

:wait_api
for /l %%i in (1,1,45) do (
  curl -fs -m 2 -o nul http://localhost:8081/health && exit /b 0
  ping -n 2 127.0.0.1 >nul
)
echo Aviso: la API no responde tras esperar. Mira el error en su ventana.
exit /b 1
