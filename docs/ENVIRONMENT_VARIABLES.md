# متغيرات البيئة — License Archive Migration Lab

هذا الملف بديل توثيقي آمن لـ`.env.example`. لا يحتوي على قيم، ولا يُستخدم لتحميل أسرار. ملفات البيئة المحمية تُدار عبر مدير الأسرار/إعدادات النشر، ولا تُحرر مباشرة داخل المشروع.

## Frontend-safe variables

```text
VITE_APP_TITLE=
VITE_APP_LOGO=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_DEVELOPMENT_URL=
VITE_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY=
VITE_LICENSE_API_BASE_URL=
```

## Server-only secrets

```text
DATABASE_URL=
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
OAUTH_SERVER_URL=
OWNER_OPEN_ID=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

## Development-only configuration

```text
NODE_ENV=development
SUPABASE_DEVELOPMENT_URL=
SUPABASE_DEVELOPMENT_SERVICE_ROLE_KEY=
CLOUDFLARE_PREVIEW_PROJECT_NAME=
```

## Production-only configuration

```text
PRODUCTION_DATABASE_URL=
PRODUCTION_SUPABASE_URL=
PRODUCTION_SUPABASE_SERVICE_ROLE_KEY=
CLOUDFLARE_PRODUCTION_PROJECT_NAME=
```

> `VITE_LICENSE_API_BASE_URL` هو عنوان Worker العام فقط ولا يحمل سراً؛ يجب أن يبقى فارغاً حتى إنشاء Worker Preview معتمد.

لا يُسمح بوضع `SUPABASE_SERVICE_ROLE_KEY` أو Cloudflare API token أو أي مفتاح خادم في `src/` أو `public/` أو متغير يبدأ بـ`VITE_`. المتغيرات العامة فقط هي التي يجوز أن تصل إلى المتصفح.

## حالة الملف المطلوب

لم يُنشأ ملف `.env.example` داخل المشروع لأن بيئة WebDev تمنع تعديل ملفات البيئة مباشرة وتُلزم بإدارة القيم عبر قناة الأسرار. هذا الملف يحفظ أسماء المتغيرات وتصنيفها دون أي قيمة سرية، ويجب تحويله إلى قالب نشر مستقل فقط بعد اعتماد آلية إدارة البيئة للهدف النهائي.
