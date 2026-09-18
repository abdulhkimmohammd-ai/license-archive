import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  documentTypeMap,
  documentTypes,
  facilityTypeMap,
  getArchiveNumberPreview,
  getTwoYearExpiryInput,
  graduationInstitutionTypeMap,
  qualificationDefaults,
  qualificationLevelMap,
} from "@/lib/licenses";
import { getLicenseSaveGuidance } from "@/lib/licenseFormValidation";
import { buildLicenseCreateInput, type LicenseFormValues } from "@/lib/licenseSubmission";
import { queueLicenseForSync } from "@/lib/offlineLicenses";
import { supabaseDevelopment, supabaseDevelopmentEnabled } from "@/lib/supabaseDevelopment";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, FileUp, Loader2, Save, WifiOff } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type FacilityType = "warehouse" | "pharmacy";
type QualificationLevel = "diploma" | "bachelor";
type InstitutionType = "institute" | "university";
type DocumentType = keyof typeof documentTypeMap;

type FormValues = LicenseFormValues;

const initialForm: FormValues = {
  licenseNo: "", facilityName: "", facilityType: "warehouse", issueDate: "", expiryDate: "", healthOfficeIssueDate: "", healthOfficeDirectorName: "د. مجاهد احمد الخطري", healthOfficeDirectorGovernorate: "",
  holderName: "", holderNationalId: "", holderPhone: "", nationalIdIssuedBy: "", nationalIdIssueGovernorate: "", nationalIdIssueDate: "", birthPlace: "", birthGovernorate: "", birthDate: "",
  qualificationLevel: "diploma", graduationInstitutionType: "institute", graduationCountry: "", graduationInstitute: "", graduationDate: "", professionalLicenseNo: "", professionalLicenseIssueDate: "",
  previousLicenseNo: "", previousLicenseIssuedBy: "", previousLicenseIssueDate: "",
  siteInspectionFormNo: "", siteInspectionFormDate: "", committeeMinutesNo: "", committeeMinutesDate: "", feeReceiptNo: "", feeReceiptDate: "",
  governorate: "", address: "", street: "", area: "", district: "", propertyOwnerName: "", archiveDate: "", archiveOfficerName: "احمد محمد المشدلي", licenseDeliveryDate: "", notes: "",
};

const emptyFiles = () => Object.fromEntries(documentTypes.map((type) => [type, null])) as Record<DocumentType, File | null>;
const localDraftKey = "license-archive:create-license-draft:v1";

export default function LicenseForm() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const supabaseMode = useMemo(() => new URLSearchParams(window.location.search).get("backend") === "supabase-development", []);
  const [supabaseAccessToken, setSupabaseAccessToken] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(initialForm);
  const [files, setFiles] = useState(emptyFiles);
  const [showReview, setShowReview] = useState(false);
  const [draftNotice, setDraftNotice] = useState(false);
  const create = trpc.licenses.create.useMutation();
  const operationalCreate = trpc.supabaseLicenses.operationalCreate.useMutation();
  const upload = trpc.licenses.uploadDocument.useMutation();
  const busy = create.isPending || operationalCreate.isPending || upload.isPending;
  const setValue = <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) => setForm((current) => ({ ...current, [key]: value }));
  const setFacilityType = (facilityType: FacilityType) => setForm((current) => ({ ...current, facilityType, expiryDate: facilityType === "pharmacy" ? getTwoYearExpiryInput(current.issueDate) : "", ...qualificationDefaults[facilityType] }));
  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(initialForm) || Object.values(files).some(Boolean);
  const leaveForm = (destination = "/licenses") => {
    if (hasUnsavedChanges && !window.confirm("لديك بيانات غير محفوظة. ستبقى المسودة مؤقتاً على هذا الجهاز، هل تريد المغادرة؟")) return;
    setLocation(destination);
  };

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(localDraftKey);
      if (!rawDraft) return;
      const savedDraft = JSON.parse(rawDraft) as Partial<FormValues>;
      setForm({ ...initialForm, ...savedDraft });
      setDraftNotice(true);
    } catch { window.localStorage.removeItem(localDraftKey); }
  }, []);
  useEffect(() => {
    if (!supabaseMode || !supabaseDevelopmentEnabled || !supabaseDevelopment) return;
    void supabaseDevelopment.auth.getSession().then(({ data }) => setSupabaseAccessToken(data.session?.access_token ?? null));
    const { data: listener } = supabaseDevelopment.auth.onAuthStateChange((_event, session) => setSupabaseAccessToken(session?.access_token ?? null));
    return () => listener.subscription.unsubscribe();
  }, [supabaseMode]);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    try { window.localStorage.setItem(localDraftKey, JSON.stringify(form)); } catch { /* مساحة التخزين قد تكون غير متاحة */ }
  }, [form, hasUnsavedChanges]);
  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { if (!hasUnsavedChanges) return; event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const guidance = getLicenseSaveGuidance(form);
    if (guidance) { toast.error(guidance, { duration: 7000 }); return; }
    if (supabaseMode && !supabaseAccessToken) { toast.error("يلزم تسجيل دخول حساب اختبار Supabase معتمد من مسار المختبر أولاً."); return; }
    if (supabaseMode && Object.values(files).some(Boolean)) { toast.error("المرفقات غير مدعومة في مسار Supabase Development الحالي؛ احفظ الترخيص دون مرفقات أو استخدم المسار التشغيلي الحالي."); return; }
    if (!navigator.onLine) {
      if (supabaseMode) { toast.info("طابور Offline للتطبيق التشغيلي على Supabase لم يُنقل بعد؛ لم تُحفظ أي عملية في هذا المسار."); return; }
      const queued = user ? queueLicenseForSync(user.id, form) : null;
      if (!queued) { toast.error("تعذر حفظ الترخيص محلياً في هذا المتصفح"); return; }
      if (!queued.queued) { toast.info("هذا الترخيص موجود بالفعل في طابور المزامنة ولن يُضاف مرة أخرى."); return; }
      const hasFiles = Object.values(files).some(Boolean);
      toast.success(hasFiles ? "حُفظ الترخيص محلياً للمزامنة لاحقاً. أعد رفع المستندات بعد المزامنة." : "حُفظ الترخيص محلياً وسيُرسل تلقائياً عند عودة الاتصال.");
      window.localStorage.removeItem(localDraftKey); setForm(initialForm); setFiles(emptyFiles()); setLocation("/licenses"); return;
    }
    try {
      const input = buildLicenseCreateInput(form, crypto.randomUUID());
      if (supabaseMode) {
        const { archiveNumber: _archiveNumber, idempotencyKey, ...operationalInput } = input;
        const result = await operationalCreate.mutateAsync({
          ...operationalInput,
          issueDate: input.issueDate!,
          expiryDate: input.expiryDate!,
          status: input.status === "suspended" || input.status === "expired" ? input.status : "active",
          accessToken: supabaseAccessToken!,
          idempotencyKey: idempotencyKey!,
        });
        toast.success(`تم حفظ الترخيص في Supabase Development برقم أرشفة ${result?.archive_number ?? "مُنشأ"}`);
        window.localStorage.removeItem(localDraftKey);
        setForm(initialForm);
        setLocation("/licenses?backend=supabase-development");
        return;
      }
      const result = await create.mutateAsync(input);
      for (const documentType of documentTypes) {
        const file = files[documentType];
        if (!file) continue;
        if (file.size > 5 * 1024 * 1024) throw new Error(`الملف «${documentTypeMap[documentType]}» أكبر من 5 ميغابايت`);
        await upload.mutateAsync({ licenseId: result.id, documentType, originalName: file.name, mimeType: normalizeMime(file.type), base64: await fileToBase64(file) });
      }
      toast.success("تم حفظ الترخيص بنجاح");
      window.localStorage.removeItem(localDraftKey);
      setLocation(`/licenses/${result.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ الترخيص، يرجى المحاولة مرة أخرى");
    }
  }

  return <DashboardLayout><div dir="rtl" className="mx-auto max-w-5xl space-y-6"><header><Button variant="ghost" onClick={() => leaveForm(supabaseMode ? "/licenses?backend=supabase-development" : "/licenses")} className="-mr-3 text-slate-600"><ArrowRight className="ml-1 h-4 w-4" />العودة إلى السجل</Button><h1 className="mt-3 text-3xl font-extrabold text-emerald-950">إضافة ترخيص جديد</h1><p className="mt-2 text-slate-500">الحقول التي تحمل نجمة فقط إلزامية؛ ويمكن رفع المستندات الآن أو لاحقاً.</p>{supabaseMode && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-900">وضع انتقال Development: سيُحفظ الترخيص في Supabase بحساب اختبار معتمد. المرفقات وطابور Offline ما زالا على المسار التشغيلي القديم.</p>}{draftNotice && <p className="mt-3 flex items-center gap-2 rounded-xl bg-sky-50 p-3 text-sm font-medium text-sky-900"><CheckCircle2 className="h-4 w-4" />تمت استعادة مسودة محلية مؤقتة. لا تُحفظ المسودة في قاعدة البيانات إلا بعد الضغط على حفظ الترخيص.</p>}{!navigator.onLine && <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900"><WifiOff className="h-4 w-4" />وضع دون اتصال: سيُحفظ الترخيص محلياً وتُرسل بياناته عند عودة الإنترنت. المستندات تُرفع لاحقاً.</p>}</header><form noValidate onSubmit={submit} className="space-y-5">
    <Card><CardContent className="p-5 sm:p-7"><Section title="بيانات الترخيص والمنشأة"><Field label="رقم الترخيص" required><Input value={form.licenseNo} onChange={(e) => setValue("licenseNo", e.target.value)} required /></Field><Field label="نوع المنشأة" required><Select value={form.facilityType} onValueChange={(value) => setFacilityType(value as FacilityType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="warehouse">{facilityTypeMap.warehouse}</SelectItem><SelectItem value="pharmacy">{facilityTypeMap.pharmacy}</SelectItem></SelectContent></Select></Field><Field label="اسم المنشأة" required><Input value={form.facilityName} onChange={(e) => setValue("facilityName", e.target.value)} required /></Field><Field label="تاريخ بداية سريان الترخيص" required><Input type="date" value={form.issueDate} onChange={(e) => setForm((current) => ({ ...current, issueDate: e.target.value, expiryDate: current.facilityType === "pharmacy" ? getTwoYearExpiryInput(e.target.value) : current.expiryDate }))} required /></Field><Field label="تاريخ إصدار الترخيص من مكتب الصحة"><Input type="date" value={form.healthOfficeIssueDate} onChange={(e) => setValue("healthOfficeIssueDate", e.target.value)} /></Field><Field label="اسم مدير مكتب الصحة"><Input value={form.healthOfficeDirectorName} onChange={(e) => setValue("healthOfficeDirectorName", e.target.value)} placeholder="مثال: د. مجاهد احمد الخطري" /></Field><Field label="محافظة مدير مكتب الصحة"><Input value={form.healthOfficeDirectorGovernorate} onChange={(e) => setValue("healthOfficeDirectorGovernorate", e.target.value)} placeholder="مثال: صنعاء" /></Field>{form.facilityType === "warehouse" ? <Field label="تاريخ انتهاء ترخيص المخزن" required><Input type="date" value={form.expiryDate} onChange={(e) => setValue("expiryDate", e.target.value)} required /></Field> : <Field label="تاريخ انتهاء ترخيص الصيدلية (بعد عامين)"><Input type="date" value={getTwoYearExpiryInput(form.issueDate)} readOnly className="bg-slate-50" /></Field>}</Section></CardContent></Card>
    <Card className="border-emerald-200 bg-emerald-50/40"><CardContent className="p-5 sm:p-7"><Section title="بيانات الأرشفة"><Field label="رقم الأرشيف"><Input value={form.licenseNo ? `سيُنشأ تلقائياً: ${getArchiveNumberPreview(form.licenseNo, form.facilityType)}` : "سيُنشأ تلقائياً بعد إدخال رقم الترخيص"} disabled /></Field><Field label="اسم المنشأة (تعبئة تلقائية)"><Input value={form.facilityName || "يُملأ بعد إدخال اسم المنشأة"} disabled /></Field><Field label="اسم مالك المنشأة (تعبئة تلقائية)"><Input value={form.holderName || "يُملأ بعد إدخال اسم صاحب الترخيص"} disabled /></Field><Field label="تاريخ قيد الأرشيف"><Input type="date" value={form.archiveDate} onChange={(e) => setValue("archiveDate", e.target.value)} /></Field><Field label="اسم رئيس قسم الأرشيف"><Input value={form.archiveOfficerName} onChange={(e) => setValue("archiveOfficerName", e.target.value)} /></Field></Section></CardContent></Card>
    <Card><CardContent className="p-5 sm:p-7"><Section title="صاحب الترخيص والهوية"><Field label="اسم صاحب الترخيص" required><Input value={form.holderName} onChange={(e) => setValue("holderName", e.target.value)} required /></Field><Field label="رقم الهوية" required><Input value={form.holderNationalId} onChange={(e) => setValue("holderNationalId", e.target.value)} required /></Field><Field label="رقم الهاتف"><Input value={form.holderPhone} onChange={(e) => setValue("holderPhone", e.target.value)} /></Field><Field label="البطاقة صادرة من"><Input value={form.nationalIdIssuedBy} onChange={(e) => setValue("nationalIdIssuedBy", e.target.value)} /></Field><Field label="محافظة إصدار البطاقة"><Input value={form.nationalIdIssueGovernorate} onChange={(e) => setValue("nationalIdIssueGovernorate", e.target.value)} /></Field><Field label="تاريخ إصدار البطاقة"><Input type="date" value={form.nationalIdIssueDate} onChange={(e) => setValue("nationalIdIssueDate", e.target.value)} /></Field><Field label="مكان الميلاد"><Input value={form.birthPlace} onChange={(e) => setValue("birthPlace", e.target.value)} /></Field><Field label="محافظة الميلاد"><Input value={form.birthGovernorate} onChange={(e) => setValue("birthGovernorate", e.target.value)} /></Field><Field label="تاريخ الميلاد"><Input type="date" value={form.birthDate} onChange={(e) => setValue("birthDate", e.target.value)} /></Field></Section></CardContent></Card>
    <Card><CardContent className="p-5 sm:p-7"><Section title="المؤهل والمزاولة المهنية"><Field label="درجة المؤهل"><Select value={form.qualificationLevel} onValueChange={(value) => setValue("qualificationLevel", value as QualificationLevel)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="diploma" disabled={form.facilityType === "pharmacy"}>{qualificationLevelMap.diploma}</SelectItem><SelectItem value="bachelor" disabled={form.facilityType === "warehouse"}>{qualificationLevelMap.bachelor}</SelectItem></SelectContent></Select></Field><Field label="جهة التخرج"><Select value={form.graduationInstitutionType} onValueChange={(value) => setValue("graduationInstitutionType", value as InstitutionType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="institute" disabled={form.facilityType === "pharmacy"}>{graduationInstitutionTypeMap.institute}</SelectItem><SelectItem value="university" disabled={form.facilityType === "warehouse"}>{graduationInstitutionTypeMap.university}</SelectItem></SelectContent></Select></Field><Field label={form.graduationInstitutionType === "university" ? "اسم الجامعة" : "اسم المعهد"}><Input value={form.graduationInstitute} onChange={(e) => setValue("graduationInstitute", e.target.value)} /></Field><Field label="دولة التخرج"><Input value={form.graduationCountry} onChange={(e) => setValue("graduationCountry", e.target.value)} /></Field><Field label="تاريخ التخرج"><Input type="date" value={form.graduationDate} onChange={(e) => setValue("graduationDate", e.target.value)} /></Field><Field label="رقم ترخيص مزاولة المهنة"><Input value={form.professionalLicenseNo} onChange={(e) => setValue("professionalLicenseNo", e.target.value)} /></Field><Field label="تاريخ إصدار ترخيص المزاولة"><Input type="date" value={form.professionalLicenseIssueDate} onChange={(e) => setValue("professionalLicenseIssueDate", e.target.value)} /></Field></Section></CardContent></Card>
    {form.facilityType === "pharmacy" && <Card className="border-sky-200 bg-sky-50/40"><CardContent className="p-5 sm:p-7"><h2 className="font-extrabold text-emerald-950">الترخيص السابق للصيدلية</h2><p className="mt-1 text-sm text-slate-600">اختياري؛ يظهر في الوجه الخلفي لكرت الصيدلية فقط عند إدخال البيانات.</p><div className="mt-5 grid gap-4 sm:grid-cols-3"><Field label="رقم الترخيص السابق"><Input value={form.previousLicenseNo} onChange={(e) => setValue("previousLicenseNo", e.target.value)} /></Field><Field label="الصادر من"><Input value={form.previousLicenseIssuedBy} onChange={(e) => setValue("previousLicenseIssuedBy", e.target.value)} /></Field><Field label="تاريخ إصدار الترخيص السابق"><Input type="date" value={form.previousLicenseIssueDate} onChange={(e) => setValue("previousLicenseIssueDate", e.target.value)} /></Field></div></CardContent></Card>}
    <Card className="border-amber-200 bg-amber-50/30"><CardContent className="p-5 sm:p-7"><h2 className="font-extrabold text-emerald-950">بيانات إصدار وتسليم الترخيص</h2><p className="mt-1 text-sm text-slate-600">كل الحقول التالية اختيارية.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="رقم استمارة معاينة الموقع"><Input value={form.siteInspectionFormNo} onChange={(e) => setValue("siteInspectionFormNo", e.target.value)} /></Field><Field label="تاريخ استمارة المعاينة"><Input type="date" value={form.siteInspectionFormDate} onChange={(e) => setValue("siteInspectionFormDate", e.target.value)} /></Field><Field label="رقم محضر اللجنة"><Input value={form.committeeMinutesNo} onChange={(e) => setValue("committeeMinutesNo", e.target.value)} /></Field><Field label="تاريخ محضر اللجنة"><Input type="date" value={form.committeeMinutesDate} onChange={(e) => setValue("committeeMinutesDate", e.target.value)} /></Field><Field label="رقم سند الرسوم القانونية"><Input value={form.feeReceiptNo} onChange={(e) => setValue("feeReceiptNo", e.target.value)} /></Field><Field label="تاريخ سند الرسوم"><Input type="date" value={form.feeReceiptDate} onChange={(e) => setValue("feeReceiptDate", e.target.value)} /></Field></div></CardContent></Card>
    <Card><CardContent className="p-5 sm:p-7"><Section title="العنوان والعقار"><Field label="المحافظة" required><Input value={form.governorate} onChange={(e) => setValue("governorate", e.target.value)} required /></Field><Field label="الشارع"><Input value={form.street} onChange={(e) => setValue("street", e.target.value)} /></Field><Field label="المنطقة"><Input value={form.area} onChange={(e) => setValue("area", e.target.value)} /></Field><Field label="المديرية"><Input value={form.district} onChange={(e) => setValue("district", e.target.value)} /></Field><Field label="مالك العقار"><Input value={form.propertyOwnerName} onChange={(e) => setValue("propertyOwnerName", e.target.value)} /></Field><Field label="العنوان التفصيلي (اختياري)"><Textarea value={form.address} onChange={(e) => setValue("address", e.target.value)} /></Field></Section><Label className="mb-2 mt-5 block">ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setValue("notes", e.target.value)} /></CardContent></Card>
    <Card><CardContent className="p-5 sm:p-7"><h2 className="font-extrabold text-emerald-950">المستندات</h2><p className="mt-1 text-sm text-slate-500">كلها اختيارية ويمكن رفعها الآن أو لاحقاً من صفحة التعديل.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{documentTypes.map((type) => <DocumentInput key={type} type={type} file={files[type]} onChange={(file) => setFiles((current) => ({ ...current, [type]: file }))} />)}</div></CardContent></Card>
    {showReview && <Card className="border-emerald-200 bg-emerald-50/50"><CardContent className="p-5"><div className="flex items-center gap-2 text-emerald-950"><CheckCircle2 className="h-5 w-5 text-emerald-700" /><h2 className="font-extrabold">مراجعة سريعة قبل الحفظ</h2></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><ReviewItem label="رقم الترخيص" value={form.licenseNo} /><ReviewItem label="المنشأة" value={form.facilityName} /><ReviewItem label="النوع" value={facilityTypeMap[form.facilityType]} /><ReviewItem label="صاحب الترخيص" value={form.holderName} /><ReviewItem label="رقم الهوية" value={form.holderNationalId} /><ReviewItem label="المحافظة" value={form.governorate} /><ReviewItem label="تاريخ البداية" value={form.issueDate} /><ReviewItem label="تاريخ الانتهاء" value={form.facilityType === "pharmacy" ? getTwoYearExpiryInput(form.issueDate) : form.expiryDate} /><ReviewItem label="رقم الأرشفة المتوقع" value={form.licenseNo ? getArchiveNumberPreview(form.licenseNo, form.facilityType) : "يظهر بعد إدخال رقم الترخيص"} /></div><p className="mt-4 text-xs text-slate-600">هذه معاينة فقط. لا تُكتب أي بيانات في قاعدة البيانات قبل الضغط على «حفظ الترخيص».</p></CardContent></Card>}
    <div className="flex flex-wrap justify-end gap-3 pb-8"><Button type="button" variant="outline" disabled={busy} onClick={() => leaveForm()}>إلغاء</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setShowReview(value => !value)}>{showReview ? "إخفاء المراجعة" : "مراجعة قبل الحفظ"}</Button><Button disabled={busy} type="submit" className="bg-emerald-900 px-6 text-white hover:bg-emerald-800">{busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}حفظ الترخيص</Button></div>
  </form></div></DashboardLayout>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <><h2 className="mb-5 font-extrabold text-emerald-950">{title}</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div></>; }
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <div><Label className="mb-2 block text-sm font-bold text-slate-700">{label}{required && <span className="mr-1 text-rose-600">*</span>}</Label>{children}</div>; }
function ReviewItem({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white p-3 shadow-sm shadow-emerald-950/5"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 font-bold text-emerald-950">{value || "غير مدخل"}</p></div>; }
function DocumentInput({ type, file, onChange }: { type: DocumentType; file: File | null; onChange: (file: File | null) => void }) { return <label className="group cursor-pointer rounded-2xl border border-dashed border-emerald-900/20 bg-emerald-50/40 p-4 transition-colors hover:border-emerald-700 hover:bg-emerald-50"><input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => onChange(e.target.files?.[0] || null)} /><FileUp className="h-5 w-5 text-emerald-700" /><p className="mt-3 text-sm font-bold text-emerald-950">{documentTypeMap[type]} <span className="font-normal text-slate-500">(اختياري)</span></p><p className="mt-1 truncate text-xs text-slate-500">{file ? file.name : "انقر لاختيار الملف"}</p></label>; }
function fileToBase64(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = () => reject(new Error("تعذر قراءة الملف")); reader.readAsDataURL(file); }); }
function normalizeMime(mime: string): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" { return ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mime) ? mime as "application/pdf" | "image/jpeg" | "image/png" | "image/webp" : "application/pdf"; }
