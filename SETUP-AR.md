# إعداد AQHub على جهاز ويندوز جديد

دليل خطوة بخطوة لمستخدم مبتدئ. انسخ الأوامر والصقها في PowerShell كما هي.

## ما هو هذا المنتج؟ (كن صادقًا)

AQHub **لوحة أوامر محلية** على جهازك فقط:

- صفحات HTML (`board.html` وغيرها)
- سكربت PowerShell يفتح خادمًا محليًا بسيطًا (`HttpListener`) على المنفذ `8766`
- قراءة/إرسال البريد عبر **Outlook للكمبيوتر** (COM) — مش سحابة ولا npm

**لا يوجد** تثبيت Node.js ثقيل، ولا سيرفر سحابي، ولا تدفق OAuth مخترع. ما تراه من نوافذ تسجيل دخول حقيقي:

| الموقف | ماذا يحدث |
|--------|-----------|
| استنساخ المستودع إن كان خاصًا | Git Credential Manager / متصفح يطلب دخول GitHub — وافق |
| Git غير مثبت | `winget` يحمّل Git مع شريط تقدم واضح |
| ميزات البريد | Outlook يجب أن يكون مثبتًا ومسجّل الدخول مسبقًا |
| أول تشغيل | ويندوز/Outlook قد يطلب إذن COM — اسمح إذا وثقت |
| بعد التشغيل | السيرفر يسمع على `http://127.0.0.1:8766/` (الصفحة الرئيسية). لوحة التاسكات **مش** بتفتح لوحدها |

**أمان البريد:** الإيميل **لا يُرسل تلقائيًا أبدًا**. المسودات تبقى محلية حتى تضغط موافقة يدويًا.

---

## الخطوة 0 — المتطلبات قبل البدء

1. جهاز **Windows** (يفضّل ويندوز 10 أو أحدث).
2. اتصال بالإنترنت (لتحميل Git والمستودع إن لزم).
3. لميزات البريد: **Outlook للكمبيوتر** مثبت ومسجّل الدخول بحسابك.
4. صلاحية تشغيل PowerShell على الجهاز (حسابك العادي يكفي عادةً).

لا تحتاج حساب Azure ولا npm ولا Docker.

---

## الخطوة 1 — افتح PowerShell

1. اضغط `Win + R` (مفتاح ويندوز + حرف R).
2. اكتب:

```text
powershell
```

3. اضغط Enter.

ستفتح نافذة PowerShell زرقاء/سوداء. الصق الأوامر التالية فيها واحدًا تلو الآخر.

---

## الخطوة 2 — ثبّت Git إن لم يكن موجودًا

الصق هذا الأمر واضغط Enter. ستشاهد تقدم التحميل من winget:

```powershell
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
```

- إن ظهرت رسالة أن Git موجود مسبقًا — هذا طبيعي، تابع.
- إن طلبت موافقة — وافق (`Y` إن سُئلت).

**مهم:** بعد تثبيت Git لأول مرة، **أغلق نافذة PowerShell وافتحها من جديد** (كرر الخطوة 1) حتى يتعرّف النظام على أمر `git`.

للتحقق بعد إعادة الفتح:

```powershell
git --version
```

يجب أن ترى رقم إصدار (مثل `git version 2.x.x`).

---

## الخطوة 3 — استنساخ المستودع (قد يظهر دخول GitHub)

الصق:

```powershell
git clone https://github.com/gwaez/AQHub.git
```

ماذا تتوقع؟

- سترى تقدم تنزيل الملفات في النافذة.
- إذا كان المستودع **خاصًا (private)**، قد يفتح المتصفح أو نافذة **Git Credential Manager** لدخول GitHub — سجّل الدخول ووافق على الوصول. هذا طبيعي وليس فيروسًا.
- بعد النجاح يظهر مجلد `AQHub` في المسار الحالي (غالبًا `Documents` أو حيث كنت واقفًا).

إذا أردت الاستنساخ مباشرة داخل المستندات:

```powershell
cd $env:USERPROFILE\Documents
git clone https://github.com/gwaez/AQHub.git
```

---

## الخطوة 4 — ادخل مجلد المشروع

```powershell
cd AQHub
```

(إذا استنسخت داخل Documents):

```powershell
cd $env:USERPROFILE\Documents\AQHub
```

---

## الخطوة 5 — شغّل الإعداد مرة واحدة أو شغّل اللوحة مباشرة

### الخيار أ (موصى به): سكربت الإعداد مع رسائل تقدم واضحة

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-AQHub.ps1
```

السكربت سيطبع مراحل مثل: التحقق من Git، تجهيز ملفات البيانات، تشغيل اللوحة، فتح المتصفح. وقد يذكر أن نافذة GitHub/Outlook قد تظهر.

### الخيار ب: تشغيل مباشر بالنقر المزدوج

من مستكشف الملفات داخل مجلد `AQHub`، انقر نقرًا مزدوجًا على:

```text
Start-Board-Background.bat
```

(الخادم يعمل مخفيًا بدون نافذة PowerShell. `Start-Board-KeepAlive.bat` ما زال يعمل ويستدعي نفس المشغّل المخفي.)

أو من PowerShell:

```powershell
.\Start-Board-Background.bat
```

---

## الخطوة 6 — اللوحة في المتصفح + أذونات Outlook

1. بعد ثوانٍ قليلة السيرفر يبقى شغال. افتح الصفحة الرئيسية بنفسك (اللوحة مش بتتفتح لوحدها):

```text
http://127.0.0.1:8766/
```

   اختياري: `powershell -File .\Start-Board.ps1 -OpenBrowser` يفتح الصفحة الرئيسية مرة واحدة.

2. إن ظهرت نوافذ ويندوز أو Outlook تطلب السماح لبرنامج بالوصول إلى البريد — **اسمح** إذا كنت أنت من شغّلت AQHub.
3. إن لم يفتح المتصفح تلقائيًا، انسخ الرابط أعلاه والصقه يدويًا.

عند النجاح: اللوحة جاهزة محليًا على جهازك.

---

## رفيق سطح المكتب AQWizard (اختياري)

الساحر تطبيق ويندوز أصلي (Tauri 2) بجانب اللوحة — **ليس Electron**. يحتاج **Node 20+** و **Rust** و **WebView2** و **Visual Studio Build Tools** (حمل عمل Desktop development with C++). المسار الشائع:

```text
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools
```

سكربت الإعداد **لا** يثبّت Build Tools تلقائيًا. الدليل الكامل: [desktop-wizard/docs/WINDOWS-SETUP.md](desktop-wizard/docs/WINDOWS-SETUP.md).

بعد أن تعمل اللوحة على `8766`:

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-AQWizard.ps1
cd desktop-wizard
npm run tauri dev
```

التشغيل مع بدء ويندوز **مغلق افتراضيًا** (`-Autostart` لاحقًا بعد `npm run tauri build`). لا إرسال بريد من الساحر. العصا السحرية / UIA لاحقًا.

---

## ماذا يفعل النظام فعليًا؟

| المكوّن | الدور |
|---------|--------|
| `Start-Board.ps1` | خادم محلي بسيط (HttpListener) + ربط Outlook COM |
| `Watch-Board.ps1` | يراقب اللوحة ويعيد تشغيلها إن توقفت (مخفي) |
| `Start-Board-Background.bat` | التشغيل اليومي — بدون نافذة PowerShell متبقية |
| `board.html` | واجهة اللوحة (كانبان / قائمة / تركيز) |
| `data/tasks.json` | مهامك المحلية (تُنشأ من العينة إن نقصت) — **لا تُرفع إلى git** |
| `data/crm-config.json` | إعدادات CRM محلية — **لا ترفع أسرارًا** |

---

## أمان مهم

- **لا إرسال تلقائي للبريد.** وافق يدويًا فقط عند الإرسال.
- لا تضع كلمات مرور أو توكنات داخل المستودع.
- لا تعمل `git commit` لملفات `data/tasks.json` أو `data/crm-config.json` أو `.env`.
- كل شيء lokal على `127.0.0.1` — لا يُنشر على الإنترنت بهذا الإعداد.

---

## استكشاف سريع للمشاكل

| المشكلة | ماذا تجرب |
|---------|-----------|
| `git` غير معروف بعد التثبيت | أغلق PowerShell وافتحه من جديد، ثم `git --version` |
| فشل `git clone` / طلب دخول | سجّل دخول GitHub في النافذة/المتصفح، أو تأكد أن لديك صلاحية على المستودع |
| المنفذ مشغول / اللوحة لا تفتح | أعد تشغيل `Start-Board-Background.bat` أو أغلق نوافذ PowerShell القديمة للوحة إن وُجدت |
| البريد لا يعمل | تأكد أن Outlook للكمبيوتر مفتوح ومسجّل الدخول على نفس الجهاز. ثم `POST /api/mail/sync` |
| `POST /api/mail/sync` يعيد 500 فارغ | أعد تشغيل اللوحة من هذا الفرع؛ Outlook لازم يكون مفتوح. الخطأ JSON `{ok:false,error,message}` |
| تحذير ExecutionPolicy | استخدم أمر الخطوة 5 مع `-ExecutionPolicy Bypass` كما هو مكتوب |

---

## ملخص الأوامر بالترتيب (نسخ سريع)

من PowerShell جديد (`Win+R` → `powershell`):

```powershell
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
```

(أغلق النافذة وافتح PowerShell من جديد إن ثبّت Git للتو)

```powershell
cd $env:USERPROFILE\Documents
git clone https://github.com/gwaez/AQHub.git
cd AQHub
powershell -ExecutionPolicy Bypass -File .\Setup-AQHub.ps1
```

ثم افتح: `http://127.0.0.1:8766/` (الصفحة الرئيسية؛ لوحة التاسكات مش بتتفتح لوحدها)

للنسخة الإنجليزية الموازية: [SETUP.md](SETUP.md)
