# P0 — AQHub compatibility map for AQWizard

Arabic-first companion. AQHub stays local-first: PowerShell `HttpListener` on `http://127.0.0.1:8766` + HTML. Wizard never rewrites the board, never migrates the backend, and never writes `tasks.json` / `eisenhower.json` / CRM config / tokens directly.

Inspected on this branch: `Start-Board.ps1` (listener + routes), `board.html`, `task.html`, `eisenhower.html`, `panel.html`, `index.html`, CRM pages, `data/*.sample.json`, `.gitignore`, `Setup-AQHub.ps1`, `SETUP-AR.md`, `HANDOFF-PROMPT-AR.md`, `README.md`.

## 1. Existing `/api` routes and how Wizard should reuse them

All of these already exist on the single-threaded listener in `Start-Board.ps1`. Wizard talks to them over HTTP only (`http://127.0.0.1:8766`). CORS is already `Access-Control-Allow-Origin: *` (local bind only).

| Method | Path | What it does today | Wizard reuse (P1 / later) |
|--------|------|--------------------|---------------------------|
| GET | `/api/tasks` | Raw `data/tasks.json` (board document: `version`, `title`, `tasks[]`) | **Adapter.** Read-only in P1. Later: list/search before any create. Never treat this as a character settings file. |
| POST | `/api/tasks` | **Full-file replace** of `tasks.json` after JSON parse | **Adapter, high risk.** Later task create/update MUST `GET` → mutate one task → `POST` whole document. Never POST an empty/partial board. Prefer a future dedicated create endpoint if the replace contract becomes unsafe. |
| GET | `/api/task?id=` | One task; migrates `chat`/`timeline`/`pendingSend` via `Ensure-TaskRoom` | **Adapter.** Later: open-task / watch a room. |
| POST | `/api/task/chat` | User chat + rule-based bot brain; may set `pendingSend` (does **not** send). Text `draft` fills `suggestedReply`. | **P10 adapter.** Wizard Draft Reply posts `{ taskId, text: "draft" }` only. Never approve-send. |
| POST | `/api/task/approve-send` | Outlook send **only** if `pendingSend` exists | **Forbidden from Wizard.** Capability `outlook.send` is Never / confirm-or-deny; Action Engine never HTTP. |
| POST | `/api/task/cancel-send` | Clears `pendingSend` | Unused by Wizard P10 (no send path). |
| POST | `/api/task/box-note` | Sets `task.boxNote` + timeline/comment | **Adapter.** Later Eisenhower note sync. Body: `{ taskId, note }`. |
| GET | `/api/eisenhower` | Load + enrich items from linked tasks (`taskId`, `entryId`, `crmUrl`, …) | **Adapter.** Later Watch / matrix panel. P1 does not render the matrix. |
| POST | `/api/eisenhower` | Save items; merges missing linkage fields from previous file | **Adapter.** GET-merge-POST like tasks. |
| POST | `/api/eisenhower/feed` | Insert open tasks into inbox; **does not re-feed trash** | Adapter. Later “follow my work” seed. Query `force=1` exists. |
| GET | `/api/signing-platforms` | `data/signing-platforms.json` (digiapi / digisign) | Adapter. Later “open sign” action. |
| GET/POST | `/api/audit` | `data/audit.jsonl` | Optional later: Wizard actions as audit lines. Never store tokens here. |
| POST | `/api/open` | `{ type:'url', url }` → `Start-Process`; else Outlook `Open-Mail` via COM (`entryId` / subject search) | **P10 adapter.** Bubble **Open** → this route. Wizard never hosts Outlook COM. |
| POST | `/api/mail/sync` | Unread inbox → new tasks (`source=email`, `entryId`, `suggestedReply`) | **P10 adapter.** User-triggered (Settings Sync now / chrome بريد after Ask). Writes `tasks.json`. Outlook must already be signed in on Windows. |
| POST | `/api/bot/run` `{taskId,mode}` | Background job files under `data/jobs/` | Out of scope P1. Do not duplicate job runner. |
| POST | `/api/bot/stop` `{id}` | Cancel flag on job | Out of scope P1. |
| GET | `/api/bot/job?id=` / `/api/bot/jobs` | Job JSON | Out of scope P1. |
| GET | `/api/crm/config` | **Public** config (`Get-CrmPublicConfig` — token masked) | Status only. Wizard never POSTs tokens. |
| POST | `/api/crm/config` | Writes `data/crm-config.json` including optional token paste | **Forbidden for Wizard** except if a future explicit CRM settings UI exists in AQHub itself. |
| GET | `/api/crm/status` | `configured` / `pending_auth` / `ready` | Adapter. Later permission/status badge. |
| GET | `/api/crm/whoami` | Dataverse WhoAmI | Adapter. 401 if pending auth. |
| GET | `/api/crm/preview` | Sample rows | Rarely needed in Wizard. |
| POST | `/api/crm/sync` | Upsert CRM-sourced tasks | Adapter. User-initiated only. |
| POST | `/api/crm/auth/token` | Store bearer | **Never from Wizard.** |
| POST | `/api/crm/auth/device/start\|poll` | AAD device code | **Never from Wizard.** |
| POST | `/api/crm/auth/clear` | Drop token | **Never from Wizard.** |
| GET | `/api/crm/mawjan/summary` `/api/crm/mawjan/units` | Mawjan project helpers | Adapter. Later CRM glance. |
| GET | `/api/crm/units` `?project&status&refresh=` | Cached units; `refresh=1` hits Dynamics | Adapter. Cache-first; do not spam `refresh=1`. |
| GET | `/api/crm/sales` `?project&refresh=` | Sales list + eligibility fields | Adapter. Same cache rule. |
| GET | `/api/crm/people` `?refresh=` | People rollup | Adapter. |
| GET | `/*.html` | Static files from repo root | Tray “Open AQHub” → `http://127.0.0.1:8766/board.html` (not a custom host). |
| OPTIONS | `*` | CORS preflight | P1 adds `PUT` to Allow-Methods for settings. |

### Task document shape (from `board.html` `normalize`)

Wizard later create/update must preserve fields it does not understand:

`id`, `title`, `status` (`backlog|todo|doing|blocked|done`), `priority`, `source`, `sourceRef`, `entryId`, `tags`, `notes`, `botAction`, `botInstruction`, `comments[]`, `suggestedReply`, `due`, `assignee`, `checklist`, `progress`, `createdAt`, `updatedAt`, `createdBy`, `chat[]`, `timeline[]`, `pendingSend`, `pendingTrash`, `mailClass`, `boxNote`, CRM extras (`crmUrl`, `fromEmail`, …).

Statuses in Arabic UI: لاحقاً / مطلوب / جاري / معلّق / تم.

### Eisenhower item shape

`id`, `taskId`, `title`, `source`, `quad` (`inbox|do|sched|deleg|elim|doing|trash`), `done`, `note`, `entryId`, `sourceRef`, `fromEmail`, `mailQuery`, `sourceUrl`, `crmUrl`, `teamsUrl`, `url`, `signUrl`/`signKind`, `createdAt`, `updatedAt`. Opening **source** ≠ opening **task**.

---

## 2. New versioned bridge (`/api/v1/wizard/*`) vs adapters

Keep AQHub core routes stable. Add a **thin optional module** `wizard/Wizard-Bridge.ps1` dotted from `Start-Board.ps1`. The module owns **only** `data/wizard-settings.json` plus a **read-only** Outlook status probe (`GetActiveObject`, never `New-Object`). It does not write `tasks.json`, CRM tokens, or start Outlook. It never calls approve-send.

### P1+P2 (implemented)

| Method | Path | Body / result | Why new (not adapter) |
|--------|------|----------------|------------------------|
| GET | `/api/v1/wizard/health` | `{ ok, aqhub: true, version }` | No existing health route. |
| GET | `/api/v1/wizard/settings` | Settings JSON including P9/P10 fields + `permissions` | Character UX + local reminder list + `mailIgnored` / `mailLastSyncAt`. |
| PUT | `/api/v1/wizard/settings` | Same schema; merge known keys | Live writes. Reminders / ignore list are **not** tasks.json. |
| GET | `/api/v1/wizard/permissions` | Capability catalog + current modes | P11 dashboard. Do not overload CRM config. |
| GET | `/api/v1/wizard/mail/status` | `{ outlook, aqhub, reason, lastSyncAt, adapter: GetActiveObject }` | P10. AQHub has no live inbox GET. Probe must not call `Get-OutlookApp` (that path may `New-Object` and start Outlook). |

### P4–P10 adapters (companion, reuse AQHub)

| Method | Path | Wizard use |
|--------|------|------------|
| GET then POST | `/api/tasks` | Quick Task: GET document → prepend one task → POST full board. Never empty the array. **P10 recent mail** = filter `source=email` (or `entryId`) after GET. |
| POST | `/api/task/box-note` | Quick Note after a task id exists. |
| GET then POST | `/api/eisenhower` | P5 matrix: GET items → change one `quad` → POST `{ items, updatedAt }`. Never empty. Soft-delete = `quad: trash`. |
| POST | `/api/audit` | Best-effort wizard action audit stub (no secrets). |
| GET | `/api/audit` | jsonl; Wizard shows last N sanitized lines. |
| POST | `/api/mail/sync` | P10 Sync now. Unread → board tasks. User-triggered; `outlook.read` Ask by default. |
| POST | `/api/open` | P10 Open mail item (`entryId` / query). |
| POST | `/api/task/chat` | P10 Draft Reply. Body `{ taskId, text: "draft" }`. Never `/api/task/approve-send`. |

### P10 mail API gaps (honest)

AQHub does **not** expose a live inbox GET. P10 therefore:

1. **Recent mail bubble** = newest non-ignored email-sourced **board task** from `GET /api/tasks`.
2. **Unread import** remains `POST /api/mail/sync` (writes `tasks.json`) — not a second Outlook stack.
3. **Connected/unavailable** = `GET /api/v1/wizard/mail/status` wrapping `Marshal.GetActiveObject('Outlook.Application')` only.
4. There is no dedicated draft-create COM route; Wizard reuses the existing chat brain `draft` path that fills `suggestedReply` without sending.
5. Linux/cloud VMs cannot exercise Outlook COM; tests mock these endpoints.

Ignored ids live in `wizard-settings.mailIgnored`, not in `tasks.json`. Auto-poll (`MAIL_POLL` without prompt) runs only when `outlook.read` is **Allow**, so Ask does not spam confirm bubbles.

### Permission table (P11 + P10 defaults)

| Capability | Default | Modes | Notes |
|------------|---------|-------|--------|
| `character.window` | Allow | allow/ask/never | Show/hide companion |
| `aqhub.open` | Allow | allow/ask/never | Open local board |
| `settings.local` | Allow | allow only | Cannot lock yourself out |
| `board.create_task` | Allow | allow/ask/never | GET-merge-POST `/api/tasks`; also mail Create Task |
| `board.create_note` | Allow | allow/ask/never | `/api/task/box-note` |
| `board.reminder` | Allow | allow/ask/never | `wizard-settings.json` only; also mail Remind Me |
| `eisenhower.move` | Allow | allow/ask/never | GET-merge-POST quadrants |
| `eisenhower.trash` | Ask | allow/ask/never | Soft-delete; confirm bubble |
| `outlook.read` | Ask | allow/ask/never | MAIL_POLL / MAIL_SYNC / MAIL_OPEN / MAIL_IGNORE |
| `outlook.draft` | Ask | allow/ask/never | MAIL_DRAFT → `/api/task/chat` only |
| `outlook.send` | Never | ask/never | Always confirm or deny; Wizard never calls approve-send |
| `delete.external` | Never | ask/never | Always confirm or deny; no-op stub |
| `uia.magic_wand` | Never | never | Windows desktop later |
| `crm.tokens` | Never | never | Tokens stay in AQHub |

Action Engine: **Allow** executes, **Ask** returns `needs_confirm` + confirmation bubble, **Never** blocks. `CONFIRM` is a one-shot grant; `DENY` audits and stops.

### Planned later

Watch board poll, Magic Wand / UIA on Windows, real Outlook approve-send **from AQHub only** (future explicit confirm model — still blocked in Wizard).

Out of scope modules (folder stubs only): Magic Wand / UIA (P7), Follow My Work (P8), AI, voice. Signed NSIS/MSI is P13. P12 is `Setup-AQWizard.ps1` + `desktop-wizard/docs/WINDOWS-SETUP.md` (not a signed installer).

### Architecture seam

```
UI (character / tray / Arabic copy / bubbles / composer)
  → WizardAction
    → Action Engine (validate → Allow/Ask/Never → HTTP → audit)
      → AQHub HTTP client
        → result
          → WizardStateMachine (IDLE…HIDDEN + stub WAND/NOTE/MATRIX/TRASH)
            → Animation engine + BubbleEngine (no file I/O)
```

Settings schema (`data/wizard-settings.json`, gitignored):

```json
{
  "version": 1,
  "characterId": "old-wizard",
  "technicalId": "AQWizard",
  "displayName": "Old Wizard",
  "window": { "x": null, "y": null, "scale": 1 },
  "visible": true,
  "animationLevel": "normal",
  "idleSleepMs": 90000,
  "reminders": [],
  "language": "ar",
  "startMinimized": false,
  "alwaysOnTop": true,
  "opacity": 1,
  "followPointer": true,
  "preferredCorner": "bottom-end",
  "proactiveBubbles": "normal",
  "bubbleScale": 1,
  "bubbleFontSize": 13,
  "closeAction": "hide",
  "permissions": {
    "character.window": "allow",
    "eisenhower.trash": "ask",
    "outlook.read": "ask",
    "outlook.draft": "ask",
    "outlook.send": "never"
  },
  "mailLastSyncAt": "",
  "mailIgnored": [],
  "firstRunComplete": false,
  "updatedAt": "ISO-8601"
}
```

- `characterId` / `technicalId` are **not** user-renamable.
- `displayName` **is** user-renamable (Arabic UI copy).
- P1 TypeScript settings module calls GET/PUT when the bridge is up; Rust may read/write this **same** file as fallback. Never `tasks.json`.

---

## 3. Risk notes

**Outlook COM**

- `Get-OutlookApp` / `Open-Mail` / `Sync-MailToTasks` / `Invoke-SendPending` live only in `Start-Board.ps1`.
- Wizard on Windows must not create `Outlook.Application`. Status uses `GetActiveObject` in `Wizard-Bridge.ps1` only. Open/sync reuse `/api/open` and `/api/mail/sync`.
- First COM use may show a Windows security prompt — AQHub already documents this; Wizard should not add a second COM host.
- This Linux agent VM cannot exercise Outlook.

**CRM tokens**

- Live file `data/crm-config.json` is gitignored and may contain `accessToken` / `refreshToken` / device codes.
- Wizard must not read that file from disk, not copy it into settings, not log it.
- Status via `GET /api/crm/status` and `GET /api/crm/config` (masked). No auth POST from the companion.

**No auto-send email**

- Product rule: drafts stay local until the user approves.
- `/api/task/chat` may create `pendingSend`; only `/api/task/approve-send` (or chat “yes” inside AQHub) sends.
- Wizard P10 Draft Reply posts `text: "draft"` only. `APPROVE_SEND` stays denied even after confirm. Animations must never call approve-send.

**Full-file POST `/api/tasks`**

- Board save replaces the entire JSON document. Lost-update if Wizard and `board.html` save concurrently.
- P2+P4: Wizard does a short GET-merge-POST (prepend one task, keep the rest). Lost-update is still possible if `board.html` saves concurrently; do not invent a second task store.

**Listener shape**

- `Start-Board.ps1` is a large monolithic `while (GetContext)` loop. Some helper functions are defined *inside* the loop (pre-existing). Wizard routes are **not** added there; they live in `wizard/Wizard-Bridge.ps1`.
- Handler must stay fast (JSON read/write of a small settings file). Do not call Dynamics or Outlook from wizard routes.
- Port `8766` bind is `127.0.0.1` only — keep it that way.

**Character identity**

- Technical ids: app `AQWizard`, pack `old-wizard`.
- Display name is user data in settings, not a pack rename.

**Git / secrets**

- Do not commit `data/tasks.json`, `data/eisenhower.json`, `data/crm-config.json`, `data/wizard-settings.json`, tokens, `.env`, `data/jobs/`, CRM cache, audit logs.

**Transparent window + tray**

- Tauri 2 config: `transparent`, `decorations: false`, `alwaysOnTop`, `skipTaskbar`.
- Linux/cloud VM will not faithfully test Windows WebView2 transparency or the system tray. Treat `cargo check` + Vite UI as the agent verification; full tray/transparency is a **Windows** check.

**Electron**

- Not used. No hard blocker found for Tauri 2 on Windows (WebView2 + tray-icon feature). If a blocker appears later, document it before considering Electron.

---

## 4. File ownership

| Path | Owner | Notes |
|------|-------|--------|
| `desktop-wizard/` | **Wizard** | Tauri 2 app, UI engines, character packs, Wizard README. |
| `desktop-wizard/characters/` | **Wizard** | Packs (`old-wizard/manifest.json` + assets). |
| `wizard/Wizard-Bridge.ps1` | **Wizard** (hosted by AQHub process) | Health + settings + permission catalog + read-only Outlook status. |
| `Setup-AQWizard.ps1` | **Wizard** | Clean-machine toolchain check + npm install + opt-in autostart. |
| `desktop-wizard/docs/WINDOWS-SETUP.md` | **Wizard** | Windows admin runbook (Build Tools path explicit). |
| `data/wizard-settings.json` | **Wizard via API** | Gitignored live file. |
| `data/wizard-settings.sample.json` | **Wizard** (safe to commit) | Seed / docs. |
| `Start-Board.ps1` | **AQHub core** | Listener. Only a dot-source + 4-line dispatch + CORS PUT. |
| `board.html` `task.html` `eisenhower.html` `index.html` `panel.html` `crm*.html` | **AQHub core** | Do not migrate into Tauri. |
| `data/tasks.json` `data/eisenhower.json` `data/crm-config.json` `data/jobs/` `data/audit.jsonl` | **AQHub core** | Wizard HTTP only. |
| `data/*.sample.json` `data/signing-platforms.json` | **AQHub core** | Samples / public signing URLs. |
| `Setup-AQHub.ps1` `Watch-Board.ps1` `Start-Board*.bat` | **AQHub core** | Board startup. Wizard has its own Windows runbook. |
| `bots/` | **AQHub core** | Unrelated job notes. |
| `.gitignore` | **shared** | Keep live data + `node_modules` / `target` ignored. |

Wizard working directory on a typical PC: `C:\Users\AMahmoud\Documents\AQHub\desktop-wizard` next to a running board on port 8766.
