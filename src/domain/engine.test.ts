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

test('全27経路が20ノードで27種類の終端へ到達する', () => {
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
  assert.equal(new Set(completed.map((progress) => progress.currentNodeId)).size, 27)
  assert.ok(completed.every((progress) => progress.visitedNodeIds.length === 20))
})

test('選択は周回し、効果と確定地点を一度だけ保存する', () => {
  let progress = advanceToDecision(createProgress(episodeOne))
  progress = reduceStory(episodeOne, progress, { type: 'MOVE_SELECTION', delta: -1 }).progress
  assert.equal(progress.selectedChoiceIndex, 2)
  const transition = reduceStory(episodeOne, progress, { type: 'CONFIRM_CHOICE' })
  assert.equal(transition.progress.currentNodeId, 'mail_year_mina')
  assert.equal(transition.progress.choices.choice_year, 'ask_mina')
  assert.deepEqual(transition.progress.flags, ['named-mina-first'])
  assert.deepEqual(transition.effects, ['SAVE'])
})

test('通常ノードの条件遷移が、それまでの二選択を中盤で呼び戻す', () => {
  let progress = advanceToDecision(createProgress(episodeOne))
  progress = reduceStory(episodeOne, progress, { type: 'SET_SELECTION', index: 2 }).progress
  progress = reduceStory(episodeOne, progress, { type: 'CONFIRM_CHOICE' }).progress
  progress = advanceToDecision(progress)
  progress = reduceStory(episodeOne, progress, { type: 'SET_SELECTION', index: 1 }).progress
  progress = reduceStory(episodeOne, progress, { type: 'CONFIRM_CHOICE' }).progress

  while (!progress.currentNodeId.startsWith('attachment_memorial_')) {
    progress = reduceStory(episodeOne, progress, { type: 'ADVANCE' }).progress
  }
  progress = reduceStory(episodeOne, progress, { type: 'ADVANCE' }).progress

  assert.equal(progress.currentNodeId, 'mail_record_name_exit')
  assert.deepEqual(progress.flags, ['named-mina-first', 'advised-shelter'])
})

test('ENDは決定で表示を保持し、戻る操作だけが正規終了する', () => {
  const endingProgress = {
    ...createProgress(episodeOne),
    currentNodeId: 'ending_year_stairs_keep_unknown',
    visitedNodeIds: ['mail_hook', 'ending_year_stairs_keep_unknown'],
  }

  assert.deepEqual(reduceStory(episodeOne, endingProgress, { type: 'ADVANCE' }).effects, [])
  assert.deepEqual(reduceStory(episodeOne, endingProgress, { type: 'BACK' }).effects, ['EXIT'])
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
