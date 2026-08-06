export type StoryMeta = {
  id: string
  title: string
  englishTitle: string
  episodeTitle: string
  startNodeId: string
}

export type ChoiceEffect = {
  rapport: number
  flags: string[]
}

export type StoryChoice = {
  id: string
  label: string
  next: string
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
  next: string
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
  next: string
}

export type SystemNode = BaseNode & {
  type: 'system'
  lines: string[]
  next: string
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
  if (node.type === 'choice') return node.choices.map((choice) => choice.next)
  if (node.type === 'ending') return []
  return [node.next]
}
