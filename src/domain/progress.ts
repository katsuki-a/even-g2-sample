import type { Story } from './story.ts'

export const PROGRESS_SCHEMA_VERSION = 1

export type Progress = {
  schemaVersion: number
  storyId: string
  currentNodeId: string
  visitedNodeIds: string[]
  choices: Record<string, string>
  flags: string[]
  rapport: number
  selectedChoiceIndex: number
  revision: number
}

export function createProgress(story: Story): Progress {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    storyId: story.meta.id,
    currentNodeId: story.meta.startNodeId,
    visitedNodeIds: [story.meta.startNodeId],
    choices: {},
    flags: [],
    rapport: 0,
    selectedChoiceIndex: 0,
    revision: 0,
  }
}

export function isRestorableProgress(story: Story, value: unknown): value is Progress {
  if (!value || typeof value !== 'object') return false
  const progress = value as Partial<Progress>
  return progress.schemaVersion === PROGRESS_SCHEMA_VERSION &&
    progress.storyId === story.meta.id &&
    typeof progress.currentNodeId === 'string' &&
    story.nodeMap.has(progress.currentNodeId) &&
    Array.isArray(progress.visitedNodeIds) &&
    typeof progress.choices === 'object' &&
    Array.isArray(progress.flags) &&
    typeof progress.rapport === 'number' &&
    typeof progress.selectedChoiceIndex === 'number' &&
    typeof progress.revision === 'number'
}
