import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const script = readFileSync(join(repoRoot, "Setup-AQWizard.ps1"), "utf8");

test("Setup-AQWizard.ps1 is ASCII-friendly and checks the toolchain", () => {
  for (let i = 0; i < script.length; i++) {
    assert.ok(script.charCodeAt(i) < 128, "non-ascii at " + i);
  }
  assert.match(script, /Node\.js 20/);
  assert.match(script, /MinNodeMajor = 20/);
  assert.match(script, /cargo/);
  assert.match(script, /WebView2/);
  assert.match(script, /link\.exe/);
  assert.match(script, /BuildTools/);
  assert.match(script, /npm install/);
  assert.match(script, /npm run tauri dev/);
  assert.match(script, /npm run tauri build/);
  assert.match(script, /Enable-AQWizardAutostart/);
  assert.match(script, /Disable-AQWizardAutostart/);
});

test("Setup-AQWizard.ps1 does not autostart, embed secrets, or auto-send", () => {
  assert.match(script, /Autostart stays OFF unless/);
  assert.match(script, /never calls \/api\/task\/approve-send/);
  assert.match(script, /No Electron/);
  assert.match(script, /Never writes HKLM/);
  assert.doesNotMatch(script, /accessToken|refreshToken|client_secret/);
});
