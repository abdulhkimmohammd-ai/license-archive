# مصفوفة اختبارات النقل — Migration Lab

**النطاق:** Local وSupabase Development بحسابات وبيانات اصطناعية فقط. لا تمثل هذه النتائج موافقة على Preview خارجي أو Production.

| الوظيفة | Legacy | Supabase Development | Worker | حالة الاختبار | النتيجة والملاحظة |
|---|---|---|---|---|---|
| Authentication/session | Manus OAuth | Supabase Auth + JWT | Bearer verification | ناجح جزئياً | دخول المختبر وجلسة JWT ناجحان؛ Manus OAuth ما زال Legacy. |
| RLS والأدوار | حماية tRPC | RLS وRPC role checks | يمرر JWT ولا يستخدم Service Role | ناجح | المستخدم العادي مرفوض في العمليات الإدارية بحساب اصطناعي. |
| Dashboard | MySQL/tRPC | `dashboard_operational` | allowlist موجود | ناجح | RPC والواجهة المستقلة يعملان ضمن النطاق المنقول. |
| قائمة التراخيص | MySQL/tRPC | `list_operational_licenses` | allowlist موجود | ناجح | بحث وترقيم وفرز وفلترة نوع/حالة. |
| فلاتر تاريخ الأرشفة | MySQL/tRPC | RPC date filters | allowlist موجود | ناجح | تحقق ترتيب التاريخ واختبار تكامل اصطناعي. |
| إنشاء ترخيص | MySQL/tRPC + Offline Legacy | idempotent RPC | allowlist موجود | ناجح جزئياً | الإنشاء Online ناجح؛ Offline التشغيلي الموسع مؤجل. |
| تعديل الترخيص | MySQL/tRPC | `update_license_details` | allowlist موجود | ناجح | التحقق والـRLS والتدقيق ضمن الجسر. |
| التجديد | MySQL/tRPC | `renew_license` | allowlist موجود | ناجح | لا يغير رقم الأرشفة. |
| تعديل رقم الأرشفة | MySQL/tRPC | `change_archive_number` | allowlist موجود | ناجح | مدير فقط، سبب إلزامي، Audit، ومنع التكرار وإعادة الاستخدام. |
| الأرشفة | MySQL/tRPC | `archive_license` | allowlist موجود | ناجح جزئياً | RPC موجود واختبارات Development؛ اختبار قبول واجهة موسع مطلوب. |
| الحذف الناعم | MySQL/tRPC | `move_license_to_trash` | allowlist موجود | ناجح جزئياً | المسار المستقل والسلة موجودان؛ اختبار قبول واجهة موسع مطلوب. |
| الاستعادة والسلة | MySQL/tRPC | `restore_license_from_trash` | allowlist موجود | ناجح جزئياً | RPC وصفحة السلة موجودان؛ التحقق التفاعلي الكامل مطلوب. |
| Audit Log وEvents | MySQL/tRPC | جداول محمية | ليس عبر Worker بعد | ناجح داخل الجسر | القراءة محمية؛ Worker يحتاج endpoints مستقلة قبل الاستقلال الكامل. |
| إدارة الفريق | MySQL/tRPC | RPC مدير + صفحة مستقلة | RPC role allowlist | ناجح جزئياً | الأدوار والحالة ومنع آخر مدير واختبار الرفض ناجحة؛ الدعوات مؤجلة. |
| التنبيهات | MySQL/Manus محتمل | مخطط Development جزئي | غير متاح | مؤجل | الإنشاء/القراءة/المقروء غير منقولة بالكامل. |
| CSV | MySQL/tRPC | توليد عميل من نتائج Supabase | ليس endpoint مستقلاً | ناجح | لا AI ولا خدمة خارجية؛ يحتاج قبول واجهة مصادقاً عليه. |
| PDF والطباعة | MySQL/tRPC | نفس محول وقالب الوزارة | ليس endpoint مستقلاً | ناجح جزئياً | PDF/Print انتقاليان؛ QR داخل القالب غير منقول. |
| QR | Legacy | غير منقول | غير متاح | مؤجل | إنشاء/قراءة/عدم تكرار/Offline لم تُثبت في المسار الجديد. |
| Offline → Online | Legacy Queue | helper محدود للإنشاء | غير منقول | ناجح للمختبر فقط | لا يوجد sync executor تشغيلي كامل ولا حل تعارض موسع. |
| PWA وRTL وMobile | Manus runtime محلي | Build Pages مستقل | غير منطبق | ناجح بصرياً | Desktop 1280×720 وMobile 375×812؛ قبول تفاعلي كامل مطلوب. |
| Build Pages | Vite + plugin محلي | `pnpm build:pages` | غير منطبق | ناجح | المخرج `dist/public`، وHTML لا يحمل تحليلات Manus. |
| Security dependencies | pnpm | pnpm | Worker contract | ناجح مع ملاحظة | `pnpm audit --prod` نظيف؛ تحذير pnpm config صيانة غير مانعة. |

## بوابة الاختبارات الأخيرة

نجحت `pnpm check` و`pnpm test` بعدد **38 ملفاً و109 اختبارات**، ونجح `pnpm build` و`pnpm build:pages`، كما نجح `pnpm audit --prod` بنتيجة `No known vulnerabilities found`. اختبار Browser Offline واختبار قيود المستخدم العادي نجحا بعد إصلاح Vite ومسار JWT.

## معيار الإغلاق

لا تعتبر المصفوفة المشروع مستقلاً بالكامل قبل نجاح صفوف Offline/Online وQR والتنبيهات ودعوات الفريق وقراءة الأحداث عبر Worker واختبار القبول المصادق عليه من الواجهة. جميع الاختبارات تستخدم Development وبيانات اصطناعية فقط.
