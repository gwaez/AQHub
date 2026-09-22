import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings, normalizeSettings } from "../api/aqhub-client.ts";
import { WizardSettingsStore } from "./wizard-settings.ts";

test("normalizeSettings fills P9 defaults and clamps", () => {
  const s = normalizeSettings({
    displayName: "تجربة",
    opacity: 9,
    bubbleScale: 0.1,
    idleSleepMs: 100,
    language: "en",
    closeAction: "exit",
    permissions: { "eisenhower.trash": "never", "outlook.send": "allow" },
  });
  assert.equal(s.characterId, "old-wizard");
  assert.equal(s.technicalId, "AQWizard");
  assert.equal(s.opacity, 1);
  assert.equal(s.bubbleScale, 0.7);
  assert.equal(s.idleSleepMs, 5000);
  assert.equal(s.language, "en");
  assert.equal(s.closeAction, "exit");
  assert.equal(s.permissions["eisenhower.trash"], "never");
  assert.equal(s.permissions["outlook.send"], "ask");
  assert.equal(s.permissions["board.create_task"], "allow");
});

test("store save merges permissions without resetting others", async () => {
  const mem = { current: defaultSettings() };
  const store = new WizardSettingsStore({
    health: async () => ({ ok: true, aqhub: true, version: "test" }),
    getSettings: async () => mem.current,
    putSettings: async (s) => {
      mem.current = s;
      return s;
    },
    getTasksDoc: async () => ({ version: 1, title: "t", tasks: [] }),
    putTasksDoc: async () => {},
    postBoxNote: async () => {},
    postAudit: async () => {},
    getAudit: async () => [],
    getEisDoc: async () => ({ items: [] }),
    putEisDoc: async () => {},
  });
  await store.load();
  await store.save({ permissions: { "eisenhower.trash": "never" } });
  assert.equal(store.current.permissions["eisenhower.trash"], "never");
  assert.equal(store.current.permissions["board.create_task"], "allow");
  await store.save({ opacity: 0.5 });
  assert.equal(store.current.opacity, 0.5);
  assert.equal(store.current.permissions["eisenhower.trash"], "never");
});
