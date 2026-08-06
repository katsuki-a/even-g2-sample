import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { evaluateProject, evaluateStory } from './fitness.mjs'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const canonicalStory = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'content/story.json'), 'utf8'))

test('正本ストーリーはconceptゲートを通る', () => {
  const report = evaluateProject({ rootDir: ROOT_DIR, phase: 'concept' })
  assert.equal(report.pass, true)
  assert.equal(report.hardGates.length, 0)
  assert.ok(report.score >= 90)
  assert.ok(report.components.story.stats.paths >= 3)
})

test('存在しない遷移先を拒否する', () => {
  const story = structuredClone(canonicalStory)
  story.nodes[0].next = 'missing-node'
  const result = evaluateStory(story, { rootDir: ROOT_DIR })
  assert.ok(result.hardGates.some((issue) => issue.code === 'STORY_DANGLING_REFERENCE'))
})

test('到達不能ノードを拒否する', () => {
  const story = structuredClone(canonicalStory)
  story.nodes.push({
    id: 'orphan-ending',
    type: 'ending',
    act: 3,
    endingId: 'orphan',
    title: '孤立',
    body: 'どこからも到達できない。',
    tags: ['cliffhanger'],
  })
  const result = evaluateStory(story, { rootDir: ROOT_DIR })
  assert.ok(result.hardGates.some((issue) => issue.code === 'STORY_UNREACHABLE'))
})

test('G2表示上限を超える本文を拒否する', () => {
  const story = structuredClone(canonicalStory)
  story.nodes.find((node) => node.type === 'mail').body = 'あ'.repeat(161)
  const result = evaluateStory(story, { rootDir: ROOT_DIR })
  assert.ok(result.hardGates.some((issue) => issue.code === 'STORY_BODY_LENGTH'))
})

test('必須ビートの順序違反を拒否する', () => {
  const story = structuredClone(canonicalStory)
  story.nodes.find((node) => node.id === 'attachment_portrait').tags = []
  const result = evaluateStory(story, { rootDir: ROOT_DIR })
  assert.ok(result.hardGates.some((issue) => issue.code === 'STORY_BEAT_ORDER'))
})
