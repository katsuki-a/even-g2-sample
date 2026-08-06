import test from 'node:test'
import assert from 'node:assert/strict'
import { episodeOne } from '../content/load-story.ts'
import { createProgress, type Progress } from '../domain/progress.ts'
import type { StoryViewModel } from '../domain/view-model.ts'
import type { Clock } from '../platform/clock.ts'
import type { ProgressStore } from '../platform/storage.ts'
import { StoryController, type RendererPort } from './controller.ts'

class FakeClock implements Clock {
  now(): Date {
    return new Date('2026-08-06T12:00:00+09:00')
  }

  async sleep(): Promise<void> {}
}

class MemoryStore implements ProgressStore {
  constructor(private value: Progress) {}

  async load(): Promise<unknown> { return structuredClone(this.value) }
  async save(progress: Progress): Promise<void> { this.value = structuredClone(progress) }
  async clear(): Promise<void> {}
}

class RetryRenderer implements RendererPort {
  views: StoryViewModel[] = []
  showCount = 0

  async start(view: StoryViewModel): Promise<void> { this.views.push(view) }
  async render(view: StoryViewModel): Promise<void> { this.views.push(view) }
  async select(view: StoryViewModel): Promise<void> { this.views.push(view) }
  async exit(): Promise<void> {}
  async showAttachment(): Promise<void> {
    this.showCount += 1
    if (this.showCount === 1) throw new Error('planned send failure')
  }
}

test('添付送信失敗を表示し、決定で同じノードのまま再試行する', async () => {
  const saved = {
    ...createProgress(episodeOne),
    currentNodeId: 'attachment_portrait',
    visitedNodeIds: ['mail_hook', 'attachment_portrait'],
    revision: 1,
  }
  const renderer = new RetryRenderer()
  const controller = new StoryController({
    story: episodeOne,
    renderer,
    storage: new MemoryStore(saved),
    clock: new FakeClock(),
    attachments: { load: async () => [0x42, 0x4d] },
  })

  const originalConsoleError = console.error
  console.error = () => undefined
  try {
    await controller.start()
  } finally {
    console.error = originalConsoleError
  }
  assert.equal(renderer.showCount, 1)
  assert.match(renderer.views.at(-1)?.status ?? '', /ATTACHMENT ERROR/)
  assert.equal(controller.currentProgress.currentNodeId, 'attachment_portrait')

  await controller.dispatch('confirm')
  assert.equal(renderer.showCount, 2)
  assert.equal(controller.currentProgress.currentNodeId, 'attachment_portrait')

  await controller.dispatch('confirm')
  assert.equal(controller.currentProgress.currentNodeId, 'mail_identity')
})

test('SDKの絶対indexをcontrollerの選択状態へ反映する', async () => {
  const renderer = new RetryRenderer()
  renderer.showCount = 1
  const controller = new StoryController({
    story: episodeOne,
    renderer,
    storage: new MemoryStore(createProgress(episodeOne)),
    clock: new FakeClock(),
    attachments: { load: async () => [] },
  })
  await controller.start()
  await controller.dispatch('confirm')
  await controller.selectChoice(2)
  assert.equal(controller.currentProgress.selectedChoiceIndex, 2)
})
