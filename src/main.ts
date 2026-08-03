import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import './styles.css'
import { G2_IMAGE_HEIGHT, G2_IMAGE_WIDTH, processImage, type ProcessedImage } from './image'

const IMAGE_CONTAINER_ID = 2
const IMAGE_CONTAINER_NAME = 'selected-image'
const TEXT_CONTAINER_ID = 1
const TEXT_CONTAINER_NAME = 'image-name'

const imageInput = document.querySelector<HTMLInputElement>('#imageInput')!
const dropZone = document.querySelector<HTMLLabelElement>('#dropZone')!
const previewCanvas = document.querySelector<HTMLCanvasElement>('#previewCanvas')!
const emptyPreview = document.querySelector<HTMLSpanElement>('#emptyPreview')!
const thresholdInput = document.querySelector<HTMLInputElement>('#threshold')!
const thresholdValue = document.querySelector<HTMLOutputElement>('#thresholdValue')!
const invertInput = document.querySelector<HTMLInputElement>('#invert')!
const sendButton = document.querySelector<HTMLButtonElement>('#sendButton')!
const status = document.querySelector<HTMLParagraphElement>('#status')!

let selectedFile: File | undefined
let processedImage: ProcessedImage | undefined
let bridge: EvenAppBridge | undefined
let processingSequence = 0

function setStatus(message: string, kind: 'info' | 'success' | 'error' = 'info'): void {
  status.textContent = message
  status.dataset.kind = kind
}

function updateSendButton(): void {
  sendButton.disabled = !bridge || !processedImage
}

async function renderSelectedImage(): Promise<void> {
  if (!selectedFile) return
  const currentSequence = ++processingSequence
  setStatus('画像を変換しています…')

  try {
    const result = await processImage(selectedFile, {
      threshold: Number(thresholdInput.value),
      invert: invertInput.checked,
    })
    if (currentSequence !== processingSequence) return

    processedImage = result
    previewCanvas.getContext('2d')?.putImageData(result.preview, 0, 0)
    emptyPreview.hidden = true
    setStatus(bridge ? '送信できます' : '画像の準備完了。G2へ接続しています…', bridge ? 'success' : 'info')
  } catch (error) {
    processedImage = undefined
    setStatus(error instanceof Error ? error.message : '画像の変換に失敗しました', 'error')
  }
  updateSendButton()
}

function selectFile(file: File | undefined): void {
  if (!file) return
  if (!file.type.startsWith('image/')) {
    setStatus('画像ファイルを選択してください', 'error')
    return
  }
  selectedFile = file
  void renderSelectedImage()
}

imageInput.addEventListener('change', () => selectFile(imageInput.files?.[0]))
thresholdInput.addEventListener('input', () => {
  thresholdValue.value = thresholdInput.value
  void renderSelectedImage()
})
invertInput.addEventListener('change', () => void renderSelectedImage())

for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault()
    dropZone.classList.add('is-dragging')
  })
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault()
    dropZone.classList.remove('is-dragging')
  })
}
dropZone.addEventListener('drop', (event) => selectFile(event.dataTransfer?.files[0]))

sendButton.addEventListener('click', async () => {
  if (!bridge || !processedImage || !selectedFile) return
  sendButton.disabled = true
  setStatus('G2へ送信しています…')

  try {
    await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: IMAGE_CONTAINER_ID,
        containerName: IMAGE_CONTAINER_NAME,
        imageData: processedImage.bmp,
      }),
    )
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: TEXT_CONTAINER_ID,
        containerName: TEXT_CONTAINER_NAME,
        contentOffset: 0,
        contentLength: 100,
        content: selectedFile.name.slice(0, 80),
      }),
    )
    setStatus(`「${selectedFile.name}」を表示しました`, 'success')
  } catch (error) {
    console.error(error)
    setStatus(error instanceof Error ? error.message : 'G2への送信に失敗しました', 'error')
  }
  updateSendButton()
})

async function connectToG2(): Promise<void> {
  try {
    bridge = await waitForEvenAppBridge()
    await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 2,
        textObject: [
          new TextContainerProperty({
            xPosition: 0,
            yPosition: 0,
            width: 576,
            height: 70,
            borderWidth: 0,
            borderColor: 5,
            paddingLength: 10,
            containerID: TEXT_CONTAINER_ID,
            containerName: TEXT_CONTAINER_NAME,
            content: 'Choose an image on your phone',
            isEventCapture: 0,
          }),
        ],
        imageObject: [
          new ImageContainerProperty({
            xPosition: Math.floor((576 - G2_IMAGE_WIDTH) / 2),
            yPosition: Math.floor((288 - G2_IMAGE_HEIGHT) / 2) + 24,
            width: G2_IMAGE_WIDTH,
            height: G2_IMAGE_HEIGHT,
            containerID: IMAGE_CONTAINER_ID,
            containerName: IMAGE_CONTAINER_NAME,
          }),
        ],
      }),
    )
    setStatus(processedImage ? '送信できます' : 'G2に接続しました。画像を選択してください', 'success')
  } catch (error) {
    console.error(error)
    setStatus('G2へ接続できませんでした。Even Appまたはシミュレータを確認してください', 'error')
  }
  updateSendButton()
}

void connectToG2()
