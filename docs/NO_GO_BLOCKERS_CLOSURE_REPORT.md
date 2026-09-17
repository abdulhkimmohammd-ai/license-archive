# License Archive Development — تقرير إغلاق موانع NO-GO

**التاريخ:** 22 أغسطس 2026  
**النطاق:** License Archive Development وSupabase Development (`qduofealtaikxhhrjxly`) وفحص Cloudflare الاستطلاعي فقط.  
**قرار النشر:** **لا نشر ولا ترحيل إلى Production في هذه المرحلة.**

> لم يُنفذ أي Deploy أو Publish أو Migration إلى Production، ولم تُنقل بيانات حقيقية أو تُحذف، ولم يُعدّل DNS أو Domain أو Cloudflare Production. كل الاتصالات والاختبارات استهدفت بيئة Development أو حساب Cloudflare عبر استعلامات `GET` فقط.

## الخلاصة التنفيذية

أُغلقت الموانع التقنية التي كانت تمنع التحقق من المختبر: أنشئت واجهة مختبر مستقلة تتصل بـSupabase Development بجلسة مستخدم وRLS، وعولجت ثغرات التبعيات إلى أن أصبح `pnpm audit --prod` نظيفاً، واختُبرت العمليات الحساسة بـRPC وIdempotency وAudit Log وحسابات اصطناعية فقط. كما اكتمل فحص Cloudflare الاستطلاعي دون إنشاء أي مورد أو نشر.

لكن هذا **ليس تصريح نشر**. صفحات التطبيق التشغيلية القديمة ما زالت مرتبطة بمسار MySQL/tRPC؛ صفحة المختبر الجديدة هي مسار انتقال معزول في `/migration-lab/supabase`. كذلك لا يوجد مشروع Pages أو Worker قائم، ولم يُنفذ اختبار انقطاع شبكة يدوي من متصفح مع Service Worker. لذلك الحالة المناسبة هي **جاهزية تقنية مشروطة للمرحلة التالية، وعدم جاهزية لأي نشر أو Migration إلى Production**.

| النتيجة | الحالة |
|---|---|
| التحقق من Supabase Development وCRUD/RLS/RPC | مكتمل |
| حساب اختبار اصطناعي ومصادقة آمنة | مكتمل |
| اختبار Offline→Online/Idempotency متصفحي | مكتمل بفصل شبكة فعلي ثم مزامنة آمنة |
| `pnpm audit --prod` | لا ثغرات معروفة |
| فحص Cloudflare Pages/Workers | مكتمل استعلامياً؛ لا توجد مشاريع أو Workers |
| نشر أو Cloudflare Deployment | غير منفذ عمداً |
| Migration أو بيانات Production | غير منفذ عمداً |

## حالة الموانع قبل وبعد

| المانع السابق | الحالة قبل الإصلاح | ما تم عمله | الحالة بعد الإصلاح |
|---|---|---|---|
| ربط الواجهة بـSupabase | الواجهة تعتمد Express/tRPC/MySQL فقط | إضافة عميل Supabase عام آمن، وجسر tRPC يمرر JWT المستخدم، وصفحة عربية معزولة للمختبر تشمل البحث والإنشاء والتعديل وتعديل رقم الأرشفة والتجديد والأرشفة والسلة والاستعادة | **مكتمل لمسار المختبر**؛ الصفحات التشغيلية القديمة لم تتحول بعد |
| CRUD وسلامة رقم الأرشفة | طبقة Supabase الأصلية لم تشمل تعديل التفاصيل أو السلة | ترحيلا Development `20260822209000` و`20260822209100` يضيفان إجراء تعديل مقيداً، حذفاً ناعماً واستعادةً وسلة للمدير، مع بقاء رقم الأرشفة خارج حمولة التعديل العادي | **مكتمل ومختبر** |
| Offline/Online مع مصادقة | رفض Auth سابقاً عناوين اختبار اصطناعية | إنشاء حسابات اصطناعية مؤكدة من الخادم، اختبار JWT وRLS، وطابور متصفح منفصل مع فصل الشبكة ثم مزامنة العنصر بعد عودتها بالمفتاح نفسه | **مكتمل آلياً ومتصفحياً** |
| حماية كلمات المرور المسربة | تحذير Supabase مفعل كمانع في التقرير السابق | فحص الوثائق وإعدادات المشروع؛ أكد المستخدم أن المشروع Free وأن الميزة Pro-only ولا يوافق على ترقية | **قيد اختياري مقبول لبيئة Development**؛ التحذير يبقى متوقعاً |
| ثغرات الإنتاج | 1 حرجة، 21 عالية، 49 متوسطة، 10 منخفضة | تطبيق إصلاحات الحزم، ترقية tRPC وAxios وDrizzle، وترقية Express لمعالجة تعارض `path-to-regexp` | **مكتمل:** لا ثغرات معروفة في `pnpm audit --prod` |
| تعطل الخادم بعد إصلاحات audit | Express 4 لم يكن متوافقاً مع `path-to-regexp@8` المفروض أمنياً | ترقية Express إلى 5.2.1 وأنواعه إلى 5.0.6، وتحديث wildcard للتخزين إلى `*key` ولمسارات Vite إلى `/{*splat}` | **مكتمل:** خادم Development يعيد `200` للمسار الجذري |
| Cloudflare readiness | موصل Cloudflare معطل ولا توجد معلومات | تفعيل موصل واحد للفحص فقط، واستعلام GET عن الحساب وPages وWorkers | **مكتمل استعلامياً:** صفر Pages وصفر Workers؛ لم يُنشأ شيء |

## ما تم تنفيذه في المختبر

### واجهة ومسار Supabase Development

أضيف مسار مستقل هو `/migration-lab/supabase` حتى لا يُستبدل السلوك التشغيلي القديم من دون موافقة. تستخدم الصفحة مفتاحاً عاماً للمتصفح فقط، بينما يحتفظ الخادم بمفتاح Development الخادمي ولا يرسله مطلقاً إلى متغيرات `VITE_*`. وينقل جسر `supabaseLicenses` رمز JWT الخاص بالمستخدم إلى Supabase؛ فلا تعمل RLS كتحقق شكلي داخل الخادم، بل على طلب المستخدم نفسه.[1](../client/src/pages/SupabaseDevelopmentLab.tsx) [2](../server/routers/supabaseLicenses.ts) [3](../server/supabaseDevelopment.ts)

يتضمن المسار إنشاء ترخيص برقم يدوي ورقم أرشفة مولد في RPC، والبحث، والتعديل المقيد لبيانات الترخيص، والأرشفة، وتغيير رقم الأرشفة للمدير مع سبب، والحذف الناعم والاستعادة. أضيفت سياسات تعرض السجل التشغيلي لموظف الأرشيف/المدير، وتعرض السلة للمدير فقط.[4](../supabase/migrations/20260822209000_add_development_crud_workflow.sql) [5](../supabase/migrations/20260822209100_allow_admin_trash_read.sql)

### المصادقة والصلاحيات وOffline/Online

اختبرت مصادقة Supabase بحسابات اصطناعية مولدة ومؤكدة آلياً، من دون أي بريد أو حساب بشري. يؤكد اختبار Round Trip أن رمز JWT يصل إلى قاعدة البيانات وأن الملف الشخصي المقيد بـRLS يظهر لصاحبه فقط. ويؤكد اختبار المستخدم العادي أن قراءة التراخيص تعيد قائمة فارغة، وأن الكتابة المباشرة تُرفض برمز `42501`، وأن محاولة تغيير رقم الأرشفة تُرفض بصلاحية `FORBIDDEN`.[6](../server/supabaseSafeAuthRoundTrip.test.ts) [7](../server/supabaseNormalUserRestrictions.integration.test.ts)

يحاكي اختبار CRUD حساب مدير اصطناعي: يحتفظ بعملية إنشاء قبل الإرسال، يرسلها بعد عودة الاتصال، ثم يعيد الإرسال بالمفتاح والبصمة نفسيهما. أعادت RPC السجل نفسه ولم تنشئ نسخة ثانية. ويختبر السيناريو كذلك البحث والتعديل مع ثبات رقم الأرشفة والسلة والاستعادة والأرشفة ورفض تجديد سجل مؤرشف وسجل التدقيق.[8](../server/supabaseDevelopmentCrud.integration.test.ts)

وأضيف اختبار Playwright فعلي لمسار `/migration-lab/supabase`: يسجل دخول حساب مدير اصطناعي، يفصل شبكة Chromium، يملأ نموذجاً حقيقياً ويحفظه في `localStorage`، ثم يعيد الشبكة ويطلق حدث `online` (لأن Playwright لا يطلقه باستمرار مع تبديل النقل) ويتحقق عبر قاعدة Development من وجود سجل واحد فقط. بذلك يغطي الدليل واجهة المتصفح والطابور واسترجاع الاتصال وIdempotency، من دون أي حساب بشري أو بيانات Production.[9](../server/supabaseDevelopmentBrowserOffline.integration.test.ts)

### حماية كلمات المرور المسربة

ما زال مستشار Supabase يعرض `auth_leaked_password_protection` كتحذير. وفق قرار المستخدم، لا تُرقّى خطة المشروع ولا يُطلب تفعيل هذه الميزة؛ لذلك تعامل كخاصية اختيارية غير متاحة في Development Free، لا كثغرة متجاهلة. وتبقى الضوابط الأخرى فعالة: مصادقة JWT، RLS، أدوار `admin`/`archivist`/`user`، حالة الموافقة، ورفض الكتابة المباشرة.[9](https://supabase.com/docs/guides/auth/password-security)

تبقى سبعة تحذيرات `SECURITY DEFINER` لدوال الأعمال. وهي تحذيرات معمارية مقصودة لأن الدوال يجب أن تكون قابلة للاستدعاء بواسطة مستخدم مصادق عليه؛ كل منها يتحقق داخلياً من الهوية والدور وحالة الحساب، واختبارات المستخدم العادي تثبت الرفض. لا ينبغي سحب `EXECUTE` عنها من دون استبدال مسار الأعمال؛ ذلك سيكسر الوظائف بدلاً من تحسين الحماية.[10](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)

### التبعيات والأمان

قبل الإصلاح كان التدقيق يسجل 81 ثغرة، منها واحدة حرجة و21 عالية. نفذت `pnpm audit --fix --prod` ثم ثُبتت الحزم. التحديث الأمني كشف تعارضاً: فرض مسار `path-to-regexp` الآمن مع Express 4 أوقف الخادم. عولج بأمان عبر Express 5 وتحديث صيغة wildcard، ثم أعيدت جميع الاختبارات والبناء وفحص تشغيل الخادم.[11](../server/_core/storageProxy.ts) [12](../server/_core/vite.ts)

| حزمة أو مسار | قبل | بعد | الحالة |
|---|---:|---:|---|
| `@trpc/server` | 11.6.0 | 11.18.0 | محدث |
| `axios` | 1.12.2 | 1.19.0 | محدث |
| `drizzle-orm` | 0.44.6 | 0.45.2 | محدث |
| `express` | 4.21.2 | 5.2.1 | محدث ومتوافق |
| `@types/express` | 4.17.21 | 5.0.6 | محدث |
| `fast-xml-parser` عبر AWS SDK | متأثر | حلته قيود lockfile | لا ثغرات معروفة |

نتيجة التدقيق النهائي هي: `No known vulnerabilities found`. لا توجد حزمة متبقية ذات شدة حرجة أو عالية تتطلب استثناء. يبقى تحذير أدوات pnpm بأن حقول `pnpm.patchedDependencies` و`pnpm.overrides` يُفضل نقلها إلى إعداد مساحة عمل معتمد في صيانة لاحقة؛ لكنه لا يغير نتيجة التدقيق النهائية الحالية أو lockfile المثبت. عولج حجم حزمة البداية بتأجيل الصفحات وتقسيم vendor؛ فأصبح ملف JavaScript الرئيسي `478.18 kB` بعد التصغير (`143.16 kB` gzip)، مع بقاء حزم الطباعة والمختبر الثقيلة مؤجلة إلى المسارات التي تحتاجها.

### فحص Cloudflare الاستطلاعي

فعّل موصل Cloudflare واحد فقط للمراجعة، ثم استخدمت طلبات `GET` فقط. نجح الاتصال OAuth، وأعاد الحساب استجابة `200`. قائمة Pages فارغة (`0` مشروعاً) وقائمة Workers فارغة (`0` Worker)، لذلك لا يوجد حالياً هدف نشر أو Function قائم في الحساب. لم يُستعلم DNS أو Domains ولم يُغيّر أي مورد.[13](CLOUDFLARE_READ_ONLY_READINESS_CHECK.md)

| بند Cloudflare | الحالة | الإجراء المقترح قبل أي نشر مستقبلي |
|---|---|---|
| Pages | لا يوجد مشروع | موافقة مستقلة لإنشاء مشروع Development باسم جديد |
| Workers | لا يوجد Worker | فصل خادم Express أو بناء Functions متوافقة مع Workers أولاً |
| DNS / Domain | غير ملموس | يبقى محظوراً حتى موافقة صريحة منفصلة |
| Production | غير ملموس | يبقى محظوراً |

## النتائج النهائية للأوامر والاختبارات

| الفحص | النتيجة النهائية |
|---|---|
| `pnpm check` | ناجح |
| `pnpm test` | **37** ملف اختبار و**104** اختبارات ناجحة |
| `pnpm build` | ناجح؛ حزمة البداية `478.18 kB` بعد التصغير؛ الحزم الثقيلة مؤجلة |
| `pnpm audit --prod` | ناجح؛ لا ثغرات معروفة |
| اختبار خادم Express محلياً | `/` يعيد `200` |
| Supabase admin credential | ناجح، قراءة إدارية محدودة |
| Supabase browser publishable key | ناجح، لا مفتاح خادم في العميل |
| RLS مستخدم عادي | ناجح، قراءة صفر وكتابة مباشرة مرفوضة |
| CRUD/RPC/Audit/Idempotency | ناجح بحساب مدير اصطناعي |
| Offline/Online المتصفحي | ناجح؛ عنصر واحد حُفظ Offline ثم زامن بعد عودة الشبكة |
| Cloudflare GET-only check | ناجح؛ لا Pages أو Workers موجودة |

## ما بقي قبل أي طلب نشر جديد

لا توجد ثغرات تبعيات حرجة أو عالية غير معالجة. لكن لا يزال الانتقال كاملاً أو النشر غير معتمدين للأسباب التالية:

| الحالة المتبقية | درجة الأثر | الإجراء المطلوب |
|---|---|---|
| صفحات التشغيل الرئيسية ما زالت MySQL/tRPC | عالٍ لمرحلة النقل الكامل | نقل كل صفحة/تدفق إلى Supabase أو اعتماد مختبر المسار الجديد كمرحلة تجريبية مستقلة فقط |
| لا يوجد مشروع Pages/Worker | عالٍ للنشر على Cloudflare | موافقة مستقلة لإنشاء بنية Development فقط، بعد تصميم Functions بدلاً من Express كما هو |
| حماية كلمات المرور المسربة | اختياري في Development Free | لا إجراء مطلوب وفق قرار المستخدم؛ يعاد تقييمه فقط إذا تغيرت الخطة أو كانت بيئة الإطلاق تستدعيه |
| تحقق التفاعل اليدوي الشامل لحالات الخطأ والتحميل والفلاتر | متوسط للقبول التشغيلي | تنفيذ جلسة قبول يدوية/آلية مستقلة قبل أي نشر مستقبلي |
| إعدادات pnpm القديمة | منخفض للصيانة | نقل overrides/patches إلى إعداد مساحة عمل مدعوم في تنظيف تقني لاحق |

## القرار

### تحديث 25 أغسطس 2026 — شريحة التطبيق التشغيلي الانتقالية

نُفذت شريحة انتقال صريحة فوق التطبيق الرئيسي، من دون استبدال مسار MySQL/tRPC الافتراضي. المسار `/licenses?backend=supabase-development` يستدعي الآن قائمة Supabase المرقمة والبحث والفلاتر، ويوجه نموذج الإضافة نفسه إلى RPC تشغيلي عند تشغيله بالمعامل الصريح. كما أضيفت صفحة تفاصيل وسلة منفصلتان لـSupabase Development لتعديل البيانات وتجديد الترخيص وتغيير رقم الأرشفة والأرشفة والحذف الناعم والاستعادة، مع سجلي الأحداث والتدقيق. تمنع هذه الصفحات المرفقات وOffline غير المنقولين، ولا تستخدم الطباعة أو PDF أو نموذج الوزارة قبل اختبار نقلها مستقلاً.[15] [16] [17]

أضاف Migration `20260825143000_operational_parity_read_foundation.sql` الحقول التشغيلية الناقصة وقيود التواريخ وفهارس القراءة وإجراءات إنشاء وقائمة مرقمة مع تحققات داخل قاعدة البيانات. اختبرت هذه الإضافات بحسابات اصطناعية، بما فيها رفض المستخدم العادي للإنشاء التشغيلي والقائمة وتغيير رقم الأرشفة. صارت نتيجة التحقق النهائي **37 ملف اختبار و106 اختبارات ناجحة**، و`pnpm check` و`pnpm build` و`pnpm audit --prod` ناجحة؛ تبلغ حزمة البداية الآن `479.04 kB` و`143.31 kB` gzip.[18] [19]

هذا التحديث لا يغيّر القرار: ما زال MySQL/tRPC قائماً، ولوحة التحكم والأرشيف والتصدير والطباعة وPDF وQR وإدارة المستخدمين وطابور Offline للتطبيق الأساسي لم تنتقل بعد. ولم ينشأ أي Pages أو Worker أو Deployment أو تغيير DNS/Domain أو عملية Production.

> **تم إغلاق موانع المختبر القابلة للإصلاح: الاتصال بـSupabase Development، اختبار CRUD/RLS/RPC/Triggers/Idempotency/Audit، الحسابات الاصطناعية، وتدقيق التبعيات.**

> **يبقى قرار النشر أو Cloudflare Deploy أو Production Migration = NO-GO إلى حين موافقة مستقلة جديدة.** لا توجد عملية نشر مخططة أو منفذة ضمن هذا التقرير.

## المراجع

[1]: ../client/src/pages/SupabaseDevelopmentLab.tsx "واجهة مختبر Supabase Development"
[2]: ../server/routers/supabaseLicenses.ts "جسر عمليات التراخيص عبر JWT وRPC"
[3]: ../server/supabaseDevelopment.ts "حاجز مشروع Supabase Development ومفاتيح الخادم"
[4]: ../supabase/migrations/20260822209000_add_development_crud_workflow.sql "CRUD آمن والحذف الناعم"
[5]: ../supabase/migrations/20260822209100_allow_admin_trash_read.sql "سياسة سلة المدير"
[6]: ../server/supabaseSafeAuthRoundTrip.test.ts "تحقق مصادقة حساب اصطناعي"
[7]: ../server/supabaseNormalUserRestrictions.integration.test.ts "تحقق RLS وصلاحيات المستخدم العادي"
[8]: ../server/supabaseDevelopmentCrud.integration.test.ts "CRUD وIdempotency وAudit بحساب اصطناعي"
[9]: ../server/supabaseDevelopmentBrowserOffline.integration.test.ts "اختبار Playwright لمسار Offline/Online"
[10]: https://supabase.com/docs/guides/auth/password-security "Supabase Password Security"
[11]: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable "Supabase SECURITY DEFINER linter"
[12]: ../server/_core/storageProxy.ts "مسار Storage Proxy المتوافق مع Express 5"
[13]: ../server/_core/vite.ts "مسارات Vite/Static fallback المتوافقة مع Express 5"
[14]: CLOUDFLARE_READ_ONLY_READINESS_CHECK.md "فحص Cloudflare الاستطلاعي"
[15]: ../docs/OPERATIONAL_SUPABASE_DEVELOPMENT_VALIDATION_2026-08-25.md "تقرير التحقق التشغيلي من Supabase Development"
[16]: ../client/src/pages/SupabaseOperationalLicenseDetails.tsx "صفحة التفاصيل والإجراءات التجريبية"
[17]: ../client/src/pages/SupabaseOperationalTrash.tsx "سلة Supabase Development التجريبية"
[18]: ../supabase/migrations/20260825143000_operational_parity_read_foundation.sql "تكافؤ المخطط والقراءة التشغيلية"
[19]: ../server/supabaseDevelopmentCrud.integration.test.ts "اختبار CRUD التشغيلي وAudit"
