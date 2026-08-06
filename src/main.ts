import { EvenAppBridge, waitForEvenAppBridge, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import './styles.css'
import { CompositeRenderer, StoryController, type RendererPort } from './app/controller.ts'
import { episodeOne } from './content/load-story.ts'
import type { AttachmentNode } from './domain/story.ts'
import { RealClock } from './platform/clock.ts'
import { EvidenceSession } from './platform/evidence.ts'
import { normalizeEvenInput } from './platform/even-input.ts'
import { EvenRenderer } from './platform/even-renderer.ts'
import {
  BrowserProgressStore,
  EvenProgressStore,
  ResilientProgressStore,
  type ProgressStore,
} from './platform/storage.ts'
import { PhoneView } from './ui/phone.ts'

const attachmentUrls = import.meta.glob<string>('./assets/story/*.bmp', {
  eager: true,
  query: '?url',
  import: 'default',
})

function hasNativeBridge(): boolean {
  return 'flutter_inappwebview' in window
}

async function loadAttachment(node: AttachmentNode): Promise<number[]> {
  const assetKey = node.asset.replace('src/assets/story/', './assets/story/')
  const assetUrl = attachmentUrls[assetKey]
  if (!assetUrl) throw new Error(`未登録の添付画像です: ${node.asset}`)
  const response = await fetch(assetUrl)
  if (!response.ok) throw new Error(`添付画像を読み込めません: ${response.status}`)
  return Array.from(new Uint8Array(await response.arrayBuffer()))
}

async function boot(): Promise<void> {
  const phone = new PhoneView()
  const evidence = EvidenceSession.fromSearch(window.location.search)
  const browserStorage = new BrowserProgressStore(evidence?.storageKey)
  let renderer: RendererPort = phone
  let storage: ProgressStore = browserStorage
  let playerName = 'あなた'
  let batteryLevel: number | undefined
  let bridge: EvenAppBridge | undefined
  let unsubscribeHub: () => void = () => undefined
  let unsubscribeDevice: () => void = () => undefined

  if (hasNativeBridge()) {
    try {
      await waitForEvenAppBridge()
      bridge = EvenAppBridge.getInstance()
      const [user, device] = await Promise.all([bridge.getUserInfo(), bridge.getDeviceInfo()])
      playerName = user.name || 'あなた'
      batteryLevel = device?.status.batteryLevel
      const evenRenderer = new EvenRenderer(bridge)
      renderer = new CompositeRenderer([phone, evidence ? evidence.wrap(evenRenderer) : evenRenderer])
      storage = new ResilientProgressStore(
        new EvenProgressStore(bridge, evidence?.storageKey),
        browserStorage,
      )
      phone.setConnection('connected', 'G2 CONNECTED')
    } catch (error) {
      console.error(error)
      phone.setConnection('error', 'PHONE PREVIEW')
    }
  } else {
    phone.setConnection('preview', 'PHONE PREVIEW')
  }

  const controller = new StoryController({
    story: episodeOne,
    renderer,
    storage,
    clock: new RealClock(),
    attachments: { load: loadAttachment },
    playerName,
    batteryLevel,
  })
  phone.onInput((input) => void controller.dispatch(input))
  phone.onReset(() => void controller.reset())

  if (bridge) {
    const handleHubEvent = (event: EvenHubEvent): void => {
      const normalized = normalizeEvenInput(event)
      evidence?.input(event, normalized)
      if (normalized?.selectionIndex !== undefined) {
        if (controller.currentProgress.selectedChoiceIndex === normalized.selectionIndex) {
          void controller.dispatch('confirm')
        } else {
          void controller.selectChoice(normalized.selectionIndex)
        }
      } else if (normalized?.input) {
        void controller.dispatch(normalized.input)
      }
    }
    unsubscribeHub = bridge.onEvenHubEvent(handleHubEvent)
    unsubscribeDevice = bridge.onDeviceStatusChanged((status) => {
      void controller.updateBattery(status.batteryLevel)
    })
  }

  window.addEventListener('pagehide', () => {
    unsubscribeHub()
    unsubscribeDevice()
  })
  await controller.start()
}

void boot().catch((error: unknown) => {
  console.error(error)
  document.querySelector('#appStatus')?.replaceChildren(String(error))
})
