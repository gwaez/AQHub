# AQHub — Aqaar Work Board

> **العربية:** اتبع [SETUP-AR.md](SETUP-AR.md) خطوة بخطوة على جهاز ويندوز جديد (نسخ ولصق أوامر PowerShell + تقدم التحميل + نوافذ GitHub/Outlook المتوقعة).

Local-first Jarvis-style command board for Aqaar ops (HTML + PowerShell).  
لوحة أوامر محلية لأعمال عقار (HTML + PowerShell).

**Honest stack:** local HTML + PowerShell `HttpListener` + Outlook COM. No heavy npm/cloud runtime.  
**Repo:** https://github.com/gwaez/AQHub  
**Default URL:** http://127.0.0.1:8766/board.html  
**English setup:** [SETUP.md](SETUP.md)

## Requirements / المتطلبات

- Windows
- PowerShell
- Outlook desktop (signed in) for mail sync / open / approve-send
- لا يوجد سيرفر سحابي — كل شيء lokal على الجهاز

## Quick start / التشغيل

Beginners on a **new PC**: prefer [SETUP-AR.md](SETUP-AR.md) (or [SETUP.md](SETUP.md)).

1. Open Run (`Win+R`) → type `powershell` → Enter  
2. Install Git if needed (visible winget progress):

```powershell
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
```

3. Clone (GitHub browser login is normal if the repo is private):

```powershell
git clone https://github.com/gwaez/AQHub.git
cd AQHub
```

4. One-shot setup **or** double-click keepalive:

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-AQHub.ps1
```

Or double-click `Start-Board-KeepAlive.bat`.

5. Browser opens http://127.0.0.1:8766/board.html — allow any Outlook/Windows COM prompts if you started AQHub.

First run creates `data/tasks.json` and `data/crm-config.json` from the sample files if they are missing.

## Safety / الأمان

- **Never auto-sends email.** Drafts stay local until you press approve.
- Do **not** commit `data/tasks.json`, `data/crm-config.json`, tokens, or `.env` (see `.gitignore`).
- CRM secrets stay only on the machine via `crm.html`.

## Main files / الملفات

| File | Role |
|------|------|
| `SETUP-AR.md` | Arabic step-by-step setup (copy-paste) |
| `SETUP.md` | English setup twin |
| `Setup-AQHub.ps1` | One-shot installer with visible progress |
| `board.html` | Kanban / list / matrix / focus board |
| `task.html` | Per-task room (timeline + agent chat) |
| `index.html` / `panel.html` | Control panel |
| `crm.html` | Dynamics CRM connector UI |
| `Start-Board.ps1` | Local HttpListener + Outlook COM |
| `Watch-Board.ps1` | Keepalive watchdog |
| `data/tasks.sample.json` | Empty sample board |

## Another PC / جهاز تاني

Clone → run `Setup-AQHub.ps1` or the bat → sign into Outlook on that PC → open the board URL. Live tasks are local files and are not in git.
