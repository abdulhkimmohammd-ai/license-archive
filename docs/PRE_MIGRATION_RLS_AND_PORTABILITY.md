# تصميم RLS وقابلية النقل قبل Migration

## حدود هذه الوثيقة

هذه الوثيقة تصميمية لمختبر **License Archive – Migration Lab**. لا تنشئ مشروع Supabase، ولا تنفذ SQL على PostgreSQL، ولا تنقل بيانات، ولا تربط Cloudflare أو DNS. وهي تحدد العقد الذي يجب تنفيذه لاحقاً على مشروع Supabase Development/Test منفصل.

## نموذج الأدوار المستهدف

سيكون لكل مستخدم Supabase Auth صف واحد في جدول `app_profiles`، يرتبط بـ`auth.users.id` ويحتوي الدور وحالة الاعتماد. الأدوار هي `admin` و`archivist` و`user`، والحالات هي `pending` و`approved` و`blocked`. لا يكفي إخفاء الأزرار في الواجهة؛ كل سياسة RLS وكل RPC حساس يجب أن يتحقق من الدور والحالة عبر `auth.uid()`.

| القدرة | admin | archivist | user |
|---|---:|---:|---:|
| قراءة السجل والأرشيف | نعم | نعم | لا |
| إنشاء ترخيص أو مزامنة طابور | نعم | نعم | لا |
| تعديل بيانات الترخيص العامة | نعم | لا | لا |
| تجديد الترخيص | نعم | لا | لا |
| تعديل رقم الأرشفة | نعم، عبر RPC فقط | لا | لا |
| إدارة المستخدمين والأدوار | نعم | لا | لا |
| قراءة Audit Log الكامل | نعم | لا | لا |
| حذف/أرشفة/استعادة | نعم، عبر RPC فقط | لا | لا |

## الجداول المستهدفة وسياسات RLS

تفعّل RLS على كل جدول في مخطط `public` مكشوف إلى API. تمنح `anon` صلاحيات صفرية على جميع جداول الأعمال. تمنح `authenticated` أقل الصلاحيات اللازمة، وتترك `service_role` في جهة الخادم فقط ولا تضعه في Vite أو Cloudflare Pages العامة.

| الجدول المستهدف | القراءة | الكتابة المباشرة | القاعدة الإلزامية |
|---|---|---|---|
| `app_profiles` | المستخدم صفه، والمدير جميع الصفوف | لا؛ التغيير عبر دالة إدارية | المدير فقط يغير الدور أو حالة الاعتماد. |
| `licenses` | `admin` و`archivist` المعتمدان | لا للإدخال/التعديل الحساس؛ يستعمل RPC | رقم الأرشفة لا يقبل تحديثاً مباشراً. |
| `archive_sequences` | لا | لا | لا يُكشف؛ لا تلمسه إلا دالة الحجز الذرية. |
| `archive_number_history` | المدير فقط | لا | Append-only؛ لا `UPDATE` ولا `DELETE`. |
| `idempotency_requests` | لا | لا | لا يُكشف؛ تحفظه RPC فقط لمنع إعادة العملية. |
| `audit_logs` و`license_events` | المدير فقط أو عرض أحداث محدود محفوظ | لا | Append-only؛ الكتابة من RPC أو خدمة خادمية معتمدة فقط. |
| `documents` | خارج نطاق Migration الحالي | خارج النطاق | لا يُنشأ تخزين مرفقات في هذه المرحلة. |

## RPC الذرية المقترحة

### `create_license_idempotent(payload, idempotency_key)`

تعمل الدالة داخل معاملة PostgreSQL واحدة. تتحقق أولاً من أن `auth.uid()` يملك دور `admin` أو `archivist` وحالة `approved`. ثم تقفل أو تحدث صف العداد الخاص بالنوع، وتنتج رقم الأرشفة بالصورة `LLLL-NNNNص/م`، وتكتب الترخيص وسجل رقم الأرشفة وسجل الحدث وسجل idempotency في المعاملة نفسها. عند إعادة نفس المفتاح مع نفس بصمة الحمولة، تعيد نتيجة الإنشاء الأصلية؛ وعند إعادة المفتاح مع حمولة مختلفة، ترفض العملية. لا تعتمد الدالة على الرقم المرسل من المتصفح.

### `change_archive_number(license_id, new_archive_number, reason)`

تعمل هذه الدالة للمدير المعتمد فقط. ترفض السبب الفارغ، وتتحقق من شكل الرقم وربطه بآخر أربع خانات من رقم الترخيص ونوع المنشأة، وتتحقق من عدم وجوده في `archive_number_history`. بعدها تحدّث الترخيص، وترفع أرضية العداد عند الحاجة، وتضيف سجل تاريخ رقم الأرشفة وسجل حدث وسجل تدقيق قبل/بعد. لا توجد سياسة `UPDATE` مباشرة تسمح بتغيير `licenses.archive_number`.

### `renew_license(license_id, issue_date, expiry_date, reason)`

تعمل للمدير فقط. تحدث التواريخ والحالة وتسجل الحدث، لكنها لا تستقبل `archive_number` ولا تكتب إليه. يجب أن يكون هذا القيد ضمن الدالة واختباراتها.

عند تنفيذ دالة `SECURITY DEFINER` مستقبلاً، تضبط `search_path` صراحةً، وتتحقق من `auth.uid()` داخلياً، ولا تمنح `EXECUTE` إلا لـ`authenticated`. هذا ضروري لأن دوال `SECURITY DEFINER` يمكن أن تتجاوز RLS إذا صممت بلا حواجز.

## اختبارات RLS المطلوبة

ينفذ المشروع المستقبلي اختبارات SQL/pgTAP أو اختبار تكامل على Supabase Test. يثبت كل اختبار النتيجة المسموح بها والنتيجة المرفوضة لدور مدير وموظف أرشيف ومستخدم عادي وحساب معلق ومحظور. تشمل المصفوفة `SELECT` و`INSERT` و`UPDATE` و`DELETE`، واستدعاءات RPC، ومحاولات استدعاء API المباشر. ويجب أن تتضمن اختباراً يثبت أن المستخدم العادي لا يستطيع تغيير رقم الأرشفة حتى لو استدعى endpoint أو RPC يدوياً.

## عقد Offline Queue وحل التعارض

الطابور الحالي يدعم العملية `create` فقط؛ لا يقبل عمليات تعديل أو تجديد أو تغيير رقم أرشفة من دون اتصال. وبذلك لا توجد عملية Offline يمكنها أن تكتب فوق تعديل أحدث، لأن جميع هذه التعديلات تبقى عمليات خادمية متصلة ومقيدة بالصلاحيات. لكل إنشاء بصمة من `facilityType + licenseNo` لمنع تكرار الإدراج المحلي، ومفتاح `idempotencyKey` ثابت يبقى مع العنصر إلى أن تتلقى الواجهة نتيجة نجاح مؤكدة.

عند عودة الاتصال، يمرر المدير المفتاح نفسه إلى الخادم. يعيد الخادم السجل الأصلي إذا كان المفتاح والبصمة متطابقين، ويرفض إعادة استعمال المفتاح مع حمولة مختلفة. إذا انقطع الرد بعد حفظ الخادم، تظل الرسالة محلياً وتعيد الإرسال بالمفتاح ذاته؛ وبذلك تتحول المحاولة التالية إلى نتيجة idempotent بدلاً من إنشاء سجل ثان. تبقى الرسالة الفاشلة في الطابور مع سبب الفشل ولا تزال قابلة لإعادة المحاولة، ولا تحذف إلا بعد نجاح مؤكد. أما تعارض رقم الترخيص أو التحقق، فيرجع خطأ واضحاً ويحفظ العنصر للمراجعة بدلاً من الكتابة القسرية.

## فصل الاعتمادات الحالية عن MySQL

| الاعتماد الحالي | الموضع | الاستبدال عند النقل |
|---|---|---|
| `drizzle-orm/mysql-core` و`mysqlTable` و`mysqlEnum` | `drizzle/schema.ts` | `drizzle-orm/pg-core` و`pgTable` و`pgEnum` أو SQL PostgreSQL موثق. |
| `drizzle-orm/mysql2` | `server/db.ts` | عميل PostgreSQL متوافق مع البيئة أو `@supabase/supabase-js` داخل Functions. |
| `onDuplicateKeyUpdate` | `server/db.ts` وإجراءات الترخيص | `onConflictDoUpdate` أو RPC PostgreSQL مقفلة ذرياً. |
| `insertId` | إنشاء الترخيص | `RETURNING id` أو نتيجة RPC. |
| `AUTO_INCREMENT` و`ON UPDATE CURRENT_TIMESTAMP` | ترحيلات Drizzle | `generated identity` ومشغل `updated_at`/تحديث صريح. |
| `mysqlEnum` | الأدوار والحالات والأنواع | `pgEnum` أو قيود `CHECK` مع ترحيل ثابت. |

لا يوجد في هذه المرحلة أي تحويل فعلي إلى PostgreSQL؛ هذه قائمة تغييرات مطلوبة قبل بدء مشروع Supabase Development/Test.

## فصل الاعتمادات الحالية عن Express وtRPC

| الاعتماد الحالي | الموضع | المسار المقترح بعد النقل |
|---|---|---|
| خادم HTTP وExpress | `server/_core/index.ts` | واجهة Vite ثابتة على Pages مع Pages Functions/Workers أو خدمة API متوافقة مع Workers. |
| سياق `req` و`res` وجلسة الكوكي | `server/_core/context.ts` و`server/_core/cookies.ts` | JWT Supabase من `Authorization`/Cookies، وسياق `Request` في Workers. |
| محول tRPC Express | `server/_core/trpc.ts` و`server/_core/index.ts` | محول tRPC Fetch متوافق مع Workers أو استبدال العمليات بـSupabase RPC محمية. |
| مهام Heartbeat | `server/_core/heartbeat.ts` | مشغل مجدول منفصل بعد قرار البنية، وليس ضمن Migration الأولي. |

يجوز الاحتفاظ بعقود Zod، ومكونات React، ومنطق PDF/CSV غير المرتبط بالخادم، وقواعد التحقق. أما تشغيل Express نفسه فلا ينقل كما هو إلى Pages Functions.

## الاعتماد المتبقي على Manus

النسخة الحالية ما زالت تستخدم Manus OAuth، ومتغيرات OAuth، وForge/S3 في `server/storage.ts`، ومسار `/manus-storage` لأصول نموذج الوزارة، و`vite-plugin-manus-runtime`، وملفات وقت التشغيل في `server/_core`. لا تستخدم العمليات اليومية الحالية AI/LLM حسب اختبار Zero-AI، لكن يجب إزالة وحدات AI الموروثة أو إبقاؤها خارج مسارات البناء الخارجي عند النقل.

لأن التخزين والمرفقات خارج النطاق، لا ينقل `server/storage.ts` ولا مسارات رفع المستندات إلى المختبر الخارجي. أما أصول الطباعة الوزارية فيجب اعتمادها كأصول ثابتة غير قابلة للتعديل مع اختبارات على المقاس والإحداثيات والنصوص قبل استبدال مسارات `/manus-storage`.

## مراجع التصميم

- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Drizzle: PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new)
