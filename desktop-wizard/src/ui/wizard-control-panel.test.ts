import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { CHARACTER_POSE_SLOTS } from "../settings/character-id.ts";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (rel: string) => readFileSync(join(repo, rel), "utf8");

test("Control Panel exposes a Wizard page with settings and PNG pose slots", () => {
  const page = read("wizard.html");
  const index = read("index.html");
  const panel = read("panel.html");
  assert.match(page, /AQWizard/);
  assert.match(page, /الإعدادات/);
  assert.match(page, /إنشاء شخصية جديدة/);
  assert.match(page, /PUT \/api\/v1\/wizard\/settings/);
  assert.match(page, /\/api\/v1\/wizard\/characters/);
  assert.match(page, /activateOnSave/);
  assert.doesNotMatch(page, /Oppenheimer|oppenheimer/);
  assert.doesNotMatch(page, /\/api\/task\/approve-send/);
  assert.match(page, /بدون tasks\.json/);
  for (const slot of CHARACTER_POSE_SLOTS) {
    assert.match(page, new RegExp(`id: '${slot.id}'`));
    assert.match(page, new RegExp(slot.labelAr));
    assert.match(page, new RegExp(slot.file.replace(".", "\\.")));
  }
  assert.match(page, /وقوف هادئ/);
  assert.match(page, /تفكير/);
  assert.match(page, /نوم/);
  assert.match(index, /href: '\.\/wizard\.html'/);
  assert.match(panel, /href: '\.\/wizard\.html'/);
  assert.match(index, /id: 'wizard'/);
});

test("Wizard-Bridge lists and writes character packs without touching tasks.json", () => {
  const bridge = read("wizard/Wizard-Bridge.ps1");
  assert.match(bridge, /Test-WizardSafeCharacterId/);
  assert.match(bridge, /Save-WizardUploadedPack/);
  assert.match(bridge, /Copy-WizardCharacterToPublic/);
  assert.match(bridge, /\/api\/v1\/wizard\/characters/);
  assert.match(bridge, /Test-WizardPngBytes/);
  assert.match(bridge, /0x89/);
  assert.match(bridge, /builtin_pack/);
  assert.match(bridge, /idle_required/);
  assert.match(bridge, /public/);
  assert.match(bridge, /characters/);
  assert.match(bridge, /Never writes tasks\.json/);
  assert.match(bridge, /never calls \/api\/task\/approve-send/);
  assert.doesNotMatch(bridge, /crm-config/);
  for (let i = 0; i < bridge.length; i++) {
    assert.ok(bridge.charCodeAt(i) < 128, "non-ascii Wizard-Bridge at " + i);
  }
});

test("tray and in-app wizard still open Eisenhower in the browser", () => {
  const tray = read("desktop-wizard/src-tauri/src/tray.rs");
  const page = read("wizard.html");
  assert.match(tray, /أيزنهاور/);
  assert.match(tray, /\/eisenhower\.html/);
  assert.match(page, /href="\.\/eisenhower\.html"/);
  assert.doesNotMatch(tray, /Oppenheimer/);
});
