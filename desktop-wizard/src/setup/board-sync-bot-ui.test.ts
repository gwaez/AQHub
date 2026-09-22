import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (name) => readFileSync(join(repoRoot, name), "utf8");

function loadAQOps() {
  const src = read("js/aq-ops.js");
  const ctx = createContext({ console });
  runInContext(src, ctx);
  assert.ok(ctx.AQOps, "AQOps missing");
  return ctx.AQOps;
}

test("AQOps formats sync counts and never claims send", () => {
  const AQOps = loadAQOps();
  const text = AQOps.formatSyncResult({ ok: true, added: 2, scanned: 11, unreadTotal: 4 });
  assert.match(text, /2 جديد/);
  assert.match(text, /فحص 11/);
  assert.match(text, /غير مقروء 4/);
  assert.equal(AQOps.claimsSend(text), false);
  assert.equal(AQOps.claimsSend(AQOps.neverSendHint()), false);
  assert.equal(AQOps.claimsSend("تم الإرسال"), true);
});

test("AQOps surfaces JSON error message from mail/bot payloads", () => {
  const AQOps = loadAQOps();
  assert.equal(
    AQOps.apiErrorText(500, '{"ok":false,"error":"mail_sync_failed","message":"Outlook is not running"}'),
    "Outlook is not running"
  );
  assert.equal(AQOps.apiErrorText(404, '{"ok":false,"error":"task_not_found"}'), "task_not_found");
  assert.equal(AQOps.apiErrorText(500, ""), "HTTP 500");
  assert.equal(AQOps.isFailurePayload({ ok: false, error: "x" }), true);
  assert.equal(AQOps.isFailurePayload({ ok: true, added: 0 }), false);
  assert.equal(AQOps.isFailurePayload({ id: "j1", status: "running" }), false);
});

test("AQOps draft_reply job text says draft and not sent", () => {
  const AQOps = loadAQOps();
  const done = AQOps.formatJobUserText({
    status: "done",
    action: "draft_reply",
    result: { suggestedReply: "hello", sent: false },
  });
  assert.match(done, /مسودة/);
  assert.match(done, /ما اتبعتش/);
  assert.equal(AQOps.claimsSend(done), false);
  assert.equal(AQOps.isJobRunning({ status: "running" }), true);
  assert.equal(AQOps.isJobRunning({ status: "done" }), false);
  assert.match(AQOps.formatJobUserText({ status: "error", result: { message: "boom" } }), /boom/);
});

test("board / eisenhower / control expose Sync + Run/Stop against the live APIs", () => {
  const board = read("board.html");
  const eis = read("eisenhower.html");
  const index = read("index.html");
  const panel = read("panel.html");
  const ops = read("js/aq-ops.js");

  assert.match(board, /js\/aq-ops\.js/);
  assert.match(eis, /js\/aq-ops\.js/);
  assert.match(index, /js\/aq-ops\.js/);
  assert.match(panel, /js\/aq-ops\.js/);

  assert.match(board, /id="btnSync"/);
  assert.match(board, /مزامنة الإيميل/);
  assert.match(board, /\/api\/mail\/sync/);
  assert.match(board, /\/api\/bot\/run/);
  assert.match(board, /\/api\/bot\/stop/);
  assert.match(board, /\/api\/bot\/job/);
  assert.match(board, /id="btnDockRun"/);
  assert.match(board, /id="btnDockStop"/);
  assert.match(board, /id="jobStatus"/);
  assert.match(board, /added\/scanned|formatSyncResult|unreadTotal/);
  assert.match(board, /ما اتبعتش إيميل/);
  assert.doesNotMatch(board, /الإيميل اتبعت/);

  assert.match(eis, /id="btnSyncMail"/);
  assert.match(eis, /id="btnRunBot"/);
  assert.match(eis, /id="btnStopBot"/);
  assert.match(eis, /\/api\/mail\/sync/);
  assert.match(eis, /\/api\/bot\/run/);
  assert.match(eis, /\/api\/bot\/stop/);
  assert.match(eis, /\/api\/bot\/job/);
  assert.match(eis, /\/api\/bot\/jobs/);
  assert.match(eis, /data-m="botrun"/);

  assert.match(index, /id="btnSync"/);
  assert.match(index, /id="btnRunBot"/);
  assert.match(index, /id="btnStopBot"/);
  assert.match(index, /mail-sync/);
  assert.match(index, /bindControlPanel/);
  assert.match(panel, /id="btnSync"/);
  assert.match(panel, /bindControlPanel/);

  assert.match(ops, /\/api\/mail\/sync/);
  assert.match(ops, /\/api\/bot\/run/);
  assert.match(ops, /\/api\/bot\/stop/);
  assert.match(ops, /\/api\/bot\/job/);
  assert.doesNotMatch(ops, /approve-send/);
});

test("fetchJson throws the JSON message on ok:false", async () => {
  const src = read("js/aq-ops.js");
  const ctx = createContext({
    console,
    fetch: async () => ({
      ok: false,
      status: 503,
      text: async () => '{"ok":false,"error":"outlook_not_running","message":"Outlook desktop is not running"}',
    }),
  });
  runInContext(src, ctx);
  await assert.rejects(
    () => ctx.AQOps.fetchJson("/api/mail/sync", { method: "POST" }),
    /Outlook desktop is not running/
  );
});
