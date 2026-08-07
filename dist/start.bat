@echo off
echo.
echo 🔐 Matrix Pro - Protected Build
echo ====================================
echo.
if "%VAULT_PASSWORD%"=="" (
  echo ⚠️  يرجى تعيين VAULT_PASSWORD
  echo    مثال:
  echo    set VAULT_PASSWORD=your-password
  echo    start.bat
  echo.
  pause
  exit /b
)
echo ✅ جاري تشغيل المنصة...
node server.js
pause
