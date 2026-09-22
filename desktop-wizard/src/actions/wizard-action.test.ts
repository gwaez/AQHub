import assert from "node:assert/strict";
import test from "node:test";
import { isWizardActionType } from "./wizard-action.ts";
import { dispatch, type WizardPorts } from "../engines/action-engine.ts";
import { WizardStateMachine } from "../state/wizard-state-machine.ts";
import type { WizardSettings } from "../settings/wizard-settings.ts";

function sample(): WizardSettings {
  return {
    version: 1,
    characterId: "old-wizard",
    technicalId: "AQWizard",
    displayName: "الساحر العتيق",
    window: { x: null, y: null, scale: 1 },
    visible: true,
    updatedAt: "",
  };
}

function mockPorts(): { ports: WizardPorts; store: { settings: WizardSettings; hidden: boolean; opened: boolean } } {
  const store = { settings: sample(), hidden: false, opened: false };
  const ports: WizardPorts = {
    api: {
      health: async () => ({ ok: true, aqhub: true, version: "0.1.0-p1" }),
      getSettings: async () => store.settings,
      putSettings: async (s) => {
        store.settings = { ...s, updatedAt: "now" };
        return store.settings;
      },
    },
    window: {
      show: async () => {
        store.hidden = false;
      },
      hide: async () => {
        store.hidden = true;
      },
      openAqHub: async () => {
        store.opened = true;
      },
      exit: async () => {},
      setPosition: async () => {},
    },
  };
  return { ports, store };
}

test("action type guard", () => {
  assert.equal(isWizardActionType("SHOW"), true);
  assert.equal(isWizardActionType("approve-send"), false);
});

test("SHOW/HIDE go through engine then state machine — not animation", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  await dispatch({ type: "HIDE" }, ports, sm);
  assert.equal(sm.state, "HIDDEN");
  assert.equal(store.hidden, true);
  assert.equal(store.settings.visible, false);
  await dispatch({ type: "SHOW" }, ports, sm);
  assert.equal(sm.state, "IDLE");
  assert.equal(store.hidden, false);
});

test("RENAME_DISPLAY persists display name and keeps technicalId", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  await dispatch({ type: "RENAME_DISPLAY", displayName: "جابر" }, ports, sm);
  assert.equal(store.settings.displayName, "جابر");
  assert.equal(store.settings.technicalId, "AQWizard");
  assert.equal(store.settings.characterId, "old-wizard");
});

test("PING_HEALTH uses AQHub API port", async () => {
  const { ports } = mockPorts();
  const sm = new WizardStateMachine();
  const result = await dispatch({ type: "PING_HEALTH" }, ports, sm);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.health?.aqhub, true);
});
