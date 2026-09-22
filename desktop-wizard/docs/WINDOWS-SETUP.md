# AQWizard on a clean Windows PC

English runbook for installing **AQHub + AQWizard** without developer tribal knowledge.  
Arabic twin: [SETUP-AR.md](../../SETUP-AR.md) (board) and the **Arabic section** at the bottom of this file.

**Not a signed NSIS/MSI yet.** This phase is a working setup script + docs + `tauri build` instructions. Unsigned `aqwizard.exe` can be produced on Windows after Build Tools are installed.

No Electron. No cloud AI. Email **never auto-sends**.

---

## Phase map

| Phase | Status |
|-------|--------|
| P0 compatibility map | Done |
| P1 Tauri scaffold | Done |
| P2–P4 state / bubbles / Quick Task | Done |
| P5–P6 Eisenhower + trash/undo | Done |
| **P7 Magic Wand / UIA** | **Pending** — needs a real Windows desktop **and** VS Build Tools (MSVC) |
| **P8 Follow My Work** | **Pending** |
| P9 settings depth | Done |
| P10 Outlook via existing AQHub mail APIs | Done |
| P11 permission center | Done |
| **P12 installer foundations** | **This document + `Setup-AQWizard.ps1`** |
| **P13 signed NSIS / MSI** | **Pending** |

---

## What an admin must install (Windows)

Do these **on the user PC**, not on a Linux cloud agent.

| Tool | Why | How |
|------|-----|-----|
| Git | Clone the private repo | `winget install --id Git.Git` (see [SETUP.md](../../SETUP.md)) |
| **Node.js 20+** (LTS) | `npm install` / Vite / Tauri CLI | `winget install --id OpenJS.NodeJS.LTS` then **reopen PowerShell** |
| **Rust stable ≥ 1.88** | Tauri 2 native crate | `winget install --id Rustlang.Rustup` then `rustup default stable` |
| **WebView2 runtime** | Tauri window | Usually already on Windows 10/11. If the window is blank: [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) |
| **VS 2022 Build Tools — Desktop development with C++** | `link.exe` for `aqwizard.exe`. Also required later for Magic Wand/UIA | See **Build Tools path** below |
| Outlook desktop (signed in) | Mail sync/open via AQHub COM | Optional for the companion UI; required for real mail |
| AQHub board | Wizard talks to `http://127.0.0.1:8766` | `Setup-AQHub.ps1` / `Start-Board-KeepAlive.bat` |

### Build Tools path (explicit)

This repo **does not** auto-install Build Tools (large download, needs elevation).

1. Open **Visual Studio Installer** → **Modify** on **Build Tools 2022** (or VS 2022).
2. Enable workload **Desktop development with C++** (MSVC + Windows 10/11 SDK).
3. Typical install root:

```text
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools
```

Winget (still need the C++ workload):

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --source winget --accept-package-agreements --accept-source-agreements
```

After install, use **x64 Native Tools Command Prompt for VS** (or Developer PowerShell) so `link.exe` is on PATH, then `npm run tauri dev` / `tauri build`.

---

## Ordered steps

### 1) Board first

From the AQHub clone:

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-AQHub.ps1
```

Wait for `http://127.0.0.1:8766/board.html`. Details: [SETUP.md](../../SETUP.md) / [SETUP-AR.md](../../SETUP-AR.md).

### 2) Wizard toolchain + npm

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-AQWizard.ps1
```

The script checks Node 20+, cargo/rustc, WebView2, MSVC `link.exe` (hint only), copies `data/wizard-settings.json` from the sample **only if missing**, and runs `npm install` in `desktop-wizard/`.

It never writes CRM tokens, never enables autostart unless you pass `-Autostart`, and never calls approve-send.

### 3) Run the companion

**Dev (recommended until an exe exists):**

```powershell
cd desktop-wizard
npm run tauri dev
```

Optional: `$env:AQHUB_ROOT` = the AQHub clone if the exe cannot find `Start-Board.ps1`.

**Unsigned Windows exe (on that PC, after Build Tools):**

```powershell
cd desktop-wizard
npm run tauri build
```

Output: `desktop-wizard\src-tauri\target\release\aqwizard.exe`  
`tauri.conf.json` currently has `"bundle": { "active": false }` — no NSIS package until P13.

A Linux VM **must not** be used to produce Windows binaries.

### 4) Autostart (default OFF)

Safe opt-in **after** a successful `tauri build`:

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-AQWizard.ps1 -Autostart
```

Creates a **current-user Startup folder** shortcut (`AQWizard.lnk`). Does not write HKLM.

Optional extra: `-UseRegistryRunKey` adds HKCU `Run` only.

Remove:

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-AQWizard.ps1 -DisableAutostart
```

---

## Desktop roam (not Follow My Work)

While **IDLE** or **WATCHING**, AQWizard slowly glides the transparent window left/right inside the **monitor work area** (taskbar-safe). This is not P8 app-tracking.

- Drag the **character body or nameplate** (not only the thin top strip): roam pauses during the drag and for ~2.5s after, then resumes from the new spot. The display-name button stays a non-drag hit so double-click rename still works.
- **SLEEPING** / **HIDDEN**: roam stops; the window stays put (sleep does not drift to a corner).
- Settings → Character → **Roam around the desktop** (`roamEnabled`, default on). Animation level **Off** also freezes roam.
- Moves call `set_character_position`. They do **not** write `tasks.json`. Glide steps are not PUT every frame; the last spot is saved when a roam target is reached or after a user drag.

---

`data/wizard-settings.json` already holds display name, size (`window.scale`), preferred corner, and the permission preset (Outlook Read/Draft = Ask, Send = Never).

On a **brand-new** settings file the companion shows a short speech bubble covering those four points, then sets `firstRunComplete`. Existing files are **not** overwritten and **not** blocked by a wizard modal.

Do not commit the live `wizard-settings.json`.

---

## Safety

- Wizard mutations go through AQHub HTTP only.
- `APPROVE_SEND` is denied even after confirm.
- Do not commit `data/tasks.json`, `data/eisenhower.json`, `data/crm-config.json`, tokens, `.env`.

---

## Troubleshoot

| Symptom | Try |
|---------|-----|
| `node` / `cargo` not recognized | Reopen PowerShell after winget; confirm `node -v` / `cargo -v` |
| `link.exe not found` / LNK errors | Install Build Tools C++ workload; use VS Native Tools prompt |
| Blank Tauri window | Install WebView2 runtime |
| Companion cannot reach the board | Start `Start-Board-KeepAlive.bat`; open `http://127.0.0.1:8766/board.html` |
| Mail bubble “unavailable” | Outlook desktop not running / not signed in — expected; no crash |

---

## العربية — مسار الجهاز النظيف

1. ثبّت اللوحة أولاً من [SETUP-AR.md](../../SETUP-AR.md) (`Setup-AQHub.ps1`).
2. ثبّت **Node 20+** و **Rust** و **WebView2** و **Visual Studio Build Tools** (حمل عمل **Desktop development with C++**). المسار الشائع:

```text
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools
```

السكربت **لا** يثبّت Build Tools تلقائيًا.

3. من مجلد AQHub:

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-AQWizard.ps1
```

4. التشغيل: `cd desktop-wizard` ثم `npm run tauri dev`. البناء: `npm run tauri build` على ويندوز فقط.
5. التشغيل مع ويندوز (اختياري، افتراضيًا مغلق): `Setup-AQWizard.ps1 -Autostart` بعد وجود `aqwizard.exe`.
6. لا Electron. لا إرسال بريد تلقائي. العصا السحرية / UIA لاحقًا بعد Build Tools وسطح المكتب.
