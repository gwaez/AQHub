import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { defaultSettings, normalizeSettings } from "../api/aqhub-client.ts";
import { isSafeBridgeUrl, isBridgeLinked, normalizeBridge } from "./config.ts";
import { buildChatPayload, assertSafePayload } from "./payload.ts";
import { postBridge } from "./client.ts";
import { memoryKv, readBridgeSecret, writeBridgeSecret, hasBridgeSecret } from "./secret-store.ts";
import { enqueueOutbound, peekOutboundQueue, takeOutboundQueue } from "./queue.ts";

test("payload shape is text/mode/characterId/technicalId/timestamp", () => {
  const payload = buildChatPayload({
    text: "  اسأل  ",
    mode: "chat",
    characterId: "secretary",
    technicalId: "AQWizard",
    timestamp: "2026-09-22T11:00:00.000Z",
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    "characterId",
    "mode",
    "technicalId",
    "text",
    "timestamp",
  ]);
  assert.equal(payload.text, "اسأل");
  assert.equal(payload.mode, "chat");
  assert.equal(payload.characterId, "secretary");
  assert.equal(payload.technicalId, "AQWizard");
  assert.equal(payload.timestamp, "2026-09-22T11:00:00.000Z");
  assert.equal("secret" in payload, false);
  assert.equal("agentId" in payload, false);
  assertSafePayload(payload);
});

test("payload omits empty agentId and never copies a secret field", () => {
  const withAgent = buildChatPayload({
    text: "hi",
    mode: "chat",
    characterId: "secretary",
    technicalId: "AQWizard",
    agentId: "grok-1",
    timestamp: "t",
  });
  assert.equal(withAgent.agentId, "grok-1");
  assert.equal("secret" in withAgent, false);
  assert.equal("token" in withAgent, false);
  const json = JSON.stringify(withAgent);
  assert.doesNotMatch(json, /"secret"/);
  assert.doesNotMatch(json, /accessToken|refreshToken/);
});

test("bridge config defaults off and rejects javascript urls", () => {
  const n = normalizeBridge({ enabled: "yes", url: "javascript:alert(1)", secret: "nope" });
  assert.equal(n.enabled, false);
  assert.equal(n.url, "");
  assert.equal(isSafeBridgeUrl("javascript:alert(1)"), false);
  assert.equal(isSafeBridgeUrl("https://hooks.example.test/w"), true);
  assert.equal(isSafeBridgeUrl("http://127.0.0.1:9999/hook"), true);
  assert.equal(isBridgeLinked(normalizeBridge({ enabled: true, url: "https://x.test/h" })), true);
  assert.equal(isBridgeLinked(normalizeBridge({ enabled: false, url: "https://x.test/h" })), false);
});

test("normalizeSettings keeps bridge and never persists a secret property", () => {
  const s = normalizeSettings({
    bridge: { enabled: true, url: "https://hooks.example.test/w", secretRef: "k", agentId: "g1", secret: "leak" },
  });
  assert.equal(s.bridge.enabled, true);
  assert.equal(s.bridge.url, "https://hooks.example.test/w");
  assert.equal(s.bridge.secretRef, "k");
  assert.equal(s.bridge.agentId, "g1");
  assert.equal("secret" in s.bridge, false);
  const round = normalizeSettings(defaultSettings());
  assert.equal(round.bridge.enabled, false);
  assert.equal(round.bridge.secretRef, "wizard-bridge");
});

test("secret lives only in the local kv, not in settings JSON", () => {
  const kv = memoryKv();
  writeBridgeSecret("wizard-bridge", "s3cret", kv);
  assert.equal(readBridgeSecret("wizard-bridge", kv), "s3cret");
  assert.equal(hasBridgeSecret("wizard-bridge", kv), true);
  const settings = JSON.stringify(defaultSettings());
  assert.doesNotMatch(settings, /s3cret/);
});

test("unlinked chat can queue the payload without the secret", () => {
  const kv = memoryKv();
  const payload = buildChatPayload({
    text: "queued",
    mode: "chat",
    characterId: "secretary",
    technicalId: "AQWizard",
    timestamp: "t",
  });
  enqueueOutbound(payload, kv);
  assert.equal(peekOutboundQueue(kv).length, 1);
  const taken = takeOutboundQueue(kv);
  assert.equal(taken[0]?.payload.text, "queued");
  assert.equal(peekOutboundQueue(kv).length, 0);
  assert.equal("secret" in (taken[0]?.payload || {}), false);
});

test("bridge POST sends payload JSON and secret header only", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const payload = buildChatPayload({
    text: "hello",
    mode: "chat",
    characterId: "secretary",
    technicalId: "AQWizard",
    timestamp: "2026-09-22T11:00:00.000Z",
    agentId: "bot",
  });
  const result = await postBridge(
    "https://hooks.example.test/wizard",
    payload,
    "local-secret",
    {
      async fetch(url, init) {
        calls.push({ url, init });
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({ reply: "أهلا" });
          },
        };
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.reply, "أهلا");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://hooks.example.test/wizard");
  assert.equal(calls[0].init.method, "POST");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers["X-AQWizard-Secret"], "local-secret");
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.text, "hello");
  assert.equal(body.mode, "chat");
  assert.equal(body.secret, undefined);
  assert.equal(body.agentId, "bot");
});

test("Ask-the-Wizard menu is enabled and chat files exist", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const html = readFileSync(join(root, "index.html"), "utf8");
  assert.match(html, /data-ctx="ASK"/);
  assert.doesNotMatch(html, /data-ctx="ASK" disabled/);
  assert.match(html, /id="askSheet"/);
  const main = readFileSync(join(root, "src", "main.ts"), "utf8");
  assert.match(main, /key === "ASK"\) await openAsk/);
  assert.match(main, /act === "ASK"\) await openAsk/);
  const conf = readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8");
  assert.match(conf, /connect-src[^"]*https:/);
  const docs = readFileSync(join(root, "docs", "wizard-chat-bridge.md"), "utf8");
  assert.match(docs, /characterId/);
  assert.match(docs, /secretRef/);
  assert.match(docs, /must not|never/i);
  const bridgePs = readFileSync(join(root, "..", "wizard", "Wizard-Bridge.ps1"), "utf8");
  assert.match(bridgePs, /ConvertTo-WizardBridgeConfig/);
  assert.match(bridgePs, /secretRef/);
  assert.doesNotMatch(bridgePs, /accessToken|refreshToken/);
});
