import { describe, expect, it } from 'vitest'
import { REALTIME_MAX_MESSAGE_BYTES } from '@braum/shared'
import { messageByteLength, parseInternalEvent, readInternalEvent } from './protocol'

describe('realtime protocol validation', () => {
  it('接受明确列出的内部事件', () => {
    expect(parseInternalEvent({ type: 'metrics_updated', node_id: 'node-1' })).toEqual({
      type: 'metrics_updated',
      node_id: 'node-1',
    })
    expect(parseInternalEvent({ type: 'config_changed', node_id: 'node-1', reason: 'node_updated' })).toEqual({
      type: 'config_changed',
      node_id: 'node-1',
      reason: 'node_updated',
    })
  })

  it('拒绝未知事件、非法节点和缺失原因', () => {
    expect(parseInternalEvent({ type: 'shell', node_id: 'node-1' })).toBeNull()
    expect(parseInternalEvent({ type: 'metrics_updated', node_id: '../node' })).toBeNull()
    expect(parseInternalEvent({ type: 'config_changed', node_id: 'node-1' })).toBeNull()
  })

  it('按 UTF-8 字节数限制消息大小', async () => {
    expect(messageByteLength('布隆')).toBe(6)
    const request = new Request('https://internal/notify', {
      method: 'POST',
      body: 'x'.repeat(REALTIME_MAX_MESSAGE_BYTES + 1),
    })
    expect(await readInternalEvent(request)).toBeNull()
  })
})
