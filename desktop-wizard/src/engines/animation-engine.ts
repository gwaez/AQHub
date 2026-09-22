/** Animation engine: apply StateMachine hints to the DOM. No AQHub calls. */

import type { AnimationHint, AnimationLevel } from "../state/wizard-state-machine.ts";

export function applyAnimation(
  root: HTMLElement,
  hint: AnimationHint,
  look?: { x: number; y: number },
  animationLevel: AnimationLevel = "normal",
): void {
  root.dataset.state = hint.label;
  root.dataset.motion = hint.motion;
  root.dataset.stub = hint.stub ? "1" : "0";
  root.dataset.blink = hint.blink ? "1" : "0";
  root.dataset.look = hint.look ? "1" : "0";
  root.style.opacity = String(hint.opacity);
  root.style.visibility = hint.opacity === 0 ? "hidden" : "visible";
  root.setAttribute("aria-hidden", hint.opacity === 0 ? "true" : "false");
  if (look) {
    root.style.setProperty("--look-x", `${look.x}px`);
    root.style.setProperty("--look-y", `${look.y}px`);
  }
  const stage = root.closest("#stage");
  if (stage) {
    stage.classList.toggle("is-hidden", hint.label === "HIDDEN" || hint.opacity === 0);
    stage.classList.toggle("is-sleeping", hint.label === "SLEEPING");
  }
  document.body.dataset.anim = animationLevel;
}
