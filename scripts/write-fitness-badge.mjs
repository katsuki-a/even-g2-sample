import fs from 'node:fs'
import path from 'node:path'
import { evaluateProject } from '../harness/fitness.mjs'

const outputPath = path.resolve(process.argv[2] ?? 'dist/badges/fitness.json')
const report = evaluateProject()
const badge = {
  schemaVersion: 1,
  label: `fitness (${report.phase})`,
  message: report.pass ? `${report.score}/100` : `${report.score}/100 · FAIL`,
  color: report.pass ? 'brightgreen' : 'critical',
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(badge, null, 2)}\n`)
console.log(`Fitness badge: ${badge.label} ${badge.message}`)
console.log(`Written to: ${outputPath}`)
