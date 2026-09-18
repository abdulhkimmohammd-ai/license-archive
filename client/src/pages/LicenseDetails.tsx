import { useAuth } from "@/_core/hooks/useAuth";
import { LicenseAdminActions } from "@/components/LicenseAdminActions";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { documentTypeMap, documentTypes, facilityTypeMap, formatDate, statusMap } from "@/lib/licenses";
import { displayOptional, formatOptionalDate } from "@/lib/licensePresentation";
import { trpc } from "@/lib/trpc";
import { Archive, ArrowRight, CalendarDays, Download, Eye, FileText, Loader2, MapPin, Pencil, Printer, ShieldAlert, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

const actions = {
  CREATE_LICENSE: "إضافة الترخيص",
  UPDATE_LICENSE: "تعديل الترخيص",
  VIEW_LICENSE: "عرض الترخيص",
  UPLOAD_DOCUMENT: "رفع مستند",
  VIEW_DOCUMENT: "عرض مستند",
  EXPORT_LICENSES: "تصدير التراخيص",
  ARCHIVE_LICENSE: "أرشفة الترخيص",
  MOVE_LICENSE_TO_TRASH: "نقل إلى سلة المحذوفات",
  RESTORE_LICENSE_FROM_TRASH: "استعادة من سلة المحذوفات",
  DELETE_LICENSE_PERMANENTLY: "حذف الترخيص نهائياً",
} as Record<string, string>;

const eventLabels = {
  issued: "إصدار السجل",
  updated: "تعديل بيانات",
  status_changed: "تغيير الحالة",
  document_added: "إضافة مستند",
  archived: "أرشفة الترخيص",
  deleted: "نقل إلى سلة المحذوفات",
  restored: "استعادة من سلة المحذوفات",
} as Record<string, string>;

export default function LicenseDetails() {
  const [, params] = useRoute("/licenses/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const id = Number(params?.id);
  const validId = Number.isInteger(id) && id > 0;
  const { data, isLoading, error, refetch } = trpc.licenses.getById.useQuery({ id }, { enabled: validId });
  const audit = trpc.licenses.auditLog.useQuery({ licenseId: id }, { enabled: validId && user?.role === "admin" });
  const openDocument = trpc.licenses.openDocument.useMutation({ onSuccess: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"), onError: error => toast.error(error.message) });
  const update = trpc.licenses.update.useMutation({ onSuccess: () => { toast.success("تم تحديث حالة الترخيص"); void refetch(); }, onError: error => toast.error(error.message) });

  if (!validId) return <DashboardLayout><div dir="rtl" className="rounded-2xl bg-rose-50 p-6 text-rose-800">رقم الترخيص غير صالح.</div></DashboardLayout>;
  if (isLoading) return <DashboardLayout><div className="grid min-h-96 place-items-center"><Loader2 className="animate-spin text-emerald-700" /></div></DashboardLayout>;
  if (error || !data) return <DashboardLayout><div dir="rtl" className="rounded-2xl bg-rose-50 p-6 text-rose-800">تعذر تحميل الترخيص: {error?.message || "غير موجود"}</div></DashboardLayout>;

  const { license, documents } = data;
  const effective = statusMap[license.effectiveStatus as keyof typeof statusMap];
  const updateStatus = (value: string) => update.mutate({
    id: license.id,
    licenseNo: license.licenseNo,
    facilityName: license.facilityName,
    facilityType: license.facilityType,
    holderName: license.holderName,
    holderNationalId: license.holderNationalId,
    governorate: license.governorate,
    address: license.address,
    archiveNumber: license.archiveNumber,
    issueDate: license.issueDate,
    expiryDate: license.expiryDate,
    notes: license.notes || undefined,
    status: value as "active" | "expired",
  });
  const issueReferences = [
    { label: "استمارة معاينة الموقع", number: license.siteInspectionFormNo, date: license.siteInspectionFormDate },
    { label: "محضر اللجنة الخاصة بالمنشآت الصيدلانية", number: license.committeeMinutesNo, date: license.committeeMinutesDate },
    { label: "سند الرسوم القانونية", number: license.feeReceiptNo, date: license.feeReceiptDate },
  ].filter(item => item.number || item.date);

  return <DashboardLayout><div dir="rtl" className="mx-auto max-w-6xl space-y-6"><header><Button variant="ghost" onClick={() => setLocation("/licenses")} className="-mr-3 text-slate-600"><ArrowRight className="ml-1 h-4 w-4" />العودة إلى السجل</Button><div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-extrabold text-emerald-950">{license.facilityName}</h1><Badge className={effective.className}>{effective.label}</Badge></div><p className="mt-2 text-slate-500">ترخيص رقم <span className="font-bold text-emerald-800">{license.licenseNo}</span> · {facilityTypeMap[license.facilityType]}</p></div>{user?.role === "admin" && <div className="flex w-full flex-col gap-3 sm:w-auto"><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => setLocation(`/licenses/${id}/edit`)} disabled={license.status === "archived"}><Pencil className="ml-2 h-4 w-4" />تعديل</Button><Button variant="outline" onClick={() => window.open(`/licenses/${id}/print`, "_blank", "noopener,noreferrer")}><Printer className="ml-2 h-4 w-4" />معاينة وطباعة</Button><Button className="bg-emerald-900 text-white hover:bg-emerald-800" onClick={() => window.open(`/licenses/${id}/print?export=pdf`, "_blank", "noopener,noreferrer")}><Download className="ml-2 h-4 w-4" />تصدير PDF</Button><LicenseAdminActions license={license} compact mode="destructive" onChanged={() => void refetch()} /></div><div className="w-full sm:w-48"><p className="mb-2 text-sm font-bold text-slate-700">تحديث الحالة</p><Select value={license.effectiveStatus === "active" ? "active" : "expired"} onValueChange={updateStatus} disabled={update.isPending || license.status === "archived"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusMap).map(([key, status]) => <SelectItem key={key} value={key}>{status.label}</SelectItem>)}</SelectContent></Select></div></div>}</div></header>
    <section className="grid gap-5 lg:grid-cols-3"><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5 lg:col-span-2"><CardContent className="p-6"><SectionTitle icon={Archive} title="بيانات الترخيص" /><div className="mt-5 grid gap-x-7 gap-y-5 sm:grid-cols-2"><DataItem label="رقم الترخيص" value={license.licenseNo} /><DataItem label="نوع المنشأة" value={facilityTypeMap[license.facilityType]} /><DataItem label="تاريخ بداية السريان" value={formatDate(license.issueDate)} /><DataItem label="تاريخ إصدار مكتب الصحة" value={formatOptionalDate(license.healthOfficeIssueDate)} /><DataItem label="تاريخ الانتهاء" value={formatDate(license.expiryDate)} /><DataItem label="المدة المتبقية" value={license.daysRemaining < 0 ? `منتهٍ منذ ${Math.abs(license.daysRemaining)} يوم` : `${license.daysRemaining} يوم`} emphasis /></div></CardContent></Card><Card className="border-0 bg-[#fdfaf2] shadow-sm shadow-emerald-950/5"><CardContent className="p-6"><SectionTitle icon={ShieldAlert} title="الحالة والتنبيه" /><div className="mt-6"><Badge className={effective.className}>{effective.label}</Badge><p className="mt-4 text-sm leading-7 text-slate-600">{license.effectiveStatus === "expired" ? "انتهت صلاحية هذا الترخيص ويحتاج إلى معالجة إدارية." : "حالة الترخيص سارية ومحدَّثة في النظام."}</p>{user?.role === "admin" && <Button variant="outline" className="mt-5 w-full" onClick={() => window.open(`/licenses/${id}/ministry-print`, "_blank", "noopener,noreferrer")}><Printer className="ml-2 h-4 w-4" />طباعة على نموذج الوزارة</Button>}</div></CardContent></Card></section>
    <section className="grid gap-5 lg:grid-cols-3"><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="p-6"><SectionTitle icon={UserRound} title="صاحب الترخيص" /><div className="mt-5 space-y-4"><DataItem label="الاسم" value={license.holderName} /><DataItem label="رقم الهوية" value={license.holderNationalId} /><DataItem label="البطاقة صادرة من" value={displayOptional(license.nationalIdIssuedBy)} /><DataItem label="محافظة إصدار البطاقة" value={displayOptional(license.nationalIdIssueGovernorate)} /><DataItem label="تاريخ إصدار البطاقة" value={formatOptionalDate(license.nationalIdIssueDate)} /><DataItem label="مكان الميلاد" value={displayOptional(license.birthPlace)} /><DataItem label="محافظة الميلاد" value={displayOptional(license.birthGovernorate)} /><DataItem label="تاريخ الميلاد" value={formatOptionalDate(license.birthDate)} /><DataItem label="رقم الهاتف" value={displayOptional(license.holderPhone)} /></div></CardContent></Card><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="p-6"><SectionTitle icon={FileText} title="المؤهل والمزاولة المهنية" /><div className="mt-5 space-y-4"><DataItem label="المؤهل" value={displayOptional(license.qualification)} /><DataItem label="تاريخ التخرج" value={formatOptionalDate(license.graduationDate)} /><DataItem label="رقم ترخيص المزاولة" value={displayOptional(license.professionalLicenseNo)} /><DataItem label="تاريخ إصدار المزاولة" value={formatOptionalDate(license.professionalLicenseIssueDate)} /></div></CardContent></Card><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="p-6"><SectionTitle icon={MapPin} title="العقار وموقع المنشأة" /><div className="mt-5 space-y-4"><DataItem label="المحافظة" value={license.governorate} /><DataItem label="العنوان" value={displayOptional(license.address)} /><DataItem label="الشارع" value={displayOptional(license.street)} /><DataItem label="المنطقة" value={displayOptional(license.area)} /><DataItem label="المديرية" value={displayOptional(license.district)} /><DataItem label="مالك العقار" value={displayOptional(license.propertyOwnerName)} /></div></CardContent></Card></section>
    <Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="p-6"><SectionTitle icon={FileText} title="الوثائق المؤرشفة" /><p className="mt-1 text-sm text-slate-500">فتح المستند يتم عبر رابط موقّت بعد توثيق العملية في السجل.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{documentTypes.map(type => { const document = documents.find(item => item.documentType === type); return <div key={type} className={`rounded-2xl border p-4 ${document ? "border-emerald-900/10 bg-emerald-50/40" : "border-slate-200 bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-emerald-950">{documentTypeMap[type]}</p><p className="mt-1 max-w-44 truncate text-xs text-slate-500">{document?.originalName || "لم يُرفع بعد"}</p></div>{document && <Button size="icon" variant="outline" disabled={openDocument.isPending} onClick={() => openDocument.mutate({ id: document.id })} aria-label={`عرض ${documentTypeMap[type]}`}><Eye className="h-4 w-4" /></Button>}</div></div>; })}</div></CardContent></Card>
    {(license.notes || issueReferences.length || license.licenseDeliveryDate) && <Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="p-6"><SectionTitle icon={CalendarDays} title="بيانات الإصدار والتسليم" />{issueReferences.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{issueReferences.map(item => <div key={item.label} className="rounded-2xl bg-amber-50/60 p-4"><p className="text-xs font-bold text-slate-500">{item.label}</p><p className="mt-2 font-bold text-emerald-950">الرقم: {displayOptional(item.number)}</p>{item.date && <p className="mt-1 text-sm text-slate-600">التاريخ: {formatOptionalDate(item.date)}</p>}</div>)}</div> : null}{license.licenseDeliveryDate && <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">تم تسليم الترخيص لصاحبه بتاريخ: {formatOptionalDate(license.licenseDeliveryDate)}</p>}{license.notes && <><p className="mt-6 text-sm font-bold text-slate-700">ملاحظات داخلية</p><p className="mt-2 leading-7 text-slate-600">{license.notes}</p></>}</CardContent></Card>}
    {license.status === "archived" && <Card className="border border-violet-200 bg-violet-50 shadow-sm shadow-violet-950/5"><CardContent className="p-6"><SectionTitle icon={Archive} title="معلومات الأرشفة" /><p className="mt-4 text-sm font-bold text-violet-900">سبب الأرشفة</p><p className="mt-1 leading-7 text-violet-900/80">{license.archiveReason || "لم يسجل سبب"}</p>{license.archivedAt && <p className="mt-3 text-xs text-violet-800">تاريخ الأرشفة: {formatDate(license.archivedAt)}</p>}</CardContent></Card>}
    <Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="p-6"><SectionTitle icon={CalendarDays} title="سجل أحداث الترخيص" /><div className="mt-4 divide-y divide-emerald-950/7">{data.events.length ? data.events.map(event => <div key={event.id} className="flex items-center justify-between gap-4 py-3"><div><p className="font-bold text-emerald-950">{eventLabels[event.eventType] || event.eventType}</p><p className="mt-1 text-xs text-slate-500">{event.note || "تم تسجيل حدث على الترخيص"}</p></div><p className="shrink-0 text-xs text-slate-500">{formatDate(event.createdAt)}</p></div>) : <p className="py-4 text-sm text-slate-500">لا توجد أحداث مسجلة بعد.</p>}</div></CardContent></Card>
    {user?.role === "admin" && <Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="p-6"><SectionTitle icon={CalendarDays} title="سجل التدقيق" /><div className="mt-4 divide-y divide-emerald-950/7">{audit.isLoading ? <p className="py-4 text-sm text-slate-500">جارٍ تحميل السجل...</p> : audit.data?.length ? audit.data.map(item => <div key={item.id} className="flex items-center justify-between gap-4 py-3"><div><p className="font-bold text-emerald-950">{actions[item.action] || item.action}</p><p className="mt-1 text-xs text-slate-500">بواسطة: {item.actorName || `المستخدم رقم ${item.actorId}`}</p></div><p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p></div>) : <p className="py-4 text-sm text-slate-500">لا توجد عمليات مسجلة بعد.</p>}</div></CardContent></Card>}
  </div></DashboardLayout>;
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Archive; title: string }) { return <div className="flex items-center gap-2 text-emerald-950"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><Icon className="h-4 w-4" /></span><h2 className="font-extrabold">{title}</h2></div>; }
function DataItem({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) { return <div><p className="text-xs font-bold text-slate-400">{label}</p><p className={`mt-1.5 text-sm leading-6 ${emphasis ? "font-extrabold text-emerald-800" : "font-bold text-slate-700"}`}>{value}</p></div>; }
