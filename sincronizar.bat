@echo off
echo ============================================================
echo   Iniciando sincronizacao local de dados do SISREG
echo ============================================================
echo.
cd /d "%~dp0"
npx tsx scripts/sync_sisreg.ts
echo.
echo ============================================================
echo   Sincronizacao finalizada!
echo ============================================================
pause
