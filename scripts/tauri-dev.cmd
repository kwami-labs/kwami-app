@echo off
rem Arranca la app de escritorio (Tauri) en modo dev sin depender del PATH de la terminal.
rem Si ya hay un Vite escuchando en :5173 lo reutiliza en vez de fallar por puerto ocupado.
rem La API local (:8080) la levanta en su propia ventana si no responde: sin ella la app abre
rem pero sin creditos, voces ni canales. Esa ventana sigue viva y se reutiliza al volver a lanzar.
setlocal
cd /d "%~dp0.."
set "PATH=%USERPROFILE%\.cargo\bin;%USERPROFILE%\.local\bin;%APPDATA%\npm;%PATH%"

rem Con la ventana abierta cargo no puede reescribir app.exe y falla con "Acceso denegado".
powershell -NoProfile -Command "if (Get-Process app -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '%CD%\src-tauri\target*' }) { exit 1 }"
if %errorlevel%==1 (
  echo KWAMI ya esta abierta. Cierra su ventana y vuelve a lanzar este script.
  exit /b 1
)

curl -fs -m 2 -o nul http://localhost:8080/health
if %errorlevel%==0 (
  echo API ya esta en :8080, la reutilizo.
) else if exist "..\api\pyproject.toml" (
  echo Arrancando la API local en :8080...
  start "kwami-api" /min cmd /k uv run --directory ..\api python -X utf8 -m src.main
  call :wait_api
) else (
  echo Aviso: no hay API en :8080 ni carpeta ..\api. La app abrira sin creditos, voces ni canales.
)

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
  curl -fs -m 2 -o nul http://localhost:8080/health && exit /b 0
  ping -n 2 127.0.0.1 >nul
)
echo Aviso: la API no responde tras esperar. Mira el error en su ventana "kwami-api".
exit /b 1
