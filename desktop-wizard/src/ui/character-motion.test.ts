import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(src, "styles.css"), "utf8");
const main = readFileSync(join(src, "main.ts"), "utf8");

test("idle body motion is on the HTML .character host, not SVG g.wizard-body", () => {
  assert.doesNotMatch(css, /\.wizard-body\s*\{/);
  assert.doesNotMatch(css, /\[data-motion="breathe"\]\s*\.wizard-body/);
  assert.doesNotMatch(css, /\[data-state="ERROR"\]\s*\.wizard-body/);
  assert.doesNotMatch(css, /\[data-state="DRAGGING"\]\s*\.wizard-body/);
  assert.match(css, /\.character\[data-motion="breathe"\]\s*\{/);
  assert.match(css, /\.character\[data-motion="glance"\]\s*\{/);
  assert.match(css, /\.character\[data-motion="ponder"\]\s*\{/);
  assert.match(css, /\.character\[data-motion="sleep"\]\s*\{/);
  assert.match(css, /\.character\[data-motion="lift"\]\s*\{/);
  assert.match(css, /\.character\[data-state="ERROR"\]\s*\{/);
  assert.match(css, /\.character\[data-state="DRAGGING"\]\s*\{/);
});

test("character scale is a CSS variable so host keyframes can compose", () => {
  assert.match(css, /--char-scale:\s*1;/);
  assert.match(main, /setProperty\("--char-scale"/);
  assert.doesNotMatch(main, /character\.style\.transform\s*=/);
  assert.match(css, /@keyframes breathe[\s\S]*scale\(var\(--char-scale\)\)/);
  assert.match(css, /@keyframes glance[\s\S]*scale\(var\(--char-scale\)\)/);
  assert.match(css, /@keyframes ponder[\s\S]*scale\(var\(--char-scale\)\)/);
  assert.match(css, /@keyframes shake[\s\S]*scale\(var\(--char-scale\)\)/);
  assert.match(css, /@keyframes slump[\s\S]*scale\(var\(--char-scale\)\)/);
});

test("IDLE breathe travel is clearly visible (~10–12px) and animationLevel off kills host motion", () => {
  const breathe = css.match(/@keyframes breathe\s*\{([\s\S]*?)\n@keyframes /);
  assert.ok(breathe, "breathe keyframes missing");
  const y = [...breathe[1].matchAll(/translateY\((-?\d+(?:\.\d+)?)px\)/g)].map((m) => Math.abs(Number(m[1])));
  assert.ok(y.some((n) => n >= 10 && n <= 12), `breathe translateY should be 10–12px, got ${y.join(",")}`);
  assert.match(css, /body\[data-anim="off"\]\s*\.character\s*\{[\s\S]*animation:\s*none\s*!important/);
  assert.match(css, /\.character\[data-look="1"\]\s*\.pupil/);
  assert.match(css, /\.character\[data-blink="1"\]\s*\.lid/);
});

test("pet hit plate is visually invisible but keeps pointer hits", () => {
  const hit = css.match(/\.pet-hit\s*\{([^}]+)\}/);
  const plate = css.match(/\.pet-plate\s*\{([^}]+)\}/);
  assert.ok(hit && plate, "pet-hit / pet-plate rules missing");
  assert.match(hit[1], /background:\s*transparent/);
  assert.match(hit[1], /pointer-events:\s*auto/);
  assert.match(plate[1], /background:\s*transparent/);
  assert.match(plate[1], /pointer-events:\s*auto/);
  assert.match(plate[1], /opacity:\s*0/);
  assert.doesNotMatch(css, /rgba\(\s*8\s*,\s*16\s*,\s*28\s*,\s*0\.0[45]\s*\)/);
});

test("PNG character art uses object-fit contain on an img, while SVG inject stays", () => {
  assert.match(css, /\.character img,/);
  assert.match(css, /\.character \.character-art/);
  assert.match(css, /\.character \.character-art \{[\s\S]*object-fit:\s*contain/);
  const character = readFileSync(join(src, "ui", "character.ts"), "utf8");
  assert.match(character, /isRasterAsset/);
  assert.match(character, /injectWizardRaster/);
  assert.match(character, /injectWizardSvg/);
  assert.match(main, /applyCharacterVisual\(character, pack, machine\.state\)/);
});

test("settings open enlarges the companion window then restores on close", () => {
  const rust = readFileSync(join(src, "..", "src-tauri", "src", "window_ctl.rs"), "utf8");
  assert.match(rust, /pub fn set_settings_layout/);
  assert.match(rust, /720\.0/);
  assert.match(rust, /680\.0/);
  assert.match(main, /invoke\("set_settings_layout"/);
  assert.match(main, /setSettingsLayout\(true\)/);
  assert.match(main, /setSettingsLayout\(false\)/);
  assert.match(css, /body\.settings-open\s+\.settings-panel:not\(\[hidden\]\)/);
  assert.match(css, /body\.settings-open\s+\.settings-panel:not\(\[hidden\]\)\s*\{[\s\S]*max-height:\s*none/);
});
