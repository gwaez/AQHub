# AQWizard — رفيق سطح المكتب لـ AQHub

Native **Windows** companion (Tauri 2 + Rust + HTML/CSS/TypeScript).  
AQHub يبقى محليًا: PowerShell `HttpListener` على `http://127.0.0.1:8766` + HTML.

**المرحلة الحالية: P1 scaffold.** شخصية شفافة + قائمة النظام (إظهار/إخفاء/فتح AQHub/خروج) + آلة حالات IDLE/HIDDEN/WATCHING + إعدادات الاسم/الموضع/الحجم عبر جسر HTTP.

لا يستخدم Electron. لا يكتب `tasks.json` / `eisenhower.json` / توكنات CRM.

## ماذا يفعل P1

- نافذة شخصية: `transparent`, `decorations: false`, `alwaysOnTop`, `skipTaskbar`
- أيقونة صينية: إظهار / إخفاء / فتح AQHub / خروج
- حزمة شخصية `characters/old-wizard/` (قبعة + عصا — سيلكويت P1)
- `WizardStateMachine`: IDLE / HIDDEN / WATCHING (`enter` / `update` / `exit`) — بدون منطق أعمال داخل الأنيميشن
- إعدادات: `displayName` قابل لإعادة التسمية؛ المعرّف التقني يبقى `AQWizard` / `old-wizard`
- مسار الملف الحي: `data/wizard-settings.json` عبر `GET/PUT /api/v1/wizard/settings`
- جسر رفيع: `GET /api/v1/wizard/health` → `{ ok, aqhub: true, version }`

## ماذا لا يفعله بعد (مراحل لاحقة)

Magic Wand / UI Automation، Follow My Work، لوحة أيزنهاور كاملة، ذكاء اصطناعي، صوت، مثبت NSIS، فقاعات إيميل، واجهة صلاحيات كاملة.

## التشغيل على ويندوز بجانب AQHub

1. شغّل اللوحة من جذر المستودع (مرة واحدة):

```powershell
cd C:\Users\AMahmoud\Documents\AQHub
.\Start-Board-KeepAlive.bat
```

أو `powershell -ExecutionPolicy Bypass -File .\Start-Board.ps1`

افتح `http://127.0.0.1:8766/board.html` وتأكد أن البورد يعمل.

2. متطلبات AQWizard (مرة واحدة على الجهاز):

- Windows 10/11
- [Node.js 20+](https://nodejs.org/) (LTS)
- [Rust](https://rustup.rs/) **stable الحديثة** (`rustc` 1.88+ — crates الحالية لـ Tauri 2 تحتاج edition 2024)
- WebView2 (عادة موجود على ويندوز 11؛ وإلا Evergreen Runtime)
- Visual Studio Build Tools (C++ workload) إن طلب `cargo` رابط MSVC

3. من مجلد الرفيق:

```powershell
cd C:\Users\AMahmoud\Documents\AQHub\desktop-wizard
npm install
npm run tauri dev
```

البناء:

```powershell
npm run tauri build
```

متغيرات اختيارية:

```powershell
$env:AQHUB_ROOT = "C:\Users\AMahmoud\Documents\AQHub"
$env:AQHUB_URL  = "http://127.0.0.1:8766"
```

إن لم تُضبط، يبحث Rust عن `Start-Board.ps1` في المجلد الأب ثم `%USERPROFILE%\Documents\AQHub`.

## البناء المحلي — خطوات ويندوز الدقيقة

| خطوة | أمر |
|------|------|
| Node | `node -v` ≥ 20 |
| Rust | `rustup` + **stable** (`rustc -V` ≥ 1.88؛ على هذا الـ VM: 1.98.1) |
| تثبيت | `cd desktop-wizard && npm install` |
| فحص TypeScript | `npm run typecheck` |
| فحص Rust | `cd src-tauri && cargo check` |
| واجهة فقط (بدون شفافية/صينية) | `npm run dev` ثم افتح Vite على المنفذ 1420 |
| تطبيق ويندوز | `npm run tauri dev` |

أول `cargo check`/`tauri dev` ينزّل crates وقد يأخذ وقتًا.

## هذا الـ VM (Linux / Cloud Agent)

لا يختبر شفافية WebView2 ولا صينية ويندوز. المتوقع هنا:

- `npm install` + `npm run typecheck` + `npm test`
- `cargo check` إن توفرت مكتبات GTK/WebKit؛ وإلا يبقى السكافولد صحيحًا للبناء على ويندوز
- معاينة CSS/SVG عبر Vite في المتصفح

## المعمارية

```
UI → WizardAction → Action Engine → AQHub HTTP API → result → StateMachine → animation
```

تعديل التاسكات **ليس** داخل كود الأنيميشن. الخرائط: [`docs/P0-compatibility-map.md`](docs/P0-compatibility-map.md).

## الملفات

```
desktop-wizard/
  characters/old-wizard/     حزمة الشخصية
  src/                       UI + محركات TypeScript
  src-tauri/                 Rust (نافذة، صينية، إعدادات)
  docs/P0-compatibility-map.md
wizard/Wizard-Bridge.ps1     جسر PowerShell اختياري في عملية AQHub
```
