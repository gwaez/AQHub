import assert from "node:assert/strict";
import test from "node:test";
import { IdleDirector } from "./idle-director.ts";

test("sleeps after inactivity and can be paused", () => {
  const d = new IdleDirector({ sleepAfterMs: 10_000, animationLevel: "normal" }, 0);
  assert.equal(d.shouldSleep(9_000, "IDLE"), false);
  assert.equal(d.shouldSleep(10_000, "IDLE"), true);
  d.pause();
  assert.equal(d.shouldSleep(50_000, "IDLE"), false);
  d.resume(50_000);
  assert.equal(d.shouldSleep(50_000, "IDLE"), false);
  assert.equal(d.shouldSleep(60_000, "IDLE"), true);
});

test("does not sleep while working, hidden, or matrix", () => {
  const d = new IdleDirector({ sleepAfterMs: 1000, animationLevel: "normal" }, 0);
  assert.equal(d.shouldSleep(5000, "WORKING"), false);
  assert.equal(d.shouldSleep(5000, "HIDDEN"), false);
  assert.equal(d.shouldSleep(5000, "MATRIX"), false);
});

test("animation off never sleeps", () => {
  const d = new IdleDirector({ sleepAfterMs: 1000, animationLevel: "off" }, 0);
  assert.equal(d.shouldSleep(60_000, "IDLE"), false);
});

test("nudge resets idle clock", () => {
  const d = new IdleDirector({ sleepAfterMs: 5000, animationLevel: "normal" }, 0);
  d.nudge(4000);
  assert.equal(d.shouldSleep(8000, "IDLE"), false);
  assert.equal(d.shouldSleep(9000, "IDLE"), true);
});
