import type { LogicalInput, RendererPort } from '../app/controller.ts'
import type { StoryViewModel } from '../domain/view-model.ts'

function element<T extends Element>(selector: string): T {
  const result = document.querySelector<T>(selector)
  if (!result) throw new Error(`Element not found: ${selector}`)
  return result
}

export class PhoneView implements RendererPort {
  private readonly screen = element<HTMLElement>('#gameScreen')
  private readonly header = element<HTMLElement>('#screenHeader')
  private readonly kicker = element<HTMLElement>('#screenKicker')
  private readonly title = element<HTMLElement>('#screenTitle')
  private readonly body = element<HTMLElement>('#screenBody')
  private readonly choices = element<HTMLOListElement>('#screenChoices')
  private readonly image = element<HTMLImageElement>('#screenImage')
  private readonly footer = element<HTMLElement>('#screenFooter')
  private readonly progress = element<HTMLElement>('#storyProgress')
  private readonly status = element<HTMLElement>('#appStatus')
  private readonly connection = element<HTMLElement>('#connectionBadge')
  private imageUrl?: string
  private attachmentNodeId?: string
  private inputHandler: (input: LogicalInput) => void = () => undefined
  private resetHandler: () => void = () => undefined

  constructor() {
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-input]')) {
      button.addEventListener('click', () => this.inputHandler(button.dataset.input as LogicalInput))
    }
    element<HTMLButtonElement>('#resetButton').addEventListener('click', () => this.resetHandler())
    document.addEventListener('keydown', (event) => {
      const mapping: Partial<Record<string, LogicalInput>> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        Enter: 'confirm',
        Escape: 'back',
      }
      const input = mapping[event.key]
      if (input) {
        event.preventDefault()
        this.inputHandler(input)
      }
    })
  }

  onInput(handler: (input: LogicalInput) => void): void {
    this.inputHandler = handler
  }

  onReset(handler: () => void): void {
    this.resetHandler = handler
  }

  setConnection(state: 'preview' | 'connected' | 'error', label: string): void {
    this.connection.dataset.state = state
    this.connection.textContent = label
  }

  async start(viewModel: StoryViewModel): Promise<void> {
    await this.render(viewModel)
  }

  async render(viewModel: StoryViewModel): Promise<void> {
    if (viewModel.kind === 'attachment' && viewModel.nodeId !== this.attachmentNodeId) {
      this.attachmentNodeId = viewModel.nodeId
      this.image.removeAttribute('src')
    }
    this.screen.dataset.kind = viewModel.kind
    this.header.textContent = viewModel.header
    this.kicker.textContent = viewModel.kicker
    this.title.textContent = viewModel.title
    this.body.textContent = viewModel.body
    this.footer.textContent = viewModel.footer
    this.progress.textContent = viewModel.progressLabel
    this.status.textContent = viewModel.status ?? 'LINK STABLE'
    this.choices.replaceChildren(...viewModel.choices.map((label, index) => {
      const item = document.createElement('li')
      item.textContent = label
      item.dataset.selected = String(index === viewModel.selectedChoiceIndex)
      return item
    }))
    this.choices.hidden = viewModel.kind !== 'choice'
    this.image.hidden = viewModel.kind !== 'attachment' || !this.image.src
    this.body.hidden = viewModel.kind === 'choice' || viewModel.kind === 'attachment'
  }

  async select(viewModel: StoryViewModel): Promise<void> {
    await this.render(viewModel)
  }

  async showAttachment(imageData: number[]): Promise<void> {
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl)
    this.imageUrl = URL.createObjectURL(new Blob([Uint8Array.from(imageData)], { type: 'image/bmp' }))
    this.image.src = this.imageUrl
    this.image.hidden = false
  }

  async exit(): Promise<void> {
    this.status.textContent = 'G2に終了確認を表示しました'
  }
}
