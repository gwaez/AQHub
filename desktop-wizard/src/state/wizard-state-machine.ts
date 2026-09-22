export type WizardStateId =
  | "IDLE"
  | "WATCHING"
  | "THINKING"
  | "SPEAKING"
  | "ALERT"
  | "WORKING"
  | "SUCCESS"
  | "ERROR"
  | "DRAGGING"
  | "SLEEPING"
  | "HIDDEN"
  | "WAND"
  | "NOTE"
  | "MATRIX"
  | "TRASH";

export type AnimationLevel = "normal" | "reduced" | "off";

export type Motion =
  | "breathe"
  | "glance"
  | "ponder"
  | "speak"
  | "alert"
  | "work"
  | "success"
  | "error"
  | "lift"
  | "sleep"
  | "still"
  | "fade-out"
  | "fade-in";

export interface AnimationHint {
  motion: Motion;
  opacity: number;
  label: WizardStateId;
  stub: boolean;
  blink: boolean;
  look: boolean;
}

export interface StateContext {
  displayName: string;
  scale: number;
  nowMs: number;
  animationLevel: AnimationLevel;
  lookX?: number;
  lookY?: number;
}

export interface StateLog {
  at: number;
  state: WizardStateId;
  phase: "enter" | "update" | "exit";
}

export interface StateHandler {
  id: WizardStateId;
  stub?: boolean;
  enter(ctx: StateContext): AnimationHint;
  update(ctx: StateContext, dtMs: number): AnimationHint | null;
  exit(ctx: StateContext): AnimationHint;
}

export const VISUAL_STATES: WizardStateId[] = [
  "IDLE",
  "WATCHING",
  "THINKING",
  "SPEAKING",
  "ALERT",
  "WORKING",
  "SUCCESS",
  "ERROR",
  "DRAGGING",
  "SLEEPING",
  "HIDDEN",
  "MATRIX",
  "TRASH",
];

export const STUB_STATES: WizardStateId[] = ["WAND", "NOTE"];

const ALL_STATES: WizardStateId[] = [...VISUAL_STATES, ...STUB_STATES];

function hint(
  label: WizardStateId,
  motion: Motion,
  ctx: StateContext,
  extra: Partial<AnimationHint> = {},
): AnimationHint {
  const off = ctx.animationLevel === "off";
  const reduced = ctx.animationLevel === "reduced";
  let resolved: Motion = motion;
  if (off && motion !== "fade-out" && motion !== "fade-in") resolved = "still";
  else if (reduced && (motion === "breathe" || motion === "glance")) resolved = "still";
  return {
    motion: resolved,
    opacity: label === "HIDDEN" ? 0 : 1,
    label,
    stub: false,
    blink: !off && !reduced && label === "IDLE",
    look: !off && label === "WATCHING",
    ...extra,
  };
}

function handler(id: WizardStateId, motion: Motion, stub = false): StateHandler {
  return {
    id,
    stub,
    enter(ctx) {
      return hint(id, motion, ctx, { stub });
    },
    update(ctx) {
      return hint(id, motion, ctx, { stub });
    },
    exit(ctx) {
      const leave: Motion = id === "HIDDEN" ? "fade-in" : "still";
      return hint(id, leave, ctx, { stub, opacity: id === "HIDDEN" ? 1 : 1 });
    },
  };
}

const handlers: Record<WizardStateId, StateHandler> = {
  IDLE: handler("IDLE", "breathe"),
  WATCHING: handler("WATCHING", "glance"),
  THINKING: handler("THINKING", "ponder"),
  SPEAKING: handler("SPEAKING", "speak"),
  ALERT: handler("ALERT", "alert"),
  WORKING: handler("WORKING", "work"),
  SUCCESS: handler("SUCCESS", "success"),
  ERROR: handler("ERROR", "error"),
  DRAGGING: handler("DRAGGING", "lift"),
  SLEEPING: handler("SLEEPING", "sleep"),
  HIDDEN: handler("HIDDEN", "fade-out"),
  WAND: handler("WAND", "work", true),
  NOTE: handler("NOTE", "ponder", true),
  MATRIX: handler("MATRIX", "work"),
  TRASH: handler("TRASH", "work"),
};

function emptyCtx(): StateContext {
  return { displayName: "", scale: 1, nowMs: 0, animationLevel: "normal" };
}

/**
 * State machine only maps states ↔ animation hints.
 * Task edits, HTTP, and file I/O must not live here.
 */
export class WizardStateMachine {
  private current: WizardStateId = "IDLE";
  private lastHint: AnimationHint = handlers.IDLE.enter(emptyCtx());
  readonly logs: StateLog[] = [];

  get state(): WizardStateId {
    return this.current;
  }

  get hint(): AnimationHint {
    return this.lastHint;
  }

  enter(state: WizardStateId, ctx: StateContext): AnimationHint {
    if (!ALL_STATES.includes(state)) {
      return this.lastHint;
    }
    if (state !== this.current) {
      this.lastHint = handlers[this.current].exit(ctx);
      this.logs.push({ at: ctx.nowMs, state: this.current, phase: "exit" });
      this.current = state;
    }
    this.lastHint = handlers[state].enter(ctx);
    this.logs.push({ at: ctx.nowMs, state, phase: "enter" });
    return this.lastHint;
  }

  update(ctx: StateContext, dtMs: number): AnimationHint {
    const next = handlers[this.current].update(ctx, dtMs);
    if (next) this.lastHint = next;
    this.logs.push({ at: ctx.nowMs, state: this.current, phase: "update" });
    if (this.logs.length > 200) this.logs.splice(0, this.logs.length - 200);
    return this.lastHint;
  }

  exit(ctx: StateContext): AnimationHint {
    this.lastHint = handlers[this.current].exit(ctx);
    this.logs.push({ at: ctx.nowMs, state: this.current, phase: "exit" });
    return this.lastHint;
  }

  lastEnterWasStub(): boolean {
    const last = [...this.logs].reverse().find((l) => l.phase === "enter");
    return last ? STUB_STATES.includes(last.state) : false;
  }
}

export function stateFromVisible(visible: boolean, watching = false): WizardStateId {
  if (!visible) return "HIDDEN";
  return watching ? "WATCHING" : "IDLE";
}

export function isTransientState(state: WizardStateId): boolean {
  return state === "SUCCESS" || state === "ERROR" || state === "ALERT" || state === "TRASH";
}
