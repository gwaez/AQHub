import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (name: string) => readFileSync(join(repoRoot, name), "utf8");

test("Watch-Board starts Start-Board hidden with -NoBrowser", () => {
  const watch = read("Watch-Board.ps1");
  assert.match(watch, /'-WindowStyle','Hidden'/);
  assert.match(watch, /-WindowStyle Hidden/);
  assert.match(watch, /-NoBrowser/);
  assert.doesNotMatch(watch, /WindowStyle Minimized/);
  assert.match(watch, /Another watchdog already running/);
});

test("Start-Board.ps1 does not always open a browser tab", () => {
  const start = read("Start-Board.ps1");
  assert.match(start, /\$args -contains '-NoBrowser'/);
  assert.match(start, /AQHUB_NO_BROWSER/);
  assert.match(start, /if \(\$openBrowser\)/);
});

test("Background VBS launches Watch-Board with WScript window style 0", () => {
  const vbs = read("Start-Board-Background.vbs");
  for (let i = 0; i < vbs.length; i++) {
    assert.ok(vbs.charCodeAt(i) < 128, "non-ascii VBS at " + i);
  }
  assert.match(vbs, /Watch-Board\.ps1/);
  assert.match(vbs, /sh\.Run cmd, 0, False/);
  assert.match(vbs, /WindowStyle Hidden/);
});

test("Background bat calls VBS then opens the board URL and exits", () => {
  const bat = read("Start-Board-Background.bat");
  assert.match(bat, /Start-Board-Background\.vbs/);
  assert.match(bat, /127\.0\.0\.1:8766\/board\.html/);
  assert.match(bat, /exit \/b 0/);
  assert.doesNotMatch(bat, /title /);
  const keep = read("Start-Board-KeepAlive.bat");
  assert.match(keep, /Start-Board-Background\.vbs/);
  assert.doesNotMatch(keep, /\/min powershell/);
});
