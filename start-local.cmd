@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist .env (
  copy .env.example .env >nul
  echo 已为你创建 .env 配置文件。
  echo 请先填写并保存它，然后再次双击 start-local.cmd。
  start "" notepad .env
  pause
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo 没有找到 Node.js，请先安装 Node.js 22 或更新版本。
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo 没有找到 pnpm，请先按《小白部署指南》的说明安装 pnpm。
  pause
  exit /b 1
)

echo 正在准备依赖……
call pnpm install
if errorlevel 1 goto error

echo 正在准备本地数据库……
set CI=1
call pnpm db:migrate
if errorlevel 1 goto error
set CI=

echo.
echo Braum 即将启动：
echo   展示页：http://localhost:4321
echo   管理后台：http://localhost:4321/admin
echo 关闭本窗口即可停止本地服务。
echo.
call pnpm dev
if errorlevel 1 goto error
exit /b 0

:error
echo.
echo 启动没有完成，请把上面的错误信息截图后反馈。
pause
exit /b 1
