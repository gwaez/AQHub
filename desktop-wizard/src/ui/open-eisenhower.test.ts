import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

test("wizard menu Eisenhower opens AQHub in the browser, not the in-app matrix", () => {
  const main = read("src/main.ts");
  const rust = read("src-tauri/src/aqhub.rs");
  const lib = read("src-tauri/src/lib.rs");
  assert.match(rust, /pub fn open_aqhub_path/);
  assert.match(rust, /127\.0\.0\.1:8766/);
  assert.match(lib, /aqhub::open_aqhub_path/);
  assert.match(main, /invoke\("open_aqhub_path"/);
  assert.match(main, /openAqHubPath\("\/eisenhower\.html"\)/);
  assert.match(main, /act === "MATRIX"\) await openAqHubEisenhower/);
  assert.match(main, /key === "MATRIX"\) await openAqHubEisenhower/);
  assert.match(main, /\/matrix[\s\S]*openAqHubEisenhower/);
  assert.doesNotMatch(main, /act === "MATRIX"\) await run\(\{ type: "OPEN_MATRIX"/);
  assert.doesNotMatch(main, /key === "MATRIX"\) await run\(\{ type: "OPEN_MATRIX"/);
  const engine = read("src/engines/action-engine.ts");
  assert.match(engine, /case "OPEN_MATRIX"/);
});

test("tray Open AQHub uses open_aqhub, not the removed open_in_browser", () => {
  const tray = read("src-tauri/src/tray.rs");
  assert.match(tray, /aqhub::open_aqhub\(app\.clone\(\)\)/);
  assert.doesNotMatch(tray, /open_in_browser/);
});

test("tray menu includes Settings and Eisenhower with the same actions as the wizard", () => {
  const tray = read("src-tauri/src/tray.rs");
  const main = read("src/main.ts");
  assert.match(tray, /with_id\(app, "settings", "الإعدادات"/);
  assert.match(tray, /with_id\(app, "eisenhower", "أيزنهاور"/);
  assert.match(tray, /with_id\(app, "show", "إظهار"/);
  assert.match(tray, /with_id\(app, "hide", "إخفاء"/);
  assert.match(tray, /with_id\(app, "open", "فتح AQHub"/);
  assert.match(tray, /with_id\(app, "exit", "خروج"/);
  assert.doesNotMatch(tray, /Oppenheimer|oppenheimer/);
  assert.match(tray, /emit_action\(app, "SETTINGS"\)/);
  assert.match(tray, /show_character\(app\.clone\(\)\)/);
  assert.match(tray, /open_aqhub_path\(app\.clone\(\), "\/eisenhower\.html"/);
  assert.doesNotMatch(tray, /eisenhower[\s\S]{0,120}emit_action/);
  assert.match(main, /t === "SETTINGS"/);
  assert.match(main, /openSettings\(\)/);
  assert.match(main, /t === "MATRIX" \|\| t === "EISENHOWER"\) await openAqHubEisenhower/);
});
