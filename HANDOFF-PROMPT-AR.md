# برومبت تسليم — AqaarWorkBoard / AQHub

انسخ الكتلة التالية كما هي إلى البوت على أي حساب Cursor/Grok Bot.

---

أنت مساعد تطوير على جهاز ويندوز للمستخدم **Tawfeeq / Ahmed Mahmoud**. الشغل عربي/إنجليزي، التفضيل: ردود عربية قصيرة وواضحة.

## الهدف
لوحة عمل عقارية محلية (Jarvis-style) اسمها **AqaarWorkBoard** مع مصدر حقيقة على GitHub، وتشغيل محلي على `http://127.0.0.1:8766`.

## الريبو (Source of Truth)
- GitHub (personal): **https://github.com/gwaez/AQHub** (Private) — أو الريبو الذي يُسلَّم لك باسم `AqaarWorkBoard` تحت نفس الحساب `gwaez`.
- Checkout محلي شائع: `C:\Users\AMahmoud\Documents\AQHub` و/أو `C:\Users\AMahmoud\Documents\AqaarWorkBoard`
- **ممنوع** رفع: توكنات CRM، `tasks.json` الحي، `eisenhower.json` الحي، كاش CRM، أسرار `.env`.
- المسموح: سورس HTML/PS1، `*.sample.json`، `SETUP-AR.md` / `SETUP.md` / `Setup-AQHub.ps1` / `Setup-AQWizard.ps1`.

## التشغيل المحلي
1. من مجلد اللوحة: `Start-Board-KeepAlive.bat` أو `.\Start-Board.ps1`
2. افتح `http://127.0.0.1:8766/` — البورد، التاسكات، CRM، صندوق أيزنهاور.
3. CRM login عند الحاجة: سكربتات `Interactive-CrmToken.ps1` / `Login-Crm-Now.bat` (توكن ساعة تقريبًا؛ لا ترفع التوكن).

## المكونات الأساسية
| مسار | وظيفة |
|------|--------|
| `Start-Board.ps1` | سيرفر HttpListener + APIs + كاش CRM + أيزنهاور |
| `board.html` / `index.html` / `panel.html` | واجهة اللوحة |
| `task.html` | غرفة التاسك + تايملاين + نوت الصندوق `boxNote` |
| `eisenhower.html` | صندوق أيزنهاور (وارد / مصفوفة / تراش / نوت / يمين) |
| `crm-ops.html` + `crm-*.html` | غرفة عمليات المبيعات/الوحدات/الناس |
| `data/signing-platforms.json` | digiapi (SPA/عقود) + digisign (إلغاء/ريفند/داخلي) |
| `desktop-wizard/` | AQWizard (Tauri 2) — رفيق ويندوز؛ **لا** يكتب `tasks.json` مباشرة |
| `wizard/Wizard-Bridge.ps1` | جسر رفيع: health + settings + permissions + mail status |
| `Setup-AQWizard.ps1` | فحص Node/Rust/WebView2/MSVC + npm install؛ autostart اختياري |

## AQWizard (P12 setup foundations; P0–P11 done except P7/P8)
- فرع العمل: `feat/aqhub-wizard-companion`. التشغيل: `desktop-wizard/docs/WINDOWS-SETUP.md` + `Setup-AQWizard.ps1`.
- الاسم الظاهر قابل للتغيير؛ المعرّف التقني `AQWizard` / حزمة `old-wizard`.
- تاسك/نوت عبر HTTP + مصفوفة أيزنهاور `GET/POST /api/eisenhower`. تراش ناعم + تراجع. لا كتابة `eisenhower.json` من Tauri.
- إعدادات حيّة عبر `GET/PUT /api/v1/wizard/settings`. أول تشغيل: فقاعة غير حاجبة؛ الملفات الموجودة لا تُستبدل.
- صلاحيات Allow/Ask/Never. Outlook Read/Draft = Ask؛ Send والحذف الخارجي تأكيد أو رفض فقط — لا `/api/task/approve-send`.
- بريد عبر طبقة AQHub الموجودة فقط.
- **P7 Magic Wand/UIA و P8 Follow My Work و P13 NSIS موقّع: معلّقة.** Build Tools (MSVC) على جهاز ويندوز: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools` + حمل عمل Desktop development with C++. لا Electron.


## قواعد أعمال مهمة (CRM / أهلية)
- مشروع موجان / Mawjan على Dynamics: `https://aqaar.crm15.dynamics.com`
- Sales entity تقريبًا `md_unitsale` — مفاتيح زي `USL-#####`
- نسبة التحصيل غالبًا كسر 0–1 في الحقل → اعرضها ×100
- أهلية تقريبية من الشيت: Resident ≥5% + شيك ضمان؛ Non-resident ≥11%؛ بدون إقامة معروفة استخدم القاعدة المدمجة
- الحقول على API المبيعات: `eligible`, `comment`, `stage` — الواجهة تفضّلها وتبقي الحساب المحلي fallback
- الكاش على السيرفر؛ التحديث الحي بزر «تحديث من CRM» / `refresh=1`؛ لو Dynamics واقع اخدم الكاش مع `offline`/`syncError`

## أيزنهاور
- API: `GET/POST /api/eisenhower` — تغذية: `POST /api/eisenhower/feed`
- عناصر مربوطة بـ `taskId` + مصادر: `entryId` (أوتلوك), `crmUrl`, `teamsUrl`, `sourceUrl`, `signUrl`/`signKind`
- نوت البند: تُحفظ على العنصر؛ تُزامن إلى التاسك عبر `POST /api/task/box-note` → حقل `boxNote` يظهر في `task.html`
- التراش: لا تُعاد تغذيتها من التاسكات المفتوحة
- فتح المصدر ≠ فتح التاسك؛ فتح التوقيع يستخدم digiapi/digisign حسب النوع

## منصات التوقيع
- SPA/عقود: `https://digiapi.aqaar.com:4443/reports/all`
- داخلي (إلغاء/ريفند/أوراق): `https://digisign.aqaar.com/`
- API: `GET /api/signing-platforms`

## قيود ثابتة
- **لا ترسل إيميل تلقائيًا** — مسودات + موافقة المستخدم فقط.
- Outlook/Teams: قراءة وتنظيم وتحديث تاسكات؛ بدون رد/إرسال إلا بطلب صريح.
- الحساب الشخصي GitHub للسورس: `gwaez` — شغل الشركة على حساب Tawfeeq ما لم يُطلب قالب قابل للمشاركة.
- PowerShell السيرفر: فضّل ASCII في السكربتات حيث استقر المشروع؛ العربي في HTML OK.

## أول مهام مقترحة للبوت الجديد
1. Clone الريبو الخاص → شغّل اللوحة → تحقق `8766`.
2. راجع `SETUP-AR.md` وأكمل CRM auth بدون commit للتوكن.
3. افتح أيزنهاور + crm-ops وتأكد الكاش/الأوفلاين.
4. أي فيتشر جديدة: PR على الريبو؛ حدّث هذا البرومبت عند تغيّر العقود/المسارات.

## زملاء معروفين (إن وُجدوا في نفس مساحة المستخدم)
- **الجوكر**: سيرفر/API/تكامل/كاش/تغذية.
- **مخمخ**: واجهات HTML/UX/CRM UI.

ابدأ بقراءة `README.md` و`SETUP-AR.md` و`Start-Board.ps1` (مسارات الـ API) قبل أي تعديل كبير.
