# تعليمات الاستعادة — Supabase Development

هذه التعليمات تخص **Development فقط**. لا تستخدمها على Production ولا تستبدل بيانات حقيقية أو تعيد توجيه نطاقات أو تنفذ نشر.

## نقطة الاستعادة المحلية

أنشئت نقطة استعادة قبل Migration التشغيلي في المسار التالي خارج مجلد المشروع:

| العنصر | القيمة |
|---|---|
| الأرشيف | `/home/ubuntu/license-archive-migration-restore/license-archive-development-pre-supabase-operational-migration-2026-08-25.tar.gz` |
| SHA-256 | `d6f8b86f445f6351a74a111dce306939f03f01d9e651c6ee6f57140e49a14a9c` |
| سجل حالة Git | `/home/ubuntu/license-archive-migration-restore/license-archive-development-pre-supabase-operational-migration-2026-08-25.git-status.txt` |

الأرشيف يستبعد `node_modules` و`dist` و`.git` وملفات البيئة والأسرار وملفات الاستعلام المؤقتة. راجع قيمة SHA-256 قبل استخدامه.

## الرجوع عن تغييرات الواجهة أو الخادم

لا تستخدم `git reset --hard`. إن أُنشئت نقطة إصدار مستقرة وغير منشورة لاحقاً، استخدم مسار الاستعادة المخصص للمنصة. أما ضمن Development المحلي، فاستخرج الأرشيف إلى مجلد عمل جديد، راجع الفرق، ثم انقل فقط الملفات التي ثبت أنها السبب. لا تنسخ ملفات البيئة أو أسرار Supabase.

## الرجوع عن Migration Supabase Development

لا يوجد تنفيذ تلقائي لرجوع DDL. إذا لزم إلغاء الشريحة التشغيلية، نفذ أولاً الاستعادة المنطقية في الكود عبر إبقاء مسار `/licenses` الافتراضي على MySQL/tRPC، ثم صمم Migration عكسيًا منفصلاً يراجع الاعتمادات قبل إسقاط أي دالة أو فهرس أو قيد. لا تحذف جداول أو سجلات اختبار أو تاريخ أرقام أرشفة إلا بموافقة مستقلة.

> قيد تاريخ الترخيص والحقول الجديدة آمنة في Development، لكن أي Migration عكسي يجب أن يفحص التبعيات قبل التطبيق.

## مسار الطوارئ التشغيلي

عند ظهور خطأ في وضع Supabase Development، أزل معامل `backend=supabase-development` أو عُد إلى `/licenses`. يبقى مسار MySQL/tRPC الأساسي مستقلاً وغير معدّل. لا تحول هذا الإجراء إلى Production ولا تغير DNS أو Domain.
