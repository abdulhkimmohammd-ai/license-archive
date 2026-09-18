# CLOUDFLARE PREVIEW MIGRATION REPORT

## القرار الحالي

المشروع في حالة **READY FOR CLOUDFLARE PREVIEW** لمسار Development، وليس **DEPLOYED**. جرى تجهيز Build مستقل وWorker adapter ومخطط Supabase Development، لكن لم تُنشأ موارد Cloudflare ولم يُنفذ Deploy أو Publish أو تغيير DNS/Domain أو Production Migration.

## ما تم تنفيذه

يستخدم `pnpm build:pages` وضع `cloudflare-preview` مع entry مستقل هو `client/src/main.pages.tsx`. هذا entry لا يستورد tRPC أو OAuth أو Manus runtime؛ ويضم فقط React Query وSupabase Auth وPWA ومدير Offline ومسارات Supabase التشغيلية. يحافظ Build Legacy على `main.tsx` وExpress/tRPC عبر تحويل Vite خاص بالوضع غير المستقل.

يحتوي `workers/src/index.ts` على adapter JWT→Supabase RPC. يمرر JWT المستخدم وSupabase public key، ويعتمد RLS داخل Development، ولا يستخدم Service Role Key. توسعت القائمة لتشمل CRUD التشغيلي والفريق والدعوات والتنبيهات، وأضيف حد 64KiB للحمولة ومعالجة أخطاء الاتصال وحارس CORS قابل للضبط عبر `ALLOWED_ORIGIN`. لم يُنشر Worker.

نُقلت صفحات Dashboard والأرشيف والتفاصيل والنموذج والسلة والفريق والدعوات والطباعة وPDF وQR إلى Supabase JS/RPC المباشر في entry المستقل. أضيف مدير طابور Offline على مستوى التطبيق مع بصمة منع التكرار، idempotency ثابت، retry للعناصر الفاشلة، وقفل يمنع المزامنة المتوازية. أضيف QR محلي للتوليد والمسح بالكاميرا دون إرسال صورة الكاميرا للخادم. دعوات الفريق تحفظ hash للرمز فقط، والتنبيهات الداخلية تنتج عبر Triggers في Development دون بريد خارجي.

## التحقق الحالي

| البند | النتيجة الأخيرة |
|---|---|
| `pnpm check` | ناجح بعد فصل entry وWorker وQR |
| `pnpm test` | ناجح: **43 ملفاً و119 اختباراً**، بما فيها اختبارات Offline وQR وWorker والقبول متعدد الأدوار والمنصات |
| `pnpm build` | ناجح للمسار الكامل Legacy بعد التغييرات |
| `pnpm build:pages` | ناجح؛ `dist/public/index.html` يشير إلى `main.pages.tsx` بعد التحويل، ولا تظهر markers `/api/trpc` أو `__manus__` أو `@trpc/` أو OAuth في المخرج الحالي |
| Bundle Pages | entry نحو 444KB، وSupabase vendor نحو 217KB، وQR lazy chunk نحو 42KB؛ لا يزال هناك تحذير legacy chunk مستقل في البناء الكامل، وليس عائقاً لمسار Pages |
| `pnpm audit --prod` | `No known vulnerabilities found` بعد إضافة مكتبات QR |
| `wrangler deploy --config workers/wrangler.toml --dry-run` | ناجح؛ تم التحقق من config وentry وحجم Worker دون رفع أو إنشاء مورد |
| Cloudflare scripts | `build:pages` و`deploy:worker` و`deploy:pages` موجودة؛ أوامر deploy لم تُنفذ |
| البيانات | Supabase Development واختبارات اصطناعية فقط؛ لا Production data |

## ما يلزم قبل Preview خارجي

يجب ضبط `VITE_SUPABASE_DEVELOPMENT_URL` و`VITE_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY` في Pages، و`SUPABASE_URL` و`SUPABASE_ANON_KEY` و`ALLOWED_ORIGIN` في Worker، خارج المستودع. يجب اختيار أصل Preview محدد بدلاً من wildcard، ومراجعة rate limiting والمراقبة قبل فتح Worker على الإنترنت العام.

جرد المشروع و`/home/ubuntu/webdev-static-assets` لم يجد أي صورة أو PDF للقالب الوزاري الأصلي. لذلك بقيت مراجع القالب التاريخية `/manus-storage/...` كما هي دون اختراع أصل أو إعادة تصميم؛ يلزم توفير أصل مستقل معتمد فقط قبل Preview الخارجي الذي يحتاج الصورة المرجعية. هذا لا يتعلق بالمرفقات؛ File Storage للمرفقات خارج نطاق المشروع عمداً.

تم تنفيذ اختبار قبول آلي بحسابات اصطناعية للمدير والمحظور، مع مسارات Desktop وMobile وRTL، وتم تنفيذ إنشاء ترخيص Development اصطناعي وتوليد/قراءة QR لعناصر الهوية المسموح بها. اختبار الكاميرا الفعلي يحتاج هاتفاً وبيئة HTTPS/إذن كاميرا؛ إذا تعذر تشغيله هنا فهو قبول يدوي مطلوب وليس فشلاً برمجياً. كما يلزم قرار مستقل بشأن نشر Preview فقط؛ لا يترتب على هذا التقرير أي إذن بالنشر.

## حدود الموافقة

لا توجد موافقة على `wrangler deploy` أو إنشاء Pages/Workers أو تغيير DNS/Domain. لا توجد موافقة على حذف Manus أو MySQL/tRPC أو نقل بيانات Production. المسار القديم محفوظ كـRollback، وأي خطوة خارجية لاحقة تحتاج موافقة صريحة مستقلة.
