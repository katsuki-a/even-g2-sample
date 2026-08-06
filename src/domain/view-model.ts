import type { Progress } from './progress.ts'
import { nodeAt, type Story } from './story.ts'

export type ViewContext = {
  now: Date
  batteryLevel?: number
  playerName: string
  status?: string
}

export type StoryViewModel = {
  kind: 'mail' | 'choice' | 'attachment' | 'system' | 'ending'
  nodeId: string
  header: string
  kicker: string
  title: string
  body: string
  footer: string
  choices: string[]
  selectedChoiceIndex: number
  status?: string
  progressLabel: string
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

function interpolate(value: string, context: ViewContext): string {
  return value
    .replaceAll('{{currentYear}}', String(context.now.getFullYear()))
    .replaceAll('{{playerName|あなた}}', context.playerName.trim() || 'あなた')
}

function sentAtLabel(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  return match ? `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}` : value
}

export function toViewModel(story: Story, progress: Progress, context: ViewContext): StoryViewModel {
  const node = nodeAt(story, progress.currentNodeId)
  const battery = context.batteryLevel === undefined ? '--' : `${context.batteryLevel}%`
  const header = `${twoDigits(context.now.getHours())}:${twoDigits(context.now.getMinutes())}  /  圏外  /  ${battery}`
  const progressLabel = `${Math.min(progress.visitedNodeIds.length, 14).toString().padStart(2, '0')} / 14`
  const common = {
    kind: node.type,
    nodeId: node.id,
    header,
    choices: [] as string[],
    selectedChoiceIndex: progress.selectedChoiceIndex,
    status: context.status,
    progressLabel,
  }

  if (node.type === 'mail') {
    return {
      ...common,
      kicker: `${node.from}  ·  ${sentAtLabel(node.sentAt)}`,
      title: interpolate(node.subject, context),
      body: interpolate(node.body, context),
      footer: '決定 つぎへ  /  2回押し 終了',
    }
  }
  if (node.type === 'choice') {
    return {
      ...common,
      kicker: 'REPLY RECOVERY',
      title: node.prompt,
      body: '欠損した返信から送信内容を選択',
      choices: node.choices.map((choice) => interpolate(choice.label, context)),
      footer: '上下 選択  /  決定 送信',
    }
  }
  if (node.type === 'attachment') {
    return {
      ...common,
      kicker: `ATTACHMENT  ·  ${node.fileSizeLabel}`,
      title: node.fileName,
      body: `${node.caption}\n${node.alt}`,
      footer: context.status?.includes('ERROR') ? '決定 再試行' : '決定 つぎへ',
    }
  }
  if (node.type === 'system') {
    return {
      ...common,
      kicker: 'SYSTEM / LINK',
      title: 'NO SERVICE',
      body: node.lines.map((line) => interpolate(line, context)).join('\n'),
      footer: '決定 つぎへ',
    }
  }
  return {
    ...common,
    kicker: 'EPISODE 01 / END',
    title: node.title,
    body: interpolate(node.body, context),
    footer: '決定 終了  /  スマホで最初から',
  }
}
