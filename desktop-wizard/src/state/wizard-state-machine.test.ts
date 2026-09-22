import assert from "node:assert/strict";
import test from "node:test";
import { WizardStateMachine, stateFromVisible } from "./wizard-state-machine.ts";

const ctx = { displayName: "الساحر العتيق", scale: 1, nowMs: 0 };

test("starts in IDLE with bob hint", () => {
  const sm = new WizardStateMachine();
  assert.equal(sm.state, "IDLE");
  const hint = sm.enter("IDLE", ctx);
  assert.equal(hint.motion, "bob");
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
  assert.equal(sm.update(ctx, 32).label, "WATCHING");
});

test("stateFromVisible mapping", () => {
  assert.equal(stateFromVisible(false), "HIDDEN");
  assert.equal(stateFromVisible(true, false), "IDLE");
  assert.equal(stateFromVisible(true, true), "WATCHING");
});
