# Aqaar Work Board — Task Room (RESULT)

## AR · غرفة التاسك
كل تاسك له صفحة خاصة: `task.html?id=T-016`
- **الخط الزمني**: أحداث (إنشاء، مسودة، اقتراح إرسال، موافقة، إرسال، تذكير، تراش، شات…)
- **محادثة الوكيل**: اكتب أو استخدم الشرائح (جهّز رد / فكّرني / حط تراش / ابعت بعد موافقتي / رأيك)
- البوت **يقترح** فقط؛ **الإرسال لا يتم إلا بعد موافقة صريحة** (زر «موافق — ابعت» أو كلمة موافق/yes في الشات، أو `POST /api/task/approve-send`)
- من اللوحة: زر **غرفة** على الكرت، أو عنوان الكرت، أو دبل‑كليك، أو من الشيت **فتح غرفة التاسك**

## EN · How to use
1. Run `Start-Board.ps1` → open board → click **غرفة** on a card (or open `task.html?id=…`).
2. Chat: «prepare draft» / Arabic جهّز → draft lands in `suggestedReply` + timeline `draft_ready`.
3. Say «send» / ابعت → creates `pendingSend` + asks approval — **does not send**.
4. Approve via chat («yes» / موافق) **or** `POST /api/task/approve-send` → Outlook `Reply().Send()` if `entryId`, else new `MailItem.Send()`.
5. Cancel with «no» / لا or `POST /api/task/cancel-send`.

## Files changed
| File | Change |
|------|--------|
| `task.html` | **New** RTL Jarvis HUD: timeline + agent chat + suggestion chips |
| `Start-Board.ps1` | ASCII-only: `GET /api/task`, `POST /api/task/chat`, `POST /api/task/approve-send`, `POST /api/task/cancel-send`; rule-based bot brain; Outlook send only with `pendingSend` |
| `board.html` | Room links (title / غرفة / dblclick / sheet button); preserve `chat`/`timeline`/`pendingSend` on normalize+save |
| `RESULT.md` | This doc |

## Persist fields on task
`chat[]`, `timeline[]`, `pendingSend`, `pendingTrash` (+ existing `suggestedReply`, `comments`, …). Missing chat/timeline are migrated on first `GET /api/task` (seed from `createdAt` + comments).

## Approve-send flow
1. Chat intent **send** → set `pendingSend {to,subject,body,createdAt}`, timeline `send_proposed`.
2. User approves (chat or `/api/task/approve-send`).
3. Server requires `pendingSend`; calls Outlook; on success clears pending, timeline `send_sent`, audit line. Never auto-sends without that step.

## Notes
- PS1 stays ASCII (Arabic keywords via Base64 `U8`); Arabic UI only in HTML.
- Box-only edits under `/home/box/workspace/AqaarWorkBoard/`.
