# Cloudflare Deployment Guide

هذا الدليل يجهّز النشر المستقبلي فقط. لم يُنفذ أي Deploy أو Preview أو Publish، ولم يتغير DNS أو Domain، ولا يُستخدم فيه أي حساب أو بيانات Production.

## قبل البدء

استخدم حساب Cloudflare مخصصاً لبيئة Development. لا ترفع `project-export.zip` عبر خيار رفع ملفات ثابتة؛ هذا المشروع يحتاج Build لـTypeScript وReact. استخدم Git/CLI واحتفظ بـMySQL وExpress وtRPC وManus Legacy كمسار Rollback.

## متغيرات البيئة والنماذج الآمنة

لا يحتوي المستودع أو ZIP على قيم سرية. بسبب حارس بيئة WebDev لا يُنشأ `.env.example` مباشرة داخل المشروع؛ استخدم `workers/.dev.vars.example` و`docs/ENVIRONMENT_VARIABLES.md` كمرجعين آمنين بقيم فارغة. متغيرات Pages العامة هي `VITE_SUPABASE_DEVELOPMENT_URL` و`VITE_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY` و`VITE_WORKER_URL`، أما Worker فيستخدم `SUPABASE_URL` و`SUPABASE_ANON_KEY` و`ALLOWED_ORIGIN`.

## 1. تسجيل الدخول إلى Cloudflare

من جهاز موثوق ثبّت Wrangler ثم سجّل الدخول:

```bash
pnpm add -g wrangler
wrangler login
```

يمكن بدلاً من التثبيت العام استخدام `pnpm dlx wrangler ...`. لا تحفظ API Token في Git أو داخل ZIP.

## 2. إنشاء Pages Development

أنشئ مشروع Pages منفصلاً باسم Development. من جذر المشروع نفّذ البناء:

```bash
pnpm install --frozen-lockfile
pnpm build:pages
```

المجلد الناتج هو `dist/public`. انشره فقط بعد مراجعة الموافقة:

```bash
pnpm deploy:pages
```

الأمر أعلاه يستخدم اسم Pages التجريبي `license-archive-migration-lab` ولا يُشغّل أي Migration. عدّل الاسم فقط في بيئة Development وبموافقة مستقلة.

اضبط متغيرات Pages العامة من لوحة Cloudflare، ولا تضع قيماً سرية في `VITE_`:

```text
VITE_SUPABASE_DEVELOPMENT_URL
VITE_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY
VITE_WORKER_URL
```

فعّل SPA fallback إلى `index.html` للمسارات الداخلية. اختبر الدخول والمسارات من هاتف وDesktop بعد الإنشاء.

## 3. إعداد Worker

راجع `workers/wrangler.toml` الموجود في المشروع، ثم اضبط `ALLOWED_ORIGIN` على أصل Pages Development فقط. استخدم أسرار Wrangler/Cloudflare خارج المصدر:

```bash
cd workers
pnpm dlx wrangler secret put SUPABASE_URL
pnpm dlx wrangler secret put SUPABASE_ANON_KEY
```

افحص قائمة RPC وCORS وحد الطلب قبل النشر، ثم لا تنفذ الأمر التالي إلا بعد الموافقة:

```bash
pnpm deploy:worker
```

يستخدم Worker JWT المستخدم ولا يحتوي Service Role Key في المصدر. لا تربطه بأي أصل Production.

## 4. إعداد Supabase Development

استخدم مشروع Supabase Development فقط. اضبط `VITE_SUPABASE_DEVELOPMENT_URL` و`VITE_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY` في Pages، وطبّق migrations على Development بعد مراجعتها. تحقق من Auth وRLS وRPC وAudit وIdempotency وNotifications وTeam Invitations وOffline/Online بحسابات اصطناعية فقط.

## 5. اختبارات القبول

بعد ضبط البيئة، نفّذ:

```bash
pnpm check
pnpm test
pnpm build
pnpm build:pages
pnpm audit --prod
```

ثم اختبر تسجيل الدخول، CRUD، البحث والفلاتر والصفحات، Offline/Online، QR، PDF/Print/CSV، والأدوار Admin/User/Blocked. اختبار الكاميرا يحتاج هاتفاً فعلياً وHTTPS وإذن الكاميرا.

## 6. التحقق من الاستقلال

افحص `dist/public` بعد البناء. وجود `/api/trpc` أو Manus OAuth أو Express أو tRPC في ملفات Pages يعني إيقاف النشر وإصلاح المصدر. وجود هذه الاعتمادات داخل `server/` أو المسار Legacy مقصود ولا يُحذف.

## 7. سياسة الإيقاف

لا تنفذ `wrangler deploy` أو `wrangler pages deploy` أو أي DNS/Domain change أو Production Migration ضمن Migration Lab إلا بعد موافقة مستقلة صريحة. للتحقق المحلي فقط استخدم `pnpm dlx wrangler deploy --config workers/wrangler.toml --dry-run`. لا تستخدم ملف ZIP كرفع Static مباشر. هذه الوثيقة لا تمثل موافقة نشر؛ هي خطوات تشغيل مستقبلية قابلة للمراجعة.
