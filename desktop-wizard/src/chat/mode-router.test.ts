import assert from "node:assert/strict";
import test from "node:test";
import { defaultBridge } from "../bridge/config.ts";
import { routeOutbound } from "./mode-router.ts";

test("mode toggle routes execute to the command map and chat to the payload", () => {
  const execute = routeOutbound({
    mode: "execute",
    text: "إخفاء",
    characterId: "secretary",
    technicalId: "AQWizard",
  });
  assert.equal(execute.mode, "execute");
  if (execute.mode === "execute") {
    assert.deepEqual(execute.execute, { kind: "action", action: { type: "HIDE" } });
  }

  const chat = routeOutbound({
    mode: "chat",
    text: "مرحبا",
    characterId: "secretary",
    technicalId: "AQWizard",
    agentId: "grok-bot-1",
    timestamp: "2026-09-22T11:00:00.000Z",
    bridge: defaultBridge(),
  });
  assert.equal(chat.mode, "chat");
  if (chat.mode === "chat") {
    assert.equal(chat.linked, false);
    assert.deepEqual(chat.payload, {
      text: "مرحبا",
      mode: "chat",
      characterId: "secretary",
      technicalId: "AQWizard",
      timestamp: "2026-09-22T11:00:00.000Z",
      agentId: "grok-bot-1",
    });
  }
});

test("chat is linked only when bridge.enabled and url are set", () => {
  const unlinked = routeOutbound({
    mode: "chat",
    text: "hi",
    characterId: "old-wizard",
    technicalId: "AQWizard",
    bridge: { enabled: true, url: "", secretRef: "wizard-bridge", agentId: "" },
  });
  assert.equal(unlinked.mode, "chat");
  if (unlinked.mode === "chat") assert.equal(unlinked.linked, false);

  const linked = routeOutbound({
    mode: "chat",
    text: "hi",
    characterId: "old-wizard",
    technicalId: "AQWizard",
    bridge: { enabled: true, url: "https://hooks.example.test/wizard", secretRef: "wizard-bridge", agentId: "" },
  });
  assert.equal(linked.mode, "chat");
  if (linked.mode === "chat") assert.equal(linked.linked, true);
});

test("execute mode does not build a webhook payload", () => {
  const routed = routeOutbound({
    mode: "execute",
    text: "تاسك: تجربة",
    characterId: "secretary",
    technicalId: "AQWizard",
    bridge: { enabled: true, url: "https://hooks.example.test/wizard", secretRef: "x", agentId: "g" },
  });
  assert.equal(routed.mode, "execute");
  assert.equal("payload" in routed, false);
});
