import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  REVIEW_SCHEMA_VERSION,
  enumerateNarrativeRoutes,
  loadNarrativeInputs,
  narrativeInputDigest,
} from '../harness/narrative.mjs'
import { evaluateStory } from '../harness/fitness.mjs'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'harness/config.json'), 'utf8'))
const story = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'content/story.json'), 'utf8'))
const narrativeConfig = config.narrative
const { personas, rubric, protocol } = loadNarrativeInputs(ROOT_DIR, narrativeConfig)
const commonPrompt = protocol
const outputDir = path.join(ROOT_DIR, 'output/narrative')
const routes = enumerateNarrativeRoutes(story, narrativeConfig.templateValues)
const storyResult = evaluateStory(story, { rootDir: ROOT_DIR })

if (storyResult.hardGates.length > 0) {
  const details = storyResult.hardGates.map((issue) => `[${issue.code}] ${issue.message}`).join('\n')
  throw new Error(`Story gates must pass before narrative preparation:\n${details}`)
}

function personaById(personaId) {
  return personas.personas.find((persona) => persona.id === personaId)
}

function emptyRatings(groupId) {
  return Object.fromEntries(
    rubric.groups[groupId].dimensions.map((dimension) => [dimension.id, null]),
  )
}

function createTemplate(persona, inputDigest) {
  return {
    schemaVersion: REVIEW_SCHEMA_VERSION,
    personaId: persona.id,
    inputDigest,
    reviewer: {
      kind: 'codex-sub-agent',
      taskName: '',
      independent: true,
    },
    routes: routes.map((route) => ({
      routeId: route.routeId,
      interest: emptyRatings('interest'),
      originality: emptyRatings('originality'),
      evidenceNodeIds: [],
      clicheSignals: [],
      interestReason: '',
      originalityReason: '',
    })),
    forcedTests: Object.fromEntries(
      rubric.forcedTests.map((item) => [item.id, { genericityDetected: null, reason: '' }]),
    ),
    overallNotes: {
      strength: '',
      risk: '',
    },
  }
}

function renderRubric() {
  const groups = Object.entries(rubric.groups).flatMap(([groupId, group]) => [
    `### ${group.label} (${groupId})`,
    ...group.dimensions.map((dimension) => (
      `- ${dimension.id} / ${dimension.label}: ${dimension.question}`
    )),
    '',
  ])
  const forcedTests = rubric.forcedTests.map((item) => (
    `- ${item.id}: ${item.question} / true=${item.genericityWhenTrue}`
  ))
  const clicheSignals = rubric.clicheSignals.map((signal) => `- ${signal}`)
  return [
    '## 共通ルーブリック',
    '',
    ...Object.entries(rubric.ratingScale.anchors).map(([rating, anchor]) => `- ${rating}: ${anchor}`),
    '',
    ...groups,
    '### 凡庸さ強制テスト',
    '',
    ...forcedTests,
    '',
    '### clicheSignalsの統制語彙',
    '',
    ...clicheSignals,
  ].join('\n')
}

function renderPacket(persona, inputDigest) {
  const routeSections = routes.flatMap((route, index) => [
    `## 経路 ${index + 1}: ${route.routeId}`,
    '',
    `- 終端: ${route.endingId}`,
    `- ノード: ${route.nodeIds.join(' -> ')}`,
    '',
    '```text',
    route.transcript,
    '```',
    '',
  ])
  return [
    commonPrompt,
    '',
    '# 今回の独立ペルソナ',
    '',
    `- ID: ${persona.id}`,
    `- 名前: ${persona.name}`,
    `- 姿勢: ${persona.stance}`,
    ...persona.focus.map((item) => `- 注目点: ${item}`),
    `- inputDigest: ${inputDigest}`,
    '',
    renderRubric(),
    '',
    '# 完走経路',
    '',
    ...routeSections,
  ].join('\n')
}

fs.mkdirSync(outputDir, { recursive: true })
for (const personaId of narrativeConfig.requiredPersonas) {
  const persona = personaById(personaId)
  if (!persona) throw new Error(`Persona not found: ${personaId}`)
  const inputDigest = narrativeInputDigest({
    story,
    persona,
    rubric,
    protocol,
    templateValues: narrativeConfig.templateValues,
  })
  const packetPath = path.join(outputDir, `${personaId}.md`)
  const templatePath = path.join(outputDir, `${personaId}.review.template.json`)
  fs.writeFileSync(packetPath, `${renderPacket(persona, inputDigest)}\n`)
  fs.writeFileSync(templatePath, `${JSON.stringify(createTemplate(persona, inputDigest), null, 2)}\n`)
  console.log(`${personaId}:`)
  console.log(`  packet   ${path.relative(ROOT_DIR, packetPath)}`)
  console.log(`  template ${path.relative(ROOT_DIR, templatePath)}`)
}

console.log(`Prepared ${routes.length} routes for ${narrativeConfig.requiredPersonas.length} personas.`)
