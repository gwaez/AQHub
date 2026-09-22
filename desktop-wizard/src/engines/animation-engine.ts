/** Animation engine: apply StateMachine hints to the DOM. No AQHub calls. */

import type { AnimationHint } from "../state/wizard-state-machine.ts";

export function applyAnimation(root: HTMLElement, hint: AnimationHint): void {
  root.dataset.state = hint.label;
  root.dataset.motion = hint.motion;
  root.style.opacity = String(hint.opacity);
  root.setAttribute("aria-hidden", hint.opacity === 0 ? "true" : "false");
}
