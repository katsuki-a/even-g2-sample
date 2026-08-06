import test from 'node:test'
import assert from 'node:assert/strict'
import { episodeOne } from '../content/load-story.ts'
import { reduceStory } from './engine.ts'
import { createProgress, type Progress } from './progress.ts'
import { nodeAt } from './story.ts'

function advanceToDecision(progress: Progress): Progress {
  let current = progress
  while (true) {
    const node = nodeAt(episodeOne, current.currentNodeId)
    if (node.type === 'choice' || node.type === 'ending') return current
    current = reduceStory(episodeOne, current, { type: 'ADVANCE' }).progress
  }
}

test('全27経路が14ノードで3種類の終端へ到達する', () => {
  const completed: Progress[] = []

  function explore(input: Progress): void {
    const progress = advanceToDecision(input)
    const node = nodeAt(episodeOne, progress.currentNodeId)
    if (node.type === 'ending') {
      completed.push(progress)
      return
    }
    assert.equal(node.type, 'choice')
    for (let index = 0; index < node.choices.length; index += 1) {
      let branch = progress
      for (let step = 0; step < index; step += 1) {
        branch = reduceStory(episodeOne, branch, { type: 'MOVE_SELECTION', delta: 1 }).progress
      }
      branch = reduceStory(episodeOne, branch, { type: 'CONFIRM_CHOICE' }).progress
      explore(branch)
    }
  }

  explore(createProgress(episodeOne))
  assert.equal(completed.length, 27)
  assert.deepEqual(new Set(completed.map((progress) => progress.currentNodeId)), new Set([
    'ending_connected',
    'ending_loop',
    'ending_intrusion',
  ]))
  assert.ok(completed.every((progress) => progress.visitedNodeIds.length === 14))
})

test('選択は周回し、効果と確定地点を一度だけ保存する', () => {
  let progress = advanceToDecision(createProgress(episodeOne))
  progress = reduceStory(episodeOne, progress, { type: 'MOVE_SELECTION', delta: -1 }).progress
  assert.equal(progress.selectedChoiceIndex, 2)
  const transition = reduceStory(episodeOne, progress, { type: 'CONFIRM_CHOICE' })
  assert.equal(transition.progress.currentNodeId, 'mail_year_who')
  assert.equal(transition.progress.choices.choice_year, 'ask_identity')
  assert.deepEqual(transition.progress.flags, ['asked-identity-first'])
  assert.deepEqual(transition.effects, ['SAVE'])
})

test('同じ初期状態と操作列は同じ進行状態になる', () => {
  const commands = [
    { type: 'ADVANCE' } as const,
    { type: 'MOVE_SELECTION', delta: 1 } as const,
    { type: 'CONFIRM_CHOICE' } as const,
    { type: 'ADVANCE' } as const,
  ]
  const run = (): Progress => commands.reduce(
    (progress, command) => reduceStory(episodeOne, progress, command).progress,
    createProgress(episodeOne),
  )
  assert.deepEqual(run(), run())
})

test('SDKの絶対indexで返信候補を同期できる', () => {
  const progress = advanceToDecision(createProgress(episodeOne))
  const selected = reduceStory(episodeOne, progress, { type: 'SET_SELECTION', index: 2 }).progress
  assert.equal(selected.selectedChoiceIndex, 2)
})
