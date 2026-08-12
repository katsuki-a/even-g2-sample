import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import {
  REVIEW_SCHEMA_VERSION,
  calculateNarrativeMechanics,
  enumerateNarrativeRoutes,
  evaluateNarrativeReviews,
  narrativeInputDigest,
} from './narrative.mjs'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const story = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'content/story.json'), 'utf8'))
const config = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'harness/config.json'), 'utf8')).narrative
const personas = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, config.personasFile), 'utf8'))
const rubric = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, config.rubricFile), 'utf8'))
const protocol = fs.readFileSync(path.join(ROOT_DIR, config.protocolFile), 'utf8').trim()

function ratings(groupId, rating) {
  return Object.fromEntries(
    rubric.groups[groupId].dimensions.map((dimension) => [dimension.id, rating]),
  )
}

function makeReview(personaId, options = {}) {
  const persona = personas.personas.find((item) => item.id === personaId)
  const routes = enumerateNarrativeRoutes(story, config.templateValues)
  const interestRating = options.interestRating ?? 4
  const originalityRating = options.originalityRating ?? 4
  return {
    schemaVersion: REVIEW_SCHEMA_VERSION,
    personaId,
    inputDigest: narrativeInputDigest({
      story,
      persona,
      rubric,
      protocol,
      templateValues: config.templateValues,
    }),
    reviewer: {
      kind: 'codex-sub-agent',
      taskName: `fixture-${personaId}`,
      independent: true,
    },
    routes: routes.map((route, index) => ({
      routeId: route.routeId,
      interest: ratings('interest', options.weakRouteIndex === index ? 1 : interestRating),
      originality: ratings('originality', options.weakRouteIndex === index ? 1 : originalityRating),
      evidenceNodeIds: [route.nodeIds[0], route.nodeIds.at(-1)],
      clicheSignals: originalityRating <= 2 ? ['ai-impersonation-reveal'] : [],
      interestReason: '導入から終端までの疑問と選択の効き方を経路全体で確認した根拠です。',
      originalityReason: '既知の類型と端末固有の変形を分け、置換可能性まで確認した根拠です。',
    })),
    forcedTests: Object.fromEntries(
      rubric.forcedTests.map((item) => [item.id, {
        genericityDetected: false,
        reason: '対象経路の固有要素と置換後の意味変化を比較して判定した結果です。',
      }]),
    ),
    overallNotes: {
      strength: '時間差と低解像度端末の制約が、読み進める具体的な疑問を作っています。',
      risk: '前半の選択が早く合流するため、反応の固有性が継続しない危険があります。',
    },
  }
}

function makeReviews(options = {}) {
  return config.requiredPersonas.map((personaId) => makeReview(personaId, options))
}

test('正本から選択IDで識別できる全27完走経路を生成する', () => {
  const routes = enumerateNarrativeRoutes(story, config.templateValues)
  assert.equal(routes.length, 27)
  assert.equal(new Set(routes.map((route) => route.routeId)).size, 27)
  assert.ok(routes.every((route) => route.nodeIds.length === 20))
  assert.equal(new Set(routes.map((route) => route.endingId)).size, 27)
})

test('最初の二選択は9種類の本人メモとして中盤へ再登場する', () => {
  const routes = enumerateNarrativeRoutes(story, config.templateValues)
  const timeJumpIds = routes.map((route) => (
    route.nodeIds.find((nodeId) => nodeId.startsWith('mail_time_jump_'))
  ))
  const memorialIds = routes.map((route) => (
    route.nodeIds.find((nodeId) => nodeId.startsWith('attachment_memorial_'))
  ))
  const callbackIds = routes.map((route) => (
    route.nodeIds.find((nodeId) => nodeId.startsWith('mail_record_'))
  ))
  const falseSenderIds = routes.map((route) => (
    route.nodeIds.find((nodeId) => nodeId.startsWith('mail_false_sender_'))
  ))

  assert.equal(new Set(timeJumpIds).size, 9)
  assert.equal(new Set(memorialIds).size, 3)
  assert.equal(new Set(callbackIds).size, 9)
  assert.equal(new Set(falseSenderIds).size, 9)
  for (const timeJumpId of new Set(timeJumpIds)) {
    assert.equal(timeJumpIds.filter((item) => item === timeJumpId).length, 3)
  }
  for (const memorialId of new Set(memorialIds)) {
    assert.equal(memorialIds.filter((item) => item === memorialId).length, 9)
  }
  for (const callbackId of new Set(callbackIds)) {
    assert.equal(callbackIds.filter((item) => item === callbackId).length, 3)
  }
  for (const falseSenderId of new Set(falseSenderIds)) {
    assert.equal(falseSenderIds.filter((item) => item === falseSenderId).length, 3)
  }
  assert.ok(routes.every((route) => route.transcript.includes('樋口ミナ / 入庫メモ')))
})

test('選択の即時反応と終端まで残る比率を分けて測る', () => {
  const mechanics = calculateNarrativeMechanics(story)
  assert.equal(mechanics.choices, 3)
  assert.equal(mechanics.persistentChoices, 3)
  assert.equal(mechanics.immediateAcknowledgementRate, 1)
  assert.equal(mechanics.persistentChoiceRate, 1)
})

test('全27経路が固有の決着とG2・ミナ固有の根拠を持つ', () => {
  const routes = enumerateNarrativeRoutes(story, config.templateValues)
  const finalMailBodies = routes.map((route) => {
    const finalMailId = route.nodeIds.at(-2)
    return story.nodes.find((node) => node.id === finalMailId)?.body
  })
  const endingBodies = routes.map((route) => {
    const endingId = route.nodeIds.at(-1)
    return story.nodes.find((node) => node.id === endingId)?.body
  })

  assert.equal(new Set(finalMailBodies).size, 27)
  assert.equal(new Set(endingBodies).size, 27)
  assert.ok(routes.every((route) => (
    route.transcript.includes('G2') &&
    route.transcript.includes('200×100') &&
    route.transcript.includes('透明') &&
    route.transcript.includes('視界')
  )))
  assert.ok(routes.every((route) => (
    route.transcript.includes('入庫') &&
    route.transcript.includes('棚卸し') &&
    route.transcript.includes('在庫') &&
    route.transcript.includes('空欄をゼロで埋めない')
  )))
})

test('5人格が全経路を4点評価した証跡を決定論的に75点へ集約する', () => {
  const input = {
    story,
    personas,
    rubric,
    protocol,
    reviews: makeReviews(),
    config,
    enforceQuality: true,
  }
  const first = evaluateNarrativeReviews(input)
  const second = evaluateNarrativeReviews(input)
  assert.deepEqual(first, second)
  assert.equal(first.score, 75)
  assert.deepEqual(first.sections, { interest: 75, originality: 75 })
  assert.equal(first.hardGates.length, 0)
  assert.equal(first.stats.personas, 5)
  assert.equal(first.stats.reviewedRoutes, 27)
})

test('物語本文が変わった後のレビューを失効させる', () => {
  const changedStory = structuredClone(story)
  changedStory.nodes.find((node) => node.id === 'mail_hook').body += '変更'
  const result = evaluateNarrativeReviews({
    story: changedStory,
    personas,
    rubric,
    protocol,
    reviews: makeReviews(),
    config,
    enforceQuality: true,
  })
  assert.equal(
    result.hardGates.filter((issue) => issue.code === 'NARRATIVE_REVIEW_STALE').length,
    5,
  )
})

test('1経路でも欠けた人格レビューを拒否する', () => {
  const reviews = makeReviews()
  reviews[0].routes.pop()
  const result = evaluateNarrativeReviews({
    story,
    personas,
    rubric,
    protocol,
    reviews,
    config,
    enforceQuality: true,
  })
  assert.ok(result.hardGates.some((issue) => issue.code === 'NARRATIVE_ROUTE_COVERAGE'))
})

test('全体平均で隠れる最低経路を拒否する', () => {
  const result = evaluateNarrativeReviews({
    story,
    personas,
    rubric,
    protocol,
    reviews: makeReviews({ weakRouteIndex: 0 }),
    config,
    enforceQuality: true,
  })
  assert.ok(result.hardGates.some((issue) => issue.code === 'NARRATIVE_WEAK_ROUTE'))
})

test('面白くても既視感が強い合議を独自性ゲートで拒否する', () => {
  const result = evaluateNarrativeReviews({
    story,
    personas,
    rubric,
    protocol,
    reviews: makeReviews({ interestRating: 5, originalityRating: 2 }),
    config,
    enforceQuality: true,
  })
  assert.ok(result.hardGates.some((issue) => issue.code === 'NARRATIVE_ORIGINALITY'))
  assert.ok(result.hardGates.some((issue) => issue.code === 'NARRATIVE_GENERIC_CONSENSUS'))
})

test('同じ品質不足をimplementationでは警告、hard checkではゲートにする', () => {
  const input = {
    story,
    personas,
    rubric,
    protocol,
    reviews: makeReviews({ interestRating: 2, originalityRating: 2 }),
    config,
  }
  const soft = evaluateNarrativeReviews({ ...input, enforceQuality: false })
  const hard = evaluateNarrativeReviews({ ...input, enforceQuality: true })
  assert.equal(soft.hardGates.some((issue) => issue.code === 'NARRATIVE_INTEREST'), false)
  assert.equal(soft.warnings.some((issue) => issue.code === 'NARRATIVE_INTEREST'), true)
  assert.equal(hard.hardGates.some((issue) => issue.code === 'NARRATIVE_INTEREST'), true)
})

test('対象経路にない根拠ノードを拒否する', () => {
  const reviews = makeReviews()
  reviews[0].routes[0].evidenceNodeIds = ['missing-a', 'missing-b']
  const result = evaluateNarrativeReviews({
    story,
    personas,
    rubric,
    protocol,
    reviews,
    config,
    enforceQuality: true,
  })
  assert.ok(result.hardGates.some((issue) => issue.code === 'NARRATIVE_EVIDENCE_NODE'))
})

test('共通レビュープロトコル変更後の証跡を失効させる', () => {
  const result = evaluateNarrativeReviews({
    story,
    personas,
    rubric,
    protocol: `${protocol}\n変更`,
    reviews: makeReviews(),
    config,
    enforceQuality: true,
  })
  assert.equal(
    result.hardGates.filter((issue) => issue.code === 'NARRATIVE_REVIEW_STALE').length,
    5,
  )
})

test('3人格が検出した凡庸さ強制テストを品質ゲートへ反映する', () => {
  const reviews = makeReviews()
  for (const review of reviews.slice(0, 3)) {
    review.forcedTests['choice-erasure'].genericityDetected = true
  }
  const result = evaluateNarrativeReviews({
    story,
    personas,
    rubric,
    protocol,
    reviews,
    config,
    enforceQuality: true,
  })
  assert.ok(result.hardGates.some((issue) => (
    issue.code === 'NARRATIVE_FORCED_TEST_CONSENSUS' && issue.message.includes('choice-erasure')
  )))
})

test('2対3の人格評価は多数側を中央値として採用する', () => {
  const highMajority = makeReviews()
  const lowMajority = makeReviews()
  for (const review of highMajority.slice(0, 2)) {
    for (const route of review.routes) {
      route.interest = ratings('interest', 2)
      route.originality = ratings('originality', 2)
    }
  }
  for (const review of lowMajority.slice(0, 3)) {
    for (const route of review.routes) {
      route.interest = ratings('interest', 2)
      route.originality = ratings('originality', 2)
    }
  }
  const evaluate = (reviews) => evaluateNarrativeReviews({
    story,
    personas,
    rubric,
    protocol,
    reviews,
    config,
    enforceQuality: false,
  })
  assert.equal(evaluate(highMajority).score, 75)
  assert.equal(evaluate(lowMajority).score, 25)
})

test('不正な配列型を例外ではなくレビューゲートにする', () => {
  const clicheReviews = makeReviews()
  clicheReviews[0].routes[0].clicheSignals = 5
  assert.doesNotThrow(() => evaluateNarrativeReviews({
    story,
    personas,
    rubric,
    protocol,
    reviews: clicheReviews,
    config,
    enforceQuality: true,
  }))
  const routeReviews = makeReviews()
  routeReviews[0].routes = 5
  const result = evaluateNarrativeReviews({
    story,
    personas,
    rubric,
    protocol,
    reviews: routeReviews,
    config,
    enforceQuality: true,
  })
  assert.ok(result.hardGates.some((issue) => issue.code === 'NARRATIVE_REVIEW_INVALID'))
})

test('同じ根拠ノードを2回書いても2件とは数えない', () => {
  const reviews = makeReviews()
  const nodeId = reviews[0].routes[0].evidenceNodeIds[0]
  reviews[0].routes[0].evidenceNodeIds = [nodeId, nodeId]
  const result = evaluateNarrativeReviews({
    story,
    personas,
    rubric,
    protocol,
    reviews,
    config,
    enforceQuality: true,
  })
  assert.ok(result.hardGates.some((issue) => issue.code === 'NARRATIVE_EVIDENCE_NODE'))
})

test('必須ペルソナが空の設定を拒否する', () => {
  const result = evaluateNarrativeReviews({
    story,
    personas,
    rubric,
    protocol,
    reviews: [],
    config: { ...config, requiredPersonas: [] },
    enforceQuality: true,
  })
  assert.ok(result.hardGates.some((issue) => issue.code === 'NARRATIVE_PERSONA_COVERAGE'))
})

test('重複choice IDによるroute ID衝突を拒否する', () => {
  const changedStory = structuredClone(story)
  const choice = changedStory.nodes.find((node) => node.type === 'choice')
  choice.choices[1].id = choice.choices[0].id
  const result = evaluateNarrativeReviews({
    story: changedStory,
    personas,
    rubric,
    protocol,
    reviews: [],
    config,
    enforceQuality: true,
  })
  assert.ok(result.hardGates.some((issue) => issue.code === 'NARRATIVE_ROUTE_ID_COLLISION'))
})

test('同じsub-agent taskNameを使った複数人格レビューを拒否する', () => {
  const reviews = makeReviews()
  for (const review of reviews) review.reviewer.taskName = 'same-task'
  const result = evaluateNarrativeReviews({
    story,
    personas,
    rubric,
    protocol,
    reviews,
    config,
    enforceQuality: true,
  })
  assert.ok(result.hardGates.some((issue) => issue.code === 'NARRATIVE_REVIEW_INDEPENDENCE'))
})
