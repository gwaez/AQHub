# RESULT-CRM — Dynamics / Dataverse (Aqaar)

## Status (Asia/Dubai)
- **Connected:** NO (pending auth) — WhoAmI previously 401; parent running `pac auth create` device-code for **prod**.
- **Org URL (prod):** `https://aqaar.crm15.dynamics.com`
- **App id:** `944e68b1-308d-4e3a-86c7-cf0452397938`
- **UAT (PAC profile, token expired):** `https://operations-aqaaruat-1.crm15.dynamics.com` — AADSTS700082
- **PAC user:** Ahmed.Mahmoud@aqaar.com

## AR · الربط
1. أكمل تسجيل الدخول على الجهاز (`pac auth create` لـ prod).
2. بعد نجاح التوكن: احفظه عبر `POST /api/crm/auth/token` أو صفحة `crm.html` (لصق Bearer) — **بدون اختلاق بيانات**.
3. تحقق: `GET /api/crm/status` → `authStatus=ready` ثم `GET /api/crm/preview` أو مزامنة.
4. المزامنة قراءة فقط → تاسكات `source=crm` (idempotent على `crmId`).

## EN · Connect & sync
1. Finish device-code auth on the Windows PC for **prod** org.
2. Store access token (paste UI or `POST /api/crm/auth/token`). Do not invent credentials.
3. Smoke: preview / sync. Default entities include custom: `md_units`, `md_offers`, `md_approvaltransactions`, `aqr_legalcases` + leads/opportunities/accounts.

## API routes (Start-Board.ps1)
| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/api/crm/config` | Persist `data/crm-config.json` (token masked on GET) |
| GET | `/api/crm/status` | configured / pending_auth / ready |
| GET | `/api/crm/whoami` | Dataverse WhoAmI (needs token) |
| GET | `/api/crm/preview` | Sample rows (needs token) |
| POST | `/api/crm/sync` | Upsert tasks; non-crm untouched |
| POST | `/api/crm/auth/token` | Paste bearer |
| POST | `/api/crm/auth/device/start\|poll` | Optional AAD device code |
| POST | `/api/crm/auth/clear` | Drop token |

## Files
- `data/crm-config.json` — seeded prod URL + appId, **no token**
- `Start-Board.ps1` — CRM helpers + routes (ASCII)
- `crm.html` — lean connect/status page (full polish paused)
- `panel.html` / `index.html` — CRM card **wait**, opens `crm.html`

## Blockers
- Auth token not yet available (PAC refresh expired; device-code in progress on parent).
- Sync/WhoAmI gated until `authReady`.
