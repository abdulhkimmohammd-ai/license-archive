# الاعتمادات التشغيلية المتبقية — Migration Lab

## نطاق التقرير

هذا التقرير يصف نسخة **Migration Lab / Development** فقط. لا يقرأ بيانات Production ولا يمنح إذناً لحذف Legacy أو تنفيذ Deploy أو Migration. الحالة مبنية على فحص الملفات الحالية ونتائج الاختبارات المحلية واختبارات Supabase Development الاصطناعية.

| الاعتماد والملف | الوظيفة وسبب الاعتماد | البديل المقترح | حالة النقل | قرار الحذف الآن |
|---|---|---|---|---|
| `server/_core/oauth.ts` و`server/_core/context.ts` ومتغيرات `OAUTH_SERVER_URL` و`VITE_OAUTH_PORTAL_URL` | تسجيل دخول Manus وبناء `ctx.user` وحماية مسارات Legacy. | Supabase Auth عبر جلسة JWT؛ Worker أو Supabase RPC يتحققان من JWT، وRLS يتحقق من الدور والحالة. | جزئي؛ مسارات Supabase Development تستخدم جلسة Supabase، بينما المسار القديم يستخدم Manus OAuth. | يجب الإبقاء مؤقتاً. |
| `server/_core/index.ts` و`server/_core/vite.ts` وExpress | استضافة الواجهة في Development، OAuth، Vite bridge، وواجهة `/api/trpc`. | Cloudflare Pages للواجهة، وCloudflare Worker للـAPI، مع Supabase مباشرة أو RPC. | Build Pages مستقل، لكن التشغيل المحلي والمسارات Legacy ما زالت تعتمد Express. تم إصلاح حل Vite config في Development. | يجب الإبقاء مؤقتاً. |
| `server/routers.ts` و`server/routers/*` و`@trpc/*` | عقود API الحالية لكل من MySQL وLegacy، إضافة إلى جسر Supabase الانتقالي. | `licenseApi` وWorker RPC مع عقود TypeScript، أو Supabase JS/RPC المباشر للمسارات غير الحساسة. | جزئي؛ توجد طبقات Supabase مستقلة، لكن صفحات مثل التفاصيل التشغيلية ما زالت تمر عبر `trpc.supabaseLicenses.*`. | لا يحذف قبل إكمال فصل الصفحات واختبار الرجوع. |
| `drizzle/schema.ts` و`server/db.ts` و`DATABASE_URL` | المخطط التشغيلي MySQL وعمليات القراءة والكتابة Legacy. | PostgreSQL/Supabase migrations وRLS وRPC. | لم يُحذف؛ Supabase Development يحتوي مخططاً موازياً وبيانات اختبارية فقط. | يجب الإبقاء حتى انتهاء التكافؤ الكامل. |
| `client/src/pages/SupabaseOperationalArchive.tsx` | جلسة Supabase، لكن استعلام القائمة الحالي يمر عبر `trpc.supabaseLicenses.operationalList`. | `licenseApi` أو Worker RPC مباشرة مع JWT. | جزئي؛ الواجهة مستقلة بصرياً لكنها ليست مستقلة runtime بالكامل. | يجب تعديلها قبل DEPLOY READY الكامل، ولا تحذف المسار الحالي. |
| `client/src/pages/SupabaseOperationalLicenseDetails.tsx` | العرض والتعديل والتجديد والأرشفة والتدقيق عبر `trpc.supabaseLicenses.*`. | استدعاءات Worker أو Supabase JS/RPC مباشرة مع طبقة توافق. | جزئي؛ Supabase/RLS مستخدمان خلف جسر Express/tRPC. | يجب إبقاؤه مع نقل طبقة الاتصال لاحقاً. |
| `client/src/components/OfflineSyncManager.tsx` و`client/src/lib/offlineLicenses.ts` | طابور Offline للمسار Legacy ومزامنة عبر tRPC/MySQL. | Queue مشتركة typed تستدعي Worker/Supabase RPC، بمفتاح idempotency وretry وتعارض صريح. | غير مكتمل للمسارات التشغيلية الجديدة؛ مختبر Supabase يملك helper محدوداً للإنشاء ولا يملك sync executor كاملاً. | لا يحذف. |
| `storage/*` و`storagePut` و`storageGet` | رفع/قراءة المرفقات في المسار القديم. | Supabase Storage بعد قرار مستقل وتصميم RLS، أو إبقاء المرفقات خارج نطاق النقل. | مؤجل عمداً؛ لا توجد مرفقات أو File Storage لمسار Supabase الحالي. | يجب إبقاؤه Legacy وعدم توسيعه. |
| `BUILT_IN_FORGE_API_*` و`VITE_FRONTEND_FORGE_API_*` | تكاملات Forge/Manus الموجودة في البنية، وليست مطلوبة للعمليات العادية. | لا بديل مطلوب لـCRUD والبحث والطباعة؛ أي AI مستقبلي يجب أن يكون اختيارياً خارج المسار التشغيلي. | غير مطلوب للنقل الحالي؛ لم يُستخدم في CRUD أو البحث أو الأرشفة أو الطباعة. | لا يحذف قبل جرد كل مستهلك، لكنه لا يدخل Build Pages. |
| `VITE_ANALYTICS_*` و`client/index.html` | تحليلات Manus السابقة. | تحليلات مستقلة اختيارية أو لا شيء في Preview الحساس. | أزيل تحميل التحليلات من HTML المشترك وBuild Pages. | يمكن حذف الاعتماد بعد تأكيد عدم وجود مستهلك آخر. |
| `OWNER_*` و`VITE_APP_*` | هوية التطبيق وإعدادات قالب Manus. | متغيرات Pages العامة الآمنة وإعدادات Supabase Development. | جزئي؛ بعض متغيرات القالب لا تزال مطلوبة للمسار Legacy. | لا تحذف قبل فصل Legacy. |
| `workers/src/index.ts` | Adapter مستقل محدود لتمرير JWT إلى Supabase RPC. | Worker مكتمل بعقود وحماية CORS/rate limit وحجم طلبات ومسارات كل الوظائف المطلوبة. | قيد الإكمال؛ يغطي RPCs الأساسية وDashboard وإدارة الفريق، ولا يغطي بعد القراءة التفصيلية والأحداث والتنبيهات وQR ودعوات الفريق ورفع/توليد PDF. | لا ينشر ولا يحذف. |

## الخلاصة التنفيذية

النسخة **ليست مستقلة عن Manus بالكامل**. Build Pages لم يعد يحمل Manus runtime أو تحليلات Manus، لكن التشغيل المحلي والمسارات القديمة تعتمد على Express وtRPC وMySQL وManus OAuth. كما أن بعض صفحات Supabase الانتقالية تستخدم جلسة Supabase مع جسر tRPC، وهو جسر توافق مفيد للاختبار لكنه ليس استقلالاً كاملاً عن Express.

لا توجد حاجة لاستخدام AI في CRUD أو البحث أو الفلترة أو الترقيم أو الحفظ أو الأرشفة أو الاستعادة أو CSV أو PDF والطباعة العادية أو المصادقة البرمجية. هذه العمليات تنفذ مباشرة عبر TypeScript وSupabase RPC/RLS أو عبر المسار Legacy.

## قرار النقل

الخطوة التالية الوحيدة قبل إعلان استقلال كامل هي **فصل صفحات Supabase التشغيلية عن جسر Express/tRPC ونقل Queue Offline/Online الموسعة إلى Worker/Supabase مع اختبار قبول مصادق عليه بحسابات اصطناعية**. بعد ذلك تُنقل QR والتنبيهات ودعوات الفريق، ثم يُعاد تشغيل مصفوفة القبول كاملة. لا يجوز حذف Legacy أو تنفيذ نشر خارجي قبل نجاح هذه الخطوات.
