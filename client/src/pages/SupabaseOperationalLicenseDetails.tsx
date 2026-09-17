import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabaseDevelopment, supabaseDevelopmentEnabled } from "@/lib/supabaseDevelopment";
import {
  archiveSupabaseLicense,
  changeSupabaseArchiveNumber,
  getSupabaseLicense,
  getSupabaseLicenseAuditLog,
  getSupabaseLicenseEvents,
  getSupabaseProfile,
  moveSupabaseLicenseToTrash,
  renewSupabaseLicense,
  updateSupabaseLicense,
} from "@/lib/licenseApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowRight, FileText, Loader2, Pencil, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type Session = { accessToken: string } | null;

const eventLabels: Record<string, string> = {
  issued: "إصدار السجل",
  renewed: "تجديد الترخيص",
  updated: "تعديل بيانات",
  status_changed: "تغيير الحالة",
  archive_number_changed: "تعديل رقم الأرشفة",
  archived: "أرشفة الترخيص",
  moved_to_trash: "نقل إلى سلة المحذوفات",
  restored: "استعادة من السلة",
};

export default function SupabaseOperationalLicenseDetails() {
  const [, params] = useRoute("/supabase-development/licenses/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ?? "";
  const [session, setSession] = useState<Session>(null);
  const [facilityName, setFacilityName] = useState("");
  const [archiveNumber, setArchiveNumber] = useState("");
  const [reason, setReason] = useState("إجراء إداري موثق في Development");
  const [renewalIssueDate, setRenewalIssueDate] = useState("");
  const [renewalExpiryDate, setRenewalExpiryDate] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabaseDevelopmentEnabled || !supabaseDevelopment) return;
    void supabaseDevelopment.auth.getSession().then(({ data }) => setSession(data.session ? { accessToken: data.session.access_token } : null));
    const { data: listener } = supabaseDevelopment.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession ? { accessToken: nextSession.access_token } : null));
    return () => listener.subscription.unsubscribe();
  }, []);

  const profile = useQuery({ queryKey: ["supabase-development", "profile"], enabled: Boolean(session), retry: false, queryFn: getSupabaseProfile });
  const license = useQuery({ queryKey: ["supabase-development", "license", id], enabled: Boolean(session && id), retry: false, queryFn: () => getSupabaseLicense(id) });
  const events = useQuery({ queryKey: ["supabase-development", "license-events", id], enabled: Boolean(session && id && profile.data?.role === "admin"), retry: false, queryFn: () => getSupabaseLicenseEvents(id) });
  const audit = useQuery({ queryKey: ["supabase-development", "license-audit", id], enabled: Boolean(session && id && profile.data?.role === "admin"), retry: false, queryFn: () => getSupabaseLicenseAuditLog(id) });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["supabase-development", "license", id] }),
      queryClient.invalidateQueries({ queryKey: ["supabase-development", "license-events", id] }),
      queryClient.invalidateQueries({ queryKey: ["supabase-development", "license-audit", id] }),
      queryClient.invalidateQueries({ queryKey: ["supabase-development", "operational-list"] }),
    ]);
  };
  const mutationOptions = (successMessage: string, after?: () => void | Promise<void>) => ({ onSuccess: async () => { toast.success(successMessage); await refresh(); await after?.(); }, onError: (error: Error) => toast.error(error.message) });
  const update = useMutation({ mutationFn: () => updateSupabaseLicense(id, { facilityName }), ...mutationOptions("تم حفظ التعديل في Supabase Development") });
  const renew = useMutation({ mutationFn: () => renewSupabaseLicense(id, new Date(`${renewalIssueDate}T00:00:00.000Z`), new Date(`${renewalExpiryDate}T00:00:00.000Z`), reason), ...mutationOptions("تم تجديد الترخيص مع الإبقاء على رقم الأرشفة") });
  const changeArchive = useMutation({ mutationFn: () => changeSupabaseArchiveNumber(id, archiveNumber, reason), ...mutationOptions("تم تعديل رقم الأرشفة وتسجيل السبب") });
  const archive = useMutation({ mutationFn: () => archiveSupabaseLicense(id, reason), ...mutationOptions("تمت الأرشفة في Supabase Development") });
  const trash = useMutation({ mutationFn: () => moveSupabaseLicenseToTrash(id, reason), ...mutationOptions("تم نقل السجل إلى السلة", () => setLocation("/supabase-development/trash")) });

  useEffect(() => {
    if (!license.data) return;
    setFacilityName(String(license.data.facility_name ?? ""));
    setArchiveNumber(String(license.data.archive_number ?? ""));
    setRenewalIssueDate(String(license.data.issue_date ?? ""));
    setRenewalExpiryDate(String(license.data.expiry_date ?? ""));
  }, [license.data]);

  if (!supabaseDevelopmentEnabled || !supabaseDevelopment) return <Shell><Notice title="إعداد Supabase Development غير متاح" detail="لم تُحمّل إعدادات العميل العامة لهذا المختبر." /></Shell>;
  if (!session) return <Shell><Notice title="يلزم حساب اختبار Supabase" detail="سجل الدخول إلى حساب Development معتمد من صفحة المختبر قبل فتح التفاصيل التشغيلية." action={() => setLocation("/migration-lab/supabase")} actionLabel="فتح مختبر Supabase" /></Shell>;
  if (profile.isLoading || license.isLoading) return <Shell><div className="grid min-h-96 place-items-center"><Loader2 className="animate-spin text-emerald-700" /></div></Shell>;
  if (profile.error || license.error || !profile.data || !license.data) return <Shell><Notice title="تعذر تحميل التفاصيل" detail={profile.error?.message ?? license.error?.message ?? "لا يوجد سجل متاح"} /></Shell>;

  const isAdmin = profile.data.role === "admin";
  const row = license.data;
  const archived = row.status === "archived";
  const effectiveStatus = archived || row.status === "suspended" || new Date(String(row.expiry_date)).getTime() < Date.now() ? "منتهٍ أو مؤرشف" : "ساري";
  return <Shell><div dir="rtl" className="mx-auto max-w-6xl space-y-6"><header><Button variant="ghost" onClick={() => setLocation("/supabase-development/archive")} className="-mr-3 text-slate-600"><ArrowRight className="ml-1 h-4 w-4" />العودة إلى السجل</Button><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold text-emerald-700">Supabase Development · سجل تجريبي</p><div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-extrabold text-emerald-950">{String(row.facility_name)}</h1><Badge className={effectiveStatus === "ساري" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}>{effectiveStatus}</Badge></div><p className="mt-2 text-slate-600">رقم الترخيص: <strong>{String(row.license_no)}</strong> · رقم الأرشفة: <strong>{String(row.archive_number)}</strong></p></div><div className="flex flex-col items-end gap-2"><p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">معاينة الطباعة وPDF متاحة بالقالب الحالي؛ المرفقات لم تُحوّل.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setLocation(`/supabase-development/licenses/${id}/print`)}>فتح معاينة الطباعة</Button><Button variant="outline" onClick={() => setLocation(`/supabase-development/licenses/${id}/qr`)}>فتح QR</Button></div></div></div></header>
    <section className="grid gap-5 lg:grid-cols-3"><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5 lg:col-span-2"><CardContent className="p-6"><SectionTitle icon={FileText} title="بيانات الترخيص" /><dl className="mt-5 grid gap-x-7 gap-y-5 sm:grid-cols-2"><Data label="رقم الترخيص" value={row.license_no} /><Data label="نوع المنشأة" value={row.facility_type === "pharmacy" ? "صيدلية" : "مخزن أدوية"} /><Data label="المحافظة" value={row.governorate} /><Data label="صاحب الترخيص" value={row.holder_name} /><Data label="رقم الهوية" value={row.holder_national_id} /><Data label="بداية السريان" value={row.issue_date} /><Data label="الانتهاء" value={row.expiry_date} /><Data label="تاريخ قيد الأرشيف" value={row.archive_date || "غير مسجل"} /></dl></CardContent></Card><Card className="border-0 bg-[#fdfaf2] shadow-sm shadow-emerald-950/5"><CardContent className="p-6"><SectionTitle icon={ShieldAlert} title="الحماية والصلاحية" /><p className="mt-5 text-sm leading-7 text-slate-600">الدور الحالي: <strong>{isAdmin ? "مدير" : profile.data.role === "archivist" ? "موظف أرشيف" : "مستخدم"}</strong>. العمليات الإدارية تُتحقق داخل RPC وRLS، وليس عبر إخفاء الأزرار فقط.</p><p className="mt-4 text-sm text-slate-600">حالة الاعتماد: <strong>{profile.data.access_status}</strong></p></CardContent></Card></section>
    {isAdmin && <section className="grid gap-5 lg:grid-cols-2"><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="space-y-4 p-6"><SectionTitle icon={Pencil} title="تعديل بيانات أساسية" /><Input value={facilityName} onChange={(event) => setFacilityName(event.target.value)} aria-label="اسم المنشأة" disabled={archived || update.isPending} /><Button disabled={archived || update.isPending} onClick={() => update.mutate()} variant="outline">حفظ اسم المنشأة</Button><p className="text-xs text-slate-500">رقم الترخيص ورقم الأرشفة لا يُعدلان عبر هذا الإجراء.</p></CardContent></Card><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="space-y-4 p-6"><SectionTitle icon={RefreshCw} title="تجديد الترخيص" /><div className="grid gap-3 sm:grid-cols-2"><Input aria-label="تاريخ بدء التجديد" type="date" value={renewalIssueDate} onChange={(event) => setRenewalIssueDate(event.target.value)} disabled={archived} /><Input aria-label="تاريخ انتهاء التجديد" type="date" value={renewalExpiryDate} onChange={(event) => setRenewalExpiryDate(event.target.value)} disabled={archived} /></div><Input aria-label="سبب الإجراء الإداري" value={reason} onChange={(event) => setReason(event.target.value)} disabled={archived} /><Button disabled={archived || renew.isPending} onClick={() => renew.mutate()} variant="outline">تجديد مع إبقاء رقم الأرشفة</Button></CardContent></Card><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="space-y-4 p-6"><SectionTitle icon={Archive} title="تعديل رقم الأرشفة" /><Input value={archiveNumber} onChange={(event) => setArchiveNumber(event.target.value)} aria-label="رقم الأرشفة الجديد" placeholder="6543-0001ص" disabled={archived} /><Input value={reason} onChange={(event) => setReason(event.target.value)} aria-label="سبب تعديل الأرشفة" disabled={archived} /><Button disabled={archived || changeArchive.isPending} onClick={() => changeArchive.mutate()} variant="outline">تعديل الرقم مع التدقيق</Button></CardContent></Card><Card className="border border-rose-200 bg-rose-50/40 shadow-sm shadow-rose-950/5"><CardContent className="space-y-4 p-6"><SectionTitle icon={Trash2} title="الأرشفة والسلة" /><Input value={reason} onChange={(event) => setReason(event.target.value)} aria-label="سبب الأرشفة أو السلة" /><div className="flex flex-wrap gap-3"><Button disabled={archived || archive.isPending} onClick={() => archive.mutate()} variant="outline">أرشفة السجل</Button><Button disabled={trash.isPending} onClick={() => trash.mutate()} variant="outline">نقل إلى السلة</Button></div></CardContent></Card></section>}
    {isAdmin && <section className="grid gap-5 lg:grid-cols-2"><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="p-6"><SectionTitle icon={Archive} title="سجل الأحداث" /><div className="mt-4 divide-y divide-emerald-950/7">{events.isLoading ? <p className="py-4 text-sm text-slate-500">جارٍ التحميل…</p> : events.data?.length ? events.data.map((event) => <div key={event.id} className="py-3"><p className="font-bold text-emerald-950">{eventLabels[event.event_type] || event.event_type}</p><p className="mt-1 text-sm text-slate-600">{event.note || "حدث تشغيلي موثق"}</p><p className="mt-1 text-xs text-slate-500">{String(event.created_at)}</p></div>) : <p className="py-4 text-sm text-slate-500">لا توجد أحداث ظاهرة.</p>}</div></CardContent></Card><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="p-6"><SectionTitle icon={ShieldAlert} title="سجل التدقيق" /><div className="mt-4 divide-y divide-emerald-950/7">{audit.isLoading ? <p className="py-4 text-sm text-slate-500">جارٍ التحميل…</p> : audit.data?.length ? audit.data.map((entry) => <div key={entry.id} className="py-3"><p className="font-bold text-emerald-950">{entry.action}</p><p className="mt-1 text-sm text-slate-600">بواسطة: {entry.actor_name || "غير معروف"}</p><p className="mt-1 text-xs text-slate-500">{String(entry.created_at)}</p></div>) : <p className="py-4 text-sm text-slate-500">لا توجد عمليات تدقيق ظاهرة.</p>}</div></CardContent></Card></section>}
  </div></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#f5f7f4] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">{children}</main>; }
function Notice({ title, detail, action, actionLabel }: { title: string; detail: string; action?: () => void; actionLabel?: string }) { return <div dir="rtl" className="mx-auto mt-16 max-w-xl rounded-3xl bg-amber-50 p-8 text-right text-amber-950"><h1 className="text-xl font-extrabold">{title}</h1><p className="mt-3 leading-7">{detail}</p>{action && <Button className="mt-5 bg-emerald-900 text-white hover:bg-emerald-800" onClick={action}>{actionLabel}</Button>}</div>; }
function SectionTitle({ icon: Icon, title }: { icon: typeof Archive; title: string }) { return <div className="flex items-center gap-2 text-emerald-950"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><Icon className="h-4 w-4" /></span><h2 className="font-extrabold">{title}</h2></div>; }
function Data({ label, value }: { label: string; value: unknown }) { return <div><dt className="text-xs font-bold text-slate-400">{label}</dt><dd className="mt-1.5 text-sm font-bold text-slate-700">{String(value ?? "غير مسجل")}</dd></div>; }
