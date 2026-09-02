# Cloudflare Preview — Migration Lab

هذه الملفات وثائق وقوالب فقط لتحضير انتقال مستقبلي. **لا تنشئ Pages أو Workers أو مشاريع Cloudflare، ولا تنفذ Deploy، ولا تغيّر DNS أو Domain من خلال هذه الملفات.**

## Cloudflare Pages

يُبنى موقع React/Vite في المسار `dist/public` عبر الأمر المحلي الآمن:

```bash
pnpm build:pages
```

يستخدم الأمر وضع `cloudflare-preview`، ويستبعد Manus runtime ومجمع سجلات Manus من Build Pages. إعدادات Pages المقترحة مستقبلاً هي:

| الإعداد | القيمة |
|---|---|
| Build command | `pnpm build:pages` |
| Build output directory | `dist/public` |
| Root directory | جذر المشروع |
| Production branch | لا تُحدد قبل موافقة مستقلة |
| Environment | Supabase Development فقط في Preview |

## Cloudflare Worker

يُستخدم Worker الموجود في `../workers/src/index.ts` لطبقة API فقط عند الحاجة. يمرر JWT المستخدم إلى Supabase Development ويعتمد على RLS/RPC؛ لا يستخدم Service Role Key. القالب موجود في `../workers/wrangler.toml.example`، ولا يجوز تشغيل `wrangler deploy` منه الآن.

قبل أي Preview خارجي يجب ضبط `SUPABASE_URL` و`SUPABASE_ANON_KEY` كأسرار خارج المصدر، وتحديد `ALLOWED_ORIGIN` لأصل Pages Preview ثابت، ثم إضافة rate limiting وحدود حجم الطلب واختبارات CORS وCSRF.

## حدود صريحة

لا تشمل هذه الملفات إنشاء موارد Cloudflare أو ربط حساب أو تعديل DNS أو Domain أو Production. أي Preview خارجي يحتاج موافقة مستقلة بعد إغلاق Queue Offline/Online التشغيلية وQR والتنبيهات ودعوات الفريق واختبار القبول المصادق عليه بحسابات اصطناعية.
