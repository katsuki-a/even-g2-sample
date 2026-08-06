import type { Progress } from './progress.ts'
import { nodeAt, type Story } from './story.ts'

export type Command =
  | { type: 'ADVANCE' }
  | { type: 'MOVE_SELECTION'; delta: -1 | 1 }
  | { type: 'SET_SELECTION'; index: number }
  | { type: 'CONFIRM_CHOICE' }
  | { type: 'BACK' }
  | { type: 'RETRY_ATTACHMENT' }

export type TransitionEffect = 'SAVE' | 'SHOW_ATTACHMENT' | 'EXIT'

export type Transition = {
  progress: Progress
  effects: TransitionEffect[]
}

function visit(progress: Progress, nextNodeId: string): Progress {
  return {
    ...progress,
    currentNodeId: nextNodeId,
    visitedNodeIds: [...progress.visitedNodeIds, nextNodeId],
    selectedChoiceIndex: 0,
    revision: progress.revision + 1,
  }
}

export function reduceStory(story: Story, progress: Progress, command: Command): Transition {
  const node = nodeAt(story, progress.currentNodeId)

  if (command.type === 'BACK') return { progress, effects: ['EXIT'] }
  if (command.type === 'RETRY_ATTACHMENT') {
    return { progress, effects: node.type === 'attachment' ? ['SHOW_ATTACHMENT'] : [] }
  }

  if (command.type === 'MOVE_SELECTION') {
    if (node.type !== 'choice') return { progress, effects: [] }
    const count = node.choices.length
    const selectedChoiceIndex = (progress.selectedChoiceIndex + command.delta + count) % count
    return { progress: { ...progress, selectedChoiceIndex }, effects: [] }
  }

  if (command.type === 'SET_SELECTION') {
    if (node.type !== 'choice' || !Number.isInteger(command.index)) return { progress, effects: [] }
    const selectedChoiceIndex = Math.max(0, Math.min(node.choices.length - 1, command.index))
    return { progress: { ...progress, selectedChoiceIndex }, effects: [] }
  }

  if (command.type === 'CONFIRM_CHOICE') {
    if (node.type !== 'choice') return { progress, effects: [] }
    const choice = node.choices[progress.selectedChoiceIndex]
    if (!choice) return { progress, effects: [] }
    const flags = [...new Set([...progress.flags, ...choice.effects.flags])]
    return {
      progress: {
        ...visit(progress, choice.next),
        choices: { ...progress.choices, [node.id]: choice.id },
        flags,
        rapport: progress.rapport + choice.effects.rapport,
      },
      effects: ['SAVE'],
    }
  }

  if (node.type === 'choice') return { progress, effects: [] }
  if (node.type === 'ending') return { progress, effects: ['EXIT'] }

  return {
    progress: visit(progress, node.next),
    effects: ['SAVE'],
  }
}
