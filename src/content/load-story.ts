import storyJson from '../../content/story.json' with { type: 'json' }
import { nextNodeIds, type Story, type StoryNode } from '../domain/story.ts'

export function loadStory(value: unknown): Story {
  if (!value || typeof value !== 'object') throw new Error('Story data is not an object')
  const candidate = value as { schemaVersion?: unknown; meta?: Partial<Story['meta']>; nodes?: unknown }
  if (candidate.schemaVersion !== 1) throw new Error('Unsupported story schema')
  if (!candidate.meta?.id || !candidate.meta.startNodeId) throw new Error('Story metadata is incomplete')
  if (!Array.isArray(candidate.nodes)) throw new Error('Story nodes are missing')

  const nodes = candidate.nodes as StoryNode[]
  const nodeMap = new Map<string, StoryNode>()
  for (const node of nodes) {
    if (!node.id || nodeMap.has(node.id)) throw new Error(`Invalid or duplicate node: ${node.id}`)
    nodeMap.set(node.id, node)
  }
  if (!nodeMap.has(candidate.meta.startNodeId)) throw new Error('Story start node is missing')
  for (const node of nodes) {
    for (const nextId of nextNodeIds(node)) {
      if (!nodeMap.has(nextId)) throw new Error(`Missing transition: ${node.id} -> ${nextId}`)
    }
  }

  return {
    schemaVersion: 1,
    meta: candidate.meta as Story['meta'],
    nodes,
    nodeMap,
  }
}

export const episodeOne = loadStory(storyJson)
