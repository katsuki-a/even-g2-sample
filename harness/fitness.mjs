import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = path.resolve(HARNESS_DIR, '..')
const NODE_TYPES = new Set(['mail', 'choice', 'attachment', 'system', 'ending'])

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function characterLength(value) {
  return Array.from(String(value ?? '')).length
}

function uniqueIssues(issues) {
  const seen = new Set()
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function referencesFrom(node) {
  if (node.type === 'choice') return (node.choices ?? []).map((choice) => choice.next)
  return node.next ? [node.next] : []
}

function enumeratePaths(story, nodeMap, addGate) {
  const paths = []
  const maximumPaths = 512

  function visit(nodeId, currentPath, activeIds) {
    if (paths.length >= maximumPaths) {
      addGate('STORY_TOO_MANY_PATHS', `経路数が${maximumPaths}を超えました`)
      return
    }
    const node = nodeMap.get(nodeId)
    if (!node) return
    if (activeIds.has(nodeId)) {
      addGate('STORY_CYCLE', `循環を検出しました: ${[...currentPath, nodeId].join(' -> ')}`)
      return
    }

    const nextPath = [...currentPath, nodeId]
    if (node.type === 'ending') {
      paths.push(nextPath)
      return
    }

    const references = referencesFrom(node)
    if (references.length === 0) {
      addGate('STORY_DEAD_END', `${nodeId}がending以外で終端になっています`)
      return
    }

    const nextActiveIds = new Set(activeIds)
    nextActiveIds.add(nodeId)
    for (const reference of references) visit(reference, nextPath, nextActiveIds)
  }

  visit(story.meta?.startNodeId, [], new Set())
  return paths
}

function pathHasOrderedBeats(pathIds, nodeMap, beatOrder) {
  let cursor = -1
  for (const beat of beatOrder) {
    const nextIndex = pathIds.findIndex((nodeId, index) => {
      if (index <= cursor) return false
      return (nodeMap.get(nodeId)?.tags ?? []).includes(beat)
    })
    if (nextIndex === -1) return false
    cursor = nextIndex
  }
  return true
}

function everyPath(paths, predicate) {
  return paths.length > 0 && paths.every(predicate)
}

export function evaluateStory(story, options = {}) {
  const rootDir = options.rootDir ?? DEFAULT_ROOT
  const hardGates = []
  const warnings = []
  const addGate = (code, message) => hardGates.push({ code, message })
  const addWarning = (code, message) => warnings.push({ code, message })

  if (!story || typeof story !== 'object') {
    return {
      score: 0,
      sections: {},
      hardGates: [{ code: 'STORY_INVALID', message: 'Storyがオブジェクトではありません' }],
      warnings,
      stats: {},
    }
  }

  const nodes = Array.isArray(story.nodes) ? story.nodes : []
  if (nodes.length === 0) addGate('STORY_NO_NODES', 'nodesが空です')

  const nodeMap = new Map()
  let uniqueIds = true
  for (const node of nodes) {
    if (!node?.id || typeof node.id !== 'string') {
      uniqueIds = false
      addGate('STORY_NODE_ID', 'IDのないノードがあります')
      continue
    }
    if (nodeMap.has(node.id)) {
      uniqueIds = false
      addGate('STORY_DUPLICATE_ID', `重複ノードID: ${node.id}`)
    }
    nodeMap.set(node.id, node)
    if (!NODE_TYPES.has(node.type)) addGate('STORY_NODE_TYPE', `${node.id}のtypeが不正です: ${node.type}`)
  }

  const startNodeId = story.meta?.startNodeId
  const hasStart = typeof startNodeId === 'string' && nodeMap.has(startNodeId)
  if (!hasStart) addGate('STORY_START', `開始ノードが存在しません: ${startNodeId ?? '(none)'}`)

  let referencesValid = true
  for (const node of nodes) {
    if (node.type === 'ending' && node.next) {
      referencesValid = false
      addGate('STORY_ENDING_NEXT', `${node.id}はendingですがnextを持っています`)
    }
    for (const reference of referencesFrom(node)) {
      if (!nodeMap.has(reference)) {
        referencesValid = false
        addGate('STORY_DANGLING_REFERENCE', `${node.id}から存在しない${reference}を参照しています`)
      }
    }
  }

  const reachable = new Set()
  if (hasStart) {
    const queue = [startNodeId]
    while (queue.length > 0) {
      const nodeId = queue.shift()
      if (reachable.has(nodeId)) continue
      reachable.add(nodeId)
      const node = nodeMap.get(nodeId)
      if (!node) continue
      for (const reference of referencesFrom(node)) {
        if (nodeMap.has(reference)) queue.push(reference)
      }
    }
  }
  const unreachableIds = [...nodeMap.keys()].filter((nodeId) => !reachable.has(nodeId))
  if (unreachableIds.length > 0) {
    addGate('STORY_UNREACHABLE', `到達不能ノード: ${unreachableIds.join(', ')}`)
  }

  const paths = hasStart && referencesValid
    ? enumeratePaths(story, nodeMap, addGate)
    : []
  if (paths.length === 0) addGate('STORY_NO_COMPLETE_PATH', 'endingへ到達する経路がありません')

  const limits = story.meta?.contentLimits ?? {}
  const subjectLimit = limits.subjectChars ?? 24
  const bodyLimit = limits.bodyChars ?? 160
  const choiceLabelLimit = limits.choiceLabelChars ?? 24
  const minimumChoices = limits.choicesPerNode?.min ?? 2
  const maximumChoices = limits.choicesPerNode?.max ?? 3
  let subjectsFit = true
  let bodiesFit = true
  let choicesFit = true
  let noEmptyContent = true
  let choiceTargetsDistinct = true
  let choiceEffectsPresent = true

  for (const node of nodes) {
    if (node.type === 'mail') {
      if (!node.subject || !node.body) {
        noEmptyContent = false
        addGate('STORY_EMPTY_MAIL', `${node.id}の件名または本文が空です`)
      }
      if (characterLength(node.subject) > subjectLimit) {
        subjectsFit = false
        addGate('STORY_SUBJECT_LENGTH', `${node.id}の件名が${subjectLimit}文字を超えています`)
      }
      if (characterLength(node.body) > bodyLimit) {
        bodiesFit = false
        addGate('STORY_BODY_LENGTH', `${node.id}の本文が${bodyLimit}文字を超えています`)
      }
    }

    if (node.type === 'ending') {
      if (!node.title || !node.body) {
        noEmptyContent = false
        addGate('STORY_EMPTY_ENDING', `${node.id}のタイトルまたは本文が空です`)
      }
      if (characterLength(node.body) > bodyLimit) {
        bodiesFit = false
        addGate('STORY_BODY_LENGTH', `${node.id}の本文が${bodyLimit}文字を超えています`)
      }
    }

    if (node.type === 'system') {
      const lines = Array.isArray(node.lines) ? node.lines : []
      if (lines.length === 0) {
        noEmptyContent = false
        addGate('STORY_EMPTY_SYSTEM', `${node.id}のlinesが空です`)
      }
      if (characterLength(lines.join('\n')) > bodyLimit) {
        bodiesFit = false
        addGate('STORY_BODY_LENGTH', `${node.id}のシステム表示が${bodyLimit}文字を超えています`)
      }
    }

    if (node.type === 'attachment') {
      if (!node.fileName || !node.alt || !node.caption) {
        noEmptyContent = false
        addGate('STORY_EMPTY_ATTACHMENT', `${node.id}の添付情報が不足しています`)
      }
      if (node.assetStatus === 'ready' && !fs.existsSync(path.join(rootDir, node.asset))) {
        addGate('STORY_ATTACHMENT_MISSING', `${node.id}のassetが存在しません: ${node.asset}`)
      }
      if (node.assetStatus !== 'ready') {
        addWarning('STORY_ATTACHMENT_PLANNED', `${node.id}のassetは未作成です: ${node.asset}`)
      }
    }

    if (node.type === 'choice') {
      const choices = Array.isArray(node.choices) ? node.choices : []
      if (choices.length < minimumChoices || choices.length > maximumChoices) {
        choicesFit = false
        addGate('STORY_CHOICE_COUNT', `${node.id}の選択肢数が${minimumChoices}〜${maximumChoices}ではありません`)
      }
      const targets = choices.map((choice) => choice.next)
      if (new Set(targets).size !== targets.length) {
        choiceTargetsDistinct = false
        addGate('STORY_CHOICE_TARGET', `${node.id}に同じ遷移先の選択肢があります`)
      }
      for (const choice of choices) {
        if (!choice.label || characterLength(choice.label) > choiceLabelLimit) {
          choicesFit = false
          addGate('STORY_CHOICE_LABEL', `${node.id}/${choice.id ?? '(no id)'}のラベルが空か長すぎます`)
        }
        if (!choice.effects || !Array.isArray(choice.effects.flags)) {
          choiceEffectsPresent = false
          addGate('STORY_CHOICE_EFFECT', `${node.id}/${choice.id ?? '(no id)'}にeffects.flagsがありません`)
        }
      }
    }
  }

  const endingIds = new Set(
    paths
      .map((pathIds) => nodeMap.get(pathIds.at(-1)))
      .filter((node) => node?.type === 'ending')
      .map((node) => node.endingId ?? node.id),
  )
  const multipleEndings = endingIds.size >= 2
  if (!multipleEndings) addGate('STORY_ENDING_VARIETY', '到達可能なendingが2種類未満です')

  const targetPathNodes = story.meta?.targetPathNodes ?? { min: 10, max: 18 }
  const pathLengthsFit = everyPath(
    paths,
    (pathIds) => pathIds.length >= targetPathNodes.min && pathIds.length <= targetPathNodes.max,
  )
  if (!pathLengthsFit) {
    addGate(
      'STORY_PATH_LENGTH',
      `経路長が${targetPathNodes.min}〜${targetPathNodes.max}ノードに収まりません`,
    )
  }

  const enoughChoices = everyPath(
    paths,
    (pathIds) => pathIds.filter((nodeId) => nodeMap.get(nodeId)?.type === 'choice').length >= 3,
  )
  if (!enoughChoices) addGate('STORY_PATH_AGENCY', '3回未満の選択で終わる経路があります')

  const earlyChoice = everyPath(paths, (pathIds) => {
    const index = pathIds.findIndex((nodeId) => nodeMap.get(nodeId)?.type === 'choice')
    return index >= 0 && index <= 1
  })
  if (!earlyChoice) addGate('STORY_LATE_FIRST_CHOICE', '最初の2ノード以内に選択がありません')

  const earlyAttachment = everyPath(paths, (pathIds) => {
    const index = pathIds.findIndex((nodeId) => nodeMap.get(nodeId)?.type === 'attachment')
    return index >= 0 && index <= Math.floor(pathIds.length / 2)
  })
  if (!earlyAttachment) addGate('STORY_LATE_ATTACHMENT', '添付が経路の中盤までに現れません')

  const allActs = everyPath(paths, (pathIds) => {
    const acts = new Set(pathIds.map((nodeId) => nodeMap.get(nodeId)?.act))
    return acts.has(1) && acts.has(2) && acts.has(3)
  })
  if (!allActs) addGate('STORY_ACTS', 'Act 1〜3をすべて含まない経路があります')

  const beatOrder = story.meta?.requiredBeatOrder ?? []
  const beatsOrdered = beatOrder.length > 0 && everyPath(
    paths,
    (pathIds) => pathHasOrderedBeats(pathIds, nodeMap, beatOrder),
  )
  if (!beatsOrdered) addGate('STORY_BEAT_ORDER', '必須ビートが全経路で指定順に現れません')

  const characterPresence = everyPath(paths, (pathIds) => (
    pathIds.filter((nodeId) => (nodeMap.get(nodeId)?.tags ?? []).includes('character')).length >= 3
  ))
  if (!characterPresence) addWarning('STORY_CHARACTER_PRESENCE', '人物ビートが3回未満の経路があります')

  const attachmentPresence = everyPath(
    paths,
    (pathIds) => pathIds.some((nodeId) => nodeMap.get(nodeId)?.type === 'attachment'),
  )
  const cliffhangerPresence = everyPath(
    paths,
    (pathIds) => pathIds.some((nodeId) => (nodeMap.get(nodeId)?.tags ?? []).includes('cliffhanger')),
  )

  const sections = {
    structure:
      (uniqueIds ? 5 : 0) +
      (hasStart ? 5 : 0) +
      (referencesValid ? 5 : 0) +
      (unreachableIds.length === 0 ? 5 : 0) +
      (paths.length > 0 && multipleEndings ? 5 : 0),
    displayFit:
      (subjectsFit ? 5 : 0) +
      (bodiesFit ? 7 : 0) +
      (choicesFit ? 5 : 0) +
      (noEmptyContent ? 3 : 0),
    pacing:
      (earlyChoice ? 5 : 0) +
      (earlyAttachment ? 5 : 0) +
      (pathLengthsFit ? 5 : 0) +
      (allActs ? 5 : 0),
    agency:
      (enoughChoices ? 6 : 0) +
      (choiceTargetsDistinct ? 5 : 0) +
      (choiceEffectsPresent ? 4 : 0) +
      (multipleEndings ? 5 : 0),
    information:
      (beatsOrdered ? 8 : 0) +
      (characterPresence ? 3 : 0) +
      (attachmentPresence ? 2 : 0) +
      (cliffhangerPresence ? 2 : 0),
  }
  const score = Object.values(sections).reduce((sum, value) => sum + value, 0)

  return {
    score,
    sections,
    hardGates: uniqueIssues(hardGates),
    warnings: uniqueIssues(warnings),
    stats: {
      nodes: nodes.length,
      paths: paths.length,
      pathLengths: [...new Set(paths.map((pathIds) => pathIds.length))].sort((a, b) => a - b),
      endings: endingIds.size,
      unreachable: unreachableIds.length,
    },
  }
}

export function evaluateDocs(rootDir, config) {
  const requiredDocs = config.requiredDocs ?? []
  const missing = []
  const empty = []
  for (const relativePath of requiredDocs) {
    const absolutePath = path.join(rootDir, relativePath)
    if (!fs.existsSync(absolutePath)) {
      missing.push(relativePath)
      continue
    }
    if (fs.readFileSync(absolutePath, 'utf8').trim().length < 40) empty.push(relativePath)
  }
  const validCount = requiredDocs.length - missing.length - empty.length
  const score = requiredDocs.length === 0 ? 100 : Math.round((validCount / requiredDocs.length) * 100)
  const hardGates = [
    ...missing.map((item) => ({ code: 'DOC_MISSING', message: `必須文書がありません: ${item}` })),
    ...empty.map((item) => ({ code: 'DOC_EMPTY', message: `必須文書が実質的に空です: ${item}` })),
  ]
  return { score, hardGates, warnings: [], stats: { required: requiredDocs.length, valid: validCount } }
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return []
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(absolutePath))
    else files.push(absolutePath)
  }
  return files
}

export function evaluateArchitecture(rootDir, config) {
  const architecture = config.architecture ?? {}
  const requiredFiles = architecture.requiredFiles ?? []
  const missingFiles = requiredFiles.filter((relativePath) => !fs.existsSync(path.join(rootDir, relativePath)))
  const requiredFileRatio = requiredFiles.length === 0
    ? 1
    : (requiredFiles.length - missingFiles.length) / requiredFiles.length

  const mainPath = path.join(rootDir, 'src/main.ts')
  const mainLines = fs.existsSync(mainPath)
    ? fs.readFileSync(mainPath, 'utf8').split(/\r?\n/).length
    : Number.POSITIVE_INFINITY
  const mainIsThin = mainLines <= (architecture.maxMainLines ?? 120)

  const domainFiles = listFiles(path.join(rootDir, 'src/domain')).filter((filePath) => filePath.endsWith('.ts'))
  const domainViolations = []
  for (const filePath of domainFiles) {
    const source = fs.readFileSync(filePath, 'utf8')
    for (const token of architecture.domainForbiddenTokens ?? []) {
      if (source.includes(token)) domainViolations.push(`${path.relative(rootDir, filePath)}: ${token}`)
    }
  }

  const packageJson = readJson(path.join(rootDir, 'package.json'))
  const missingScripts = (architecture.requiredScripts ?? []).filter((script) => !packageJson.scripts?.[script])
  const appJsonPath = path.join(rootDir, 'app.json')
  const appJson = fs.existsSync(appJsonPath) ? readJson(appJsonPath) : { permissions: [] }
  const allowedPermissions = new Set(architecture.mvpAllowedPermissions ?? [])
  const unexpectedPermissions = (appJson.permissions ?? [])
    .map((permission) => permission.name)
    .filter((permission) => !allowedPermissions.has(permission))

  const tests = listFiles(path.join(rootDir, 'src')).filter((filePath) => /\.test\.(ts|js|mjs)$/.test(filePath))
  const harnessTests = listFiles(path.join(rootDir, 'harness')).filter((filePath) => /\.test\.mjs$/.test(filePath))
  const hasStoryEngineTest = tests.some((filePath) => filePath.includes('engine'))

  const hardGates = [
    ...missingFiles.map((item) => ({ code: 'ARCH_FILE_MISSING', message: `目標モジュールがありません: ${item}` })),
    ...(mainIsThin ? [] : [{ code: 'ARCH_MAIN_SIZE', message: `src/main.tsが${mainLines}行です。上限は${architecture.maxMainLines ?? 120}行です` }]),
    ...domainViolations.map((item) => ({ code: 'ARCH_DOMAIN_DEPENDENCY', message: `ドメイン層の禁止依存: ${item}` })),
    ...missingScripts.map((item) => ({ code: 'ARCH_SCRIPT_MISSING', message: `package scriptがありません: ${item}` })),
    ...unexpectedPermissions.map((item) => ({ code: 'ARCH_PERMISSION', message: `MVPで許可されていない権限: ${item}` })),
    ...(hasStoryEngineTest ? [] : [{ code: 'ARCH_ENGINE_TEST', message: 'Story Engineの自動テストがありません' }]),
  ]

  const moduleBoundary = Math.round(requiredFileRatio * 20) + (mainIsThin ? 10 : 0)
  const testability = Math.min(15, (tests.length * 5)) + (hasStoryEngineTest ? 10 : 0)
  const sdkFit = fs.existsSync(path.join(rootDir, 'src/platform/image-queue.ts')) ? 20 : 0
  const recovery = fs.existsSync(path.join(rootDir, 'src/platform/storage.ts')) ? 15 : 0
  const leastPrivilege = unexpectedPermissions.length === 0 ? 10 : 0
  const score = Math.min(100, moduleBoundary + testability + sdkFit + recovery + leastPrivilege)

  return {
    score,
    sections: { moduleBoundary, testability, sdkFit, recovery, leastPrivilege },
    hardGates: uniqueIssues(hardGates),
    warnings: harnessTests.length > 0 ? [] : [{ code: 'ARCH_HARNESS_TEST', message: 'Fitness Harness自体のテストがありません' }],
    stats: {
      requiredFiles: requiredFiles.length,
      presentFiles: requiredFiles.length - missingFiles.length,
      mainLines,
      sourceTests: tests.length,
      harnessTests: harnessTests.length,
      unexpectedPermissions,
    },
  }
}

export function evaluateReleaseEvidence(evidence) {
  const hardGates = []
  const addGate = (code, message) => hardGates.push({ code, message })
  const simulatorChecks = [
    evidence.simulator?.status === 'passed',
    evidence.simulator?.allPaths === true,
    evidence.simulator?.restartResume === true,
    evidence.simulator?.attachmentRetry === true,
    (evidence.simulator?.screenshotPaths?.length ?? 0) > 0,
  ]
  const hardwareChecks = [
    evidence.hardware?.status === 'passed',
    evidence.hardware?.allPaths === true,
    evidence.hardware?.g2Input === true,
    evidence.hardware?.r1Input === true,
    evidence.hardware?.lockedPhone === true,
    evidence.hardware?.idleTwoMinutes === true,
    evidence.hardware?.attachmentRetry === true,
  ]
  const participants = evidence.userTest?.participants ?? 0
  const userChecks = [
    participants >= 5,
    (evidence.userTest?.understoodHookUnder60Seconds ?? 0) >= 4,
    (evidence.userTest?.continueRatingFourOrMore ?? 0) >= 4,
  ]
  const reviewValues = Object.values(evidence.narrativeReview ?? {})
  const reviewChecks = reviewValues.length === 6 && reviewValues.every((value) => typeof value === 'number' && value >= 4)
  const bugChecks = evidence.openBugs?.p0 === 0 && evidence.openBugs?.p1 === 0

  if (!simulatorChecks.every(Boolean)) addGate('RELEASE_SIMULATOR', 'シミュレータ証拠が未完了です')
  if (!hardwareChecks.every(Boolean)) addGate('RELEASE_HARDWARE', '実機証拠が未完了です')
  if (!userChecks.every(Boolean)) addGate('RELEASE_USER_TEST', '5人ユーザーテストの閾値を満たしていません')
  if (!reviewChecks) addGate('RELEASE_NARRATIVE', '物語の人手評価が全項目4以上ではありません')
  if (!bugChecks) addGate('RELEASE_BUGS', 'P0/P1不具合件数が0と確認されていません')

  const totalChecks = simulatorChecks.length + hardwareChecks.length + userChecks.length + 2
  const passedChecks =
    simulatorChecks.filter(Boolean).length +
    hardwareChecks.filter(Boolean).length +
    userChecks.filter(Boolean).length +
    (reviewChecks ? 1 : 0) +
    (bugChecks ? 1 : 0)

  return {
    score: Math.round((passedChecks / totalChecks) * 100),
    hardGates,
    warnings: [],
    stats: { passedChecks, totalChecks, participants },
  }
}

export function evaluateProject(options = {}) {
  const rootDir = options.rootDir ?? DEFAULT_ROOT
  const config = readJson(path.join(rootDir, 'harness/config.json'))
  const phase = options.phase ?? config.activePhase
  if (!config.weights?.[phase]) throw new Error(`Unknown phase: ${phase}`)

  const story = readJson(path.join(rootDir, 'content/story.json'))
  const evidence = readJson(path.join(rootDir, 'harness/evidence.json'))
  const storyResult = evaluateStory(story, { rootDir })
  const docsResult = evaluateDocs(rootDir, config)
  const architectureResult = evaluateArchitecture(rootDir, config)
  const releaseResult = evaluateReleaseEvidence(evidence)
  const components = {
    story: storyResult,
    docs: docsResult,
    architecture: architectureResult,
    release: releaseResult,
  }
  const weights = config.weights[phase]
  const score = Math.round(Object.entries(weights).reduce(
    (sum, [name, weight]) => sum + (components[name].score * weight) / 100,
    0,
  ))

  const activeComponentNames = Object.entries(weights)
    .filter(([, weight]) => weight > 0)
    .map(([name]) => name)
  const hardGates = activeComponentNames.flatMap((name) => (
    components[name].hardGates.map((issue) => ({ ...issue, component: name }))
  ))
  const passScore = config.passScore ?? 85

  return {
    phase,
    score,
    passScore,
    pass: hardGates.length === 0 && score >= passScore,
    hardGates,
    components,
  }
}

function printHumanReport(report) {
  console.log(`Fitness phase: ${report.phase}`)
  console.log(`Score: ${report.score}/100 (pass: ${report.passScore})`)
  console.log(`Result: ${report.pass ? 'PASS' : 'FAIL'}`)
  console.log('')
  for (const [name, result] of Object.entries(report.components)) {
    console.log(`${name.padEnd(12)} ${String(result.score).padStart(3)}/100  gates=${result.hardGates.length} warnings=${result.warnings.length}`)
    if (name === 'story') {
      console.log(`  nodes=${result.stats.nodes} paths=${result.stats.paths} endings=${result.stats.endings} pathLengths=${result.stats.pathLengths.join(',')}`)
    }
  }
  if (report.hardGates.length > 0) {
    console.log('')
    console.log('Hard gates:')
    for (const issue of report.hardGates) console.log(`- [${issue.component}/${issue.code}] ${issue.message}`)
  }
  const activeWarnings = Object.entries(report.components)
    .flatMap(([component, result]) => result.warnings.map((issue) => ({ ...issue, component })))
  if (activeWarnings.length > 0) {
    console.log('')
    console.log('Warnings:')
    for (const issue of activeWarnings) console.log(`- [${issue.component}/${issue.code}] ${issue.message}`)
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  const args = process.argv.slice(2)
  const phaseIndex = args.indexOf('--phase')
  const phase = phaseIndex >= 0 ? args[phaseIndex + 1] : undefined
  try {
    const report = evaluateProject({ phase })
    if (args.includes('--json')) console.log(JSON.stringify(report, null, 2))
    else printHumanReport(report)
    if (!report.pass) process.exitCode = 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
