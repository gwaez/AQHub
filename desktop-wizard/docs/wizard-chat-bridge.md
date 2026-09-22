# Ask-the-Wizard chat + external agent bridge

MVP protocol for the desktop companion chat sheet opened from **اسأل الساحر**. Short speech/alert bubbles stay in `BubbleEngine`; this sheet is a separate overlay.

## Modes

Each outbound message carries a mode toggle on the composer (not on historical bubbles):

| Mode | UI (AR / EN) | Behavior |
|------|----------------|----------|
| `chat` | كلام / Chat | If the bridge is linked, `POST` the payload to `bridge.url`. If not linked, echo locally and **queue** the payload on the device. |
| `execute` | نفّذ / Execute | Map a small safe command set onto the existing Action Engine. **Never** POSTs to the webhook. |

Execute never bypasses Allow / Ask / Never. Confirm still uses the existing bubble Yes/No path. CRM tokens and auto-send email are rejected in the router and are not Action Engine actions the wizard will perform.

Safe execute set (MVP):

- show / hide → `SHOW` / `HIDE` (`character.window`)
- Eisenhower → `OPEN_EISENHOWER` (browser ` /eisenhower.html`, gated by `aqhub.open`)
- open AQHub → `OPEN_AQHUB`
- `تاسك: العنوان` / `task: title` → `CREATE_TASK` (`board.create_task`)
- settings → opens the in-app Settings panel (`settings.local`, always Allow)

Blocked on purpose: `approve-send`, send-email phrasing, CRM / token phrasing.

## Payload

JSON body only — **no secret, no CRM token, no mailbox contents**:

```json
{
  "text": "user utterance",
  "mode": "chat",
  "characterId": "secretary",
  "technicalId": "AQWizard",
  "timestamp": "2026-09-22T11:00:00.000Z",
  "agentId": "optional-grok-bot-id"
}
```

`agentId` is omitted when empty. `mode` is `"chat"` or `"execute"`; the webhook stub currently receives **chat** only.

## Settings (`data/wizard-settings.json`)

```json
"bridge": {
  "enabled": false,
  "url": "",
  "secretRef": "wizard-bridge",
  "agentId": ""
}
```

- `bridge.enabled` + a safe `http:` / `https:` `bridge.url` ⇒ linked.
- `bridge.secretRef` is a **name**, not the secret.
- The webhook secret lives in **local-only** storage (`localStorage` key `aqwizard.bridge.secret:<secretRef>`). It is never written to `wizard-settings.json`, never committed, never put in the JSON body, and never copied into the audit log.
- Send the secret (if present) as header `X-AQWizard-Secret`.

Do not put `.env` webhook secrets in git. `data/wizard-settings.json` is already gitignored; keep real URLs + refs there, secrets only in local storage.

Queued chat payloads (unlinked or failed POST) use `localStorage` key `aqwizard.chat.outboundQueue` (max 40). Same payload shape, still no secret.

## Webhook stub

`POST bridge.url`

Headers:

- `Content-Type: application/json`
- `X-AQWizard-Secret: <local secret>` when set

A JSON response may include `reply`, `text`, or `message` (string) to show in the sheet. Otherwise the companion shows a generic “sent” line. Failures stay queued.

Tauri CSP `connect-src` allows `http://127.0.0.1:*`, `http://localhost:*`, and `https:` so a local test listener or an HTTPS Grok/agent URL works. Arbitrary LAN `http:` hosts are not opened.

## Intentional gaps

- No inbound streaming / WebSocket from Grok Bot.
- No HMAC signature (header secret only).
- Queue flush is best-effort on the next successful linked send.
- Voice Ask is still out of scope.
- Execute does not invent new board verbs (no CRM, no Outlook send).
