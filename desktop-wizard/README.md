# AQWizard — رفيق سطح المكتب لـ AQHub

Native **Windows** companion (Tauri 2 + Rust + HTML/CSS/TypeScript).  
AQHub يبقى محليًا: PowerShell `HttpListener` على `http://127.0.0.1:8766` + HTML.

**المرحلة الحالية: P9 إعدادات + P11 مركز الصلاحيات.** آلة حالات، فقاعات، تاسك/نوت، ومصفوفة أيزنهاور عبر HTTP، وإعدادات حيّة مع لوحة صلاحيات وسجل تدقيق.

لا يستخدم Electron. لا يكتب `tasks.json` / `eisenhower.json` / توكنات CRM من القرص.

## ماذا يعمل الآن

- نافذة شخصية: `transparent`, `decorations: false`, `alwaysOnTop`, `skipTaskbar`
- صينية: إظهار / إخفاء / فتح AQHub / خروج
- حزمة `characters/old-wizard/` — SVG احترافي + CSS للحالات
- `WizardStateMachine` مع enter/update/exit:
  IDLE, WATCHING, THINKING, SPEAKING, ALERT, WORKING, SUCCESS, ERROR, DRAGGING, SLEEPING, HIDDEN, **MATRIX**, **TRASH**  
  (WAND / NOTE: stub يسجّل الحالة)
- Idle: تنفس + رمش؛ النظر للمؤشر → WATCHING؛ خمول طويل → SLEEPING عند الحافة (مؤقت قابل للإيقاف)
- مستوى الحركة في الإعدادات: `normal` / `reduced` / `off` (افتراضي normal)
- فقاعات: كلام / فكر / تنبيه — تخطيط RTL + أزرار تأكيد عند Ask
- زر يمين: تاسك جديد، ملاحظة، **أيزنهاور**، فتح AQHub، اسأل الساحر (معطّل)، إعدادات، إخفاء، خروج
- زر يسار: منشئ أمر مضغوط — الأمر `/matrix` يفتح المصفوفة
- **تاسك سريع:** `GET` ثم `POST /api/tasks` (لا مخزن وهمي)
- **ملاحظة سريعة:** إنشاء تاسك ثم `POST /api/task/box-note`
- **تذكير:** داخل `wizard-settings.json` عبر الجسر؛ فقاعة ALERT عند الاستحقاق
- **أيزنهاور:** `GET/POST /api/eisenhower` — أربعة أرباع + سحب/إفلات + تراش ناعم مع تراجع
- **إعدادات P9:** لغة AR/EN (stub)، بدء مصغّر، دائمًا فوق، حزمة `old-wizard`، اسم العرض، الحجم، الشفافية، الحركة، تتبع المؤشر، الزاوية، فقاعات استباقية، نوم الخمول، حجم/خط الفقاعة، اختصارات للعرض فقط، زر الإغلاق Hide vs Exit
- **صلاحيات P11:** لوحة Allow / Ask / Never. Ask → فقاعة تأكيد. Never يمنع. Outlook Send والحذف الخارجي دائمًا تأكيد أو رفض (لا Allow صامت، ولا استدعاء approve-send)
- **سجل:** `POST/GET /api/audit` بدون أسرار؛ آخر N سطور في الإعدادات
- فتح AQHub: `http://127.0.0.1:8766/board.html`
- لا إرسال إيميل تلقائي (`APPROVE_SEND` مرفوض حتى بعد التأكيد)

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

لا يختبر شفافية WebView2 ولا صينية ويندوز. Vite على `:1420` يختبر الشخصية/الفقاعات/المنشئ/المصفوفة/الإعدادات/الصلاحيات. مسار التاسك/أيزنهاور الحقيقي يحتاج `Start-Board.ps1` على ويندوز (أو محاكاة HTTP).

## المعمارية

```
UI → WizardAction → Action Engine (validate → Allow/Ask/Never → HTTP → audit)
  → AQHub /api/tasks | /api/task/box-note | /api/eisenhower | /api/v1/wizard/settings | /api/v1/wizard/permissions | /api/audit
  → StateMachine → animation / BubbleEngine
```

الإعدادات تُحفظ فقط في `data/wizard-settings.json` عبر الجسر — أبدًا `tasks.json`.

الخرائط: [`docs/P0-compatibility-map.md`](docs/P0-compatibility-map.md).

## خارج النطاق بعد

Magic Wand / UIA (ويندوز سطح مكتب)، Follow My Work الكامل، صوت، ذكاء سحابي، NSIS، فقاعات إيميل، موافقة إرسال حقيقية، مسح نهائي للتراش، اختصارات عامة في Rust.
