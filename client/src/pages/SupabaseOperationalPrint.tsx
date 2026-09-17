import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildPrintRows, type PrintableLicenseDetails } from "@/lib/licensePresentation";
import { facilityTypeMap, statusMap } from "@/lib/licenses";
import { supabaseDevelopment, supabaseDevelopmentEnabled } from "@/lib/supabaseDevelopment";
import { getSupabaseLicense } from "@/lib/licenseApi";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, Loader2, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";

type RawLicense = Record<string, unknown>;

export default function SupabaseOperationalPrint() {
  const [, params] = useRoute("/supabase-development/licenses/:id/print");
  const [, setLocation] = useLocation();
  const id = params?.id ?? "";
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    if (!supabaseDevelopment) return;
    void supabaseDevelopment.auth.getSession().then(({ data }) => setAccessToken(data.session?.access_token ?? null));
    const { data: listener } = supabaseDevelopment.auth.onAuthStateChange((_event, session) => setAccessToken(session?.access_token ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);
  const query = useQuery({ queryKey: ["supabase-development", "license", id], enabled: Boolean(accessToken && id), retry: false, queryFn: () => getSupabaseLicense(id) });
  const raw = query.data as RawLicense | undefined;
  const license = useMemo<PrintableLicenseDetails | null>(() => raw ? {
    holderName: String(raw.holder_name ?? ""), holderNationalId: String(raw.holder_national_id ?? ""), archiveNumber: String(raw.archive_number ?? ""),
    issueDate: String(raw.issue_date ?? ""), expiryDate: String(raw.expiry_date ?? ""), governorate: String(raw.governorate ?? ""),
    nationalIdIssuedBy: raw.national_id_issued_by as string | null, nationalIdIssueGovernorate: raw.national_id_issue_governorate as string | null,
    nationalIdIssueDate: raw.national_id_issue_date as string | null, birthPlace: raw.birth_place as string | null, birthGovernorate: raw.birth_governorate as string | null,
    birthDate: raw.birth_date as string | null, holderPhone: raw.holder_phone as string | null, healthOfficeIssueDate: raw.health_office_issue_date as string | null,
    propertyOwnerName: raw.property_owner_name as string | null, qualification: raw.qualification as string | null, graduationDate: raw.graduation_date as string | null,
    professionalLicenseNo: raw.professional_license_no as string | null, professionalLicenseIssueDate: raw.professional_license_issue_date as string | null,
    siteInspectionFormNo: raw.site_inspection_form_no as string | null, siteInspectionFormDate: raw.site_inspection_form_date as string | null,
    committeeMinutesNo: raw.committee_minutes_no as string | null, committeeMinutesDate: raw.committee_minutes_date as string | null,
    feeReceiptNo: raw.fee_receipt_no as string | null, feeReceiptDate: raw.fee_receipt_date as string | null, licenseDeliveryDate: raw.license_delivery_date as string | null,
  } : null, [raw]);
  const downloadPdf = async () => {
    const source = document.querySelector<HTMLElement>(".print-document");
    if (!source || !license || exporting) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(source, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const width = 210; const height = (canvas.height * width) / canvas.width;
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, width, height, undefined, "FAST");
      pdf.save(`ترخيص-${license.holderName || "سجل"}.pdf`);
    } finally { setExporting(false); }
  };
  if (!supabaseDevelopmentEnabled || !supabaseDevelopment) return <Notice title="إعداد Supabase Development غير متاح" detail="لم تُحمّل إعدادات العميل العامة لهذا المختبر." />;
  if (!accessToken) return <Notice title="يلزم حساب اختبار Supabase" detail="سجل الدخول إلى المختبر بحساب اصطناعي قبل فتح الطباعة." action={() => setLocation("/migration-lab/supabase")} />;
  if (query.isLoading) return <div className="grid min-h-screen place-items-center bg-stone-100"><Loader2 className="animate-spin text-emerald-700" /></div>;
  if (query.error || !raw || !license) return <Notice title="تعذر إنشاء المعاينة" detail={query.error?.message ?? "الترخيص غير موجود"} />;
  const type = String(raw.facility_type) as keyof typeof facilityTypeMap;
  const status = statusMap[String(raw.status) as keyof typeof statusMap];
  return <main dir="rtl" className="min-h-screen bg-stone-100 px-4 py-6 text-slate-900 print:bg-white print:p-0"><style>{`@media print { @page { size: A4; margin: 12mm; } .print-actions { display:none !important; } .print-document { box-shadow:none !important; max-width:none !important; border:none !important; } }`}</style><div className="print-actions mx-auto mb-5 flex max-w-[210mm] flex-wrap justify-between gap-3"><Button variant="outline" onClick={() => setLocation(`/supabase-development/licenses/${id}`)}><ArrowRight className="ml-2 h-4 w-4" />العودة للتفاصيل</Button><div className="flex gap-2"><Button variant="outline" onClick={() => window.print()}><Printer className="ml-2 h-4 w-4" />طباعة</Button><Button disabled={exporting} onClick={downloadPdf} className="bg-emerald-900 text-white hover:bg-emerald-800">{exporting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Download className="ml-2 h-4 w-4" />}تصدير PDF</Button></div></div><article className="print-document relative mx-auto min-h-[270mm] max-w-[210mm] overflow-hidden border border-emerald-950/10 bg-white p-7 shadow-xl shadow-slate-950/10 sm:p-11"><div className="absolute inset-x-0 top-0 h-2 bg-emerald-900" /><header className="flex items-start justify-between border-b-2 border-emerald-900 pb-6"><div><p className="text-xs font-bold tracking-[0.15em] text-emerald-800">سجل إلكتروني داخلي</p><h1 className="mt-2 text-2xl font-extrabold text-emerald-950">أرشيف التراخيص</h1><p className="mt-1 text-sm text-slate-600">إدارة المنشآت الصيدلانية</p></div><div className="text-left"><p className="text-xs text-slate-500">رقم الترخيص</p><p className="mt-1 text-2xl font-extrabold text-emerald-950">{String(raw.license_no)}</p>{status && <Badge className={`mt-2 ${status.className}`}>{status.label}</Badge>}</div></header><section className="mt-8"><p className="text-xs font-bold tracking-wider text-emerald-700">بيان ترخيص منشأة</p><h2 className="mt-2 text-3xl font-extrabold text-emerald-950">{String(raw.facility_name)}</h2><p className="mt-2 text-base text-slate-600">{facilityTypeMap[type]}</p></section><section className="mt-8 grid grid-cols-2 border border-emerald-950/15 text-sm">{buildPrintRows(license).map(([label, value]) => <Row key={label} label={label} value={value} />)}</section><section className="mt-7"><h3 className="border-r-4 border-amber-400 pr-3 font-extrabold text-emerald-950">عنوان المنشأة</h3><p className="mt-3 rounded-xl bg-stone-50 p-4 text-sm leading-7 text-slate-700">{String(raw.address ?? "—")}</p></section><footer className="absolute inset-x-0 bottom-0 border-t border-emerald-950/10 px-7 py-5 text-center text-xs text-slate-500 sm:px-11">نسخة إلكترونية للمعاينة الداخلية · تم إنشاؤها من نظام أرشيف التراخيص</footer></article></main>;
}
function Row({ label, value }: { label: string; value: string }) { return <div className="border-b border-l border-emerald-950/10 p-4 even:border-l-0"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 font-bold text-emerald-950">{value}</p></div>; }
function Notice({ title, detail, action }: { title: string; detail: string; action?: () => void }) { return <div dir="rtl" className="m-6 rounded-2xl bg-amber-50 p-6 text-amber-950"><h1 className="text-xl font-extrabold">{title}</h1><p className="mt-3">{detail}</p>{action && <Button className="mt-5 bg-emerald-900 text-white" onClick={action}>فتح مختبر Supabase</Button>}</div>; }
