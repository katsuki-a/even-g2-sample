import test from 'node:test'
import assert from 'node:assert/strict'
import { EventSourceType, OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import { normalizeEvenInput } from './even-input.ts'

test('G2とR1のイベントを同じ論理入力へ正規化する', () => {
  const g2Down: EvenHubEvent = {
    textEvent: {
      eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT,
    },
    sysEvent: {
      eventSource: EventSourceType.TOUCH_EVENT_FROM_GLASSES_R,
    },
  }
  const r1Down: EvenHubEvent = {
    listEvent: {
      eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT,
    },
    sysEvent: {
      eventSource: EventSourceType.TOUCH_EVENT_FROM_RING,
    },
  }
  assert.deepEqual(normalizeEvenInput(g2Down), { input: 'down', source: 'g2' })
  assert.deepEqual(normalizeEvenInput(r1Down), { input: 'down', source: 'r1' })
})

test('simulatorでenum 0が欠落するクリックpayloadを決定へ補正する', () => {
  const event: EvenHubEvent = {
    jsonData: { eventSource: 1 },
    sysEvent: { eventSource: EventSourceType.TOUCH_EVENT_FROM_GLASSES_R },
  }
  assert.deepEqual(normalizeEvenInput(event), { input: 'confirm', source: 'g2' })
})

test('simulatorでeventTypeが欠落するリスト移動は絶対indexとして扱う', () => {
  const event: EvenHubEvent = {
    jsonData: { containerID: 3, currentSelectItemIndex: 2 },
    listEvent: { containerID: 3, currentSelectItemIndex: 2 },
  }
  assert.deepEqual(normalizeEvenInput(event), { selectionIndex: 2, source: 'simulator' })
})
