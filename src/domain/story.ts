export type StoryMeta = {
  id: string
  title: string
  englishTitle: string
  episodeTitle: string
  startNodeId: string
  targetPathNodes?: {
    min: number
    max: number
  }
}

export type ChoiceEffect = {
  rapport: number
  flags: string[]
}

export type ConditionalNextCase = {
  requires: string[]
  next: string
}

export type NextTarget = string | {
  cases: ConditionalNextCase[]
  fallback?: string
}

export type StoryChoice = {
  id: string
  label: string
  next: NextTarget
  effects: ChoiceEffect
}

type BaseNode = {
  id: string
  act: 1 | 2 | 3
  tags: string[]
}

export type MailNode = BaseNode & {
  type: 'mail'
  sentAt: string
  from: string
  subject: string
  body: string
  next: NextTarget
}

export type ChoiceNode = BaseNode & {
  type: 'choice'
  prompt: string
  choices: StoryChoice[]
}

export type AttachmentNode = BaseNode & {
  type: 'attachment'
  fileName: string
  fileSizeLabel: string
  asset: string
  assetStatus: 'planned' | 'ready'
  alt: string
  caption: string
  next: NextTarget
}

export type SystemNode = BaseNode & {
  type: 'system'
  lines: string[]
  next: NextTarget
}

export type EndingNode = BaseNode & {
  type: 'ending'
  endingId: string
  title: string
  body: string
}

export type StoryNode = MailNode | ChoiceNode | AttachmentNode | SystemNode | EndingNode

export type Story = {
  schemaVersion: number
  meta: StoryMeta
  nodes: StoryNode[]
  nodeMap: ReadonlyMap<string, StoryNode>
}

export function nodeAt(story: Story, nodeId: string): StoryNode {
  const node = story.nodeMap.get(nodeId)
  if (!node) throw new Error(`Story node not found: ${nodeId}`)
  return node
}

export function nextNodeIds(node: StoryNode): string[] {
  if (node.type === 'choice') return node.choices.flatMap((choice) => nextTargetNodeIds(choice.next))
  if (node.type === 'ending') return []
  return nextTargetNodeIds(node.next)
}

export function nextTargetNodeIds(target: NextTarget): string[] {
  if (typeof target === 'string') return [target]
  return [
    ...target.cases.map((item) => item.next),
    ...(target.fallback ? [target.fallback] : []),
  ]
}

export function resolveNextTarget(target: NextTarget, flags: readonly string[]): string {
  if (typeof target === 'string') return target
  const flagSet = new Set(flags)
  const matched = target.cases.find((item) => item.requires.every((flag) => flagSet.has(flag)))
  if (matched) return matched.next
  if (target.fallback) return target.fallback
  throw new Error(`No conditional transition matches flags: ${flags.join(', ')}`)
}
