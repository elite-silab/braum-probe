function shellLiteral(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

export function createLinuxManageScript(releaseBaseUrl: string): string {
  return `#!/usr/bin/env bash
set -uo pipefail

SERVICE_NAME="braum-agent"
AGENT_BIN="/usr/local/bin/braum-agent"
MANAGER_BIN="/usr/local/bin/braum-agentctl"
CONFIG_FILE="/etc/braum-agent/config.json"
SERVICE_FILE="/etc/systemd/system/braum-agent.service"
RELEASE_BASE=${shellLiteral(releaseBaseUrl.replace(/\/$/, ''))}

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 sudo 运行：sudo braum-agentctl" >&2
  exit 1
fi

download_url() {
  local url="$1"
  local output="$2"
  if [[ "$url" == https://* ]]; then
    curl --proto '=https' --tlsv1.2 -fsSL "$url" -o "$output"
    return
  fi
  if [[ "$url" =~ ^http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?(/|$) ]]; then
    curl --proto '=http' -fsSL "$url" -o "$output"
    return
  fi
  echo "拒绝不安全的下载地址：$url" >&2
  return 1
}

config_server() {
  sed -n 's/^[[:space:]]*"server"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' "$CONFIG_FILE" | sed -n '1p'
}

config_node_id() {
  sed -n 's/^[[:space:]]*"node_id"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' "$CONFIG_FILE" | sed -n '1p'
}

config_interval() {
  sed -n 's/^[[:space:]]*"interval"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' "$CONFIG_FILE" | sed -n '1p'
}

install_manager() {
  local server manager_url work_dir
  if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "未找到 $CONFIG_FILE，请先从管理后台安装 Agent。" >&2
    return 1
  fi
  server="$(config_server)"
  if [[ -z "$server" ]]; then
    echo "配置文件中缺少 Worker 地址，无法安装管理脚本。" >&2
    return 1
  fi
  manager_url="$server/api/agent/v1/manage.sh"
  work_dir="$(mktemp -d)" || return 1
  echo "正在下载最新版管理脚本……"
  if ! download_url "$manager_url" "$work_dir/braum-agentctl"; then
    rm -rf "$work_dir"
    return 1
  fi
  if ! bash -n "$work_dir/braum-agentctl"; then
    echo "管理脚本语法校验失败，已取消安装。" >&2
    rm -rf "$work_dir"
    return 1
  fi
  if ! install -m 0755 "$work_dir/braum-agentctl" "$MANAGER_BIN"; then
    echo "管理脚本安装失败。" >&2
    rm -rf "$work_dir"
    return 1
  fi
  rm -rf "$work_dir"
  echo "管理脚本已安装：sudo braum-agentctl"
}

pause_menu() {
  printf '\n按回车键返回菜单……'
  read -r _ || true
}

show_status() {
  printf '\n=== Braum Agent 服务状态 ===\n'
  systemctl status "$SERVICE_NAME" --no-pager || true
}

show_recent_logs() {
  printf '\n=== 最近 100 条日志 ===\n'
  journalctl -u "$SERVICE_NAME" -n 100 --no-pager || true
}

show_summary() {
  local server node_id interval permissions
  printf '\n=== 版本与安全配置 ===\n'
  if [[ -x "$AGENT_BIN" ]]; then
    "$AGENT_BIN" --version || true
  else
    echo "Agent 程序：未安装"
  fi

  if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "配置文件：不存在"
    return
  fi

  server="$(config_server)"
  node_id="$(config_node_id)"
  interval="$(config_interval)"
  permissions="$(stat -c '%a %U:%G' "$CONFIG_FILE" 2>/dev/null || echo '未知')"
  [[ -n "$server" ]] || server="未配置"
  [[ -n "$node_id" ]] || node_id="未配置"
  [[ -n "$interval" ]] || interval="60"
  echo "Worker 地址：$server"
  echo "节点 ID：$node_id"
  echo "采集间隔：$interval 秒"
  echo "配置权限：$permissions"
  if grep -Eq '"(agent_secret|enrollment_token)"[[:space:]]*:' "$CONFIG_FILE"; then
    echo "凭据状态：已配置（内容已隐藏）"
  else
    echo "凭据状态：未配置"
  fi
  systemctl show "$SERVICE_NAME" --no-pager \
    --property=User --property=Group --property=NoNewPrivileges \
    --property=ProtectSystem --property=ProtectHome 2>/dev/null || true
}

service_action() {
  local action="$1"
  local label="$2"
  if systemctl "$action" "$SERVICE_NAME"; then
    printf '%s成功。\n' "$label"
  else
    printf '%s失败，请查看服务状态或日志。\n' "$label" >&2
  fi
}

update_agent() {
  local arch artifact work_dir old_version new_version new_binary backup
  for command in curl sha256sum install systemctl uname mktemp cp mv rm bash; do
    if ! command -v "$command" >/dev/null 2>&1; then
      echo "缺少必要命令：$command" >&2
      return 1
    fi
  done
  if [[ ! -f "$CONFIG_FILE" || ! -f "$SERVICE_FILE" ]]; then
    echo "Agent 安装不完整，请在后台重新生成安装命令。" >&2
    return 1
  fi

  case "$(uname -m)" in
    x86_64|amd64) arch="amd64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) echo "暂不支持此架构：$(uname -m)" >&2; return 1 ;;
  esac

  artifact="braum-agent_linux_$arch"
  work_dir="$(mktemp -d)" || return 1
  echo "正在下载 linux/$arch 最新版本……"
  if ! download_url "$RELEASE_BASE/$artifact" "$work_dir/$artifact" \
    || ! download_url "$RELEASE_BASE/$artifact.sha256" "$work_dir/$artifact.sha256"; then
    echo "下载失败，现有 Agent 未被修改。" >&2
    rm -rf "$work_dir"
    return 1
  fi
  if ! (cd "$work_dir" && sha256sum -c "$artifact.sha256"); then
    echo "SHA-256 校验失败，已取消更新。" >&2
    rm -rf "$work_dir"
    return 1
  fi

  old_version="$($AGENT_BIN --version 2>/dev/null || echo '未知版本')"
  new_version="$($work_dir/$artifact --version 2>/dev/null || echo '未知版本')"
  new_binary="/usr/local/bin/.braum-agent.new.$$"
  backup="/usr/local/bin/.braum-agent.backup.$$"
  rm -f "$new_binary" "$backup"
  if ! install -m 0755 "$work_dir/$artifact" "$new_binary"; then
    echo "准备新版本失败，现有 Agent 未被修改。" >&2
    rm -rf "$work_dir"
    return 1
  fi
  if [[ -e "$AGENT_BIN" ]]; then
    if ! cp -p "$AGENT_BIN" "$backup"; then
      echo "备份现有 Agent 失败，已取消更新。" >&2
      rm -f "$new_binary"
      rm -rf "$work_dir"
      return 1
    fi
  fi
  if ! mv -f "$new_binary" "$AGENT_BIN"; then
    echo "替换 Agent 程序失败。" >&2
    rm -f "$new_binary" "$backup"
    rm -rf "$work_dir"
    return 1
  fi

  if systemctl restart "$SERVICE_NAME" && systemctl is-active --quiet braum-agent; then
    rm -f "$backup"
    rm -rf "$work_dir"
    echo "Agent 更新成功：$old_version → $new_version"
    echo "节点配置与密钥均已保留。"
    if ! install_manager; then
      echo "Agent 已更新，但管理脚本刷新失败；可稍后重试。" >&2
    fi
    return 0
  fi

  echo "新版本启动失败，正在回滚……" >&2
  if [[ -f "$backup" ]]; then
    mv -f "$backup" "$AGENT_BIN"
    systemctl restart "$SERVICE_NAME" || true
  fi
  rm -f "$new_binary" "$backup"
  rm -rf "$work_dir"
  echo "更新失败，已恢复原 Agent。" >&2
  return 1
}

uninstall_agent() {
  local confirmation
  printf '\n此操作会停止 Agent，并删除程序、配置和节点密钥。\n'
  printf '后台中的节点和历史数据不会被删除。\n'
  if ! read -r -p '输入 YES 确认卸载：' confirmation; then
    echo "已取消卸载。"
    return
  fi
  if [[ "$confirmation" != "YES" ]]; then
    echo "已取消卸载。"
    return
  fi

  systemctl disable --now "$SERVICE_NAME" >/dev/null 2>&1 || true
  rm -f "$SERVICE_FILE" "$AGENT_BIN"
  rm -rf /etc/braum-agent
  systemctl daemon-reload
  if id braum-agent >/dev/null 2>&1 && command -v userdel >/dev/null 2>&1; then
    userdel braum-agent || true
  fi
  rm -f "$MANAGER_BIN"
  echo "Braum Agent 已从这台 VPS 卸载。"
  echo "如不再使用该节点，请回到管理后台吊销凭据或删除节点。"
  exit 0
}

print_menu() {
  local status
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    status="运行中"
  elif systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    status="已停止"
  else
    status="未安装或未启用"
  fi
  printf '\n=================================\n'
  printf '       Braum Agent 管理菜单\n'
  printf '=================================\n'
  printf '当前状态：%s\n\n' "$status"
  printf '1. 查看服务状态\n'
  printf '2. 查看实时日志\n'
  printf '3. 查看最近日志\n'
  printf '4. 查看版本与安全配置\n'
  printf '5. 启动 Agent\n'
  printf '6. 重启 Agent\n'
  printf '7. 停止 Agent\n'
  printf '8. 在线更新 Agent\n'
  printf '9. 卸载 Agent\n'
  printf '0. 退出\n'
}

if [[ "\${1:-}" == "--install" || ! -t 0 ]]; then
  install_manager
  exit $?
fi

while true; do
  print_menu
  if ! read -r -p '请选择 [0-9]：' choice; then
    printf '\n'
    exit 0
  fi
  case "$choice" in
    1) show_status; pause_menu ;;
    2) echo "按 Ctrl+C 结束实时日志并返回菜单。"; journalctl -u "$SERVICE_NAME" -f || true; pause_menu ;;
    3) show_recent_logs; pause_menu ;;
    4) show_summary; pause_menu ;;
    5) service_action start "启动"; pause_menu ;;
    6) service_action restart "重启"; pause_menu ;;
    7) service_action stop "停止"; pause_menu ;;
    8) update_agent || true; pause_menu ;;
    9) uninstall_agent; pause_menu ;;
    0) echo "已退出。"; exit 0 ;;
    *) echo "无效选项，请输入 0 到 9。" ;;
  esac
done
`
}

export function createLinuxInstallScript(releaseBaseUrl: string): string {
  return `#!/usr/bin/env bash
set -Eeuo pipefail

SERVER=""
NODE_ID=""
ENROLLMENT_TOKEN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server) SERVER="\${2:-}"; shift 2 ;;
    --node) NODE_ID="\${2:-}"; shift 2 ;;
    --token) ENROLLMENT_TOKEN="\${2:-}"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run the installer as root (use sudo)." >&2
  exit 1
fi
if [[ -z "$SERVER" || -z "$NODE_ID" || -z "$ENROLLMENT_TOKEN" ]]; then
  echo "Missing --server, --node or --token." >&2
  exit 2
fi
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Braum Agent currently supports Linux only." >&2
  exit 1
fi

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

RELEASE_BASE=${shellLiteral(releaseBaseUrl.replace(/\/$/, ''))}
ARTIFACT="braum-agent_linux_\${ARCH}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "Downloading Braum Agent for linux/\${ARCH}..."
curl --proto '=https' --tlsv1.2 -fsSL "$RELEASE_BASE/$ARTIFACT" -o "$WORK_DIR/$ARTIFACT"
curl --proto '=https' --tlsv1.2 -fsSL "$RELEASE_BASE/$ARTIFACT.sha256" -o "$WORK_DIR/$ARTIFACT.sha256"
(
  cd "$WORK_DIR"
  sha256sum -c "$ARTIFACT.sha256"
)

MANAGER_URL="\${SERVER%/}/api/agent/v1/manage.sh"
if [[ "$MANAGER_URL" == https://* ]]; then
  curl --proto '=https' --tlsv1.2 -fsSL "$MANAGER_URL" -o "$WORK_DIR/braum-agentctl"
elif [[ "$MANAGER_URL" =~ ^http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?(/|$) ]]; then
  curl --proto '=http' -fsSL "$MANAGER_URL" -o "$WORK_DIR/braum-agentctl"
else
  echo "Refusing insecure Agent manager URL: $MANAGER_URL" >&2
  exit 1
fi
bash -n "$WORK_DIR/braum-agentctl"

if ! id braum-agent >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin braum-agent
fi

install -m 0755 "$WORK_DIR/$ARTIFACT" /usr/local/bin/braum-agent
install -m 0755 "$WORK_DIR/braum-agentctl" /usr/local/bin/braum-agentctl
install -d -m 0700 -o braum-agent -g braum-agent /etc/braum-agent
/usr/local/bin/braum-agent \
  --init-config \
  --config /etc/braum-agent/config.json \
  --server "$SERVER" \
  --node "$NODE_ID" \
  --token "$ENROLLMENT_TOKEN"
chown braum-agent:braum-agent /etc/braum-agent/config.json
chmod 0600 /etc/braum-agent/config.json
unset ENROLLMENT_TOKEN

cat >/etc/systemd/system/braum-agent.service <<'UNIT'
[Unit]
Description=Braum VPS Monitoring Agent
Documentation=https://github.com/elite-silab/braum-probe
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=braum-agent
Group=braum-agent
ExecStart=/usr/local/bin/braum-agent --config /etc/braum-agent/config.json
Restart=on-failure
RestartSec=10s
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
LockPersonality=true
RestrictSUIDSGID=true
RestrictNamespaces=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
ReadWritePaths=/etc/braum-agent

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable braum-agent
systemctl restart braum-agent
echo "Braum Agent installed and started. Manage it with: sudo braum-agentctl"
`
}
