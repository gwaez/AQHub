import assert from "node:assert/strict";
import test from "node:test";
import {
  CHARACTER_POSE_SLOTS,
  DEFAULT_CHARACTER_ID,
  isSafeCharacterId,
  normalizeCharacterId,
  poseFileForState,
  slugifyCharacterName,
} from "./character-id.ts";

test("safe character ids are slugs; unsafe values fall back to secretary", () => {
  assert.equal(isSafeCharacterId("secretary"), true);
  assert.equal(isSafeCharacterId("old-wizard"), true);
  assert.equal(isSafeCharacterId("luna-bot"), true);
  assert.equal(isSafeCharacterId("Nope"), false);
  assert.equal(isSafeCharacterId("../x"), false);
  assert.equal(isSafeCharacterId("a/b"), false);
  assert.equal(isSafeCharacterId("con"), false);
  assert.equal(normalizeCharacterId("luna-bot"), "luna-bot");
  assert.equal(normalizeCharacterId("../etc"), DEFAULT_CHARACTER_ID);
});

test("Arabic names become char- slugs; latin names hyphenate", () => {
  assert.equal(slugifyCharacterName("Luna Bot"), "luna-bot");
  assert.equal(slugifyCharacterName("  Hello__World  "), "hello-world");
  const ar = slugifyCharacterName("ليلى");
  assert.match(ar, /^char-[0-9a-f]+$/);
  assert.equal(isSafeCharacterId(ar), true);
});

test("pose catalog covers secretary PNG slots with Arabic labels", () => {
  const ids = CHARACTER_POSE_SLOTS.map((s) => s.id);
  assert.deepEqual(ids, ["idle", "watch", "think", "speak", "work", "success", "error", "drag", "sleep"]);
  assert.equal(CHARACTER_POSE_SLOTS.find((s) => s.id === "idle")?.labelAr, "وقوف هادئ");
  assert.equal(CHARACTER_POSE_SLOTS.find((s) => s.id === "think")?.labelAr, "تفكير");
  assert.equal(CHARACTER_POSE_SLOTS.find((s) => s.id === "sleep")?.labelAr, "نوم");
  assert.equal(poseFileForState(["idle"], "THINKING"), "idle.png");
  assert.equal(poseFileForState(["idle", "think"], "THINKING"), "think.png");
  assert.equal(poseFileForState(["idle", "work"], "MATRIX"), "work.png");
  assert.equal(poseFileForState(["idle"], "HIDDEN"), "idle.png");
});
