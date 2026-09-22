import assert from "node:assert/strict";
import test from "node:test";
import { formatAuditLine, parseAuditLog, stripSecrets } from "./audit.ts";

test("stripSecrets redacts tokens without dropping the line", () => {
  const cleaned = stripSecrets({
    at: "2026-09-22T00:00:00Z",
    actor: "AQWizard",
    action: "wizard.create_task",
    extra: { taskId: "T-002", accessToken: "secret-value", nested: { refreshToken: "nope" } },
  }) as Record<string, unknown>;
  const extra = cleaned.extra as Record<string, unknown>;
  assert.equal(extra.taskId, "T-002");
  assert.equal(extra.accessToken, "[redacted]");
  assert.equal((extra.nested as Record<string, unknown>).refreshToken, "[redacted]");
});

test("parseAuditLog returns last N newest-first", () => {
  const raw = [
    JSON.stringify({ at: "1", actor: "User", action: "board.save" }),
    JSON.stringify({ at: "2", actor: "AQWizard", action: "wizard.create_task" }),
    "not-json",
    JSON.stringify({ at: "3", actor: "AQWizard", action: "wizard.ask", extra: { token: "abc" } }),
  ].join("\n");
  const lines = parseAuditLog(raw, 2);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].action, "wizard.ask");
  assert.equal((lines[0].extra as Record<string, unknown>).token, "[redacted]");
  assert.equal(lines[1].action, "wizard.create_task");
  assert.match(formatAuditLine(lines[0]), /wizard.ask/);
});
