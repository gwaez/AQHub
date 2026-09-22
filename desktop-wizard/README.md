# AQWizard — رفيق سطح المكتب لـ AQHub

Native **Windows** companion (Tauri 2 + Rust + HTML/CSS/TypeScript).  
AQHub يبقى محليًا: PowerShell `HttpListener` على `http://127.0.0.1:8766` + HTML.

**المرحلة الحالية: P2 character + P3/P4 vertical slice.** آلة حالات حقيقية، حزمة old-wizard، فقاعات RTL، قائمة يمين، منشئ أوامر، وتاسك/نوت/تذكير عبر HTTP.

لا يستخدم Electron. لا يكتب `tasks.json` / `eisenhower.json` / توكنات CRM من القرص.

## ماذا يعمل الآن

- نافذة شخصية: `transparent`, `decorations: false`, `alwaysOnTop`, `skipTaskbar`
- صينية: إظهار / إخفاء / فتح AQHub / خروج
- حزمة `characters/old-wizard/` — SVG احترافي + CSS للحالات
- `WizardStateMachine` مع enter/update/exit:
  IDLE, WATCHING, THINKING, SPEAKING, ALERT, WORKING, SUCCESS, ERROR, DRAGGING, SLEEPING, HIDDEN  
  (WAND / NOTE / MATRIX / TRASH: stub يسجّل الحالة)
- Idle: تنفس + رمش؛ النظر للمؤشر → WATCHING؛ خمول طويل → SLEEPING عند الحافة (مؤقت قابل للإيقاف)
- مستوى الحركة في الإعدادات: `normal` / `reduced` / `off` (افتراضي normal)
- فقاعات: كلام / فكر / تنبيه — تخطيط RTL
- زر يمين: تاسك جديد، ملاحظة، فتح AQHub، اسأل الساحر (معطّل)، إعدادات، إخفاء، خروج
- زر يسار: منشئ أمر مضغوط
- **تاسك سريع:** `GET` ثم `POST /api/tasks` (لا مخزن وهمي)
- **ملاحظة سريعة:** إنشاء تاسك ثم `POST /api/task/box-note`
- **تذكير:** داخل `wizard-settings.json` عبر الجسر؛ فقاعة ALERT عند الاستحقاق
- فتح AQHub: `http://127.0.0.1:8766/board.html`
- لا إرسال إيميل تلقائي (`APPROVE_SEND` مرفوض)

## التشغيل على ويندوز بجانب AQHub

1. شغّل اللوحة: `Start-Board-KeepAlive.bat` → `http://127.0.0.1:8766/board.html`
2. Node 20+ و **Rust stable ≥ 1.88** و WebView2 و MSVC tools
3. من `desktop-wizard/`:

```powershell
npm install
npm run tauri dev
```

`$env:AQHUB_ROOT` اختياري.

## أوامر التحقق

| خطوة | أمر |
|------|------|
| TypeScript | `npm run typecheck` |
| اختبارات | `npm test` |
| Vite | `npm run build` / `npm run dev` |
| Rust | `cd src-tauri && cargo check` |
| ويندوز | `npm run tauri dev` بجانب AQHub حي |

## هذا الـ VM (Linux)

لا يختبر شفافية WebView2 ولا صينية ويندوز. Vite على `:1420` يختبر الشخصية/الفقاعات/المنشئ. مسار التاسك الحقيقي يحتاج `Start-Board.ps1` على ويندوز (أو محاكاة HTTP لـ `/api/tasks`).

## المعمارية

```
UI → WizardAction → Action Engine (validate → permission stub → HTTP → audit)
  → AQHub /api/tasks | /api/task/box-note | /api/v1/wizard/settings | /api/audit
  → StateMachine → animation / BubbleEngine
```

الخرائط: [`docs/P0-compatibility-map.md`](docs/P0-compatibility-map.md).

## خارج النطاق بعد

Magic Wand / UIA، Follow My Work الكامل، لوحة أيزنهاور، صوت، ذكاء سحابي، NSIS، فقاعات إيميل، موافقة إرسال.
