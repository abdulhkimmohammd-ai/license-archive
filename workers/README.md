# License Archive Worker — Deployment-ready scaffold

هذا Worker هو طبقة API مستقبلية للنسخة المستقلة. يمرر فقط RPCs المسموح بها إلى Supabase مع `Authorization: Bearer <Supabase access token>` و`apikey` العام، وبذلك تبقى قرارات الدور وRLS داخل قاعدة البيانات. لا يستخدم Service Role Key ولا يحتوي على أسرار في المصدر.

## التشغيل والنشر

القالب جاهز للمراجعة فقط. لم يُنفذ `wrangler deploy` ولم تُنشأ Worker أو Pages. قبل أي تشغيل يجب ضبط أسرار البيئة في Cloudflare، وتحديد `ALLOWED_ORIGIN` بدلاً من الاعتماد على قيمة CORS عامة، ثم اختبار مسارات login/logout وRLS بالحسابات الاصطناعية في بيئة Preview منفصلة.

## المسارات المسموحة

`POST /api/licenses/rpc/list_operational_licenses` و`dashboard_operational` و`list_team_members` و`set_team_role` و`set_team_access_status` وعمليات الإنشاء والتعديل والتجديد وتغيير رقم الأرشفة والأرشفة والحذف الناعم والاستعادة. أي مسار آخر يعيد 404، وأي طريقة غير POST تعيد 405، وغياب Bearer token يعيد 401.

## ملاحظة معمارية

لا يرسل Worker مفتاح Service Role إلى العميل، ولا يتولى قرار المدير بنفسه؛ يمرر JWT المستخدم إلى Supabase حتى تطبق RLS وRPC والتحقق من الدور داخل قاعدة البيانات. يجب لاحقاً إضافة حدود حجم الطلب، ومراقبة rate limit، واختبار CSRF/CORS مع نطاق Preview محدد قبل نشره.
