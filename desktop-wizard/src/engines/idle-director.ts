import type { AnimationLevel } from "../state/wizard-state-machine.ts";

export interface IdleDirectorOptions {
  sleepAfterMs: number;
  animationLevel: AnimationLevel;
}

/**
 * Idle / watch / sleep timing lives here — not inside CSS keyframes.
 * It only reports intended states; Action Engine performs transitions.
 */
export class IdleDirector {
  private lastActive = 0;
  private paused = false;
  sleepAfterMs: number;
  animationLevel: AnimationLevel;

  constructor(opts: IdleDirectorOptions, nowMs = 0) {
    this.sleepAfterMs = Math.max(5_000, opts.sleepAfterMs);
    this.animationLevel = opts.animationLevel;
    this.lastActive = nowMs;
  }

  nudge(nowMs: number): void {
    this.lastActive = nowMs;
  }

  pause(): void {
    this.paused = true;
  }

  resume(nowMs: number): void {
    this.paused = false;
    this.lastActive = nowMs;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  idleMs(nowMs: number): number {
    return Math.max(0, nowMs - this.lastActive);
  }

  shouldSleep(nowMs: number, current: string): boolean {
    if (this.paused) return false;
    if (this.animationLevel === "off") return false;
    if (current === "HIDDEN" || current === "DRAGGING" || current === "SLEEPING") return false;
    if (current === "WORKING" || current === "SPEAKING" || current === "THINKING") return false;
    return this.idleMs(nowMs) >= this.sleepAfterMs;
  }

  shouldWake(nowMs: number, current: string): boolean {
    if (current !== "SLEEPING") return false;
    return this.idleMs(nowMs) < 400;
  }
}
