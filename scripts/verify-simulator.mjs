import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUTPUT = path.join(ROOT, 'output', 'simulator')
const PREVIEW_PORT = 4173
const AUTOMATION_PORT = 9898
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`
const API_URL = `http://127.0.0.1:${AUTOMATION_PORT}`
const EVIDENCE_PREFIX = '[NO_SERVICE_EVIDENCE] '
const SETTLE_MS = 800
const runId = Date.now().toString(36)
const simulatorBinary = path.join(
  ROOT,
  'node_modules',
  '@evenrealities',
  `sim-${process.platform}-${process.arch}`,
  'bin',
  process.platform === 'win32' ? 'evenhub-simulator.exe' : 'evenhub-simulator',
)

const storySource = JSON.parse(await readFile(path.join(ROOT, 'content', 'story.json'), 'utf8'))
const simulatorPackage = JSON.parse(await readFile(
  path.join(ROOT, 'node_modules', '@evenrealities', 'evenhub-simulator', 'package.json'),
  'utf8',
))
const nodes = new Map(storySource.nodes.map((node) => [node.id, node]))

let previewProcess
let simulatorProcess

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function child(command, args) {
  const childProcess = spawn(command, args, {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = []
  childProcess.stdout.on('data', (chunk) => output.push(String(chunk)))
  childProcess.stderr.on('data', (chunk) => output.push(String(chunk)))
  childProcess.output = output
  return childProcess
}

async function stopChild(process) {
  if (!process || process.exitCode !== null) return
  process.kill('SIGINT')
  const exited = once(process, 'exit')
  await Promise.race([exited, delay(3_000)])
  if (process.exitCode === null) {
    process.kill('SIGTERM')
    await Promise.race([once(process, 'exit'), delay(3_000)])
  }
}

async function waitForHttp(url, description, timeout = 15_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch {
      // The native simulator and preview server need a short startup window.
    }
    await delay(100)
  }
  throw new Error(`${description} did not become ready within ${timeout}ms`)
}

class EvidenceFeed {
  entries = []
  evidence = []
  cursor

  async poll() {
    const suffix = this.cursor === undefined ? '' : `?since_id=${this.cursor}`
    const response = await fetch(`${API_URL}/api/console${suffix}`)
    if (!response.ok) throw new Error(`Console API failed: ${response.status}`)
    const payload = await response.json()
    for (const entry of payload.entries ?? []) {
      this.entries.push(entry)
      this.cursor = Math.max(this.cursor ?? -1, entry.id)
      const offset = entry.message.indexOf(EVIDENCE_PREFIX)
      if (offset >= 0) {
        this.evidence.push(JSON.parse(entry.message.slice(offset + EVIDENCE_PREFIX.length)))
      }
    }
  }

  async waitFor(predicate, description, marker = 0, timeout = 8_000) {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      await this.poll()
      const result = this.evidence.slice(marker).find(predicate)
      if (result) return result
      await delay(100)
    }
    const evidenceTail = JSON.stringify(this.evidence.slice(-10), null, 2)
    const consoleTail = JSON.stringify(this.entries.slice(-10), null, 2)
    throw new Error(
      `Timed out waiting for ${description}\nEvidence tail:\n${evidenceTail}\nConsole tail:\n${consoleTail}`,
    )
  }

  marker() {
    return this.evidence.length
  }

  errors({ allowInjectedFailure = false } = {}) {
    const injectionObserved = this.evidence.some(
      (event) => event.phase === 'attachment-failure-injected',
    )
    let injectedConsoleErrorConsumed = false
    return this.entries.filter((entry) => {
      if (!['error', 'warn'].includes(entry.level)) return false
      const plannedError = entry.message.includes('planned attachment failure') || entry.message === '{}'
      if (allowInjectedFailure && injectionObserved && plannedError && !injectedConsoleErrorConsumed) {
        injectedConsoleErrorConsumed = true
        return false
      }
      return !entry.message.includes('Even App storage unavailable')
    })
  }
}

async function startPreview() {
  previewProcess = child(path.join(ROOT, 'node_modules', '.bin', 'vite'), [
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(PREVIEW_PORT),
    '--strictPort',
  ])
  await waitForHttp(PREVIEW_URL, 'Vite preview')
}

async function startSimulator(caseId, { failAttachmentOnce = false } = {}) {
  const target = new URL('/', PREVIEW_URL)
  target.searchParams.set('simulator', 'true')
  target.searchParams.set('evidenceCase', caseId)
  if (failAttachmentOnce) target.searchParams.set('failAttachmentOnce', '1')
  simulatorProcess = child(simulatorBinary, [
    target.href,
    '--automation-port',
    String(AUTOMATION_PORT),
    '--bounce',
    'spring',
  ])
  await waitForHttp(`${API_URL}/api/ping`, 'Simulator automation API')
  const feed = new EvidenceFeed()
  await feed.waitFor((event) => event.phase === 'start', `${caseId} startup`, 0, 12_000)
  return feed
}

async function stopSimulator() {
  await stopChild(simulatorProcess)
  simulatorProcess = undefined
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    try {
      await fetch(`${API_URL}/api/ping`)
      await delay(100)
    } catch {
      return
    }
  }
}

async function input(action) {
  await delay(SETTLE_MS)
  const response = await fetch(`${API_URL}/api/input`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  if (!response.ok) throw new Error(`Input ${action} failed: ${response.status}`)
}

async function screenshot(fileName) {
  const response = await fetch(`${API_URL}/api/screenshot/glasses`)
  if (!response.ok) throw new Error(`Screenshot failed: ${response.status}`)
  const filePath = path.join(OUTPUT, fileName)
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()))
  return path.relative(ROOT, filePath)
}

function routeCombinations() {
  const combinations = []
  for (let first = 0; first < 3; first += 1) {
    for (let second = 0; second < 3; second += 1) {
      for (let third = 0; third < 3; third += 1) combinations.push([first, second, third])
    }
  }
  return combinations
}

function expectedPath(choiceIndexes, stopAt) {
  const nodeIds = []
  let choiceOffset = 0
  let node = nodes.get(storySource.meta.startNodeId)
  const flags = new Set()
  while (node) {
    nodeIds.push(node.id)
    if (node.id === stopAt || node.type === 'ending') break
    if (node.type === 'choice') {
      const choice = node.choices[choiceIndexes[choiceOffset++] ?? 0]
      for (const flag of choice.effects?.flags ?? []) flags.add(flag)
      node = nodes.get(resolveTarget(choice.next, flags))
    } else {
      node = nodes.get(resolveTarget(node.next, flags))
    }
  }
  return nodeIds
}

function resolveTarget(target, flags) {
  if (typeof target === 'string') return target
  return target.cases.find((item) => item.requires.every((flag) => flags.has(flag)))?.next
    ?? target.fallback
}

async function waitForAttachment(feed, marker = 0) {
  await feed.waitFor(
    (event) => event.phase === 'attachment-complete',
    'attachment transfer completion',
    marker,
    10_000,
  )
}

async function drive(feed, choiceIndexes, { stopAt } = {}) {
  const expected = expectedPath(choiceIndexes, stopAt)
  const observed = [expected[0]]
  let choiceOffset = 0
  for (let offset = 0; offset < expected.length; offset += 1) {
    const nodeId = expected[offset]
    const node = nodes.get(nodeId)
    if (!node) throw new Error(`Unknown node ${nodeId}`)
    if (node.id === stopAt || node.type === 'ending') break

    if (node.type === 'choice') {
      const targetIndex = choiceIndexes[choiceOffset++]
      for (let index = 1; index <= targetIndex; index += 1) {
        const marker = feed.marker()
        await input('down')
        await feed.waitFor(
          (event) => event.phase === 'select' && event.nodeId === nodeId &&
            event.selectedChoiceIndex === index,
          `${nodeId} selection ${index}`,
          marker,
        )
      }
    }

    const nextNodeId = expected[offset + 1]
    const marker = feed.marker()
    await input('click')
    await feed.waitFor(
      (event) => ['render', 'start'].includes(event.phase) && event.nodeId === nextNodeId,
      `${nodeId} -> ${nextNodeId}`,
      marker,
      10_000,
    )
    if (nodes.get(nextNodeId)?.type === 'attachment') await waitForAttachment(feed, marker)
    observed.push(nextNodeId)
  }
  return observed
}

async function verifyRoute(choiceIndexes) {
  const routeName = choiceIndexes.join('')
  const caseId = `route-${routeName}-${runId}`
  const startedAt = Date.now()
  const feed = await startSimulator(caseId)
  try {
    const observedNodeIds = await drive(feed, choiceIndexes)
    const endingNodeId = observedNodeIds.at(-1)
    const image = await screenshot(`route-${routeName}-${endingNodeId}.png`)
    const holdMarker = feed.marker()
    await input('click')
    await feed.waitFor(
      (event) => event.phase === 'render' && event.nodeId === endingNodeId,
      `${routeName} ending retained after confirm`,
      holdMarker,
    )
    const retainedImage = await screenshot(`route-${routeName}-${endingNodeId}-retained.png`)
    const exitMarker = feed.marker()
    await input('double_click')
    await feed.waitFor((event) => event.phase === 'exit', `${routeName} clean exit`, exitMarker)
    await feed.poll()
    const errors = feed.errors()
    if (errors.length > 0) throw new Error(`Console errors: ${JSON.stringify(errors)}`)
    return {
      choices: choiceIndexes,
      endingNodeId,
      observedNodeIds,
      inputEvents: feed.evidence.filter((event) => event.phase === 'input').length,
      screenshotPath: image,
      retainedScreenshotPath: retainedImage,
      durationMs: Date.now() - startedAt,
    }
  } finally {
    await stopSimulator()
  }
}

async function verifyRestartResume() {
  const caseId = `restart-${runId}`
  let feed = await startSimulator(caseId)
  let beforeRestart
  try {
    await drive(feed, [0, 0, 0], { stopAt: 'attachment_portrait' })
    beforeRestart = await screenshot('restart-before.png')
  } finally {
    await stopSimulator()
  }

  feed = await startSimulator(caseId)
  try {
    const restored = await feed.waitFor(
      (event) => event.phase === 'start' && event.nodeId === 'attachment_portrait' &&
        event.status?.includes('復元'),
      'restored attachment node',
    )
    await waitForAttachment(feed)
    const afterRestart = await screenshot('restart-after.png')
    return { nodeId: restored.nodeId, beforeRestart, afterRestart }
  } finally {
    await stopSimulator()
  }
}

async function verifyAttachmentRetry() {
  const caseId = `retry-${runId}`
  const feed = await startSimulator(caseId, { failAttachmentOnce: true })
  try {
    const expected = expectedPath([0, 0, 0], 'attachment_street')
    await drive(feed, [0, 0, 0], { stopAt: expected.at(-2) })
    const marker = feed.marker()
    await input('click')
    await feed.waitFor(
      (event) => event.phase === 'render' && event.nodeId === 'attachment_street' &&
        event.status?.includes('ATTACHMENT ERROR'),
      'visible attachment error',
      marker,
      10_000,
    )
    const failureScreenshot = await screenshot('attachment-retry-error.png')
    const retryMarker = feed.marker()
    await input('click')
    await feed.waitFor(
      (event) => event.phase === 'attachment-complete',
      'successful attachment retry',
      retryMarker,
      10_000,
    )
    const successScreenshot = await screenshot('attachment-retry-success.png')
    const advanceMarker = feed.marker()
    await input('click')
    await feed.waitFor(
      (event) => event.phase === 'render' && event.nodeId === 'mail_elapsed',
      'advance after attachment retry',
      advanceMarker,
    )
    const errors = feed.errors({ allowInjectedFailure: true })
    if (errors.length > 0) throw new Error(`Unexpected console errors: ${JSON.stringify(errors)}`)
    return { failureScreenshot, successScreenshot, advancedTo: 'mail_elapsed' }
  } finally {
    await stopSimulator()
  }
}

async function main() {
  await mkdir(OUTPUT, { recursive: true })
  await startPreview()
  if (process.argv.includes('--only-retry')) {
    const attachmentRetry = await verifyAttachmentRetry()
    const reportPath = path.join(OUTPUT, 'retry-smoke.json')
    await writeFile(reportPath, `${JSON.stringify({ attachmentRetry }, null, 2)}\n`)
    console.log('PASS attachment failure and retry')
    console.log(`Evidence report: ${path.relative(ROOT, reportPath)}`)
    return
  }
  const routeArgument = process.argv.find((argument) => argument.startsWith('--route='))
  const requestedRoute = routeArgument?.split('=')[1]
  const routes = requestedRoute
    ? [[...requestedRoute].map(Number)]
    : routeCombinations()
  if (routes.some((route) => route.length !== 3 || route.some((value) => ![0, 1, 2].includes(value)))) {
    throw new Error('--route must contain exactly three indexes from 0 to 2, for example --route=012')
  }

  const routeResults = []
  const progressPath = path.join(OUTPUT, 'evidence-progress.json')
  for (const route of routes) {
    const result = await verifyRoute(route)
    routeResults.push(result)
    await writeFile(progressPath, `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      routeCount: routeResults.length,
      routes: routeResults,
    }, null, 2)}\n`)
    console.log(`PASS route ${route.join('')} -> ${result.endingNodeId}`)
  }

  const fullRun = !requestedRoute
  const restartResume = fullRun ? await verifyRestartResume() : undefined
  if (restartResume) console.log('PASS restart resume at attachment_portrait')
  const attachmentRetry = fullRun ? await verifyAttachmentRetry() : undefined
  if (attachmentRetry) console.log('PASS attachment failure and retry')

  const report = {
    generatedAt: new Date().toISOString(),
    buildSource: 'dist',
    simulatorVersion: simulatorPackage.version,
    settleMilliseconds: SETTLE_MS,
    routeCount: routeResults.length,
    allRoutesPassed: routeResults.length === 27,
    endingNodeIds: [...new Set(routeResults.map((result) => result.endingNodeId))].sort(),
    routes: routeResults,
    restartResume,
    attachmentRetry,
  }
  const reportPath = path.join(OUTPUT, requestedRoute ? `smoke-${requestedRoute}.json` : 'evidence-report.json')
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Evidence report: ${path.relative(ROOT, reportPath)}`)
}

try {
  await main()
} finally {
  await stopSimulator()
  await stopChild(previewProcess)
}
