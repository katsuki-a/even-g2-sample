import test from 'node:test'
import assert from 'node:assert/strict'
import type { RendererPort } from '../app/controller.ts'
import type { StoryViewModel } from '../domain/view-model.ts'
import { EvidenceSession } from './evidence.ts'

const view: StoryViewModel = {
  kind: 'attachment',
  nodeId: 'attachment_portrait',
  header: '00:01 / 圏外 / 100%',
  kicker: 'ATTACHMENT / 19.8 KB',
  title: 'PIC_0047.BMP',
  body: '200×100 MONO',
  footer: '決定 つぎへ',
  choices: [],
  selectedChoiceIndex: 0,
  progressLabel: '07 / 14',
}

class FakeRenderer implements RendererPort {
  attachmentCalls = 0

  async start(): Promise<void> {}
  async render(): Promise<void> {}
  async select(): Promise<void> {}
  async exit(): Promise<void> {}
  async showAttachment(): Promise<void> { this.attachmentCalls += 1 }
}

test('証跡caseを通常保存領域から分離し、不正なcase名は無効化する', () => {
  assert.equal(EvidenceSession.fromSearch('?evidenceCase=INVALID_case'), undefined)
  const session = EvidenceSession.fromSearch('?evidenceCase=route-012')
  assert.ok(session)
  assert.match(session.storageKey, /:evidence:route-012$/)
})

test('証跡用の添付故障は一度だけ発生し、次の送信はdelegateへ届く', async () => {
  const session = EvidenceSession.fromSearch('?evidenceCase=retry-001&failAttachmentOnce=1')
  assert.ok(session)
  const delegate = new FakeRenderer()
  const renderer = session.wrap(delegate)
  const logs: string[] = []
  const originalInfo = console.info
  console.info = (message: string) => logs.push(message)
  try {
    await renderer.start(view)
    await assert.rejects(renderer.showAttachment([0x42, 0x4d]), /planned attachment failure/)
    await renderer.showAttachment([0x42, 0x4d])
  } finally {
    console.info = originalInfo
  }
  assert.equal(delegate.attachmentCalls, 1)
  assert.ok(logs.some((log) => log.includes('attachment-failure-injected')))
  assert.ok(logs.some((log) => log.includes('attachment-complete')))
})
