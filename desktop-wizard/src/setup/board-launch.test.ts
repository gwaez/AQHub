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
  assert.match(watch, /'-STA'/);
  assert.match(watch, /-WindowStyle Hidden/);
  assert.match(watch, /-NoBrowser/);
  assert.doesNotMatch(watch, /WindowStyle Minimized/);
  assert.match(watch, /Another watchdog already running/);
});

test("Start-Board.ps1 does not always open a browser tab", () => {
  const start = read("Start-Board.ps1");
  assert.match(start, /\[switch\]\$OpenBrowser/);
  assert.match(start, /\[switch\]\$NoBrowser/);
  assert.match(start, /\$args -contains '-NoBrowser'/);
  assert.match(start, /AQHUB_NO_BROWSER/);
  assert.match(start, /AQHUB_OPEN_BROWSER/);
  assert.match(start, /if \(\$wantOpen\)/);
  assert.doesNotMatch(start, /Start-Process "http:\/\/127\.0\.0\.1:\$Port\/board\.html"/);
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

test("Eisenhower notes use a centered floating modal with save/close", () => {
  const eis = read("eisenhower.html");
  assert.match(eis, /id="noteModal"/);
  assert.match(eis, /note-float/);
  assert.match(eis, /id="btnOpenNotes"/);
  assert.match(eis, /id="noteSave"/);
  assert.match(eis, />حفظ</);
  assert.match(eis, />إغلاق</);
  assert.match(eis, /await save\(\)/);
  assert.doesNotMatch(eis, /id="notesEditor"/);
  assert.doesNotMatch(eis, /insertBefore\(\$\('modNotes'\), gutter\)/);
  const task = read("task.html");
  assert.match(task, /id="boxNoteModal"/);
  assert.match(task, /id="btnOpenBoxNote"/);
  assert.match(task, />حفظ</);
  assert.match(task, />إغلاق</);
});

test("merged tree keeps filters dashboard UX and wizard roam/drag", () => {
  const eis = read("eisenhower.html");
  assert.match(eis, /\/api\/dashboard-layout/);
  assert.match(eis, /modNotes/);
  assert.match(eis, /btnApplyBatch/);
  const roam = read("desktop-wizard/src/engines/roam-engine.ts");
  assert.match(roam, /roamEnabled/);
  const main = read("desktop-wizard/src/main.ts");
  assert.match(main, /startDragging/);
  const styles = read("desktop-wizard/src/styles.css");
  assert.match(styles, /--char-scale/);
});

test("Background bat calls VBS then opens the homepage and exits", () => {
  const bat = read("Start-Board-Background.bat");
  assert.match(bat, /Start-Board-Background\.vbs/);
  assert.match(bat, /127\.0\.0\.1:8766\/"/);
  assert.doesNotMatch(bat, /board\.html/);
  assert.match(bat, /exit \/b 0/);
  assert.doesNotMatch(bat, /title /);
  const keep = read("Start-Board-KeepAlive.bat");
  assert.match(keep, /Start-Board-Background\.vbs/);
  assert.doesNotMatch(keep, /\/min powershell/);
  const startBat = read("Start-Board.bat");
  assert.match(startBat, /Start-Board-Background\.vbs/);
  assert.doesNotMatch(startBat, /\/min powershell/);
});
