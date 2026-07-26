import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createLinuxInstallScript, createLinuxManageScript } from './install-script'

describe('Linux Agent installer', () => {
  it('校验下载摘要并以受限 systemd 用户运行', () => {
    const script = createLinuxInstallScript('https://downloads.example.com/releases')
    expect(script).toContain("curl --proto '=https' --tlsv1.2")
    expect(script).toContain('sha256sum -c')
    expect(script).toContain('User=braum-agent')
    expect(script).toContain('NoNewPrivileges=true')
    expect(script).toContain('ProtectSystem=strict')
    expect(script).toContain('chmod 0600 /etc/braum-agent/config.json')
    expect(script).toContain('systemctl enable braum-agent')
    expect(script).toContain('systemctl restart braum-agent')
    expect(script).toContain('/api/agent/v1/manage.sh')
    expect(script).toContain('install -m 0755 "$WORK_DIR/braum-agentctl" /usr/local/bin/braum-agentctl')
    expect(script).not.toContain('set -x')
    expect(() => execFileSync('bash', ['-n'], { input: script })).not.toThrow()
  })
})

describe('Linux Agent 数字菜单管理脚本', () => {
  it('提供完整生命周期操作并安全执行在线更新', () => {
    const script = createLinuxManageScript('https://downloads.example.com/releases')

    expect(script).toContain('Braum Agent 管理菜单')
    expect(script).toContain('当前状态：%s')
    expect(script).toContain('1. 查看服务状态')
    expect(script).toContain('4. 查看版本与安全配置')
    expect(script).toContain('8. 在线更新 Agent')
    expect(script).toContain('9. 卸载 Agent')
    expect(script).toContain("curl --proto '=https' --tlsv1.2")
    expect(script).toContain('sha256sum -c')
    expect(script).toContain('systemctl is-active --quiet braum-agent')
    expect(script).toContain('/api/agent/v1/manage.sh')
    expect(script).toContain('输入 YES 确认卸载')
    expect(script).toContain('凭据状态：已配置（内容已隐藏）')
    expect(script).not.toContain('AGENT_SECRET=')
    expect(script).not.toContain('set -x')
    expect(() => execFileSync('bash', ['-n'], { input: script })).not.toThrow()
  })

  it('安全转义发布地址，避免生成可执行的额外 Shell 片段', () => {
    const script = createLinuxManageScript("https://downloads.example.com/a'b")

    expect(script).toContain("RELEASE_BASE='https://downloads.example.com/a'\"'\"'b'")
    expect(() => execFileSync('bash', ['-n'], { input: script })).not.toThrow()
  })
})
