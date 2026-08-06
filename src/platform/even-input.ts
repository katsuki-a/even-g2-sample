import { EventSourceType, OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import type { LogicalInput } from '../app/controller.ts'

export type NormalizedInput = {
  input?: LogicalInput
  selectionIndex?: number
  source: 'g2' | 'r1' | 'simulator'
}

function sourceOf(event: EvenHubEvent): NormalizedInput['source'] {
  const source = event.sysEvent?.eventSource ?? EventSourceType.fromJson(
    event.jsonData?.eventSource ?? event.jsonData?.EventSource,
  )
  if (source === EventSourceType.TOUCH_EVENT_FROM_RING) return 'r1'
  if (source === EventSourceType.TOUCH_EVENT_FROM_GLASSES_L ||
      source === EventSourceType.TOUCH_EVENT_FROM_GLASSES_R) return 'g2'
  return 'simulator'
}

export function normalizeEvenInput(event: EvenHubEvent): NormalizedInput | null {
  const containerEvent = event.listEvent ?? event.textEvent
  const eventType = containerEvent?.eventType ?? event.sysEvent?.eventType
  const source = sourceOf(event)
  if (event.listEvent?.currentSelectItemIndex !== undefined && eventType === undefined) {
    return { selectionIndex: event.listEvent.currentSelectItemIndex, source }
  }
  let input: LogicalInput | undefined
  if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) input = 'up'
  if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) input = 'down'
  if (eventType === OsEventTypeList.CLICK_EVENT || (containerEvent && eventType === undefined)) input = 'confirm'
  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) input = 'back'
  const sourceOnlySystemClick = !containerEvent &&
    eventType === undefined &&
    event.sysEvent?.eventSource !== undefined &&
    !event.sysEvent.imuData &&
    event.sysEvent.systemExitReasonCode === undefined &&
    Object.keys(event.jsonData ?? {}).every((key) => key.toLowerCase() === 'eventsource')
  if (sourceOnlySystemClick) input = 'confirm'
  return input ? { input, source } : null
}
