import test from 'node:test'
import assert from 'node:assert/strict'
import { episodeOne } from '../content/load-story.ts'
import { createProgress, isRestorableProgress } from './progress.ts'

test('正しいstoryとrevisionを持つ確定状態だけを復元する', () => {
  const progress = createProgress(episodeOne)
  assert.equal(isRestorableProgress(episodeOne, progress), true)
  assert.equal(isRestorableProgress(episodeOne, { ...progress, storyId: 'other-story' }), false)
  assert.equal(isRestorableProgress(episodeOne, { ...progress, currentNodeId: 'missing' }), false)
  assert.equal(isRestorableProgress(episodeOne, { ...progress, revision: '1' }), false)
})
