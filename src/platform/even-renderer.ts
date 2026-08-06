import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import type { RendererPort } from '../app/controller.ts'
import type { StoryViewModel } from '../domain/view-model.ts'
import { ImageQueue } from './image-queue.ts'

const DISPLAY_WIDTH = 576
const IMAGE_ID = 40
const IMAGE_NAME = 'story-attachment'
const CHOICES_ID = 3
const CHOICES_NAME = 'story-choices'

function textContainer(
  id: number,
  name: string,
  content: string,
  yPosition: number,
  height: number,
  capture = false,
): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: 16,
    yPosition,
    width: DISPLAY_WIDTH - 32,
    height,
    borderWidth: 0,
    paddingLength: 4,
    containerID: id,
    containerName: name,
    content,
    isEventCapture: capture ? 1 : 0,
  })
}

function contentFor(view: StoryViewModel): string {
  return `${view.kicker}\n${view.title}\n\n${view.body}`
}

function choicesFor(view: StoryViewModel): string {
  return view.choices.map((choice, index) => {
    const cursor = index === view.selectedChoiceIndex ? '>' : ' '
    return `${cursor} ${choice}`
  }).join('\n\n')
}

function pageFor(view: StoryViewModel): RebuildPageContainer {
  const status = view.status ? `  ·  ${view.status}` : ''
  if (view.kind === 'choice') {
    return new RebuildPageContainer({
      containerTotalNum: 3,
      textObject: [
        textContainer(1, 'story-header', view.header, 6, 30),
        textContainer(2, 'story-choice-title', `${view.kicker}\n${view.title}`, 40, 55),
        textContainer(CHOICES_ID, CHOICES_NAME, choicesFor(view), 98, 178, true),
      ],
    })
  }

  if (view.kind === 'attachment') {
    return new RebuildPageContainer({
      containerTotalNum: 4,
      textObject: [
        textContainer(1, 'story-header', view.header, 6, 30),
        textContainer(2, 'story-attachment-title', `${view.title}  ·  ${view.kicker.replace('ATTACHMENT  ·  ', '')}`, 40, 42),
        textContainer(3, 'story-footer', `${view.footer}${status}`, 246, 34, true),
      ],
      imageObject: [
        new ImageContainerProperty({
          xPosition: 188,
          yPosition: 98,
          width: 200,
          height: 100,
          containerID: IMAGE_ID,
          containerName: IMAGE_NAME,
        }),
      ],
    })
  }

  return new RebuildPageContainer({
    containerTotalNum: 3,
    textObject: [
      textContainer(1, 'story-header', view.header, 6, 30),
      textContainer(2, 'story-content', contentFor(view), 42, 196),
      textContainer(3, 'story-footer', `${view.footer}  ·  ${view.progressLabel}${status}`, 246, 34, true),
    ],
  })
}

export class EvenRenderer implements RendererPort {
  private readonly imageQueue = new ImageQueue()

  constructor(private readonly bridge: EvenAppBridge) {}

  async start(viewModel: StoryViewModel): Promise<void> {
    const page = pageFor(viewModel)
    const result = await this.bridge.createStartUpPageContainer(new CreateStartUpPageContainer(page))
    if (result !== StartUpPageCreateResult.success) throw new Error(`G2起動ページ作成失敗: ${result}`)
  }

  async render(viewModel: StoryViewModel): Promise<void> {
    const success = await this.bridge.rebuildPageContainer(pageFor(viewModel))
    if (!success) throw new Error('G2ページ更新に失敗しました')
  }

  async select(viewModel: StoryViewModel): Promise<void> {
    const success = await this.bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: CHOICES_ID,
      containerName: CHOICES_NAME,
      content: choicesFor(viewModel),
    }))
    if (!success) throw new Error('G2返信カーソルの更新に失敗しました')
  }

  async showAttachment(imageData: number[]): Promise<void> {
    await this.imageQueue.enqueue(async () => {
      const result = await this.bridge.updateImageRawData(new ImageRawDataUpdate({
        containerID: IMAGE_ID,
        containerName: IMAGE_NAME,
        imageData,
      }))
      if (result !== ImageRawDataUpdateResult.success) throw new Error(`添付画像送信失敗: ${result}`)
    })
  }

  async exit(): Promise<void> {
    const success = await this.bridge.shutDownPageContainer(1)
    if (!success) throw new Error('終了確認を表示できませんでした')
  }
}
