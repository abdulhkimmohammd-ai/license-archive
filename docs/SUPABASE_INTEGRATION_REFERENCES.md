# مراجع التكامل مع Supabase

## المراجع الرسمية

- [JavaScript Client Library](https://supabase.com/docs/reference/javascript/initializing): توثق تثبيت `@supabase/supabase-js`، واستخدام عميل JavaScript، واشتراط تفعيل RLS وصلاحيات Data API المناسبة قبل منح الوصول للجداول أو الدوال.
- [JavaScript RPC Reference](https://supabase.com/docs/reference/javascript/rpc): توثق استدعاء دوال PostgreSQL عبر `rpc` مع تقييد التنفيذ بالصلاحيات الممنوحة وRLS.
- [Creating a Supabase client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client): توضح استخدام عميل خادم لكل طلب والتحقق من الهوية عبر `getClaims()` بدلاً من الوثوق بـ`getSession()` داخل الخادم.
- [Password security](https://supabase.com/docs/guides/auth/password-security): توضح أن حماية كلمات المرور المسربة تُضبط من **Authentication → Auth settings** وأنها تعتمد على خدمة Pwned Passwords؛ وتذكر الوثيقة أنها متاحة في خطة Pro أو أعلى.

## قرار التطبيق في المختبر

سيبقى مفتاح الخادم في بيئة الخادم فقط، ولن يضاف إلى متغيرات `VITE_*` أو إلى المستودع. ستُبنى عمليات الإنشاء الحساسة على دوال RPC القائمة، مع إرسال رمز المستخدم المصادق عليه حيثما يلزم، والحفاظ على RLS والتحقق الداخلي من الأدوار.

تبيّن أن أداة الإدارة المتاحة للمختبر لا تعرض عملية تغيير إعدادات Auth الخاصة بحماية كلمات المرور المسربة. لذلك لا يُفترض تفعيلها برمجياً أو الادعاء بذلك؛ يلزم التحقق من الإعداد داخل لوحة Supabase، كما أن توفره مرتبط بخطة المشروع وفق الوثيقة الرسمية.
