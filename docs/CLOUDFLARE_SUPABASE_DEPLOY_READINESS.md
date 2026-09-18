# CLOUDFLARE + SUPABASE DEPLOY READINESS

## القرار الحالي

الحالة هي **DEPLOY READY preparation** لمسار **Supabase Development + Cloudflare Pages/Workers**، وليست **DEPLOYED**. المصدر قابل للبناء المستقل والمراجعة، لكن Preview الخارجي ما زال مشروطاً بإغلاق اختبارات القبول والأصول الرسمية وموافقة مستقلة. لم تُنقل بيانات Production، ولم يتغير DNS أو Domain، ولم تُنشأ Pages أو Workers.

## ما تم إنجازه

تم فصل entry الخاص بـPages إلى `client/src/main.pages.tsx`، وهو لا يستورد tRPC أو Manus OAuth أو Manus runtime. وضع `cloudflare-preview` في Vite يستخدم هذا entry، بينما يبقى `main.tsx` وExpress/tRPC وMySQL وManus OAuth للمسار Legacy. أضيف تقسيم Supabase vendor لتقليل entry، مع بقاء الصفحات كسولة التحميل.

تم تنفيذ صفحات Supabase المستقلة للمختبر وDashboard والأرشيف والتفاصيل والنموذج والسلة والفريق والدعوات والطباعة وPDF وQR. تستخدم المصادقة Supabase Auth، وتستخدم العمليات الحساسة RPC/RLS/Triggers أو Worker adapter اختياري، ولا تستخدم Service Role Key في الواجهة.

تم توحيد طابور إنشاء Offline في مدير مستقل على مستوى التطبيق. الطابور مرتبط بالمستخدم، يمنع التكرار ببصمة نوع المنشأة ورقم الترخيص، يحافظ على idempotency key، يضع علامة على الفشل مع عدد المحاولات، ويمنع المزامنة المتوازية. العمليات الحساسة غير الإنشائية Online-only عمداً إلى حين تصميم تعارض قابل للدمج.

تم تنفيذ QR محلي للتوليد والمسح بالكاميرا، بحمولة لا تتضمن إلا معرف السجل ورقم الترخيص ورقم الأرشفة. تمت إضافة دعوات الفريق الآمنة مع hash للرمز والقبول والرفض والانتهاء والإلغاء والتدقيق، وتنبيهات داخلية عبر Triggers وRLS للمستلم.

## مصفوفة الحالة

| المجال | الحالة | الملاحظة |
|---|---|---|
| React/Vite/TypeScript | **DONE** | `pnpm check` ناجح، وentry مستقل لـPages.
| Supabase Auth/RLS/RPC | **DONE IN DEVELOPMENT** | حسابات اصطناعية ومخطط Development فقط.
| CRUD والترخيص والأرشفة | **DONE IN DEVELOPMENT** | إنشاء وتعديل وتجديد وأرشفة وتعديل رقم الأرشفة وحذف ناعم واستعادة مع Audit وIdempotency.
| Dashboard/Archive/Details/Team/Trash | **DONE IN INDEPENDENT ENTRY** | لا تمر عبر DashboardLayout أو tRPC في Build Pages.
| Offline/Online | **PARTIALLY DONE** | إنشاء Offline ومزامنة مستقلة مع retry؛ التعديلات الحساسة لا تُخزّن Offline.
| QR | **IMPLEMENTED / ACCEPTANCE PENDING** | التوليد والمسح محليان؛ اختبار كاميرا هاتف فعلي ما زال مطلوباً.
| Notifications | **DONE IN DEVELOPMENT** | Triggers وتنبيهات داخلية ووضع مقروء؛ لا بريد خارجي.
| Team Invitations | **DONE IN DEVELOPMENT** | RPC/RLS/hash/Audit؛ يلزم اختبار قبول تفاعلي.
| Print/PDF/CSV | **DONE WITH ASSET BLOCKER** | القالب محفوظ، لكن صور المراجع التاريخية ما زالت `/manus-storage/...`.
| Worker | **PREVIEW READY SOURCE** | JWT/RLS، RPCs الأساسية، CORS قابل للضبط، حد 64KiB؛ لم يُنشر.
| Pages | **BUILD READY** | `dist/public` يتولد بنجاح وHTML الحالي لا يحمل markers tRPC/Manus.
| Production/DNS/Domain | **UNTOUCHED** | لا Deploy ولا Publish ولا Migration ولا تغيير DNS/Domain.
| Zero-AI | **DONE** | لا AI في العمليات اليومية؛ مثبت بالاختبارات والوثائق.
| Security audit | **PASS** | `pnpm audit --prod`: لا ثغرات معروفة في آخر تشغيل.

## نتائج البوابات الأخيرة

نجح `pnpm check`، ونجحت `pnpm test` بعدد **43 ملفاً و119 اختباراً** بعد تطبيق تعليمات الملف النهائي وإعادة تشغيل المجموعة كاملة. نجح `pnpm build` و`pnpm build:pages`. أظهر Build Pages entry بنحو **444KB** وSupabase vendor بنحو **217KB** وQR في chunk كسول بنحو **42KB**، مع عدم وجود `/api/trpc` أو `__manus__` أو `@trpc/` أو OAuth أو `manus-storage` في مخرج Pages بعد تنظيفه وإعادة بنائه. نجح `pnpm audit --prod` بنتيجة `No known vulnerabilities found`. تم تحديث `exports/project-export.zip` والتحقق من checksum، مع استبعاد `node_modules` و`dist` و`.git` وملفات البيئة المحلية.

## الموانع المتبقية قبل Preview الخارجي

المانع الأول هو اختبار قبول تفاعلي بالحسابات الاصطناعية على Desktop وMobile وRTL، ويشمل loading/error والبحث والفلاتر والأدوار والمدير والمستخدم والمحظور والدعوات والمزامنة. المانع الثاني هو اختبار الكاميرا على هاتف فعلي. المانع الثالث هو استبدال مراجع صور الوزارة التاريخية بأصول مستقلة متاحة في Pages أو R2 دون إدخالها في File Storage للمرفقات. المانع الرابع هو ضبط متغيرات بيئة Preview و`ALLOWED_ORIGIN` خارج المصدر ومراجعة rate limiting والمراقبة قبل فتح Worker للعامة.

> تفعيل حماية كلمات المرور المسربة في Supabase Development **اختياري ومعلق** لأن المشروع على Free plan؛ لم تتم ترقية المشروع، وبقية إعدادات المصادقة الأمنية باقية.

## قرار النشر

القرار الحالي: **ليس جاهزاً للموافقة على Preview الخارجي بعد** بسبب الموانع الأربعة أعلاه، لكنه **جاهز تقنياً للمراجعة المحلية وبناء Pages**. لا يجوز تنفيذ أي Deploy أو Publish أو Migration أو ربط Domain أو تغيير DNS قبل موافقة صريحة مستقلة بعد مراجعة هذه النتائج.
