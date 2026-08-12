import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const REVIEW_SCHEMA_VERSION = 2

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  )
}

function digest(value) {
  const json = JSON.stringify(canonicalize(value))
  return `sha256:${crypto.createHash('sha256').update(json).digest('hex')}`
}

function referencesFrom(node) {
  if (node.type === 'choice') return (node.choices ?? []).flatMap((choice) => referencesFromTarget(choice.next))
  return node.next ? referencesFromTarget(node.next) : []
}

function referencesFromTarget(target) {
  if (typeof target === 'string') return [target]
  return [
    ...(target?.cases ?? []).map((item) => item.next),
    ...(target?.fallback ? [target.fallback] : []),
  ]
}

function resolveTarget(target, flags) {
  if (typeof target === 'string') return target
  const matched = (target?.cases ?? []).find((item) => (
    Array.isArray(item.requires) && item.requires.every((flag) => flags.has(flag))
  ))
  return matched?.next ?? target?.fallback
}

function replaceTemplates(value, templateValues) {
  return String(value ?? '').replace(/\{\{([^}]+)\}\}/g, (match, key) => (
    Object.hasOwn(templateValues, key) ? String(templateValues[key]) : match
  ))
}

function renderNode(node, decision, templateValues) {
  const expand = (value) => replaceTemplates(value, templateValues)
  if (node.type === 'mail') {
    return [
      `[${node.id}] MAIL ${expand(node.sentAt)} / FROM ${expand(node.from)}`,
      `件名: ${expand(node.subject)}`,
      expand(node.body),
    ].join('\n')
  }
  if (node.type === 'choice') {
    const choices = (node.choices ?? []).map((choice) => (
      `${choice.id === decision?.choiceId ? '>' : '-'} ${choice.id}: ${expand(choice.label)}`
    ))
    return [
      `[${node.id}] CHOICE ${expand(node.prompt)}`,
      ...choices,
    ].join('\n')
  }
  if (node.type === 'attachment') {
    return [
      `[${node.id}] ATTACHMENT ${expand(node.fileName)}`,
      `代替説明: ${expand(node.alt)}`,
      `キャプション: ${expand(node.caption)}`,
    ].join('\n')
  }
  if (node.type === 'system') {
    return [`[${node.id}] SYSTEM`, ...(node.lines ?? []).map(expand)].join('\n')
  }
  if (node.type === 'ending') {
    return [`[${node.id}] END ${expand(node.title)}`, expand(node.body)].join('\n')
  }
  return `[${node.id}] UNKNOWN`
}

export function enumerateNarrativeRoutes(story, templateValues = {}) {
  const nodes = Array.isArray(story?.nodes) ? story.nodes : []
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const routes = []

  function visit(nodeId, nodeIds, decisions, activeIds, flags) {
    const node = nodeMap.get(nodeId)
    if (!node || activeIds.has(nodeId)) return
    const nextNodeIds = [...nodeIds, nodeId]
    const nextActiveIds = new Set(activeIds)
    nextActiveIds.add(nodeId)

    if (node.type === 'ending') {
      const decisionMap = new Map(decisions.map((decision) => [decision.nodeId, decision]))
      const transcript = nextNodeIds
        .map((id) => renderNode(nodeMap.get(id), decisionMap.get(id), templateValues))
        .join('\n\n')
      routes.push({
        routeId: decisions
          .map((decision) => `${decision.nodeId}=${decision.choiceId}`)
          .join('--'),
        endingId: node.endingId ?? node.id,
        endingNodeId: node.id,
        nodeIds: nextNodeIds,
        decisions,
        transcript,
      })
      return
    }

    if (node.type === 'choice') {
      for (const choice of node.choices ?? []) {
        const nextFlags = new Set(flags)
        for (const flag of choice.effects?.flags ?? []) nextFlags.add(flag)
        const nextNodeId = resolveTarget(choice.next, nextFlags)
        if (!nextNodeId) continue
        visit(
          nextNodeId,
          nextNodeIds,
          [...decisions, {
            nodeId: node.id,
            choiceId: choice.id,
            label: replaceTemplates(choice.label, templateValues),
          }],
          nextActiveIds,
          nextFlags,
        )
      }
      return
    }

    const nextNodeId = node.next ? resolveTarget(node.next, flags) : undefined
    if (nextNodeId) visit(nextNodeId, nextNodeIds, decisions, nextActiveIds, flags)
  }

  visit(story?.meta?.startNodeId, [], [], new Set(), new Set())
  return routes.sort((left, right) => left.routeId.localeCompare(right.routeId))
}

export function calculateNarrativeMechanics(story) {
  const nodes = Array.isArray(story?.nodes) ? story.nodes : []
  const routes = enumerateNarrativeRoutes(story)
  const choices = nodes.filter((node) => node.type === 'choice')
  const persistentChoices = choices.filter((node) => {
    const endingSets = (node.choices ?? []).map((choice) => new Set(
      routes
        .filter((route) => route.decisions.some((decision) => (
          decision.nodeId === node.id && decision.choiceId === choice.id
        )))
        .map((route) => route.endingId),
    ))
    if (endingSets.some((endings) => endings.size === 0)) return false
    return endingSets.every((endings, index) => endingSets.every((other, otherIndex) => (
      index === otherIndex || [...endings].every((ending) => !other.has(ending))
    )))
  })
  const immediateAcknowledgements = choices.filter((node) => {
    const targets = (node.choices ?? []).map((choice) => JSON.stringify(choice.next))
    return targets.length > 1 && new Set(targets).size === targets.length
  })

  return {
    choices: choices.length,
    persistentChoices: persistentChoices.length,
    persistentChoiceRate: choices.length === 0 ? 0 : persistentChoices.length / choices.length,
    immediateAcknowledgementRate: choices.length === 0 ? 0 : immediateAcknowledgements.length / choices.length,
  }
}

function personaById(personas, personaId) {
  return (personas.personas ?? []).find((persona) => persona.id === personaId)
}

export function narrativeInputDigest({ story, persona, rubric, protocol, templateValues }) {
  const routes = enumerateNarrativeRoutes(story, templateValues)
  return digest({
    schemaVersion: REVIEW_SCHEMA_VERSION,
    story,
    persona,
    rubric,
    protocol,
    templateValues,
    routes,
  })
}

function dimensionIds(rubric, groupId) {
  return (rubric.groups?.[groupId]?.dimensions ?? []).map((dimension) => dimension.id)
}

function normalizeRating(rating, minimum, maximum) {
  return ((rating - minimum) / (maximum - minimum)) * 100
}

function mean(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function rounded(value) {
  return Math.round(value * 10) / 10
}

function scoreRoute(routeReview, rubric) {
  const minimum = rubric.ratingScale.minimum
  const maximum = rubric.ratingScale.maximum
  const interest = mean(dimensionIds(rubric, 'interest').map((dimensionId) => (
    normalizeRating(routeReview.interest[dimensionId], minimum, maximum)
  )))
  const originality = mean(dimensionIds(rubric, 'originality').map((dimensionId) => (
    normalizeRating(routeReview.originality[dimensionId], minimum, maximum)
  )))
  return {
    interest: rounded(interest),
    originality: rounded(originality),
    composite: rounded((interest + originality) / 2),
  }
}

function addIssue(issues, code, message) {
  if (!issues.some((issue) => issue.code === code && issue.message === message)) {
    issues.push({ code, message })
  }
}

function validateRouteReview({
  routeReview,
  route,
  rubric,
  personaId,
  hardGates,
}) {
  if (!routeReview || typeof routeReview !== 'object') {
    addIssue(
      hardGates,
      'NARRATIVE_REVIEW_INVALID',
      `${personaId}/${route?.routeId ?? '(unknown)'}の経路レビューがオブジェクトではありません`,
    )
    return { valid: false, clicheSignals: [] }
  }
  const routeLabel = `${personaId}/${route?.routeId ?? routeReview.routeId ?? '(unknown)'}`
  let valid = true
  const minimum = rubric.ratingScale.minimum
  const maximum = rubric.ratingScale.maximum

  for (const groupId of ['interest', 'originality']) {
    for (const dimensionId of dimensionIds(rubric, groupId)) {
      const value = routeReview[groupId]?.[dimensionId]
      if (!Number.isInteger(value) || value < minimum || value > maximum) {
        addIssue(
          hardGates,
          'NARRATIVE_RATING_RANGE',
          `${routeLabel}/${groupId}.${dimensionId}は${minimum}〜${maximum}の整数ではありません`,
        )
        valid = false
      }
    }
  }

  const evidenceNodeIds = Array.isArray(routeReview.evidenceNodeIds)
    ? routeReview.evidenceNodeIds
    : []
  if (
    new Set(evidenceNodeIds).size < 2 ||
    evidenceNodeIds.some((nodeId) => !route?.nodeIds.includes(nodeId))
  ) {
    addIssue(
      hardGates,
      'NARRATIVE_EVIDENCE_NODE',
      `${routeLabel}の根拠ノードが2件未満か、対象経路に存在しません`,
    )
    valid = false
  }

  for (const field of ['interestReason', 'originalityReason']) {
    if (Array.from(String(routeReview[field] ?? '')).length < 20) {
      addIssue(
        hardGates,
        'NARRATIVE_REASON_MISSING',
        `${routeLabel}の${field}が20文字未満です`,
      )
      valid = false
    }
  }

  const allowedSignals = new Set(rubric.clicheSignals ?? [])
  const clicheSignals = Array.isArray(routeReview.clicheSignals) ? routeReview.clicheSignals : []
  if (!Array.isArray(routeReview.clicheSignals)) {
    addIssue(
      hardGates,
      'NARRATIVE_REVIEW_INVALID',
      `${routeLabel}のclicheSignalsが配列ではありません`,
    )
    valid = false
  }
  if (clicheSignals.some((signal) => !allowedSignals.has(signal))) {
    addIssue(
      hardGates,
      'NARRATIVE_CLICHE_SIGNAL',
      `${routeLabel}に未定義のclicheSignalsがあります`,
    )
    valid = false
  }
  return { valid, clicheSignals }
}

export function evaluateNarrativeReviews({
  story,
  personas,
  rubric,
  protocol,
  reviews,
  config = {},
  enforceQuality = false,
}) {
  const hardGates = []
  const warnings = []
  const qualityIssues = []
  const templateValues = config.templateValues ?? {}
  const routes = enumerateNarrativeRoutes(story, templateValues)
  const routeMap = new Map(routes.map((route) => [route.routeId, route]))
  const configuredPersonaIds = config.requiredPersonas
  const requiredPersonaIds = Array.isArray(configuredPersonaIds)
    ? configuredPersonaIds
    : (personas.personas ?? []).map((persona) => persona.id)
  const reviewMap = new Map()

  if (routes.length !== routeMap.size) {
    addIssue(hardGates, 'NARRATIVE_ROUTE_ID_COLLISION', '完走経路のrouteIdが一意ではありません')
  }
  if (
    !Array.isArray(configuredPersonaIds) ||
    requiredPersonaIds.length < 5 ||
    new Set(requiredPersonaIds).size !== requiredPersonaIds.length
  ) {
    addIssue(hardGates, 'NARRATIVE_PERSONA_COVERAGE', '必須ペルソナは重複なしで5人格以上必要です')
  }
  if (!Array.isArray(reviews)) {
    addIssue(hardGates, 'NARRATIVE_REVIEW_INVALID', 'reviewsが配列ではありません')
  }

  for (const review of Array.isArray(reviews) ? reviews : []) {
    const personaId = review?.personaId
    if (!personaId || reviewMap.has(personaId)) {
      addIssue(hardGates, 'NARRATIVE_REVIEW_INVALID', `personaIdがないか重複しています: ${personaId ?? '(none)'}`)
      continue
    }
    reviewMap.set(personaId, review)
  }
  const taskNames = requiredPersonaIds
    .map((personaId) => reviewMap.get(personaId)?.reviewer?.taskName)
    .filter(Boolean)
  if (new Set(taskNames).size !== taskNames.length) {
    addIssue(
      hardGates,
      'NARRATIVE_REVIEW_INDEPENDENCE',
      '必須ペルソナ間でreviewer.taskNameが重複しています',
    )
  }

  const validPersonaResults = []
  for (const personaId of requiredPersonaIds) {
    const persona = personaById(personas, personaId)
    const review = reviewMap.get(personaId)
    if (!persona) {
      addIssue(hardGates, 'NARRATIVE_PERSONA_INVALID', `ペルソナ定義がありません: ${personaId}`)
      continue
    }
    if (!review) {
      addIssue(hardGates, 'NARRATIVE_REVIEW_MISSING', `レビューがありません: ${personaId}`)
      continue
    }
    if (review.loadError) {
      addIssue(hardGates, 'NARRATIVE_REVIEW_INVALID', `${personaId}のJSONを読み込めません: ${review.loadError}`)
      continue
    }
    if (review.schemaVersion !== REVIEW_SCHEMA_VERSION) {
      addIssue(hardGates, 'NARRATIVE_REVIEW_INVALID', `${personaId}のschemaVersionが不正です`)
      continue
    }

    const expectedDigest = narrativeInputDigest({
      story,
      persona,
      rubric,
      protocol,
      templateValues,
    })
    if (review.inputDigest !== expectedDigest) {
      addIssue(hardGates, 'NARRATIVE_REVIEW_STALE', `${personaId}のレビュー入力が現在の物語・人格・ルーブリックと一致しません`)
      continue
    }
    if (
      review.reviewer?.kind !== 'codex-sub-agent' ||
      review.reviewer?.independent !== true ||
      !review.reviewer?.taskName
    ) {
      addIssue(hardGates, 'NARRATIVE_REVIEW_INVALID', `${personaId}が独立sub-agentレビューとして記録されていません`)
      continue
    }

    if (!Array.isArray(review.routes)) {
      addIssue(hardGates, 'NARRATIVE_REVIEW_INVALID', `${personaId}のroutesが配列ではありません`)
      continue
    }
    const personaRouteMap = new Map()
    for (const routeReview of review.routes) {
      if (!routeReview?.routeId || personaRouteMap.has(routeReview.routeId)) {
        addIssue(hardGates, 'NARRATIVE_ROUTE_COVERAGE', `${personaId}にrouteIdの欠落または重複があります`)
        continue
      }
      personaRouteMap.set(routeReview.routeId, routeReview)
    }
    const missingRouteIds = routes
      .map((route) => route.routeId)
      .filter((routeId) => !personaRouteMap.has(routeId))
    const unknownRouteIds = [...personaRouteMap.keys()].filter((routeId) => !routeMap.has(routeId))
    if (missingRouteIds.length > 0 || unknownRouteIds.length > 0) {
      addIssue(
        hardGates,
        'NARRATIVE_ROUTE_COVERAGE',
        `${personaId}の経路網羅が不正です: missing=${missingRouteIds.length} unknown=${unknownRouteIds.length}`,
      )
      continue
    }

    const routeScores = []
    let routesValid = true
    for (const route of routes) {
      const routeReview = personaRouteMap.get(route.routeId)
      const validated = validateRouteReview({
        routeReview,
        route,
        rubric,
        personaId,
        hardGates,
      })
      if (!validated.valid) {
        routesValid = false
        continue
      }
      routeScores.push({
        routeId: route.routeId,
        endingId: route.endingId,
        ...scoreRoute(routeReview, rubric),
        clicheSignals: validated.clicheSignals,
        ratings: {
          interest: routeReview.interest,
          originality: routeReview.originality,
        },
      })
    }
    if (!routesValid) continue

    const forcedTestIds = new Set((rubric.forcedTests ?? []).map((item) => item.id))
    const forcedResults = review.forcedTests ?? {}
    const forcedTestsValid = [...forcedTestIds].every((testId) => {
      const item = forcedResults[testId]
      return (
        typeof item?.genericityDetected === 'boolean' &&
        Array.from(String(item.reason ?? '')).length >= 20
      )
    })
    if (!forcedTestsValid) {
      addIssue(hardGates, 'NARRATIVE_FORCED_TEST', `${personaId}の凡庸さ強制テストが不足しています`)
      continue
    }
    if (
      Array.from(String(review.overallNotes?.strength ?? '')).length < 20 ||
      Array.from(String(review.overallNotes?.risk ?? '')).length < 20
    ) {
      addIssue(hardGates, 'NARRATIVE_REVIEW_INVALID', `${personaId}の総評が20文字未満です`)
      continue
    }

    validPersonaResults.push({
      personaId,
      interest: rounded(mean(routeScores.map((item) => item.interest))),
      originality: rounded(mean(routeScores.map((item) => item.originality))),
      composite: rounded(mean(routeScores.map((item) => item.composite))),
      routeScores,
      forcedTests: forcedResults,
    })
  }

  const routeResults = routes.map((route) => {
    const scores = validPersonaResults
      .map((persona) => persona.routeScores.find((item) => item.routeId === route.routeId))
      .filter(Boolean)
    return {
      routeId: route.routeId,
      endingId: route.endingId,
      interest: rounded(median(scores.map((item) => item.interest))),
      originality: rounded(median(scores.map((item) => item.originality))),
      composite: rounded(median(scores.map((item) => item.composite))),
      clicheSignals: [...new Set(scores.flatMap((item) => item.clicheSignals))],
    }
  })
  const interest = rounded(median(validPersonaResults.map((item) => item.interest)))
  const originality = rounded(median(validPersonaResults.map((item) => item.originality)))
  const composite = rounded((interest + originality) / 2)
  const weakestRoute = [...routeResults].sort((left, right) => left.composite - right.composite)[0]
  const dimensionMedians = Object.fromEntries(['interest', 'originality'].map((groupId) => [
    groupId,
    Object.fromEntries(dimensionIds(rubric, groupId).map((dimensionId) => [
      dimensionId,
      rounded(median(validPersonaResults.flatMap((persona) => (
        persona.routeScores.map((route) => route.ratings[groupId][dimensionId])
      )))),
    ])),
  ]))
  const clicheCounts = new Map()
  for (const persona of validPersonaResults) {
    for (const route of persona.routeScores) {
      for (const signal of new Set(route.clicheSignals)) {
        const current = clicheCounts.get(signal) ?? {
          personaIds: new Set(),
          routeIds: new Set(),
          occurrences: 0,
        }
        current.personaIds.add(persona.personaId)
        current.routeIds.add(route.routeId)
        current.occurrences += 1
        clicheCounts.set(signal, current)
      }
    }
  }
  const frequentCliches = [...clicheCounts.entries()]
    .map(([signal, counts]) => ({
      signal,
      personaCount: counts.personaIds.size,
      routeCount: counts.routeIds.size,
      occurrences: counts.occurrences,
    }))
    .sort((left, right) => (
      right.personaCount - left.personaCount ||
      right.routeCount - left.routeCount ||
      left.signal.localeCompare(right.signal)
    ))
  const forcedTestConsensus = (rubric.forcedTests ?? []).map((test) => {
    const detectedPersonaIds = validPersonaResults
      .filter((persona) => persona.forcedTests[test.id]?.genericityDetected === true)
      .map((persona) => persona.personaId)
    return {
      testId: test.id,
      genericityWhenTrue: test.genericityWhenTrue,
      detectedPersonas: detectedPersonaIds.length,
      personaIds: detectedPersonaIds,
    }
  })

  if (validPersonaResults.length === requiredPersonaIds.length && requiredPersonaIds.length > 0) {
    const thresholds = config.thresholds ?? {}
    if (interest < (thresholds.minInterest ?? 70)) {
      addIssue(qualityIssues, 'NARRATIVE_INTEREST', `面白さ${interest}が閾値${thresholds.minInterest ?? 70}未満です`)
    }
    if (originality < (thresholds.minOriginality ?? 65)) {
      addIssue(qualityIssues, 'NARRATIVE_ORIGINALITY', `非凡庸性${originality}が閾値${thresholds.minOriginality ?? 65}未満です`)
    }
    if (composite < (thresholds.minComposite ?? 68)) {
      addIssue(qualityIssues, 'NARRATIVE_COMPOSITE', `合議点${composite}が閾値${thresholds.minComposite ?? 68}未満です`)
    }
    if (weakestRoute && weakestRoute.composite < (thresholds.minWeakestRoute ?? 60)) {
      addIssue(
        qualityIssues,
        'NARRATIVE_WEAK_ROUTE',
        `最低経路${weakestRoute.routeId}が${weakestRoute.composite}で閾値${thresholds.minWeakestRoute ?? 60}未満です`,
      )
    }
    const genericPersonas = validPersonaResults.filter((item) => (
      item.originality < (thresholds.minOriginality ?? 65)
    ))
    if (genericPersonas.length > (thresholds.maxGenericPersonas ?? 2)) {
      addIssue(
        qualityIssues,
        'NARRATIVE_GENERIC_CONSENSUS',
        `${genericPersonas.length}/${validPersonaResults.length}人格が非凡庸性を閾値未満と判定しました`,
      )
    }
    for (const test of forcedTestConsensus) {
      if (test.detectedPersonas >= (thresholds.forcedTestConsensusPersonas ?? 3)) {
        addIssue(
          qualityIssues,
          'NARRATIVE_FORCED_TEST_CONSENSUS',
          `${test.testId}: ${test.detectedPersonas}/${validPersonaResults.length}人格が「${test.genericityWhenTrue}」と判定しました`,
        )
      }
    }

    const personaScores = validPersonaResults.map((item) => item.composite)
    const spread = personaScores.length === 0 ? 0 : Math.max(...personaScores) - Math.min(...personaScores)
    if (spread >= (thresholds.disagreementWarningSpread ?? 30)) {
      addIssue(warnings, 'NARRATIVE_DISAGREEMENT', `人格間の総合点差が${rounded(spread)}あります`)
    }
  }

  const qualityTarget = enforceQuality ? hardGates : warnings
  for (const issue of qualityIssues) addIssue(qualityTarget, issue.code, issue.message)
  const mechanics = calculateNarrativeMechanics(story)
  if (mechanics.persistentChoiceRate < 0.5) {
    addIssue(
      warnings,
      'NARRATIVE_CHOICE_PERSISTENCE',
      `終端差へ残る選択は${mechanics.persistentChoices}/${mechanics.choices}です`,
    )
  }

  return {
    score: Math.round(composite),
    sections: { interest, originality },
    hardGates,
    warnings,
    stats: {
      personas: validPersonaResults.length,
      requiredPersonas: requiredPersonaIds.length,
      routes: routes.length,
      reviewedRoutes: routeResults.filter((route) => (
        validPersonaResults.length === requiredPersonaIds.length && route.composite >= 0
      )).length,
      reviewedPersonaRoutes: validPersonaResults.reduce(
        (sum, persona) => sum + persona.routeScores.length,
        0,
      ),
      totalPersonaRoutes: requiredPersonaIds.length * routes.length,
      weakestRoute,
      personaScores: validPersonaResults,
      dimensionMedians,
      frequentCliches,
      forcedTestConsensus,
      mechanics,
    },
  }
}

export function loadNarrativeInputs(rootDir, config) {
  let personas
  let rubric
  let protocol
  try {
    personas = JSON.parse(fs.readFileSync(path.join(rootDir, config.personasFile), 'utf8'))
    rubric = JSON.parse(fs.readFileSync(path.join(rootDir, config.rubricFile), 'utf8'))
    protocol = fs.readFileSync(path.join(rootDir, config.protocolFile), 'utf8').trim()
    if (
      !personas ||
      !Array.isArray(personas.personas) ||
      !rubric ||
      !rubric.ratingScale ||
      !rubric.groups?.interest ||
      !rubric.groups?.originality ||
      !protocol
    ) {
      throw new Error('persona、rubric、protocolの必須構造がありません')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`NARRATIVE_CONFIG_INVALID: ${message}`)
  }
  const reviews = (config.requiredPersonas ?? []).flatMap((personaId) => {
    const relativePath = path.join(config.reviewsDir, `${personaId}.json`)
    const absolutePath = path.join(rootDir, relativePath)
    if (!fs.existsSync(absolutePath)) return []
    try {
      return [JSON.parse(fs.readFileSync(absolutePath, 'utf8'))]
    } catch (error) {
      return [{
        personaId,
        loadError: error instanceof Error ? error.message : String(error),
      }]
    }
  })
  return { personas, rubric, protocol, reviews }
}
