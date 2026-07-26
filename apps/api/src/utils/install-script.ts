function shellLiteral(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
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

if ! id braum-agent >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin braum-agent
fi

install -m 0755 "$WORK_DIR/$ARTIFACT" /usr/local/bin/braum-agent
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
echo "Braum Agent installed and started. Check status with: systemctl status braum-agent"
`
}
