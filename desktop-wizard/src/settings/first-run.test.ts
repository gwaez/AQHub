import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../api/aqhub-client.ts";
import { firstRunBubbleText, shouldMarkFirstRunQuiet, shouldShowFirstRun } from "./first-run.ts";

test("brand-new settings get a first-run bubble", () => {
  const s = defaultSettings();
  assert.equal(s.firstRunComplete, false);
  assert.equal(s.updatedAt, "");
  assert.equal(shouldShowFirstRun(s), true);
  assert.equal(shouldMarkFirstRunQuiet(s), false);
});

test("existing persisted settings are not blocked or nagged", () => {
  const s = { ...defaultSettings(), updatedAt: "2026-09-22T00:00:00Z", firstRunComplete: false };
  assert.equal(shouldShowFirstRun(s), false);
  assert.equal(shouldMarkFirstRunQuiet(s), true);
});

test("completed first-run stays quiet", () => {
  const s = { ...defaultSettings(), firstRunComplete: true, updatedAt: "" };
  assert.equal(shouldShowFirstRun(s), false);
  assert.equal(shouldMarkFirstRunQuiet(s), false);
});

test("bubble copy interpolates name, size, corner", () => {
  const s = defaultSettings("الساحر العتيق");
  s.window.scale = 1.2;
  s.preferredCorner = "top-start";
  const text = firstRunBubbleText(s, {
    firstRunWelcome: "name={name} scale={scale} corner={corner}",
  });
  assert.equal(text, "name=الساحر العتيق scale=120 corner=top-start");
});
