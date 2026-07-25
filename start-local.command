#!/bin/zsh

cd -- "$(dirname -- "$0")" || exit 1

pause_on_error() {
  echo
  echo "启动没有完成，请把上面的错误信息截图后反馈。"
  read -r "?按回车键关闭窗口……"
  exit 1
}

if [[ ! -f .env ]]; then
  cp .env.example .env || pause_on_error
  echo "已为你创建 .env 配置文件。"
  echo "请先填写并保存它，然后再次双击 start-local.command。"
  open -t .env >/dev/null 2>&1 || true
  read -r "?按回车键关闭窗口……"
  exit 0
fi

command -v node >/dev/null 2>&1 || {
  echo "没有找到 Node.js，请先安装 Node.js 22 或更新版本。"
  pause_on_error
}

command -v pnpm >/dev/null 2>&1 || {
  echo "没有找到 pnpm，请先按《小白部署指南》的说明安装 pnpm。"
  pause_on_error
}

echo "正在准备依赖……"
pnpm install || pause_on_error

echo "正在准备本地数据库……"
CI=1 pnpm db:migrate || pause_on_error

echo
echo "Braum 即将启动："
echo "  展示页：http://localhost:4321"
echo "  管理后台：http://localhost:4321/admin"
echo "关闭本窗口即可停止本地服务。"
echo
pnpm dev || pause_on_error
