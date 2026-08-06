import { reduceStory, type Command } from '../domain/engine.ts'
import { createProgress, isRestorableProgress, type Progress } from '../domain/progress.ts'
import { toViewModel, type StoryViewModel } from '../domain/view-model.ts'
import { nodeAt, type AttachmentNode, type Story } from '../domain/story.ts'
import type { Clock } from '../platform/clock.ts'
import type { ProgressStore } from '../platform/storage.ts'

export type LogicalInput = 'up' | 'down' | 'confirm' | 'back'

export interface RendererPort {
  start(viewModel: StoryViewModel): Promise<void>
  render(viewModel: StoryViewModel): Promise<void>
  select(viewModel: StoryViewModel): Promise<void>
  showAttachment(imageData: number[]): Promise<void>
  exit(): Promise<void>
}

export interface AttachmentLoader {
  load(node: AttachmentNode): Promise<number[]>
}

export type ControllerOptions = {
  story: Story
  renderer: RendererPort
  storage: ProgressStore
  clock: Clock
  attachments: AttachmentLoader
  playerName?: string
  batteryLevel?: number
}

export class CompositeRenderer implements RendererPort {
  constructor(private readonly renderers: RendererPort[]) {}

  async start(viewModel: StoryViewModel): Promise<void> {
    await Promise.all(this.renderers.map((renderer) => renderer.start(viewModel)))
  }

  async render(viewModel: StoryViewModel): Promise<void> {
    await Promise.all(this.renderers.map((renderer) => renderer.render(viewModel)))
  }

  async select(viewModel: StoryViewModel): Promise<void> {
    await Promise.all(this.renderers.map((renderer) => renderer.select(viewModel)))
  }

  async showAttachment(imageData: number[]): Promise<void> {
    await Promise.all(this.renderers.map((renderer) => renderer.showAttachment(imageData)))
  }

  async exit(): Promise<void> {
    await Promise.all(this.renderers.map((renderer) => renderer.exit()))
  }
}

export class StoryController {
  private progress: Progress
  private status?: string
  private attachmentFailed = false
  private inputTail: Promise<void> = Promise.resolve()
  private batteryLevel?: number

  constructor(private readonly options: ControllerOptions) {
    this.progress = createProgress(options.story)
    this.batteryLevel = options.batteryLevel
  }

  get currentProgress(): Progress {
    return structuredClone(this.progress)
  }

  async start(): Promise<void> {
    const restored = await this.options.storage.load()
    if (isRestorableProgress(this.options.story, restored)) {
      this.progress = restored
      this.status = '受信箱を復元しました'
    }
    await this.options.renderer.start(this.viewModel())
    if (nodeAt(this.options.story, this.progress.currentNodeId).type === 'attachment') {
      await this.sendAttachment()
    }
  }

  dispatch(input: LogicalInput): Promise<void> {
    const task = this.inputTail.then(() => this.handle(input))
    this.inputTail = task.catch(() => undefined)
    return task
  }

  selectChoice(index: number): Promise<void> {
    const task = this.inputTail.then(() => this.handleCommand({ type: 'SET_SELECTION', index }))
    this.inputTail = task.catch(() => undefined)
    return task
  }

  async reset(): Promise<void> {
    await this.options.storage.clear()
    this.progress = createProgress(this.options.story)
    this.status = 'EPISODE 01 / RESTART'
    this.attachmentFailed = false
    await this.options.storage.save(this.progress)
    await this.options.renderer.render(this.viewModel())
  }

  async updateBattery(batteryLevel?: number): Promise<void> {
    this.batteryLevel = batteryLevel
    await this.options.renderer.render(this.viewModel())
    const node = nodeAt(this.options.story, this.progress.currentNodeId)
    if (node.type === 'attachment' && !this.attachmentFailed) {
      await this.options.renderer.showAttachment(await this.options.attachments.load(node))
    }
  }

  private viewModel(): StoryViewModel {
    return toViewModel(this.options.story, this.progress, {
      now: this.options.clock.now(),
      batteryLevel: this.batteryLevel,
      playerName: this.options.playerName ?? 'あなた',
      status: this.status,
    })
  }

  private commandFor(input: LogicalInput): Command {
    if (input === 'up') return { type: 'MOVE_SELECTION', delta: -1 }
    if (input === 'down') return { type: 'MOVE_SELECTION', delta: 1 }
    if (input === 'back') return { type: 'BACK' }
    const node = nodeAt(this.options.story, this.progress.currentNodeId)
    if (node.type === 'choice') return { type: 'CONFIRM_CHOICE' }
    if (node.type === 'attachment' && this.attachmentFailed) return { type: 'RETRY_ATTACHMENT' }
    return { type: 'ADVANCE' }
  }

  private async handle(input: LogicalInput): Promise<void> {
    const command = this.commandFor(input)
    await this.handleCommand(command)
  }

  private async handleCommand(command: Command): Promise<void> {
    if (command.type === 'CONFIRM_CHOICE') {
      this.status = '返信を送信中…'
      await this.options.renderer.render(this.viewModel())
      await this.options.clock.sleep(450)
    }

    const transition = reduceStory(this.options.story, this.progress, command)
    this.progress = transition.progress
    this.status = undefined
    if (command.type === 'MOVE_SELECTION' || command.type === 'SET_SELECTION') {
      await this.options.renderer.select(this.viewModel())
      return
    }
    if (transition.effects.includes('SAVE')) await this.options.storage.save(this.progress)
    if (transition.effects.includes('EXIT')) {
      await this.options.renderer.exit()
      return
    }
    if (transition.effects.includes('SHOW_ATTACHMENT')) {
      await this.sendAttachment()
      return
    }

    await this.options.renderer.render(this.viewModel())
    if (nodeAt(this.options.story, this.progress.currentNodeId).type === 'attachment') {
      await this.sendAttachment()
    }
  }

  private async sendAttachment(): Promise<void> {
    const node = nodeAt(this.options.story, this.progress.currentNodeId)
    if (node.type !== 'attachment') return
    this.status = 'ATTACHMENT RECEIVING…'
    await this.options.renderer.render(this.viewModel())
    try {
      const image = await this.options.attachments.load(node)
      this.attachmentFailed = false
      this.status = 'ATTACHMENT COMPLETE'
      await this.options.renderer.render(this.viewModel())
      await this.options.renderer.showAttachment(image)
    } catch (error) {
      console.error(error)
      this.attachmentFailed = true
      this.status = 'ATTACHMENT ERROR · 決定で再試行'
      await this.options.renderer.render(this.viewModel())
    }
  }
}
