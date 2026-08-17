import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AdminSidebar from './AdminSidebar'

describe('AdminSidebar', () => {
  it('使用分组导航和完整的产品标识', () => {
    const html = renderToStaticMarkup(
      <AdminSidebar mobileOpen onMobileClose={() => undefined} />
    )

    expect(html).toContain('Braum Probe')
    expect(html).toContain('工作台')
    expect(html).toContain('监控中心')
    expect(html).toContain('运营与系统')
    expect(html).toContain('Cloudflare Workers')
    expect(html).not.toContain('收起侧栏')
    expect(html).not.toContain('展开侧栏')
  })
})
