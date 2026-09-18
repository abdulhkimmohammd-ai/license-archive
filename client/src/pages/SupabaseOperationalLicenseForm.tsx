import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSupabaseOperationalLicense } from "@/lib/licenseApi";
import { enqueueSupabaseDevelopmentCreate, getSupabaseDevelopmentQueue, syncSupabaseDevelopmentQueue, type SupabaseDevelopmentCreatePayload } from "@/lib/supabaseDevelopmentOffline";
import { supabaseDevelopment, supabaseDevelopmentEnabled } from "@/lib/supabaseDevelopment";
import { getTwoYearExpiryInput } from "@/lib/licenses";
import { ArrowRight, Loader2, WifiOff } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Session = { userId: string } | null;
type FormState = SupabaseDevelopmentCreatePayload;

const initialForm: FormState = { licenseNo: "", facilityName: "", facilityType: "warehouse", holderName: "", holderNationalId: "", governorate: "", issueDate: "", expiryDate: "" };

export default function SupabaseOperationalLicenseForm() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<Session>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [queuedCount, setQueuedCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabaseDevelopment) return;
    void supabaseDevelopment.auth.getSession().then(({ data }) => setSession(data.session ? { userId: data.session.user.id } : null));
    const { data: listener } = supabaseDevelopment.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession ? { userId: nextSession.user.id } : null));
    return () => listener.subscription.unsubscribe();
  }, []);

  const syncQueue = useCallback(async () => {
    if (!session || !navigator.onLine || busy) return;
    const items = getSupabaseDevelopmentQueue(session.userId);
    if (!items.length) { setQueuedCount(0); return; }
    setBusy(true);
    try {
      const result = await syncSupabaseDevelopmentQueue(session.userId, (payload, idempotencyKey) => createSupabaseOperationalLicense(payload, idempotencyKey));
      setQueuedCount(result.remaining.length);
      if (result.saved) toast.success(`تمت مزامنة ${result.saved} عملية من طابور Offline بأمان`);
    } finally { setBusy(false); }
  }, [busy, session]);

  useEffect(() => {
    if (!session) return;
    setQueuedCount(getSupabaseDevelopmentQueue(session.userId).length);
    const online = () => { void syncQueue(); };
    window.addEventListener("online", online);
    void syncQueue();
    return () => window.removeEventListener("online", online);
  }, [session, syncQueue]);

  const setValue = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) { toast.error("يلزم تسجيل الدخول بحساب اختبار Supabase معتمد."); return; }
    if (form.licenseNo.trim().length < 1 || form.facilityName.trim().length < 2 || form.holderName.trim().length < 2 || form.holderNationalId.trim().length < 3 || form.governorate.trim().length < 2 || !form.issueDate || !form.expiryDate) {
      toast.error("يرجى استكمال الحقول الإلزامية قبل الحفظ.");
      return;
    }
    if (new Date(form.expiryDate) < new Date(form.issueDate)) { toast.error("تاريخ الانتهاء يجب أن يكون بعد تاريخ بداية السريان."); return; }
    if (!navigator.onLine) {
      const queued = enqueueSupabaseDevelopmentCreate(session.userId, form);
      if (!queued) { toast.error("تعذر حفظ العملية في طابور Offline."); return; }
      if (!queued.queued) { toast.info("توجد عملية مطابقة محفوظة في الطابور."); return; }
      setQueuedCount(getSupabaseDevelopmentQueue(session.userId).length);
      setForm(initialForm);
      toast.success("حُفظ الترخيص محلياً وسيُرسل عند عودة الاتصال.");
      return;
    }
    setBusy(true);
    try {
      const { result } = await createSupabaseOperationalLicense(form);
      toast.success(`تم حفظ الترخيص في Supabase Development برقم أرشفة ${String(result?.archive_number ?? "مُنشأ")}`);
      setForm(initialForm);
      setLocation("/supabase-development/archive");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حفظ الترخيص"); } finally { setBusy(false); }
  };

  if (!supabaseDevelopmentEnabled || !supabaseDevelopment) return <Shell><Notice title="إعداد Supabase Development غير متاح" detail="لم تُضبط متغيرات عميل Development العامة." /></Shell>;
  if (!session) return <Shell><Notice title="يلزم حساب اختبار Supabase" detail="سجل الدخول إلى المختبر بحساب اصطناعي معتمد قبل إضافة ترخيص." action={() => setLocation("/migration-lab/supabase")} /></Shell>;
  return <Shell><div dir="rtl" className="mx-auto max-w-5xl space-y-6"><header><Button variant="ghost" onClick={() => setLocation("/supabase-development/archive")} className="-mr-3 text-slate-600"><ArrowRight className="ml-1 h-4 w-4" />العودة إلى الأرشيف</Button><p className="mt-4 text-sm font-bold text-emerald-700">Supabase Development · نموذج مستقل</p><h1 className="mt-1 text-3xl font-extrabold text-emerald-950">إضافة ترخيص جديد</h1><p className="mt-2 text-slate-500">رقم الترخيص يُدخل يدوياً من الكرت؛ رقم الأرشفة يُحجز تلقائياً داخل RPC الذري.</p>{!navigator.onLine && <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900"><WifiOff className="h-4 w-4" />وضع Offline: سيُحفظ الإدخال محلياً دون مرفقات.</p>}{queuedCount > 0 && <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm font-medium text-sky-900">طابور Offline: {queuedCount} عملية تنتظر المزامنة.</p>}</header><form noValidate onSubmit={submit} className="space-y-5"><Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7"><Field label="رقم الترخيص" required><Input value={form.licenseNo} onChange={(event) => setValue("licenseNo", event.target.value)} required /></Field><Field label="نوع المنشأة" required><Select value={form.facilityType} onValueChange={(value) => { const type = value as FormState["facilityType"]; setForm((current) => ({ ...current, facilityType: type, expiryDate: type === "pharmacy" ? getTwoYearExpiryInput(current.issueDate) : "" })); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="warehouse">مخزن أدوية</SelectItem><SelectItem value="pharmacy">صيدلية</SelectItem></SelectContent></Select></Field><Field label="اسم المنشأة" required><Input value={form.facilityName} onChange={(event) => setValue("facilityName", event.target.value)} required /></Field><Field label="صاحب الترخيص" required><Input value={form.holderName} onChange={(event) => setValue("holderName", event.target.value)} required /></Field><Field label="رقم الهوية" required><Input value={form.holderNationalId} onChange={(event) => setValue("holderNationalId", event.target.value)} required /></Field><Field label="المحافظة" required><Input value={form.governorate} onChange={(event) => setValue("governorate", event.target.value)} required /></Field><Field label="تاريخ بداية سريان الترخيص" required><Input type="date" value={form.issueDate} onChange={(event) => { const issueDate = event.target.value; setForm((current) => ({ ...current, issueDate, expiryDate: current.facilityType === "pharmacy" ? getTwoYearExpiryInput(issueDate) : current.expiryDate })); }} required /></Field><Field label="تاريخ انتهاء الترخيص" required><Input type="date" value={form.expiryDate} onChange={(event) => setValue("expiryDate", event.target.value)} required disabled={form.facilityType === "pharmacy"} /></Field></CardContent></Card><Card className="border-emerald-200 bg-emerald-50/40"><CardContent className="p-5 sm:p-7"><Field label="رقم الأرشيف"><Input value={form.licenseNo ? `سيُنشأ تلقائياً بعد الحفظ حسب النوع: ${form.facilityType === "pharmacy" ? "آخر 4 أرقام-تسلسل رباعي ص" : "آخر 4 أرقام-تسلسل رباعي م"}` : "سيُنشأ تلقائياً بعد إدخال رقم الترخيص"} disabled /></Field><p className="mt-3 text-sm leading-7 text-emerald-900">لا توجد مرفقات في مسار Supabase Development. الإدخال والبحث والطباعة والحفظ تعمل دون AI.</p></CardContent></Card><div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy} className="bg-emerald-900 text-white hover:bg-emerald-800">{busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}{navigator.onLine ? "حفظ الترخيص" : "حفظ في طابور Offline"}</Button><Button type="button" variant="outline" onClick={() => setLocation("/supabase-development/archive")}>إلغاء</Button></div></form></div></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#f5f7f4] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">{children}</main>; }
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="space-y-2 text-sm font-bold text-slate-700"><span>{label}{required ? " *" : ""}</span>{children}</label>; }
function Notice({ title, detail, action }: { title: string; detail: string; action?: () => void }) { return <div dir="rtl" className="mx-auto mt-16 max-w-xl rounded-3xl bg-amber-50 p-8 text-right text-amber-950"><h1 className="text-xl font-extrabold">{title}</h1><p className="mt-3 leading-7">{detail}</p>{action && <Button className="mt-5 bg-emerald-900 text-white hover:bg-emerald-800" onClick={action}>فتح مختبر Supabase</Button>}</div>; }
