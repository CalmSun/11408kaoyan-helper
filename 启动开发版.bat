@echo off
chcp 65001 >nul
echo ========================================
echo       考研助手 - 启动脚本
echo ========================================
echo.

if not exist node_modules (
    echo 正在安装依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo 依赖安装失败！
        pause
        exit /b 1
    )
)

echo 正在启动考研助手...
echo.
call npm run electron:dev

pause
