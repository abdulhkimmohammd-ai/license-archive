# MANUS_DEPENDENCIES

**النطاق:** هذه الوثيقة تصف نسخة **License Archive – Migration Lab / Development** فقط. لا تمنح إذناً لإلغاء المسار القديم أو تنفيذ Deploy أو Migration أو تغيير DNS/Domain. لا تُستخدم أي بيانات Production في هذا المسار.

| الاعتماد | الاستخدام الحالي | البديل المستهدف | حالة النقل الحالية | القرار |
|---|---|---|---|---|
| Manus OAuth / `OAUTH_SERVER_URL` / `VITE_OAUTH_PORTAL_URL` | تسجيل الدخول وبناء `ctx.user` وحماية صفحات المسار القديم. | Supabase Auth مع JWT وRLS وRPC/Worker. | **PARTIALLY DONE**؛ كل صفحات `/supabase-development/*` التشغيلية تستخدم جلسة Supabase، بينما Legacy ما زال يعتمد Manus. | الإبقاء حتى اكتمال اختبار القبول والرجوع.
| Express runtime | خادم التشغيل المحلي، Vite bridge، OAuth، tRPC وStorage proxy. | Cloudflare Pages للواجهة وCloudflare Worker/API عند الحاجة، مع Supabase مباشرة أو RPC. | **PARTIALLY DONE**؛ `pnpm build:pages` مستقل، لكن `pnpm dev` والمسارات Legacy تعتمد Express. | لا يُحذف الآن.
| `@trpc/client`, `@trpc/react-query`, `@trpc/server` | عقود API للمسار القديم ومكوّنات Legacy. | `licenseApi` وSupabase JS/RPC وWorker JWT adapter. | **PARTIALLY DONE**؛ Dashboard والأرشيف والتفاصيل والفريق والطباعة والسلة والنموذج والدعوات المستقلة لا تحتاج tRPC؛ صفحات Legacy لا تزال تحتاجه. | الإبقاء كـFallback.
| MySQL / Drizzle / `DATABASE_URL` | قاعدة بيانات ومنطق أعمال المسار القديم. | PostgreSQL/Supabase migrations وRLS وRPC وTriggers. | **PARTIALLY DONE**؛ Supabase Development يملك مخططاً موازياً واختبارات اصطناعية، دون نقل بيانات حقيقية. | لا حذف ولا Migration إنتاجي.
| `client/src/components/OfflineSyncManager.tsx` و`offlineLicenses.ts` | طابور Legacy ومزامنته عبر tRPC/MySQL. | مدير `SupabaseDevelopmentOfflineManager` وطابور Supabase بمفتاح idempotency وretry وعزل الفشل. | **PARTIALLY DONE**؛ المدير المستقل يعمل على مستوى التطبيق للمسار الجديد، ومدير Legacy محفوظ للمسار القديم. العمليات الحساسة غير الإنشائية تبقى Online-only لتفادي تعارض غير قابل للدمج. | الإبقاء على الاثنين خلال الانتقال.
| `storage/*`, `storagePut`, `storageGet` | مرفقات المسار القديم. | خارج نطاق مسار Supabase الحالي؛ لا File Storage أو مرفقات في المختبر. | **INTENTIONALLY DEFERRED**. | لا توسعة ولا حذف Legacy.
| Manus Forge / `BUILT_IN_FORGE_API_*` و`VITE_FRONTEND_FORGE_API_*` | تكاملات Manus المحتملة في البنية. | لا بديل مطلوب للعمليات العادية؛ أي AI مستقبلي يجب أن يكون اختيارياً وخارج CRUD والبحث والطباعة. | **NOT USED IN DAILY OPERATIONS**؛ اختبار Zero-AI يثبت عدم استخدامه في CRUD والبحث والأرشفة والطباعة وPDF وCSV وOffline. | لا يدخل Build Pages.
| `VITE_ANALYTICS_*` | تحليلات Manus السابقة. | تحليلات مستقلة اختيارية أو لا شيء في Preview الحساس. | **REMOVED FROM PAGES BUILD**؛ لا توجد إضافة تحليلات Manus في HTML الخاص بـ`build:pages`. | تبقى متغيرات Legacy خارج Build Pages.
| `OWNER_*` و`VITE_APP_*` | هوية القالب وإعدادات المسار القديم. | متغيرات Pages العامة الآمنة وSupabase Development. | **PARTIALLY DONE**؛ لا تُستخدم أسرار داخل المصدر، ولا يُنقل أي Production value. | تُدار خارج المصدر.
| `workers/src/index.ts` | Worker JWT→Supabase RPC adapter. | Worker منشور لاحقاً مع CORS مقيد ومفاتيح بيئية وحد حجم طلبات ومراقبة. | **PREVIEW READY SOURCE**؛ قائمة RPC تشمل CRUD التشغيلي والفريق والدعوات والتنبيهات، مع حارس JWT وحد 64KiB؛ لم يُنشر Worker. | لا Deploy دون موافقة مستقلة.
| QR (`qrcode`, `@zxing/browser`) | توليد رمز هوية مختصر ومسح بالكاميرا في صفحة مستقلة. | تنفيذ متصفح مستقل دون Manus أو خدمة خارجية. | **DONE IN DEVELOPMENT**؛ الحمولة لا تتضمن بيانات شخصية، ومسح الكاميرا محلي. | يحتاج اختبار كاميرا فعلي على جهاز قبل Preview.
| Team Invitations وNotifications | دعوات داخلية وتنبيهات أحداث الترخيص والدعوات. | Supabase RPC/Triggers وRLS للمستلم فقط. | **DONE IN DEVELOPMENT**؛ رموز الدعوة تحفظ كـhash فقط، وتوجد وظائف قبول/رفض/انتهاء/إلغاء وتدقيق، والتنبيهات داخلية بلا بريد خارجي. | يحتاج اختبار قبول تفاعلي بحسابات اصطناعية.

## سياسة الاستقلال

مسار Pages المستقل لا يستدعي Manus runtime أو Forge في البناء الخاص به، لكن المستودع ما زال يحتوي عمداً على Express وtRPC وMySQL وManus OAuth من أجل التشغيل المحلي والمسار الاحتياطي. لذلك تعني كلمة **Deploy Ready** في هذه المرحلة جاهزية مصدر ومخطط وقابلية اختبار، لا نشر الموقع ولا تحويل Production.

> لا توجد عملية يومية تستخدم AI: الإدخال اليدوي، البحث، الفلاتر، CRUD، الترقيم، الأرشفة، التعديل، التجديد، الحذف الناعم، الاستعادة، الطباعة، PDF، CSV، QR وOffline/Online تنفذ ببرمجيات حتمية وSupabase RLS/RPC أو المسار القديم.

## قواعد الأسرار

لا توضع المفاتيح الإدارية أو Service Role أو مفاتيح Worker في `src/` أو `public/` أو JavaScript المرسل للمتصفح. مفاتيح Supabase العامة فقط هي المسموح بها في Frontend، بينما قيم Worker وCloudflare وProduction تدار من مدير أسرار خارجي. لا تُضمّن بيانات Production أو مفاتيحها في ملفات التصدير أو الحزمة.
