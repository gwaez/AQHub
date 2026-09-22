import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (name: string) => readFileSync(join(repoRoot, name), "utf8");

function assertAscii(label: string, text: string) {
  for (let i = 0; i < text.length; i++) {
    assert.ok(text.charCodeAt(i) < 128, `${label} non-ascii at ${i}`);
  }
}

function braceBalance(text: string) {
  let n = 0;
  for (const ch of text) {
    if (ch === "{") n++;
    else if (ch === "}") n--;
    if (n < 0) return n;
  }
  return n;
}

test("Mail-Sync.ps1 is ASCII, STA-safe, never starts Outlook or sends", () => {
  const src = read("wizard/Mail-Sync.ps1");
  assertAscii("Mail-Sync.ps1", src);
  assert.equal(braceBalance(src), 0);
  assert.match(src, /function Sync-MailToTasksCore/);
  assert.match(src, /function Get-ActiveComObject/);
  assert.match(src, /function Invoke-InSta/);
  assert.match(src, /function ConvertTo-SlimMailSyncItem/);
  assert.match(src, /function ConvertTo-MailSyncResponseJson/);
  assert.match(src, /GetActiveObject/);
  assert.match(src, /outlook_not_running/);
  assert.match(src, /id = \$id/);
  assert.match(src, /title = \$title/);
  assert.match(src, /entryId = \$entryId/);
  assert.match(src, /fromEmail = \$fromEmail/);
  assert.match(src, /\$script:MailSyncMaxNew = 25/);
  assert.match(src, /\$script:MailSyncMaxScan = 120/);
  assert.doesNotMatch(src, /New-Object\s+-ComObject\s+Outlook/i);
  assert.doesNotMatch(src, /\.Send\s*\(/);
  assert.match(src, /never calls \/api\/task\/approve-send/);
  assert.doesNotMatch(src, /\$it\.Body/);
  assert.doesNotMatch(src, /\$MailItem\.Body/);
});

test("Start-Board.ps1 wires mail/sync JSON errors and wizard mail/status", () => {
  const src = read("Start-Board.ps1");
  assertAscii("Start-Board.ps1", src);
  assert.match(src, /wizard\/Mail-Sync\.ps1/);
  assert.match(src, /function Write-JsonError/);
  assert.match(src, /function Sync-MailToTasks/);
  assert.match(src, /Sync-MailToTasksCore/);
  assert.match(src, /\/api\/mail\/sync/);
  assert.match(src, /\/api\/v1\/wizard\/mail\/status/);
  assert.match(src, /Get-OutlookRunningStatus/);
  assert.match(src, /ApartmentState/);
  assert.match(src, /Write-JsonError \$res 'mail_sync_failed'/);
  assert.match(src, /Unknown API route/);
  assert.match(src, /"ok":false,"error":"unhandled","message":/);
});

test("Wizard-Bridge mail/status is GetActiveObject only", () => {
  const src = read("wizard/Wizard-Bridge.ps1");
  assertAscii("Wizard-Bridge.ps1", src);
  assert.match(src, /\/api\/v1\/wizard\/mail\/status/);
  assert.match(src, /GetActiveObject/);
  assert.match(src, /Get-OutlookRunningStatus/);
  assert.doesNotMatch(src, /New-Object\s+-ComObject\s+Outlook/i);
  assert.match(src, /never calls \/api\/task\/approve-send/);
});
