import test from 'node:test'
import assert from 'node:assert/strict'
import { ImageQueue } from './image-queue.ts'

test('画像処理を失敗後も含めて必ず直列化する', async () => {
  const queue = new ImageQueue()
  const events: string[] = []
  let releaseFirst: () => void = () => undefined
  const firstBarrier = new Promise<void>((resolve) => { releaseFirst = resolve })

  const first = queue.enqueue(async () => {
    events.push('first:start')
    await firstBarrier
    events.push('first:end')
  })
  const second = queue.enqueue(async () => {
    events.push('second:start')
    throw new Error('send failed')
  })
  const third = queue.enqueue(async () => {
    events.push('third:start')
  })

  await Promise.resolve()
  assert.deepEqual(events, ['first:start'])
  releaseFirst()
  await first
  await assert.rejects(second, /send failed/)
  await third
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'third:start'])
})
