# AQWizard — رفيق سطح المكتب لـ AQHub

Native **Windows** companion (Tauri 2 + Rust + HTML/CSS/TypeScript).  
AQHub يبقى محليًا: PowerShell `HttpListener` على `http://127.0.0.1:8766` + HTML.

**المرحلة الحالية: P12 أسس التثبيت (سكربت + توثيق).** P0–P6 وP9–P11 منجزة. P7 العصا/UIA وP8 Follow My Work وP13 حزمة NSIS موقّعة لاحقًا.

لا يستخدم Electron. لا يكتب `tasks.json` / `eisenhower.json` / توكنات CRM من القرص.

خريطة المراحل وتشغيل جهاز ويندوز نظيف: [`docs/WINDOWS-SETUP.md`](docs/WINDOWS-SETUP.md). السكربت: `Setup-AQWizard.ps1` في جذر AQHub.

## ماذا يعمل الآن

- نافذة شخصية: `transparent`, `decorations: false`, `alwaysOnTop`, `skipTaskbar`
- صينية: إظهار / إخفاء / فتح AQHub / خروج
- حزمة `characters/secretary/` — PNG متعدد الوضعيات (الافتراضي) + `characters/old-wizard/` SVG؛ الإعدادات تبدّل بينهما
- `WizardStateMachine` مع enter/update/exit:
  IDLE, WATCHING, THINKING, SPEAKING, ALERT, WORKING, SUCCESS, ERROR, DRAGGING, SLEEPING, HIDDEN, **MATRIX**, **TRASH**  
  (WAND / NOTE: stub يسجّل الحالة)
- Idle: تنفس + رمش؛ النظر للمؤشر → WATCHING؛ خمول طويل → SLEEPING عند الحافة (مؤقت قابل للإيقاف). حركة الجسم على عنصر HTML `.character` عبر `--char-scale` (WebView2 لا يعتمد على `transform` داخل `g.wizard-body`)
- **تجوّل حر (ليس P8):** في IDLE/WATCHING النافذة الشفافة تنزلق يمين/يسار داخل مساحة العمل (بدون شريط المهام). اسحب جسم الساحر (أو الاسم) لأي مكان — السحب يوقف التجوّل ~2.5 ث ثم يُحفظ الموضع ويُستأنف لاحقًا. النوم/الإخفاء يوقف التجوّل في مكانه. `animationLevel=off` أو إعداد `roamEnabled` (افتراضي true) يجمّد الحركة. الخطوات عبر `set_character_position` — بدون كتابة `tasks.json`.
- مستوى الحركة في الإعدادات: `normal` / `reduced` / `off` (افتراضي normal)
- فقاعات: كلام / فكر / تنبيه — تخطيط RTL + أزرار تأكيد عند Ask + أزرار بريد (فتح / تاسك / ذكّرني / مسودة / تجاهل)
- زر يمين: تاسك جديد، ملاحظة، **أيزنهاور**، فتح AQHub، اسأل الساحر (معطّل)، إعدادات، إخفاء، خروج
- زر يسار: منشئ أمر مضغوط — الأمر `/matrix` يفتح المصفوفة
- **تاسك سريع:** `GET` ثم `POST /api/tasks` (لا مخزن وهمي)
- **ملاحظة سريعة:** إنشاء تاسك ثم `POST /api/task/box-note`
- **تذكير:** داخل `wizard-settings.json` عبر الجسر؛ فقاعة ALERT عند الاستحقاق
- **أيزنهاور:** `GET/POST /api/eisenhower` — أربعة أرباع + سحب/إفلات + تراش ناعم مع تراجع
- **إعدادات P9:** لغة AR/EN (stub)، بدء مصغّر، دائمًا فوق، حزمة `secretary` (أو `old-wizard`)، اسم العرض، الحجم، الشفافية، الحركة، تتبع المؤشر، الزاوية، فقاعات استباقية، نوم الخمول، حجم/خط الفقاعة، اختصارات للعرض فقط، زر الإغلاق Hide vs Exit
- **صلاحيات P11:** لوحة Allow / Ask / Never. Ask → فقاعة تأكيد. Never يمنع. Outlook Send والحذف الخارجي دائمًا تأكيد أو رفض (لا Allow صامت، ولا استدعاء approve-send)
- **بريد P10:** فقاعة تنبيه لآخر مهمة مصدرها إيميل. القراءة عبر AQHub فقط. Outlook Read = Ask، Draft = Ask، Send = Never. المسودة `POST /api/task/chat` بالنص `draft` — **لا** `/api/task/approve-send`
- **أول تشغيل P12:** فقاعة غير حاجبة لاسم العرض والحجم والزاوية وصلاحيات البريد — تُتخطى إذا كانت الإعدادات موجودة مسبقًا
- **سجل:** `POST/GET /api/audit` بدون أسرار؛ آخر N سطور في الإعدادات
- فتح AQHub: `http://127.0.0.1:8766/board.html`
- لا إرسال إيميل تلقائي (`APPROVE_SEND` مرفوض حتى بعد التأكيد)

## التشغيل على ويندوز بجانب AQHub

دليل الجهاز النظيف: [`docs/WINDOWS-SETUP.md`](docs/WINDOWS-SETUP.md)

1. شغّل اللوحة: `Setup-AQHub.ps1` أو `Start-Board-Background.bat` → `http://127.0.0.1:8766/board.html`
2. **Node 20+** و **Rust stable ≥ 1.88** و **WebView2** و **VS 2022 Build Tools** (حمل عمل Desktop development with C++). المسار الشائع: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`. السكربت لا يثبّت Build Tools تلقائيًا.
3. من جذر AQHub:

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-AQWizard.ps1
```

ثم من `desktop-wizard/`:

```powershell
npm run tauri dev
```

`$env:AQHUB_ROOT` اختياري. البناء على ويندوز: `npm run tauri build` → `src-tauri\target\release\aqwizard.exe` (بدون NSIS موقّع في P12).

التشغيل مع ويندوز **مغلق افتراضيًا**. بعد البناء: `Setup-AQWizard.ps1 -Autostart`.

## أوامر التحقق

| خطوة | أمر |
|------|------|
| TypeScript | `npm run typecheck` |
| اختبارات | `npm test` |
| Vite | `npm run build` / `npm run dev` |
| Rust | `cd src-tauri && cargo check` |
| ويندوز | `npm run tauri dev` بجانب AQHub حي وOutlook موقَّع إن رغبت بالمزامنة |

## هذا الـ VM (Linux)

لا يختبر شفافية WebView2 ولا صينية ويندوز ولا COM الخاص بـ Outlook. Vite على `:1420` يختبر الشخصية/الفقاعات/المنشئ/المصفوفة/الإعدادات/الصلاحيات/فقاعة البريد مع محاكاة HTTP. مسار التاسك/أيزنهاور/المزامنة الحقيقي يحتاج `Start-Board.ps1` على ويندوز.

## المعمارية

```
UI → WizardAction → Action Engine (validate → Allow/Ask/Never → HTTP → audit)
  → AQHub /api/tasks | /api/mail/sync | /api/open | /api/task/chat
     /api/v1/wizard/mail/status | /api/v1/wizard/settings | /api/audit
  → StateMachine → animation / BubbleEngine
```

الإعدادات تُحفظ فقط في `data/wizard-settings.json` عبر الجسر — أبدًا `tasks.json`.

الخرائط: [`docs/P0-compatibility-map.md`](docs/P0-compatibility-map.md).

## فجوات بريد AQHub (صراحة)

AQHub لا يعرّض GET لصندوق الوارد الحي. الساحر لذلك:

- يعرض «بريد حديث» من مهام اللوحة ذات `source=email` عبر `GET /api/tasks`
- يستورد غير المقروء فقط عند `POST /api/mail/sync` (يكتب `tasks.json` — بطلب المستخدم، صلاحية Ask)
- يفحص اتصال Outlook عبر `GET /api/v1/wizard/mail/status` = `GetActiveObject` فقط (لا `New-Object`، لا تشغيل Outlook)
- يفتح الرسالة عبر `POST /api/open` الموجود
- يحضّر المسودة عبر `POST /api/task/chat` (`draft`) وليس approve-send

تجاهل البريد يُحفظ في `wizard-settings.mailIgnored` وليس في `tasks.json`.

## خارج النطاق بعد

**P7** Magic Wand / UIA (ويندوز سطح مكتب + Build Tools)، **P8** Follow My Work، صوت، ذكاء سحابي، **P13** NSIS/MSI موقّع، موافقة إرسال حقيقية من الساحر، مسح نهائي للتراش، اختصارات عامة في Rust.
