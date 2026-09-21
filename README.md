# AQHub — Aqaar Work Board

Local-first Jarvis-style command board for Aqaar ops (HTML + PowerShell).  
لوحة أوامر محلية لأعمال عقار (HTML + PowerShell).

**Repo:** https://github.com/gwaez/AQHub  
**Default URL:** http://127.0.0.1:8766/board.html

## Requirements / المتطلبات

- Windows
- PowerShell
- Outlook desktop (signed in) for mail sync / open / approve-send
- لا يوجد سيرفر سحابي — كل شيء lokal على الجهاز

## Quick start / التشغيل

1. Clone this repo onto the PC  
   `git clone https://github.com/gwaez/AQHub.git`
2. Double-click `Start-Board-KeepAlive.bat` (preferred) or `Start-Board.bat`
3. Open http://127.0.0.1:8766/board.html

First run creates `data/tasks.json` and `data/crm-config.json` from the sample files if they are missing.

## Safety / الأمان

- **Never auto-sends email.** Drafts stay local until you press approve.
- Do **not** commit `data/tasks.json`, `data/crm-config.json`, tokens, or `.env` (see `.gitignore`).
- CRM secrets stay only on the machine via `crm.html`.

## Main files / الملفات

| File | Role |
|------|------|
| `board.html` | Kanban / list / matrix / focus board |
| `task.html` | Per-task room (timeline + agent chat) |
| `index.html` / `panel.html` | Control panel |
| `crm.html` | Dynamics CRM connector UI |
| `Start-Board.ps1` | Local HttpListener + Outlook COM |
| `Watch-Board.ps1` | Keepalive watchdog |
| `data/tasks.sample.json` | Empty sample board |

## Another PC / جهاز تاني

Clone → run the bat → sign into Outlook on that PC → open the board URL. Live tasks are local files and are not in git.
