$env:VAULT_PASSWORD = Read-Host "🔐 أدخل كلمة مرور الخزنة" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($env:VAULT_PASSWORD)
$env:VAULT_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
Write-Host "✅ جاري تشغيل المنصة..." -ForegroundColor Green
node server.js
