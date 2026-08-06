import test from 'node:test'
import assert from 'node:assert/strict'
import type { EvenAppBridge, TextContainerUpgrade } from '@evenrealities/even_hub_sdk'
import type { StoryViewModel } from '../domain/view-model.ts'
import { EvenRenderer } from './even-renderer.ts'

function choiceView(selectedChoiceIndex: number): StoryViewModel {
  return {
    kind: 'choice',
    nodeId: 'choice_year',
    header: '00:01 / 圏外 / 100%',
    kicker: 'REPLY RECOVERY',
    title: '返信を選択',
    body: '欠損した返信から送信内容を選択',
    footer: '上下 選択 / 決定 送信',
    choices: ['2026年', '間違いメールです', 'あなたは誰？'],
    selectedChoiceIndex,
    progressLabel: '02 / 14',
  }
}

test('G2返信カーソルをTextContainerの差分更新だけで移動する', async () => {
  const upgrades: TextContainerUpgrade[] = []
  const bridge = {
    textContainerUpgrade: async (upgrade: TextContainerUpgrade) => {
      upgrades.push(upgrade)
      return true
    },
  } as unknown as EvenAppBridge
  const renderer = new EvenRenderer(bridge)

  await renderer.select(choiceView(1))

  assert.equal(upgrades.length, 1)
  assert.equal(upgrades[0]?.containerID, 3)
  assert.equal(upgrades[0]?.containerName, 'story-choices')
  assert.equal(upgrades[0]?.content, '  2026年\n\n> 間違いメールです\n\n  あなたは誰？')
})

test('G2返信カーソルの差分更新失敗を握りつぶさない', async () => {
  const bridge = {
    textContainerUpgrade: async () => false,
  } as unknown as EvenAppBridge
  const renderer = new EvenRenderer(bridge)

  await assert.rejects(renderer.select(choiceView(2)), /返信カーソルの更新に失敗/)
})
