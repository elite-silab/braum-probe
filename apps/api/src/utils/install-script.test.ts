import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createLinuxInstallScript } from './install-script'

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
    expect(script).not.toContain('set -x')
    expect(() => execFileSync('bash', ['-n'], { input: script })).not.toThrow()
  })
})
