import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { measureAndPlaceMenu, placeFixedMenu } from "./place-menu.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("near the bottom of a compact window the menu opens upward so Hide/Exit fit", () => {
  const view = { width: 380, height: 560 };
  const menu = { width: 180, height: 320 };
  const pos = placeFixedMenu({ x: 200, y: 500 }, menu, view);
  assert.ok(pos.top + menu.height <= view.height - 8);
  assert.ok(pos.top >= 8);
  assert.ok(pos.top < 500, "should flip upward when the click is near the bottom");
});

test("near the right edge the menu opens left and stays inside", () => {
  const view = { width: 380, height: 560 };
  const menu = { width: 180, height: 320 };
  const pos = placeFixedMenu({ x: 370, y: 80 }, menu, view);
  assert.ok(pos.left + menu.width <= view.width - 8);
  assert.ok(pos.left >= 8);
  assert.ok(pos.left < 370);
});

test("top-start click stays inside with a margin", () => {
  const pos = placeFixedMenu({ x: 4, y: 4 }, { width: 180, height: 320 }, { width: 380, height: 560 });
  assert.equal(pos.left, 8);
  assert.equal(pos.top, 8);
});

test("measureAndPlaceMenu writes left/top using at least 320px height", () => {
  const el = {
    offsetWidth: 180,
    offsetHeight: 0,
    getBoundingClientRect: () => ({ width: 180, height: 0 }),
    style: { left: "", top: "" },
  } as unknown as HTMLElement;
  const pos = measureAndPlaceMenu(el, 40, 500, 380, 560, 320);
  assert.match(el.style.left, /px$/);
  assert.match(el.style.top, /px$/);
  assert.ok(pos.top + 320 <= 560 - 8);
});

test("main.ts no longer uses the short innerHeight-240 clamp; HIDE/EXIT stay after Settings", () => {
  const main = readFileSync(join(root, "src", "main.ts"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");
  assert.doesNotMatch(main, /innerHeight\s*-\s*240/);
  assert.match(main, /measureAndPlaceMenu/);
  const block = html.match(/id="ctx"[\s\S]*?<\/nav>/);
  assert.ok(block);
  const settingsAt = block[0].indexOf('data-ctx="SETTINGS"');
  const hideAt = block[0].indexOf('data-ctx="HIDE"');
  const exitAt = block[0].indexOf('data-ctx="EXIT"');
  assert.ok(settingsAt >= 0 && hideAt > settingsAt && exitAt > hideAt);
});
