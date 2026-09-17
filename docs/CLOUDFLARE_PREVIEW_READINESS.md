# Cloudflare Preview Readiness — Migration Lab

هذه الوثيقة تصف متطلبات **Preview مستقبلية فقط** لنسخة Migration Lab. لم تُنشأ Pages أو Workers، ولم يُنفذ Deploy أو Publish أو تعديل DNS أو Domain.

## Pages

| الإعداد | القيمة المقترحة في Preview | الحالة الحالية |
|---|---|---|
| Framework | Vite/React static build | جاهز من خلال `pnpm build` |
| Build command | `pnpm build` | موثق فقط، غير منفذ عبر Cloudflare |
| Output directory | `dist/public` | موثق في `cloudflare/wrangler.toml.example` |
| Node version | نسخة متوافقة مع lockfile | يجب تثبيتها في إعداد Preview قبل الإنشاء |
| API origin | Worker Preview URL فقط | غير مضبوط |
| Domain/DNS | لا شيء | ممنوع حالياً |

## Workers

يستخدم Worker الموجود في `workers/src/index.ts` قائمة RPC صريحة ويمرر JWT المستخدم إلى Supabase Development. لا يحتوي المصدر على Service Role Key. قبل Preview يجب إضافة حدود حجم الطلب، وrate limiting، والتحقق من CORS مع أصل Preview ثابت، ثم اختبار كل endpoint بحسابات اصطناعية.

يجب ضبط المتغيرات السرية عبر مدير أسرار Cloudflare في مشروع Preview منفصل، وليس في المصدر أو ملفات `.env`:

| المتغير | مكانه | الغرض |
|---|---|---|
| `SUPABASE_URL` | Worker secret | عنوان Supabase Development فقط |
| `SUPABASE_ANON_KEY` | Worker secret | المفتاح العام المسموح به مع JWT المستخدم |
| `ALLOWED_ORIGIN` | Worker variable | أصل Pages Preview المحدد |
| `VITE_SUPABASE_DEVELOPMENT_URL` | Pages variable | عنوان Supabase Development للواجهة |
| `VITE_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY` | Pages variable | المفتاح القابل للنشر للواجهة |

## بوابة الموافقة

لا يجوز الانتقال من القوالب إلى إنشاء موارد Cloudflare إلا بعد اكتمال التصدير والطباعة الرسمية وQR وOffline/Online والتنبيهات ودعوات الفريق، وبعد موافقة مستقلة صريحة. كما لا يجوز استبدال Manus OAuth أو مسار MySQL في النسخة الحالية إلا بعد وجود نسخة مستقلة كاملة قابلة للرجوع واختبار قبول مصادق عليه.
