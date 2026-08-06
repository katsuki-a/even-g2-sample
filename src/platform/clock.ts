export interface Clock {
  now(): Date
  sleep(milliseconds: number): Promise<void>
}

export class RealClock implements Clock {
  now(): Date {
    return new Date()
  }

  sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds))
  }
}
