import {
  AppLocationAccuracy,
  AudioInputSource,
  CreateStartUpPageContainer,
  EvenAppBridge,
  EventSourceType,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  ImuReportPace,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  type AppImageAsset,
  type AppLocation,
  type DeviceInfo,
  type DeviceStatus,
  type EvenHubEvent,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import './styles.css'
import {
  G2_IMAGE_HEIGHT,
  G2_IMAGE_WIDTH,
  createDemoPatternBmp,
  processImage,
  type ProcessedImage,
} from './image'

const DISPLAY_WIDTH = 576
const DISPLAY_HEIGHT = 288
const ROOT_TEXT_ID = 1
const ROOT_TEXT_NAME = 'hardware-lab'
const IMAGE_CAPTURE_ID = 20
const IMAGE_CAPTURE_NAME = 'image-input'
const IMAGE_CONTAINER_ID = 21
const IMAGE_CONTAINER_NAME = 'image-demo'
const STORAGE_KEY = 'g2-hardware-lab-last-run'

function element<T extends Element>(selector: string): T {
  const match = document.querySelector<T>(selector)
  if (!match) throw new Error(`Element not found: ${selector}`)
  return match
}

const connectionBadge = element<HTMLSpanElement>('#connectionBadge')
const connectionStatus = element<HTMLParagraphElement>('#connectionStatus')
const apiStatus = element<HTMLParagraphElement>('#apiStatus')
const showTextButton = element<HTMLButtonElement>('#showTextButton')
const updateTextButton = element<HTMLButtonElement>('#updateTextButton')
const showListButton = element<HTMLButtonElement>('#showListButton')
const showPatternButton = element<HTMLButtonElement>('#showPatternButton')
const imageInput = element<HTMLInputElement>('#imageInput')
const albumButton = element<HTMLButtonElement>('#albumButton')
const cameraButton = element<HTMLButtonElement>('#cameraButton')
const imageName = element<HTMLParagraphElement>('#imageName')
const thresholdInput = element<HTMLInputElement>('#threshold')
const thresholdValue = element<HTMLOutputElement>('#thresholdValue')
const invertInput = element<HTMLInputElement>('#invert')
const previewCanvas = element<HTMLCanvasElement>('#previewCanvas')
const emptyPreview = element<HTMLSpanElement>('#emptyPreview')
const sendImageButton = element<HTMLButtonElement>('#sendImageButton')
const eventEmpty = element<HTMLParagraphElement>('#eventEmpty')
const eventLog = element<HTMLOListElement>('#eventLog')
const clearEventsButton = element<HTMLButtonElement>('#clearEventsButton')
const audioSource = element<HTMLSelectElement>('#audioSource')
const audioLevel = element<HTMLSpanElement>('#audioLevel')
const audioRms = element<HTMLElement>('#audioRms')
const audioFrames = element<HTMLElement>('#audioFrames')
const audioBytes = element<HTMLElement>('#audioBytes')
const startAudioButton = element<HTMLButtonElement>('#startAudioButton')
const stopAudioButton = element<HTMLButtonElement>('#stopAudioButton')
const imuPace = element<HTMLSelectElement>('#imuPace')
const imuX = element<HTMLElement>('#imuX')
const imuY = element<HTMLElement>('#imuY')
const imuZ = element<HTMLElement>('#imuZ')
const imuSamplesElement = element<HTMLElement>('#imuSamples')
const startImuButton = element<HTMLButtonElement>('#startImuButton')
const stopImuButton = element<HTMLButtonElement>('#stopImuButton')
const deviceModel = element<HTMLElement>('#deviceModel')
const deviceConnection = element<HTMLElement>('#deviceConnection')
const deviceBattery = element<HTMLElement>('#deviceBattery')
const deviceWearing = element<HTMLElement>('#deviceWearing')
const deviceCharging = element<HTMLElement>('#deviceCharging')
const launchSource = element<HTMLElement>('#launchSource')
const userInfo = element<HTMLElement>('#userInfo')
const refreshDeviceButton = element<HTMLButtonElement>('#refreshDeviceButton')
const latitude = element<HTMLElement>('#latitude')
const longitude = element<HTMLElement>('#longitude')
const locationAccuracy = element<HTMLElement>('#locationAccuracy')
const locationUpdatesElement = element<HTMLElement>('#locationUpdates')
const getLocationButton = element<HTMLButtonElement>('#getLocationButton')
const startLocationButton = element<HTMLButtonElement>('#startLocationButton')
const stopLocationButton = element<HTMLButtonElement>('#stopLocationButton')
const storageValue = element<HTMLParagraphElement>('#storageValue')
const storageButton = element<HTMLButtonElement>('#storageButton')
const shutdownButton = element<HTMLButtonElement>('#shutdownButton')

const bridge = EvenAppBridge.getInstance()
const bridgeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-requires-bridge]'))
const busyButtons = new Set<HTMLButtonElement>()

let bridgeReady = false
let pageActionBusy = false
let currentPage: 'root' | 'text' | 'list' | 'image' = 'root'
let selectedFile: File | undefined
let processedImage: ProcessedImage | undefined
let processingSequence = 0
let microphoneActive = false
let imuActive = false
let locationActive = false
let audioFrameCount = 0
let audioByteCount = 0
let imuSampleCount = 0
let locationUpdateCount = 0
let lastAudioLogAt = 0
let lastImuPaintAt = 0
let lastImuLogAt = 0

const IMU_PACES: Record<string, ImuReportPace> = {
  '100': ImuReportPace.P100,
  '300': ImuReportPace.P300,
  '500': ImuReportPace.P500,
  '700': ImuReportPace.P700,
  '1000': ImuReportPace.P1000,
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function setApiStatus(message: string, kind: 'info' | 'success' | 'error' = 'info'): void {
  apiStatus.textContent = message
  apiStatus.dataset.kind = kind
}

function setConnection(state: 'connecting' | 'connected' | 'error', label: string, detail: string): void {
  connectionBadge.dataset.state = state
  connectionBadge.textContent = label
  connectionStatus.textContent = detail
}

function syncControls(): void {
  for (const button of bridgeButtons) {
    let disabled = !bridgeReady || busyButtons.has(button)

    if (pageActionBusy && button.classList.contains('page-action')) disabled = true
    if (button === sendImageButton && !processedImage) disabled = true
    if (button === startAudioButton && microphoneActive) disabled = true
    if (button === stopAudioButton && !microphoneActive) disabled = true
    if (button === startImuButton && imuActive) disabled = true
    if (button === stopImuButton && !imuActive) disabled = true
    if (button === startLocationButton && locationActive) disabled = true
    if (button === stopLocationButton && !locationActive) disabled = true

    button.disabled = disabled
    button.setAttribute('aria-busy', busyButtons.has(button) ? 'true' : 'false')
  }

  audioSource.disabled = !bridgeReady || microphoneActive
  imuPace.disabled = !bridgeReady || imuActive
}

async function runButtonAction(
  button: HTMLButtonElement,
  progressMessage: string,
  action: () => Promise<void>,
): Promise<void> {
  if (busyButtons.has(button)) return
  busyButtons.add(button)
  syncControls()
  setApiStatus(progressMessage)

  try {
    await action()
  } catch (error) {
    console.error(error)
    const message = formatError(error)
    setApiStatus(message, 'error')
    addEventLog('ERROR', message)
  } finally {
    busyButtons.delete(button)
    syncControls()
  }
}

async function runPageAction(
  button: HTMLButtonElement,
  progressMessage: string,
  action: () => Promise<void>,
): Promise<void> {
  if (pageActionBusy) return
  pageActionBusy = true
  syncControls()
  await runButtonAction(button, progressMessage, action)
  pageActionBusy = false
  syncControls()
}

function addEventLog(kind: string, detail: string): void {
  console.info(`[HardwareLab] ${kind}: ${detail}`)
  eventEmpty.hidden = true
  const item = document.createElement('li')
  const time = document.createElement('time')
  const content = document.createElement('span')
  time.dateTime = new Date().toISOString()
  time.textContent = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date())
  content.textContent = `${kind} · ${detail}`
  item.append(time, content)
  eventLog.prepend(item)

  while (eventLog.children.length > 30) eventLog.lastElementChild?.remove()
}

function formatEventType(type: OsEventTypeList | undefined, hasContainerEvent = false): string {
  if (type === undefined && hasContainerEvent) return 'CLICK_EVENT'
  switch (type) {
    case OsEventTypeList.CLICK_EVENT: return 'CLICK_EVENT'
    case OsEventTypeList.SCROLL_TOP_EVENT: return 'SCROLL_TOP_EVENT'
    case OsEventTypeList.SCROLL_BOTTOM_EVENT: return 'SCROLL_BOTTOM_EVENT'
    case OsEventTypeList.DOUBLE_CLICK_EVENT: return 'DOUBLE_CLICK_EVENT'
    case OsEventTypeList.FOREGROUND_ENTER_EVENT: return 'FOREGROUND_ENTER_EVENT'
    case OsEventTypeList.FOREGROUND_EXIT_EVENT: return 'FOREGROUND_EXIT_EVENT'
    case OsEventTypeList.ABNORMAL_EXIT_EVENT: return 'ABNORMAL_EXIT_EVENT'
    case OsEventTypeList.SYSTEM_EXIT_EVENT: return 'SYSTEM_EXIT_EVENT'
    case OsEventTypeList.IMU_DATA_REPORT: return 'IMU_DATA_REPORT'
    default: return 'UNKNOWN_EVENT'
  }
}

function formatEventSource(source: EventSourceType | undefined): string {
  switch (source) {
    case EventSourceType.TOUCH_EVENT_FROM_GLASSES_R: return 'G2 right temple'
    case EventSourceType.TOUCH_EVENT_FROM_GLASSES_L: return 'G2 left temple'
    case EventSourceType.TOUCH_EVENT_FROM_RING: return 'R1 ring'
    case EventSourceType.TOUCH_EVENT_FORM_DUMMY_NULL: return 'simulator / unknown'
    default: return 'source unavailable'
  }
}

function eventSourceFrom(event: EvenHubEvent): EventSourceType | undefined {
  if (event.sysEvent?.eventSource !== undefined) return event.sysEvent.eventSource
  const data = event.jsonData
  if (!data) return undefined
  const raw = data.eventSource ?? data.EventSource ?? data.Event_Source
  return raw === undefined ? undefined : EventSourceType.fromJson(raw)
}

function calculateAudioLevel(bytes: Uint8Array): { rms: number; peak: number } {
  const sampleCount = Math.floor(bytes.byteLength / 2)
  if (sampleCount === 0) return { rms: 0, peak: 0 }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let sumSquares = 0
  let peak = 0
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = view.getInt16(index * 2, true) / 32768
    sumSquares += sample * sample
    peak = Math.max(peak, Math.abs(sample))
  }
  return { rms: Math.sqrt(sumSquares / sampleCount), peak }
}

function handleAudioEvent(event: EvenHubEvent): void {
  const audio = event.audioEvent
  if (!audio) return

  audioFrameCount += 1
  audioByteCount += audio.audioPcm.byteLength
  const { rms, peak } = calculateAudioLevel(audio.audioPcm)
  const decibels = 20 * Math.log10(Math.max(rms, 0.000001))
  const meterPercent = Math.max(0, Math.min(100, ((decibels + 60) / 60) * 100))
  audioLevel.style.width = `${meterPercent}%`
  audioRms.textContent = `${decibels.toFixed(1)} dB`
  audioFrames.textContent = audioFrameCount.toLocaleString('ja-JP')
  audioBytes.textContent = audioByteCount.toLocaleString('ja-JP')

  const now = performance.now()
  if (now - lastAudioLogAt >= 1000) {
    addEventLog('AUDIO', `${audio.source}, ${audio.audioPcm.byteLength} bytes, peak ${peak.toFixed(3)}`)
    lastAudioLogAt = now
  }
}

function handleImuEvent(event: EvenHubEvent): void {
  const sysEvent = event.sysEvent
  if (!sysEvent?.imuData || sysEvent.eventType !== OsEventTypeList.IMU_DATA_REPORT) return

  imuSampleCount += 1
  const now = performance.now()
  if (now - lastImuPaintAt >= 80) {
    const formatAxis = (value: number | undefined): string => value === undefined ? '—' : value.toFixed(4)
    imuX.textContent = formatAxis(sysEvent.imuData.x)
    imuY.textContent = formatAxis(sysEvent.imuData.y)
    imuZ.textContent = formatAxis(sysEvent.imuData.z)
    imuSamplesElement.textContent = imuSampleCount.toLocaleString('ja-JP')
    lastImuPaintAt = now
  }
  if (now - lastImuLogAt >= 1000) {
    addEventLog(
      'IMU',
      `x=${sysEvent.imuData.x?.toFixed(3) ?? '—'}, y=${sysEvent.imuData.y?.toFixed(3) ?? '—'}, z=${sysEvent.imuData.z?.toFixed(3) ?? '—'}`,
    )
    lastImuLogAt = now
  }
}

function handleGestureEvent(event: EvenHubEvent): void {
  const containerEvent = event.textEvent ?? event.listEvent
  if (!containerEvent) return

  const type = formatEventType(containerEvent.eventType, true)
  const source = formatEventSource(eventSourceFrom(event))
  const selection = event.listEvent
    ? ` · #${event.listEvent.currentSelectItemIndex ?? '?'} ${event.listEvent.currentSelectItemName ?? ''}`
    : ''
  addEventLog('GESTURE', `${type} · ${source}${selection}`)
}

function handleSystemEvent(event: EvenHubEvent): void {
  const sysEvent = event.sysEvent
  if (!sysEvent || sysEvent.eventType === OsEventTypeList.IMU_DATA_REPORT) return
  addEventLog(
    'SYSTEM',
    `${formatEventType(sysEvent.eventType, sysEvent.eventSource !== undefined)} · ${formatEventSource(sysEvent.eventSource)}${sysEvent.systemExitReasonCode === undefined ? '' : ` · reason ${sysEvent.systemExitReasonCode}`}`,
  )
}

function handleEvenHubEvent(event: EvenHubEvent): void {
  handleAudioEvent(event)
  handleImuEvent(event)
  handleGestureEvent(event)
  handleSystemEvent(event)
}

function renderDeviceStatus(status: DeviceStatus): void {
  deviceConnection.textContent = status.connectType
  deviceBattery.textContent = status.batteryLevel === undefined ? '—' : `${status.batteryLevel}%`
  deviceWearing.textContent = status.isWearing === undefined ? '—' : status.isWearing ? 'yes' : 'no'
  const charging = status.isCharging === undefined ? '—' : status.isCharging ? 'charging' : 'not charging'
  const inCase = status.isInCase === undefined ? '—' : status.isInCase ? 'in case' : 'out of case'
  deviceCharging.textContent = `${charging} / ${inCase}`
}

function renderDeviceInfo(info: DeviceInfo | null): void {
  if (!info) {
    deviceModel.textContent = 'device not found'
    return
  }
  deviceModel.textContent = info.model
  renderDeviceStatus(info.status)
}

function renderLocation(location: AppLocation, countAsUpdate: boolean): void {
  latitude.textContent = location.latitude.toFixed(6)
  longitude.textContent = location.longitude.toFixed(6)
  locationAccuracy.textContent = location.accuracy === undefined ? '—' : `${location.accuracy.toFixed(1)} m`
  if (countAsUpdate) locationUpdateCount += 1
  locationUpdatesElement.textContent = locationUpdateCount.toLocaleString('ja-JP')
}

async function refreshDeviceData(): Promise<void> {
  const [device, user] = await Promise.all([bridge.getDeviceInfo(), bridge.getUserInfo()])
  renderDeviceInfo(device)
  userInfo.textContent = `${user.name || '(no name)'} / ${user.country || '—'} / uid ${user.uid}`
}

function rootPage(): CreateStartUpPageContainer {
  return new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        borderWidth: 0,
        paddingLength: 14,
        containerID: ROOT_TEXT_ID,
        containerName: ROOT_TEXT_NAME,
        content: 'G2 Hardware Lab\n\nPhone controls are ready.\nTry tap, double tap, swipe up and swipe down.',
        isEventCapture: 1,
      }),
    ],
  })
}

async function rebuildPage(container: RebuildPageContainer): Promise<void> {
  const success = await bridge.rebuildPageContainer(container)
  if (!success) throw new Error('rebuildPageContainer が false を返しました')
}

function textDemoContent(prefix = 'Text output is working.'): string {
  return [
    'G2 Hardware Lab / TEXT',
    '',
    prefix,
    `Updated: ${new Date().toLocaleTimeString('ja-JP')}`,
    '',
    'Tap / double tap / swipe on G2 or R1.',
    'Events appear in the phone log.',
  ].join('\n')
}

async function showTextDemo(): Promise<void> {
  await rebuildPage(new RebuildPageContainer({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        borderWidth: 1,
        borderColor: 6,
        borderRadius: 8,
        paddingLength: 14,
        containerID: ROOT_TEXT_ID,
        containerName: ROOT_TEXT_NAME,
        content: textDemoContent(),
        isEventCapture: 1,
      }),
    ],
  }))
  currentPage = 'text'
}

async function showListDemo(): Promise<void> {
  const items = ['Text output', 'Image output', 'Touch events', 'Microphone PCM', 'IMU motion']
  await rebuildPage(new RebuildPageContainer({
    containerTotalNum: 2,
    textObject: [
      new TextContainerProperty({
        xPosition: 20,
        yPosition: 10,
        width: 536,
        height: 42,
        borderWidth: 0,
        paddingLength: 4,
        containerID: 10,
        containerName: 'list-title',
        content: 'G2 Hardware Lab / LIST',
        isEventCapture: 0,
        zOrderIndex: 1,
      }),
    ],
    listObject: [
      new ListContainerProperty({
        xPosition: 28,
        yPosition: 58,
        width: 520,
        height: 215,
        borderWidth: 1,
        borderColor: 5,
        borderRadius: 7,
        paddingLength: 8,
        containerID: 11,
        containerName: 'feature-list',
        itemContainer: new ListItemContainerProperty({
          itemCount: items.length,
          itemWidth: 0,
          isItemSelectBorderEn: 1,
          itemName: items,
        }),
        isEventCapture: 1,
        zOrderIndex: 2,
      }),
    ],
  }))
  currentPage = 'list'
}

async function showImageData(imageData: number[], title: string): Promise<void> {
  await rebuildPage(new RebuildPageContainer({
    containerTotalNum: 2,
    textObject: [
      new TextContainerProperty({
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        borderWidth: 0,
        paddingLength: 10,
        containerID: IMAGE_CAPTURE_ID,
        containerName: IMAGE_CAPTURE_NAME,
        content: `${title.slice(0, 44)}\n\n\n\n\n\nTap or swipe to test input`,
        isEventCapture: 1,
        zOrderIndex: 1,
      }),
    ],
    imageObject: [
      new ImageContainerProperty({
        xPosition: Math.floor((DISPLAY_WIDTH - G2_IMAGE_WIDTH) / 2),
        yPosition: 72,
        width: G2_IMAGE_WIDTH,
        height: G2_IMAGE_HEIGHT,
        containerID: IMAGE_CONTAINER_ID,
        containerName: IMAGE_CONTAINER_NAME,
        zOrderIndex: 2,
      }),
    ],
  }))

  const result = await bridge.updateImageRawData(new ImageRawDataUpdate({
    containerID: IMAGE_CONTAINER_ID,
    containerName: IMAGE_CONTAINER_NAME,
    imageData,
  }))
  if (result !== ImageRawDataUpdateResult.success) {
    throw new Error(`updateImageRawData: ${result}`)
  }
  currentPage = 'image'
}

async function renderSelectedImage(): Promise<void> {
  if (!selectedFile) return
  const sequence = ++processingSequence
  imageName.textContent = `${selectedFile.name} を変換中…`

  try {
    const result = await processImage(selectedFile, {
      threshold: Number(thresholdInput.value),
      invert: invertInput.checked,
    })
    if (sequence !== processingSequence) return
    processedImage = result
    previewCanvas.getContext('2d')?.putImageData(result.preview, 0, 0)
    emptyPreview.hidden = true
    imageName.textContent = `${selectedFile.name} · ${(selectedFile.size / 1024).toFixed(1)} KB`
  } catch (error) {
    processedImage = undefined
    imageName.textContent = formatError(error)
    setApiStatus(formatError(error), 'error')
  }
  syncControls()
}

function selectFile(file: File | undefined): void {
  if (!file) return
  if (!file.type.startsWith('image/')) {
    setApiStatus('画像ファイルを選択してください', 'error')
    return
  }
  selectedFile = file
  void renderSelectedImage()
}

function fileFromAsset(asset: AppImageAsset): File {
  const commaIndex = asset.base64.indexOf(',')
  const encoded = (commaIndex >= 0 ? asset.base64.slice(commaIndex + 1) : asset.base64).replace(/\s/g, '')
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new File([bytes], asset.name || 'even-app-image', { type: asset.mimeType || 'image/jpeg' })
}

async function selectAppImage(asset: AppImageAsset | null, source: string): Promise<void> {
  if (!asset) {
    setApiStatus(`${source}はキャンセルされたか、権限が許可されませんでした`)
    return
  }
  selectFile(fileFromAsset(asset))
  setApiStatus(`${source}から「${asset.name}」を読み込みました`, 'success')
}

const unsubscribeLaunch = bridge.onLaunchSource((source) => {
  launchSource.textContent = source
  addEventLog('LAUNCH', source)
})
const unsubscribeDevice = bridge.onDeviceStatusChanged((status) => {
  renderDeviceStatus(status)
  addEventLog('DEVICE', `${status.connectType}, battery ${status.batteryLevel ?? '—'}%`)
})
const unsubscribeHub = bridge.onEvenHubEvent(handleEvenHubEvent)
const unsubscribeLocation = bridge.onAppLocationChanged((location) => renderLocation(location, true))

showTextButton.addEventListener('click', () => {
  void runPageAction(showTextButton, 'テキストページを構築しています…', async () => {
    await showTextDemo()
    setApiStatus('テキストをG2へ表示しました', 'success')
  })
})

updateTextButton.addEventListener('click', () => {
  void runPageAction(updateTextButton, 'テキストを更新しています…', async () => {
    if (currentPage !== 'text') await showTextDemo()
    const success = await bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: ROOT_TEXT_ID,
      containerName: ROOT_TEXT_NAME,
      content: textDemoContent('textContainerUpgrade succeeded.'),
    }))
    if (!success) throw new Error('textContainerUpgrade が false を返しました')
    setApiStatus('テキストを差分更新しました', 'success')
  })
})

showListButton.addEventListener('click', () => {
  void runPageAction(showListButton, 'リストページを構築しています…', async () => {
    await showListDemo()
    setApiStatus('リストをG2へ表示しました。上下スワイプを試してください', 'success')
  })
})

showPatternButton.addEventListener('click', () => {
  void runPageAction(showPatternButton, 'テストパターンを送信しています…', async () => {
    await showImageData(createDemoPatternBmp(), 'G2 Hardware Lab / IMAGE')
    setApiStatus('テストパターンをG2へ表示しました', 'success')
  })
})

imageInput.addEventListener('change', () => selectFile(imageInput.files?.[0]))
thresholdInput.addEventListener('input', () => {
  thresholdValue.value = thresholdInput.value
  void renderSelectedImage()
})
invertInput.addEventListener('change', () => void renderSelectedImage())

albumButton.addEventListener('click', () => {
  void runButtonAction(albumButton, 'スマホのアルバムを開いています…', async () => {
    await selectAppImage(await bridge.pickImageFromAlbum(), 'アルバム')
  })
})

cameraButton.addEventListener('click', () => {
  void runButtonAction(cameraButton, 'スマホのカメラを開いています…', async () => {
    await selectAppImage(await bridge.captureImageFromCamera(), 'カメラ')
  })
})

sendImageButton.addEventListener('click', () => {
  void runPageAction(sendImageButton, '画像をG2へ送信しています…', async () => {
    if (!processedImage || !selectedFile) throw new Error('先に画像を選択してください')
    await showImageData(processedImage.bmp, selectedFile.name)
    setApiStatus(`「${selectedFile.name}」をG2へ表示しました`, 'success')
  })
})

clearEventsButton.addEventListener('click', () => {
  eventLog.replaceChildren()
  eventEmpty.hidden = false
})

startAudioButton.addEventListener('click', () => {
  void runButtonAction(startAudioButton, 'マイク入力を開始しています…', async () => {
    const source = audioSource.value === AudioInputSource.Phone
      ? AudioInputSource.Phone
      : AudioInputSource.Glasses
    audioFrameCount = 0
    audioByteCount = 0
    lastAudioLogAt = 0
    audioFrames.textContent = '0'
    audioBytes.textContent = '0'
    const success = await bridge.audioControl(true, source)
    if (!success) throw new Error(`audioControl(true, ${source}) が false を返しました。権限と起動ページを確認してください`)
    microphoneActive = true
    addEventLog('AUDIO', `${source} input started`)
    setApiStatus(`${source === AudioInputSource.Glasses ? 'G2' : 'スマホ'}マイクの入力を開始しました`, 'success')
  })
})

stopAudioButton.addEventListener('click', () => {
  void runButtonAction(stopAudioButton, 'マイク入力を停止しています…', async () => {
    const success = await bridge.audioControl(false)
    if (!success) throw new Error('audioControl(false) が false を返しました')
    microphoneActive = false
    audioLevel.style.width = '0%'
    addEventLog('AUDIO', 'input stopped')
    setApiStatus('マイク入力を停止しました', 'success')
  })
})

startImuButton.addEventListener('click', () => {
  void runButtonAction(startImuButton, 'IMU入力を開始しています…', async () => {
    const pace = IMU_PACES[imuPace.value] ?? ImuReportPace.P500
    imuSampleCount = 0
    lastImuPaintAt = 0
    lastImuLogAt = 0
    imuSamplesElement.textContent = '0'
    const success = await bridge.imuControl(true, pace)
    if (!success) throw new Error(`imuControl(true, P${pace}) が false を返しました`)
    imuActive = true
    addEventLog('IMU', `P${pace} started`)
    setApiStatus(`IMU入力をP${pace}で開始しました`, 'success')
  })
})

stopImuButton.addEventListener('click', () => {
  void runButtonAction(stopImuButton, 'IMU入力を停止しています…', async () => {
    const success = await bridge.imuControl(false)
    if (!success) throw new Error('imuControl(false) が false を返しました')
    imuActive = false
    addEventLog('IMU', 'stopped')
    setApiStatus('IMU入力を停止しました', 'success')
  })
})

refreshDeviceButton.addEventListener('click', () => {
  void runButtonAction(refreshDeviceButton, 'デバイス情報を取得しています…', async () => {
    await refreshDeviceData()
    setApiStatus('デバイス情報を更新しました', 'success')
  })
})

getLocationButton.addEventListener('click', () => {
  void runButtonAction(getLocationButton, '現在地を取得しています…', async () => {
    const location = await bridge.getAppLocation({
      accuracy: AppLocationAccuracy.High,
      timeoutMs: 8000,
    })
    if (!location) throw new Error('位置を取得できませんでした。スマホの位置情報権限を確認してください')
    renderLocation(location, false)
    setApiStatus('スマホの現在地を取得しました', 'success')
  })
})

startLocationButton.addEventListener('click', () => {
  void runButtonAction(startLocationButton, '位置の連続更新を開始しています…', async () => {
    locationUpdateCount = 0
    locationUpdatesElement.textContent = '0'
    const success = await bridge.startAppLocationUpdates({
      accuracy: AppLocationAccuracy.Medium,
      intervalMs: 1000,
      distanceFilter: 1,
    })
    if (!success) throw new Error('startAppLocationUpdates が false を返しました')
    locationActive = true
    setApiStatus('位置の連続更新を開始しました', 'success')
  })
})

stopLocationButton.addEventListener('click', () => {
  void runButtonAction(stopLocationButton, '位置の連続更新を停止しています…', async () => {
    const success = await bridge.stopAppLocationUpdates()
    if (!success) throw new Error('stopAppLocationUpdates が false を返しました')
    locationActive = false
    setApiStatus('位置の連続更新を停止しました', 'success')
  })
})

storageButton.addEventListener('click', () => {
  void runButtonAction(storageButton, 'ホスト保存領域を確認しています…', async () => {
    const value = new Date().toISOString()
    const success = await bridge.setLocalStorage(STORAGE_KEY, value)
    if (!success) throw new Error('setLocalStorage が false を返しました')
    storageValue.textContent = await bridge.getLocalStorage(STORAGE_KEY)
    setApiStatus('保存と読み出しに成功しました', 'success')
  })
})

shutdownButton.addEventListener('click', () => {
  void runButtonAction(shutdownButton, '終了確認を表示しています…', async () => {
    if (microphoneActive) {
      await bridge.audioControl(false)
      microphoneActive = false
    }
    if (imuActive) {
      await bridge.imuControl(false)
      imuActive = false
    }
    if (locationActive) {
      await bridge.stopAppLocationUpdates()
      locationActive = false
    }
    const success = await bridge.shutDownPageContainer(1)
    if (!success) throw new Error('shutDownPageContainer(1) が false を返しました')
    setApiStatus('G2にシステム終了確認を表示しました', 'success')
  })
})

async function connect(): Promise<void> {
  try {
    await waitForEvenAppBridge()
    const result = await bridge.createStartUpPageContainer(rootPage())
    if (result !== StartUpPageCreateResult.success) {
      throw new Error(`createStartUpPageContainer: result ${result}`)
    }
    bridgeReady = true
    await refreshDeviceData()
    setConnection('connected', '接続済み', 'Even App BridgeとG2の起動ページを初期化しました。')
    setApiStatus('各APIを試せます', 'success')
    syncControls()
  } catch (error) {
    console.error(error)
    setConnection(
      'error',
      '未接続',
      'Even Appまたはシミュレータ内で開いてください。通常のブラウザだけではネイティブAPIを呼べません。',
    )
    setApiStatus(formatError(error), 'error')
  }
}

window.addEventListener('pagehide', () => {
  unsubscribeLaunch()
  unsubscribeDevice()
  unsubscribeHub()
  unsubscribeLocation()
})

syncControls()
void connect()
