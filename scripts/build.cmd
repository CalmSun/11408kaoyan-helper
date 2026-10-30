@echo off
REM Build entry (Windows cmd). ASCII only: cmd decodes UTF-8 as GBK and garbles CJK.
cd /d "%~dp0.."
echo [build] cwd=%CD%
echo [build] node=%~1
call npm run build
set EXITCODE=%ERRORLEVEL%
echo [build] exit=%EXITCODE%
exit /b %EXITCODE%
