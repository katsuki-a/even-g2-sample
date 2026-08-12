import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateNarrativeReviews, loadNarrativeInputs } from '../harness/narrative.mjs'
import { evaluateStory } from '../harness/fitness.mjs'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'harness/config.json'), 'utf8'))
const story = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'content/story.json'), 'utf8'))
const narrativeConfig = config.narrative
const inputs = loadNarrativeInputs(ROOT_DIR, narrativeConfig)
const storyResult = evaluateStory(story, { rootDir: ROOT_DIR })
if (storyResult.hardGates.length > 0) {
  const details = storyResult.hardGates.map((issue) => `[${issue.code}] ${issue.message}`).join('\n')
  throw new Error(`Story gates must pass before narrative verification:\n${details}`)
}
const report = evaluateNarrativeReviews({
  story,
  ...inputs,
  config: narrativeConfig,
  enforceQuality: true,
})

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`Narrative score: ${report.score}/100`)
  console.log(`Interest: ${report.sections.interest}/100`)
  console.log(`Originality: ${report.sections.originality}/100`)
  console.log(`Personas: ${report.stats.personas}/${report.stats.requiredPersonas}`)
  console.log(`Routes: ${report.stats.reviewedRoutes}/${report.stats.routes}`)
  if (report.stats.weakestRoute) {
    console.log(`Weakest route: ${report.stats.weakestRoute.routeId} (${report.stats.weakestRoute.composite}/100)`)
  }
  if (report.hardGates.length > 0) {
    console.log('')
    console.log('Hard gates:')
    for (const issue of report.hardGates) console.log(`- [${issue.code}] ${issue.message}`)
  }
  if (report.warnings.length > 0) {
    console.log('')
    console.log('Warnings:')
    for (const issue of report.warnings) console.log(`- [${issue.code}] ${issue.message}`)
  }
}

if (report.hardGates.length > 0) process.exitCode = 1
