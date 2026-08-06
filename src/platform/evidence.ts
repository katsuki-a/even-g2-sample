import type { EvenHubEvent } from '@evenrealities/even_hub_sdk'
import type { RendererPort } from '../app/controller.ts'
import type { StoryViewModel } from '../domain/view-model.ts'
import type { NormalizedInput } from './even-input.ts'
import { DEFAULT_STORAGE_KEY } from './storage.ts'

const EVIDENCE_PREFIX = '[NO_SERVICE_EVIDENCE]'
const CASE_PATTERN = /^[a-z0-9-]{1,64}$/

type EvidenceEvent = {
  caseId: string
  phase: string
  nodeId?: string
  kind?: StoryViewModel['kind']
  selectedChoiceIndex?: number
  status?: string
  input?: NormalizedInput | null
  rawEvent?: unknown
}

function writeEvidence(event: EvidenceEvent): void {
  console.info(`${EVIDENCE_PREFIX} ${JSON.stringify(event)}`)
}

class EvidenceRenderer implements RendererPort {
  private failAttachmentOnce: boolean

  constructor(
    private readonly delegate: RendererPort,
    private readonly caseId: string,
    failAttachmentOnce: boolean,
  ) {
    this.failAttachmentOnce = failAttachmentOnce
  }

  async start(view: StoryViewModel): Promise<void> {
    await this.delegate.start(view)
    this.view('start', view)
  }

  async render(view: StoryViewModel): Promise<void> {
    await this.delegate.render(view)
    this.view('render', view)
  }

  async select(view: StoryViewModel): Promise<void> {
    await this.delegate.select(view)
    this.view('select', view)
  }

  async showAttachment(imageData: number[]): Promise<void> {
    if (this.failAttachmentOnce) {
      this.failAttachmentOnce = false
      writeEvidence({ caseId: this.caseId, phase: 'attachment-failure-injected' })
      throw new Error('Simulator evidence: planned attachment failure')
    }
    await this.delegate.showAttachment(imageData)
    writeEvidence({ caseId: this.caseId, phase: 'attachment-complete' })
  }

  async exit(): Promise<void> {
    await this.delegate.exit()
    writeEvidence({ caseId: this.caseId, phase: 'exit' })
  }

  private view(phase: string, view: StoryViewModel): void {
    writeEvidence({
      caseId: this.caseId,
      phase,
      nodeId: view.nodeId,
      kind: view.kind,
      selectedChoiceIndex: view.selectedChoiceIndex,
      status: view.status,
    })
  }
}

export class EvidenceSession {
  readonly storageKey: string

  private constructor(
    readonly caseId: string,
    private readonly failAttachmentOnce: boolean,
  ) {
    this.storageKey = `${DEFAULT_STORAGE_KEY}:evidence:${caseId}`
  }

  static fromSearch(search: string): EvidenceSession | undefined {
    const params = new URLSearchParams(search)
    const caseId = params.get('evidenceCase')
    if (!caseId || !CASE_PATTERN.test(caseId)) return undefined
    return new EvidenceSession(caseId, params.get('failAttachmentOnce') === '1')
  }

  wrap(renderer: RendererPort): RendererPort {
    return new EvidenceRenderer(renderer, this.caseId, this.failAttachmentOnce)
  }

  input(rawEvent: EvenHubEvent, normalized: NormalizedInput | null): void {
    writeEvidence({
      caseId: this.caseId,
      phase: 'input',
      input: normalized,
      rawEvent: rawEvent.jsonData,
    })
  }
}
