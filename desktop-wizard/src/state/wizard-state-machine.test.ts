import assert from "node:assert/strict";
import test from "node:test";
import {
  STUB_STATES,
  VISUAL_STATES,
  WizardStateMachine,
  stateFromVisible,
} from "./wizard-state-machine.ts";

const ctx = { displayName: "الساحر العتيق", scale: 1, nowMs: 0, animationLevel: "normal" as const };

test("starts in IDLE with breathe hint", () => {
  const sm = new WizardStateMachine();
  assert.equal(sm.state, "IDLE");
  const hint = sm.enter("IDLE", ctx);
  assert.equal(hint.motion, "breathe");
  assert.equal(hint.blink, true);
  assert.equal(hint.opacity, 1);
});

test("HIDDEN enter/update/exit", () => {
  const sm = new WizardStateMachine();
  const enter = sm.enter("HIDDEN", ctx);
  assert.equal(sm.state, "HIDDEN");
  assert.equal(enter.motion, "fade-out");
  const upd = sm.update(ctx, 16);
  assert.equal(upd.opacity, 0);
  const exit = sm.exit(ctx);
  assert.equal(exit.motion, "fade-in");
});

test("WATCHING uses glance motion", () => {
  const sm = new WizardStateMachine();
  const hint = sm.enter("WATCHING", ctx);
  assert.equal(hint.motion, "glance");
  assert.equal(hint.look, true);
  assert.equal(sm.update(ctx, 32).label, "WATCHING");
});

test("all visual states have enter/update/exit", () => {
  const sm = new WizardStateMachine();
  for (const id of VISUAL_STATES) {
    const enter = sm.enter(id, ctx);
    assert.equal(enter.label, id);
    assert.ok(sm.update(ctx, 10));
    assert.ok(sm.exit(ctx));
  }
});

test("stub states log enter without requiring unique art", () => {
  const sm = new WizardStateMachine();
  for (const id of STUB_STATES) {
    const hint = sm.enter(id, ctx);
    assert.equal(hint.stub, true);
    assert.equal(sm.state, id);
    const last = sm.logs.filter((l) => l.phase === "enter").at(-1);
    assert.equal(last?.state, id);
  }
});

test("animation level off collapses motion to still", () => {
  const sm = new WizardStateMachine();
  const hint = sm.enter("IDLE", { ...ctx, animationLevel: "off" });
  assert.equal(hint.motion, "still");
  assert.equal(hint.blink, false);
});

test("animation level reduced stills idle/watch loops but keeps thinking", () => {
  const sm = new WizardStateMachine();
  const idle = sm.enter("IDLE", { ...ctx, animationLevel: "reduced" });
  assert.equal(idle.motion, "still");
  assert.equal(idle.blink, false);
  const watch = sm.enter("WATCHING", { ...ctx, animationLevel: "reduced" });
  assert.equal(watch.motion, "still");
  assert.equal(watch.look, true);
  const think = sm.enter("THINKING", { ...ctx, animationLevel: "reduced" });
  assert.equal(think.motion, "ponder");
});

test("stateFromVisible mapping", () => {
  assert.equal(stateFromVisible(false), "HIDDEN");
  assert.equal(stateFromVisible(true, false), "IDLE");
  assert.equal(stateFromVisible(true, true), "WATCHING");
});
