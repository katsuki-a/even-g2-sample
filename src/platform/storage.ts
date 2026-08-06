import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { Progress } from '../domain/progress.ts'

export const DEFAULT_STORAGE_KEY = 'no-service-episode-01-progress'

export interface ProgressStore {
  load(): Promise<unknown>
  save(progress: Progress): Promise<void>
  clear(): Promise<void>
}

export class BrowserProgressStore implements ProgressStore {
  constructor(private readonly key = DEFAULT_STORAGE_KEY) {}

  async load(): Promise<unknown> {
    try {
      const raw = globalThis.localStorage?.getItem(this.key)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  async save(progress: Progress): Promise<void> {
    globalThis.localStorage?.setItem(this.key, JSON.stringify(progress))
  }

  async clear(): Promise<void> {
    globalThis.localStorage?.removeItem(this.key)
  }
}

export class EvenProgressStore implements ProgressStore {
  constructor(
    private readonly bridge: EvenAppBridge,
    private readonly key = DEFAULT_STORAGE_KEY,
  ) {}

  async load(): Promise<unknown> {
    const raw = await this.bridge.getLocalStorage(this.key)
    return raw ? JSON.parse(raw) : null
  }

  async save(progress: Progress): Promise<void> {
    const success = await this.bridge.setLocalStorage(this.key, JSON.stringify(progress))
    if (!success) throw new Error('進行状態を保存できませんでした')
  }

  async clear(): Promise<void> {
    const success = await this.bridge.setLocalStorage(this.key, '')
    if (!success) throw new Error('進行状態を初期化できませんでした')
  }
}

export class ResilientProgressStore implements ProgressStore {
  constructor(
    private readonly primary: ProgressStore,
    private readonly fallback: ProgressStore,
  ) {}

  async load(): Promise<unknown> {
    try {
      return (await this.primary.load()) ?? this.fallback.load()
    } catch {
      return this.fallback.load()
    }
  }

  async save(progress: Progress): Promise<void> {
    await this.fallback.save(progress)
    try {
      await this.primary.save(progress)
    } catch (error) {
      console.warn('Even App storage unavailable; browser backup is current', error)
    }
  }

  async clear(): Promise<void> {
    await this.fallback.clear()
    try {
      await this.primary.clear()
    } catch (error) {
      console.warn('Even App storage clear failed; browser backup was cleared', error)
    }
  }
}
