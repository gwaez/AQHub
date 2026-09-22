/**
 * Free roam: glide the character *window* across the primary work area.
 * Not Follow-My-Work (P8). Pure timing/geometry — Action Engine / window port apply moves.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface RoamOptions {
  stepPx: number;
  reducedStepPx: number;
  minRetargetMs: number;
  maxRetargetMs: number;
  pauseAfterDragMs: number;
  minTravelPx: number;
  maxTravelPx: number;
  verticalJitterPx: number;
  arrivePx: number;
  rng: () => number;
}

export interface RoamTickInput {
  nowMs: number;
  state: string;
  animationLevel: "normal" | "reduced" | "off";
  roamEnabled: boolean;
  position: Point;
  windowSize: { width: number; height: number };
  workArea: Rect;
  forcePause?: boolean;
}

export interface RoamTickResult {
  move: boolean;
  x: number;
  y: number;
  persist: boolean;
  paused: boolean;
  reason: string;
}

const DEFAULTS: RoamOptions = {
  stepPx: 20,
  reducedStepPx: 8,
  minRetargetMs: 3500,
  maxRetargetMs: 7000,
  pauseAfterDragMs: 2500,
  minTravelPx: 220,
  maxTravelPx: 560,
  verticalJitterPx: 72,
  arrivePx: 3,
  rng: Math.random,
};

export const ROAM_STATES = new Set(["IDLE", "WATCHING"]);

export function clampToWorkArea(
  pos: Point,
  size: { width: number; height: number },
  work: Rect,
): Point {
  const maxX = work.x + Math.max(0, work.width - size.width);
  const maxY = work.y + Math.max(0, work.height - size.height);
  return {
    x: Math.round(Math.min(maxX, Math.max(work.x, pos.x))),
    y: Math.round(Math.min(maxY, Math.max(work.y, pos.y))),
  };
}

export function stepToward(from: Point, to: Point, stepPx: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= stepPx || dist === 0) return { x: to.x, y: to.y };
  return {
    x: Math.round(from.x + (dx / dist) * stepPx),
    y: Math.round(from.y + (dy / dist) * stepPx),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class RoamEngine {
  private target: Point | null = null;
  private pausedUntil = 0;
  private nextPickAt = 0;
  readonly opts: RoamOptions;

  constructor(opts: Partial<RoamOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  noteDrag(nowMs: number): void {
    this.pausedUntil = nowMs + this.opts.pauseAfterDragMs;
    this.target = null;
  }

  get pausedUntilMs(): number {
    return this.pausedUntil;
  }

  get currentTarget(): Point | null {
    return this.target ? { ...this.target } : null;
  }

  pickTarget(pos: Point, size: { width: number; height: number }, work: Rect): Point {
    const bounds = {
      minX: work.x,
      maxX: work.x + Math.max(0, work.width - size.width),
      minY: work.y,
      maxY: work.y + Math.max(0, work.height - size.height),
    };
    const rng = this.opts.rng;
    if (bounds.maxX <= bounds.minX && bounds.maxY <= bounds.minY) {
      return { x: bounds.minX, y: bounds.minY };
    }
    const travel = lerp(this.opts.minTravelPx, this.opts.maxTravelPx, rng());
    const goRight = rng() >= 0.5;
    let tx = goRight ? pos.x + travel : pos.x - travel;
    if (tx < bounds.minX) tx = Math.min(bounds.maxX, pos.x + travel);
    if (tx > bounds.maxX) tx = Math.max(bounds.minX, pos.x - travel);
    tx = Math.min(bounds.maxX, Math.max(bounds.minX, tx));
    if (Math.abs(tx - pos.x) < 48) {
      tx = pos.x < (bounds.minX + bounds.maxX) / 2 ? bounds.maxX : bounds.minX;
    }
    let ty = pos.y + (rng() * 2 - 1) * this.opts.verticalJitterPx;
    ty = Math.min(bounds.maxY, Math.max(bounds.minY, ty));
    return { x: Math.round(tx), y: Math.round(ty) };
  }

  tick(input: RoamTickInput): RoamTickResult {
    const size = input.windowSize;
    const work = input.workArea;
    const pos = clampToWorkArea(input.position, size, work);

    if (input.state === "DRAGGING") {
      this.noteDrag(input.nowMs);
      return { move: false, x: pos.x, y: pos.y, persist: false, paused: true, reason: "dragging" };
    }

    if (!input.roamEnabled) {
      this.target = null;
      return { move: false, x: pos.x, y: pos.y, persist: false, paused: true, reason: "disabled" };
    }
    if (input.animationLevel === "off") {
      this.target = null;
      return { move: false, x: pos.x, y: pos.y, persist: false, paused: true, reason: "anim-off" };
    }
    if (input.state === "HIDDEN") {
      this.target = null;
      return { move: false, x: pos.x, y: pos.y, persist: false, paused: true, reason: "hidden" };
    }
    if (input.state === "SLEEPING") {
      this.target = null;
      return { move: false, x: pos.x, y: pos.y, persist: false, paused: true, reason: "sleep" };
    }
    if (input.forcePause || !ROAM_STATES.has(input.state)) {
      return { move: false, x: pos.x, y: pos.y, persist: false, paused: true, reason: "busy" };
    }
    if (input.nowMs < this.pausedUntil) {
      return { move: false, x: pos.x, y: pos.y, persist: false, paused: true, reason: "drag-settle" };
    }

    const step = input.animationLevel === "reduced" ? this.opts.reducedStepPx : this.opts.stepPx;
    const arrived =
      this.target != null && Math.hypot(this.target.x - pos.x, this.target.y - pos.y) <= this.opts.arrivePx;

    if (!this.target || arrived || input.nowMs >= this.nextPickAt) {
      this.target = this.pickTarget(pos, size, work);
      const span = this.opts.maxRetargetMs - this.opts.minRetargetMs;
      this.nextPickAt = input.nowMs + this.opts.minRetargetMs + Math.round(this.opts.rng() * span);
    }

    const next = clampToWorkArea(stepToward(pos, this.target, step), size, work);
    const moved = next.x !== pos.x || next.y !== pos.y;
    const persist =
      moved && Math.hypot(this.target.x - next.x, this.target.y - next.y) <= this.opts.arrivePx;
    if (persist) this.target = null;
    return { move: moved, x: next.x, y: next.y, persist, paused: false, reason: "glide" };
  }
}
