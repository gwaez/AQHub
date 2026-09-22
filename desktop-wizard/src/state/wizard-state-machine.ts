export type WizardStateId = "IDLE" | "HIDDEN" | "WATCHING";

export interface AnimationHint {
  motion: "bob" | "still" | "glance" | "fade-out" | "fade-in";
  opacity: number;
  label: WizardStateId;
}

export interface StateContext {
  displayName: string;
  scale: number;
  nowMs: number;
}

export interface StateHandler {
  id: WizardStateId;
  enter(ctx: StateContext): AnimationHint;
  update(ctx: StateContext, dtMs: number): AnimationHint | null;
  exit(ctx: StateContext): AnimationHint;
}

const idle: StateHandler = {
  id: "IDLE",
  enter: () => ({ motion: "bob", opacity: 1, label: "IDLE" }),
  update: () => ({ motion: "bob", opacity: 1, label: "IDLE" }),
  exit: () => ({ motion: "still", opacity: 1, label: "IDLE" }),
};

const hidden: StateHandler = {
  id: "HIDDEN",
  enter: () => ({ motion: "fade-out", opacity: 0, label: "HIDDEN" }),
  update: () => ({ motion: "still", opacity: 0, label: "HIDDEN" }),
  exit: () => ({ motion: "fade-in", opacity: 1, label: "HIDDEN" }),
};

const watching: StateHandler = {
  id: "WATCHING",
  enter: () => ({ motion: "glance", opacity: 1, label: "WATCHING" }),
  update: () => ({ motion: "glance", opacity: 1, label: "WATCHING" }),
  exit: () => ({ motion: "bob", opacity: 1, label: "WATCHING" }),
};

const handlers: Record<WizardStateId, StateHandler> = {
  IDLE: idle,
  HIDDEN: hidden,
  WATCHING: watching,
};

/**
 * State machine only maps states ↔ animation hints.
 * Task edits, HTTP, and file I/O must not live here.
 */
export class WizardStateMachine {
  private current: WizardStateId = "IDLE";
  private lastHint: AnimationHint = idle.enter({ displayName: "", scale: 1, nowMs: 0 });

  get state(): WizardStateId {
    return this.current;
  }

  get hint(): AnimationHint {
    return this.lastHint;
  }

  enter(state: WizardStateId, ctx: StateContext): AnimationHint {
    if (state !== this.current) {
      this.lastHint = handlers[this.current].exit(ctx);
      this.current = state;
    }
    this.lastHint = handlers[state].enter(ctx);
    return this.lastHint;
  }

  update(ctx: StateContext, dtMs: number): AnimationHint {
    const next = handlers[this.current].update(ctx, dtMs);
    if (next) this.lastHint = next;
    return this.lastHint;
  }

  exit(ctx: StateContext): AnimationHint {
    this.lastHint = handlers[this.current].exit(ctx);
    return this.lastHint;
  }
}

export function stateFromVisible(visible: boolean, watching = false): WizardStateId {
  if (!visible) return "HIDDEN";
  return watching ? "WATCHING" : "IDLE";
}
