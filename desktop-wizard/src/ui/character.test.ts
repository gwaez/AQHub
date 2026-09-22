import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  characterAssetUrl,
  DEFAULT_CHARACTER_ID,
  isRasterAsset,
  loadCharacterPack,
  normalizeCharacterId,
  resolveStateAsset,
  type CharacterPack,
} from "./character.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const secretaryDir = join(root, "characters", "secretary");
const oldWizardDir = join(root, "characters", "old-wizard");

function packFromManifest(id: string, dir: string): CharacterPack {
  const m = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as {
    id: string;
    technicalId?: string;
    defaultDisplayName?: string;
    states: Record<string, { asset?: string | null }>;
    bubble?: { dir?: string; lang?: string };
    anchors?: { bubble?: { x: number; y: number }; wand?: { x: number; y: number } };
  };
  const states: CharacterPack["states"] = {};
  for (const [k, v] of Object.entries(m.states || {})) {
    states[k] = { asset: v.asset ?? null };
  }
  const idle = states.IDLE?.asset || "";
  return {
    id: m.id || id,
    technicalId: m.technicalId || "AQWizard",
    defaultDisplayName: m.defaultDisplayName || "",
    svgUrl: `/characters/${id}/${idle}`,
    baseUrl: `/characters/${id}`,
    bubble: { dir: m.bubble?.dir === "ltr" ? "ltr" : "rtl", lang: m.bubble?.lang || "ar" },
    anchors: {
      bubble: { x: m.anchors?.bubble?.x ?? 0, y: m.anchors?.bubble?.y ?? 0 },
      wand: { x: m.anchors?.wand?.x ?? 0, y: m.anchors?.wand?.y ?? 0 },
    },
    states,
  };
}

test("secretary pack ships PNG poses + manifest, not the user zip", () => {
  const names = readdirSync(secretaryDir);
  assert.ok(!names.some((n) => n.endsWith(".zip") || n === "_extracted" || n.includes("AQWizard_character_pack")));
  const required = [
    "idle.png",
    "watch.png",
    "think.png",
    "speak.png",
    "work.png",
    "success.png",
    "error.png",
    "drag.png",
    "sleep.png",
    "manifest.json",
  ];
  for (const file of required) {
    assert.equal(existsSync(join(secretaryDir, file)), true, `missing ${file}`);
  }
  const png = readFileSync(join(secretaryDir, "idle.png"));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const m = JSON.parse(readFileSync(join(secretaryDir, "manifest.json"), "utf8"));
  assert.equal(m.id, "secretary");
  assert.equal(m.defaultDisplayName, "السكرتيرة");
  assert.equal(m.displayNameEn, "Secretary");
  assert.equal(m.bubble.dir, "rtl");
  assert.equal(m.bubble.lang, "ar");
  assert.equal(m.states.IDLE.asset, "idle.png");
  assert.equal(m.states.WATCHING.asset, "watch.png");
  assert.equal(m.states.THINKING.asset, "think.png");
  assert.equal(m.states.SPEAKING.asset, "speak.png");
  assert.equal(m.states.WORKING.asset, "work.png");
  assert.equal(m.states.MATRIX.asset, "work.png");
  assert.equal(m.states.NOTE.asset, "work.png");
  assert.equal(m.states.TRASH.asset, "work.png");
  assert.equal(m.states.SUCCESS.asset, "success.png");
  assert.equal(m.states.ERROR.asset, "error.png");
  assert.equal(m.states.DRAGGING.asset, "drag.png");
  assert.equal(m.states.SLEEPING.asset, "sleep.png");
  assert.equal(m.states.HIDDEN.asset, null);
});

test("isRasterAsset / resolveStateAsset map PNG packs and keep SVG as non-raster", () => {
  assert.equal(isRasterAsset("idle.png"), true);
  assert.equal(isRasterAsset("watch.webp"), true);
  assert.equal(isRasterAsset("photo.jpg"), true);
  assert.equal(isRasterAsset("photo.jpeg"), true);
  assert.equal(isRasterAsset("wizard.svg"), false);
  assert.equal(isRasterAsset("/characters/secretary/work.png"), true);
  const secretary = packFromManifest("secretary", secretaryDir);
  assert.equal(resolveStateAsset(secretary, "IDLE"), "idle.png");
  assert.equal(resolveStateAsset(secretary, "WATCHING"), "watch.png");
  assert.equal(resolveStateAsset(secretary, "WORKING"), "work.png");
  assert.equal(resolveStateAsset(secretary, "MATRIX"), "work.png");
  assert.equal(resolveStateAsset(secretary, "DRAGGING"), "drag.png");
  assert.equal(resolveStateAsset(secretary, "HIDDEN"), null);
  assert.equal(characterAssetUrl(secretary.baseUrl, "work.png"), "/characters/secretary/work.png");
  const wizard = packFromManifest("old-wizard", oldWizardDir);
  assert.equal(isRasterAsset(resolveStateAsset(wizard, "IDLE") || ""), false);
  assert.equal(resolveStateAsset(wizard, "WORKING"), "wizard.svg");
  assert.equal(normalizeCharacterId("old-wizard"), "old-wizard");
  assert.equal(normalizeCharacterId("nope"), DEFAULT_CHARACTER_ID);
  assert.equal(DEFAULT_CHARACTER_ID, "secretary");
});

test("loadCharacterPack reads PNG state table from the secretary manifest", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/characters/secretary/manifest.json")) {
      return new Response(readFileSync(join(secretaryDir, "manifest.json")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith("/characters/old-wizard/manifest.json")) {
      return new Response(readFileSync(join(oldWizardDir, "manifest.json")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("missing", { status: 404 });
  }) as typeof fetch;
  try {
    const secretary = await loadCharacterPack("secretary");
    assert.equal(secretary.id, "secretary");
    assert.equal(secretary.states.IDLE.asset, "idle.png");
    assert.equal(resolveStateAsset(secretary, "THINKING"), "think.png");
    assert.equal(isRasterAsset(secretary.states.WORKING.asset || ""), true);
    const wizard = await loadCharacterPack("old-wizard");
    assert.equal(wizard.id, "old-wizard");
    assert.equal(wizard.states.IDLE.asset, "wizard.svg");
    assert.equal(isRasterAsset(wizard.states.IDLE.asset || ""), false);
  } finally {
    globalThis.fetch = orig;
  }
});

test("copy-characters copies every pack folder including secretary; UI swaps asset per state", () => {
  const copy = readFileSync(join(root, "scripts", "copy-characters.mjs"), "utf8");
  assert.match(copy, /cpSync\(from, to, \{ recursive: true \}\)/);
  assert.doesNotMatch(copy, /old-wizard/);
  const character = readFileSync(join(root, "src", "ui", "character.ts"), "utf8");
  assert.match(character, /isRasterAsset/);
  assert.match(character, /injectWizardRaster/);
  assert.match(character, /injectWizardSvg/);
  assert.match(character, /className = "character-art"/);
  assert.match(character, /applyCharacterVisual/);
  const main = readFileSync(join(root, "src", "main.ts"), "utf8");
  assert.match(main, /applyCharacterVisual\(character, pack, machine\.state\)/);
  assert.match(main, /loadCharacterPack\(settings\.current\.characterId\)/);
  assert.doesNotMatch(main, /loadCharacterPack\("old-wizard"\)/);
  const settingsPanel = readFileSync(join(root, "src", "ui", "settings-panel.ts"), "utf8");
  assert.match(settingsPanel, /data-set="characterId"/);
  assert.match(settingsPanel, /value="secretary"/);
  assert.match(settingsPanel, /value="old-wizard"/);
});
