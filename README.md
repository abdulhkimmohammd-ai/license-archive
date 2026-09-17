# License Archive – Migration Lab

هذه النسخة هي **Migration Lab / Development** لنظام أرشيف التراخيص العربي. الهدف هو تجهيز مسار مستقل قابل للتشغيل مستقبلاً عبر **Cloudflare Pages + Cloudflare Workers + Supabase Development**، مع إبقاء MySQL/tRPC وManus OAuth وExpress كمسار رجوع. لا تتضمن هذه المرحلة أي بيانات Production ولا تمنح إذناً بالنشر.

> الحالة الحالية هي **DEPLOY READY preparation** وليست **DEPLOYED**. لم يُنفذ Deploy أو Publish أو Migration إلى Production، ولم يُغيّر DNS أو Domain.

## مسارا التشغيل والبناء

يظل `pnpm dev` و`pnpm build` متوافقين مع المسار الكامل الحالي الذي يخدم Legacy عبر Express/tRPC. أما `pnpm build:pages` فيستخدم وضع `cloudflare-preview` ويحوّل HTML إلى `client/src/main.pages.tsx`، وهو entry مستقل لا يستورد tRPC أو OAuth أو Manus runtime. ينتج الأمر ملفات Pages في `dist/public`.

```bash
pnpm check
pnpm test
pnpm build
pnpm build:pages
pnpm audit --prod
```

يجب نشر `dist/public` لاحقاً على Pages بعد اعتماد مستقل. لم تُنشأ Pages أو Workers ولم يُنفذ `wrangler deploy`.

## مسارات Supabase Development

تبدأ جلسة المختبر من `/migration-lab/supabase` أو الجذر في Build Pages، وتستخدم Supabase Auth بحساب اصطناعي معتمد. المسارات المستقلة هي Dashboard والأرشيف والتفاصيل والنموذج والسلة والفريق والدعوات والطباعة وPDF وQR. العمليات الحساسة تنفذ عبر Supabase RPC/RLS/Triggers أو Worker adapter الاختياري، ولا تستخدم Service Role Key في المتصفح.

رقم الترخيص يُدخل يدوياً من الكرت. رقم الأرشفة يحجزه RPC الذري وفق آخر أربعة أرقام من الترخيص وتسلسل رباعي وحرف النوع، مع منع التكرار وعدم إعادة الاستخدام وتسجيل تعديل المدير في Audit Log. التجديد لا يغير رقم الأرشفة.

## Offline/Online وQR

يعمل `SupabaseDevelopmentOfflineManager` على طابور إنشاء محلي مرتبط بمعرف المستخدم، مع بصمة تمنع تكرار نفس نوع المنشأة ورقم الترخيص، ومفتاح idempotency ثابت، ومحاولات فاشلة قابلة لإعادة التشغيل، وقفل يمنع المزامنة المتوازية. العمليات الحساسة غير الإنشائية تبقى Online-only حتى لا يحدث تعارض غير قابل للدمج.

صفحة `/supabase-development/licenses/:id/qr` تنشئ QR محلياً من معرف السجل ورقم الترخيص ورقم الأرشفة فقط، وتوفر مسحاً بالكاميرا عبر ZXing داخل المتصفح. لا تُرسل صورة الكاميرا إلى الخادم. يلزم اختبار الكاميرا الفعلي على جهاز جوال قبل Preview خارجي.

## الطباعة والملفات

يستخدم PDF والطباعة قالب وزارة الصحة الحالي دون تعديل نصوصه أو إحداثياته. مراجع صور القالب ما زالت تشير إلى مسار `manus-storage` التاريخي، ولذلك يجب توفير هذه الصور لاحقاً كأصول Pages/R2 مستقلة أو ضبط عنوان عام آمن قبل اعتماد نشر خارجي؛ لم تُنقل مرفقات أو File Storage، ولا يجوز خلط صور القالب مع مرفقات التراخيص.

## الأمان والاعتمادات

لا يحتوي المستودع على Secrets أو Service Role Key. قيم Frontend العامة تضبط خارج المصدر، وأسرار Worker تضبط في بيئة Cloudflare. ملف أسماء البيئة المطلوب محمي من التحرير المباشر في هذه البيئة؛ القائمة الموثقة موجودة في `docs/ENVIRONMENT_VARIABLES.md`، ويجب إنشاء ملف محلي غير متعقب أو ضبط القيم عبر مدير الأسرار. يوجد قالب Worker آمن بلا قيم في `workers/.dev.vars.example`، كما يوضح `cloudflare/wrangler.toml.example` bindings المطلوبة. تعذر إنشاء `.env.example` داخل بيئة WebDev بسبب حارس ملفات البيئة؛ لا توجد قيم حقيقية أو Production credentials في المشروع.

العمليات اليومية—الإدخال والبحث والفلاتر وCRUD والأرشفة والتجديد والطباعة وPDF وCSV وQR وOffline/Online—حتمية ولا تستخدم AI أو Forge. تكاملات Manus وStorage باقية فقط لمسار Legacy أو كفجوات موثقة.

## الوثائق

راجع `docs/CLOUDFLARE_SUPABASE_DEPLOY_READINESS.md` للحالة التنفيذية، و`docs/CLOUDFLARE_PREVIEW_MIGRATION_REPORT.md` لخطوات Pages/Workers، و`docs/MANUS_DEPENDENCIES.md` لجرد الاعتمادات، و`docs/MIGRATION_TEST_MATRIX.md` لمصفوفة القبول. النسخة القابلة للنقل موجودة في `exports/project-export.zip` وتستبعد `node_modules` و`dist` و`.git` وملفات الأسرار والملفات المؤقتة. لا تُنفذ أي خطوة خارجية قبل موافقة صريحة مستقلة.
