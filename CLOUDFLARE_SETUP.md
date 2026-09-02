# Cloudflare Setup Guide

هذا الدليل للتجهيز فقط. لا تنفذ أوامر Deploy أو Preview أو Publish أثناء مرحلة Migration Lab.

## Cloudflare Pages

أنشئ مشروع Pages مستقلًا باسم Development منفصل، واربطه لاحقًا بمصدر Git أو ارفع نسخة المشروع بعد اعتماد الحزمة. استخدم الأمر التالي للبناء:

```bash
pnpm build:pages
```

المجلد الناتج الفعلي هو:

```text
dist/public
```

فعّل SPA fallback بحيث تعيد المسارات غير المعروفة إلى `index.html`. لا تستخدم `dist` داخل حزمة التصدير؛ هو مخرج بناء مؤقت ويُعاد إنشاؤه في بيئة Pages.

المتغيرات العامة التي يحتاجها المتصفح تُضبط من إعدادات Pages ولا توضع في Git، مثل `VITE_SUPABASE_DEVELOPMENT_URL` و`VITE_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY` و`VITE_WORKER_URL` عند استخدام Worker. لا تضع Service Role Key أو أي سر في متغير يبدأ بـ`VITE_`.

## Cloudflare Workers

يوجد مصدر Worker في `workers/src/index.ts` وملف إعداد نموذجي في `workers/wrangler.toml.example` وقيم محلية نموذجية في `workers/.dev.vars.example`. ثبّت Wrangler في بيئة التشغيل، ثم راجع bindings قبل أي تشغيل خارجي.

اضبط `ALLOWED_ORIGIN` من environment binding. اضبط `SUPABASE_URL` و`SUPABASE_ANON_KEY` كقيم خارجية عبر مدير أسرار Cloudflare؛ لا تسجلها في Git ولا في الحزمة. يستخدم Worker JWT المستخدم ويترك التفويض النهائي لقواعد Supabase RLS/RPC.

الأمر المستقبلي، بعد موافقة مستقلة فقط، سيكون من داخل مجلد `workers`:

```bash
wrangler deploy
```

هذا الأمر **لم يُنفذ** في Migration Lab.

## Supabase Development

استخدم مشروع Supabase Development المنفصل فقط. طبّق ملفات `supabase/migrations/` بالترتيب في المشروع المعتمد، ثم تحقق من Auth وRLS وRPC وTriggers والجداول باستخدام حسابات اصطناعية. لا تطبق migrations على Production من هذه الحزمة، ولا تنقل بيانات حقيقية.

اضبط عنوان Supabase ومفتاح المتصفح العام خارج المصدر. لا تستخدم Supabase Storage للمرفقات في نطاق هذه المرحلة؛ مراجع أصل قالب الوزارة ليست مرفقات تراخيص ويجب توفيرها لاحقًا كأصل مستقل معتمد إن لزم.

## فحص ما قبل Preview

قبل أي Preview خارجي مستقل، شغّل `pnpm check` و`pnpm test` و`pnpm build` و`pnpm build:pages` و`pnpm audit --prod`، وافحص `dist/public` بحثًا عن `/api/trpc` و`@trpc` وManus runtime وManus OAuth. راجع CORS و`ALLOWED_ORIGIN` وسلوك Auth وRLS على Desktop وMobile.

هذا الدليل لا يمنح موافقة على Preview أو Deploy أو DNS أو Domain أو Production Migration. يجب أن تبقى MySQL وExpress وtRPC وManus Legacy محفوظة كمسار Rollback.
