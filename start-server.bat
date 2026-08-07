@echo off
cd /d "C:\Users\hp\Desktop\مجلد جديد"
start /B node server.js
echo Server started on PID: %ERRORLEVEL%
