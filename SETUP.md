# Setup AQHub on a new Windows PC

Step-by-step for a beginner. Copy-paste each command into PowerShell exactly as written.

## What this product actually is

AQHub is a **local-only command board** on your PC:

- HTML pages (`board.html` and related files)
- A PowerShell script that runs a simple local server (`HttpListener`) on port `8766`
- Mail read/send via **desktop Outlook** (COM) — not a cloud mail API and not npm

There is **no** heavy Node.js stack, no cloud server, and no invented OAuth flow. Real prompts you may see:

| Situation | What happens |
|-----------|----------------|
| Cloning a private repo | Git Credential Manager / browser asks for GitHub login — approve |
| Git missing | `winget` downloads Git with visible progress |
| Mail features | Outlook desktop must already be installed and signed in |
| First run | Windows/Outlook may show COM security prompts — allow if you started AQHub |
| After start | Server listens on `http://127.0.0.1:8766/` (homepage). The task board is **not** auto-opened |

**Mail safety:** email **never auto-sends**. Drafts stay local until you manually approve send.

---

## Step 0 — Prerequisites

1. A **Windows** PC (Windows 10+ recommended).
2. Internet access (to download Git and the repo if needed).
3. For mail features: **Outlook desktop** installed and signed in.
4. Ability to run PowerShell (a normal user account is usually enough).

You do **not** need Azure, npm, or Docker for the board itself.

---

## Step 1 — Open PowerShell

1. Press `Win + R`.
2. Type:

```text
powershell
```

3. Press Enter.

---

## Step 2 — Install Git if missing (visible progress)

Paste and press Enter:

```powershell
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
```

- If Git is already installed, that is fine — continue.
- After installing Git for the first time, **close PowerShell and open it again** (repeat Step 1).

Verify:

```powershell
git --version
```

---

## Step 3 — Clone the repository (GitHub login may appear)

```powershell
git clone https://github.com/gwaez/AQHub.git
```

What to expect:

- Download progress in the PowerShell window.
- If the repo is **private**, a browser or **Git Credential Manager** window may ask you to sign in to GitHub — sign in and approve access. That is normal.
- A folder named `AQHub` appears in your current directory.

To clone into Documents:

```powershell
cd $env:USERPROFILE\Documents
git clone https://github.com/gwaez/AQHub.git
```

---

## Step 4 — Enter the project folder

```powershell
cd AQHub
```

Or:

```powershell
cd $env:USERPROFILE\Documents\AQHub
```

---

## Step 5 — One-shot setup (or start the board directly)

### Option A (recommended): setup script with clear progress lines

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-AQHub.ps1
```

The script prints stages such as checking Git, preparing data files, starting the board, and opening the browser. It mentions when a GitHub or Outlook prompt may appear.

### Option B: double-click

In File Explorer inside `AQHub`, double-click:

```text
Start-Board-Background.bat
```

(The server runs hidden. `Start-Board-KeepAlive.bat` still works; it now calls the same hidden launcher.)

Or from PowerShell:

```powershell
.\Start-Board-Background.bat
```

---

## Step 6 — Board in the browser + Outlook prompts

1. After a few seconds the server is up. Open the control home yourself (the board is not auto-opened):

```text
http://127.0.0.1:8766/
```

   Optional: `powershell -File .\Start-Board.ps1 -OpenBrowser` opens the homepage once.

2. If Windows or Outlook asks for permission to access mail — **Allow** if you started AQHub yourself.
3. If the browser did not open, paste the URL manually.

When that works, the system is ready locally.

---

## Optional: AQWizard desktop companion

Native Windows Tauri 2 app (not Electron). Needs **Node 20+**, **Rust**, **WebView2**, and **VS 2022 Build Tools** (Desktop development with C++). Typical path:

```text
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools
```

`Setup-AQWizard.ps1` does **not** auto-install Build Tools. Full runbook: [desktop-wizard/docs/WINDOWS-SETUP.md](desktop-wizard/docs/WINDOWS-SETUP.md).

After the board answers on port 8766:

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-AQWizard.ps1
cd desktop-wizard
npm run tauri dev
```

Windows autostart stays **off** unless you later pass `-Autostart` (after `npm run tauri build`). The wizard never auto-sends mail.

---

## What runs under the hood

| Component | Role |
|-----------|------|
| `Start-Board.ps1` | Local HttpListener + Outlook COM |
| `Watch-Board.ps1` | Keepalive watchdog (hidden via Background launcher) |
| `Start-Board-Background.bat` | Daily start — no leftover PowerShell window |
| `board.html` | Board UI |
| `data/tasks.json` | Local tasks (seeded from sample if missing) — **not committed** |
| `data/crm-config.json` | Local CRM settings — **do not commit secrets** |

---

## Safety

- **Never auto-sends email.** Approve only.
- Do not put passwords or tokens in the repo.
- Do not commit `data/tasks.json`, `data/crm-config.json`, or `.env`.
- Everything binds to `127.0.0.1` — local only.

---

## Quick troubleshooting

| Issue | Try |
|-------|-----|
| `git` not recognized after install | Close and reopen PowerShell, then `git --version` |
| `git clone` fails / asks for login | Sign in to GitHub in the popup/browser; confirm repo access |
| Board does not open | Re-run `Start-Board-Background.bat`; close leftover board PowerShell windows if any |
| Mail features fail | Open Outlook desktop and sign in on this PC |
| ExecutionPolicy warning | Use the Step 5 command with `-ExecutionPolicy Bypass` as written |

---

## Ordered copy-paste summary

From a new PowerShell (`Win+R` → `powershell`):

```powershell
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
```

(Close and reopen PowerShell if Git was just installed)

```powershell
cd $env:USERPROFILE\Documents
git clone https://github.com/gwaez/AQHub.git
cd AQHub
powershell -ExecutionPolicy Bypass -File .\Setup-AQHub.ps1
```

Then open: `http://127.0.0.1:8766/` (control home; the task board is not auto-opened)

Arabic guide: [SETUP-AR.md](SETUP-AR.md)
