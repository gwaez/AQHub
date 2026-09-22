import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { RoamEngine, clampToWorkArea, stepToward } from "./roam-engine.ts";

const work = { x: 0, y: 0, width: 1920, height: 1040 };
const size = { width: 380, height: 560 };
const start = { x: 200, y: 300 };

function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

function tickMany(
  roam: RoamEngine,
  n: number,
  extra: Partial<Parameters<RoamEngine["tick"]>[0]> = {},
  pos = { ...start },
) {
  const xs: number[] = [];
  let now = 0;
  for (let i = 0; i < n; i++) {
    const r = roam.tick({
      nowMs: now,
      state: "IDLE",
      animationLevel: "normal",
      roamEnabled: true,
      position: pos,
      windowSize: size,
      workArea: work,
      ...extra,
    });
    if (r.move) {
      pos = { x: r.x, y: r.y };
    }
    xs.push(pos.x);
    now += 250;
  }
  return { xs, pos };
}

test("clampToWorkArea keeps the window fully inside the work area", () => {
  const inside = clampToWorkArea({ x: 100, y: 80 }, size, work);
  assert.equal(inside.x, 100);
  assert.equal(inside.y, 80);
  const left = clampToWorkArea({ x: -40, y: -10 }, size, work);
  assert.equal(left.x, 0);
  assert.equal(left.y, 0);
  const right = clampToWorkArea({ x: 5000, y: 5000 }, size, work);
  assert.equal(right.x, 1920 - 380);
  assert.equal(right.y, 1040 - 560);
});

test("stepToward takes small steps and does not teleport", () => {
  const a = stepToward({ x: 0, y: 0 }, { x: 400, y: 0 }, 20);
  assert.equal(a.x, 20);
  assert.equal(a.y, 0);
  const b = stepToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 20);
  assert.equal(b.x, 10);
});

test("IDLE glides so X changes over time and stays in bounds", () => {
  const roam = new RoamEngine({ rng: seq([0.9, 0.9, 0.2, 0.1]) });
  const { xs, pos } = tickMany(roam, 24);
  const unique = new Set(xs);
  assert.ok(unique.size > 5, "expected several distinct X values, got " + unique.size);
  assert.ok(Math.max(...xs) - Math.min(...xs) >= 80, "roam travel too small: " + xs.join(","));
  assert.ok(pos.x >= 0 && pos.x <= 1920 - 380);
  assert.ok(pos.y >= 0 && pos.y <= 1040 - 560);
  for (const x of xs) assert.ok(x >= 0 && x <= 1540);
});

test("WATCHING still roams", () => {
  const roam = new RoamEngine({ rng: seq([0.8, 0.2, 0.4, 0.3]) });
  const { xs } = tickMany(roam, 12, { state: "WATCHING" });
  assert.ok(new Set(xs).size > 3);
});

test("DRAGGING and the settle window pause roam", () => {
  const roam = new RoamEngine({ rng: seq([0.9, 0.1, 0.5, 0.5]), pauseAfterDragMs: 2500 });
  let pos = { ...start };
  const drag = roam.tick({
    nowMs: 0,
    state: "DRAGGING",
    animationLevel: "normal",
    roamEnabled: true,
    position: pos,
    windowSize: size,
    workArea: work,
  });
  assert.equal(drag.move, false);
  assert.equal(drag.reason, "dragging");
  const during = roam.tick({
    nowMs: 500,
    state: "IDLE",
    animationLevel: "normal",
    roamEnabled: true,
    position: { x: 640, y: 220 },
    windowSize: size,
    workArea: work,
  });
  assert.equal(during.move, false);
  assert.equal(during.reason, "drag-settle");
  assert.equal(during.x, 640);
  const after = roam.tick({
    nowMs: 2600,
    state: "IDLE",
    animationLevel: "normal",
    roamEnabled: true,
    position: { x: 640, y: 220 },
    windowSize: size,
    workArea: work,
  });
  assert.equal(after.paused, false);
  assert.equal(after.move, true);
});

test("animationLevel off and roamEnabled false freeze", () => {
  const roam = new RoamEngine({ rng: () => 0.8 });
  const off = roam.tick({
    nowMs: 0,
    state: "IDLE",
    animationLevel: "off",
    roamEnabled: true,
    position: start,
    windowSize: size,
    workArea: work,
  });
  assert.equal(off.move, false);
  assert.equal(off.reason, "anim-off");
  const disabled = roam.tick({
    nowMs: 10,
    state: "IDLE",
    animationLevel: "normal",
    roamEnabled: false,
    position: start,
    windowSize: size,
    workArea: work,
  });
  assert.equal(disabled.move, false);
  assert.equal(disabled.reason, "disabled");
});

test("SLEEPING and HIDDEN stay put", () => {
  const roam = new RoamEngine({ rng: () => 0.7 });
  for (const state of ["SLEEPING", "HIDDEN"] as const) {
    const r = roam.tick({
      nowMs: 0,
      state,
      animationLevel: "normal",
      roamEnabled: true,
      position: start,
      windowSize: size,
      workArea: work,
    });
    assert.equal(r.move, false, state);
  }
});

test("reduced steps are smaller than normal", () => {
  const rng = () => 0.95;
  const normal = new RoamEngine({ rng, stepPx: 20, reducedStepPx: 8 });
  const reduced = new RoamEngine({ rng, stepPx: 20, reducedStepPx: 8 });
  const a = normal.tick({
    nowMs: 0,
    state: "IDLE",
    animationLevel: "normal",
    roamEnabled: true,
    position: start,
    windowSize: size,
    workArea: work,
  });
  const b = reduced.tick({
    nowMs: 0,
    state: "IDLE",
    animationLevel: "reduced",
    roamEnabled: true,
    position: start,
    windowSize: size,
    workArea: work,
  });
  const da = Math.hypot(a.x - start.x, a.y - start.y);
  const db = Math.hypot(b.x - start.x, b.y - start.y);
  assert.ok(a.move && b.move);
  assert.ok(da <= 21 && da >= 1);
  assert.ok(db <= 9 && db >= 1);
  assert.ok(db < da);
});

test("character body is a window-drag hit, not drag-region=false", () => {
  const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "index.html"), "utf8");
  assert.match(html, /id="petHit"[^>]*data-tauri-drag-region/);
  assert.doesNotMatch(html, /id="character"[^>]*data-tauri-drag-region="false"/);
  assert.match(html, /id="displayName"[^>]*data-tauri-drag-region="false"/);
});
