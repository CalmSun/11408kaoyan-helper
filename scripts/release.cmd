@echo off
REM Release entry (Windows cmd). ASCII only: cmd decodes UTF-8 as GBK and garbles CJK.
REM Commit message / tag message are read from UTF-8 files via -F so they stay intact.
cd /d "%~dp0.."
set TAG=v3.6.6

echo [1/5] stage
git add -A
if errorlevel 1 goto fail

echo [2/5] commit
git commit -F .git-msg.txt
if errorlevel 1 goto fail

echo [3/5] delete remote tag %TAG%
git push origin :refs/tags/%TAG%

echo [4/5] create tag %TAG%
if exist .git-tag-ready.txt del /q .git-tag-ready.txt
git tag -d %TAG% >nul 2>&1
git tag -a %TAG% -F .git-msg.txt
if errorlevel 1 goto fail

echo [5/5] push main (fast-forward) and tag
git push origin main
if errorlevel 1 goto fail
git push origin %TAG%
if errorlevel 1 goto fail

echo [done] %TAG% released
exit /b 0

:fail
echo [FAILED] exit=%ERRORLEVEL%
exit /b 1
