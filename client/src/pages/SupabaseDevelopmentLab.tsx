import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { callLicenseApi, changeSupabaseArchiveNumber, createSupabaseOperationalLicense, getSupabaseProfile, updateSupabaseLicense, archiveSupabaseLicense, moveSupabaseLicenseToTrash, restoreSupabaseLicenseFromTrash } from "@/lib/licenseApi";
import { enqueueSupabaseDevelopmentCreate, getSupabaseDevelopmentQueue, type SupabaseDevelopmentCreatePayload } from "@/lib/supabaseDevelopmentOffline";
import { supabaseDevelopment, supabaseDevelopmentEnabled } from "@/lib/supabaseDevelopment";
import { Archive, CheckCircle2, Database, Loader2, LogOut, Search, ShieldCheck, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const blankCreate: SupabaseDevelopmentCreatePayload = { licenseNo: "", facilityName: "", facilityType: "pharmacy", holderName: "", holderNationalId: "", governorate: "", issueDate: "", expiryDate: "" };
type SessionState = { email: string; userId: string } | null;
type LabLicense = { id: string; licenseNo: string; archiveNumber: string; facilityName: string; facilityType: "pharmacy" | "warehouse"; holderName: string; status: string; issueDate: string | null; expiryDate: string | null };
type RawLicense = { id: string; license_no: string; archive_number: string; facility_name: string; facility_type: "pharmacy" | "warehouse"; holder_name: string; status: string; issue_date: string | null; expiry_date: string | null };

function normalizeLicense(row: RawLicense): LabLicense { return { id: row.id, licenseNo: row.license_no, archiveNumber: row.archive_number, facilityName: row.facility_name, facilityType: row.facility_type, holderName: row.holder_name, status: row.status, issueDate: row.issue_date, expiryDate: row.expiry_date }; }

export default function SupabaseDevelopmentLab() {
  const [session, setSession] = useState<SessionState>(null);
  const [profile, setProfile] = useState<{ display_name: string | null; email: string | null; role: string; access_status: string } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [search, setSearch] = useState("");
  const [licenses, setLicenses] = useState<LabLicense[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [reason, setReason] = useState("اختبار إداري موثق");
  const [archiveNumber, setArchiveNumber] = useState("");
  const [createForm, setCreateForm] = useState(blankCreate);
  const [queuedCount, setQueuedCount] = useState(0);
  const [working, setWorking] = useState(false);

  const selected = useMemo(() => licenses.find((item) => item.id === selectedId) ?? null, [licenses, selectedId]);
  const isAdmin = profile?.role === "admin";
  const isArchivist = profile?.role === "archivist";

  const refresh = async (nextSearch = search) => {
    if (!session || !supabaseDevelopment) return;
    setLoading(true);
    try {
      const data = await callLicenseApi<RawLicense[]>("list_operational_licenses", { p_search: nextSearch.trim() || null, p_search_scope: "all", p_facility_type: null, p_status: null, p_governorate: null, p_issue_date_from: null, p_issue_date_to: null, p_archive_date_from: null, p_archive_date_to: null, p_sort_by: "created_at", p_sort_direction: "desc", p_page: 1, p_page_size: 50 });
      setLicenses((data ?? []).map(normalizeLicense));
      setQueuedCount(getSupabaseDevelopmentQueue(session.userId).length);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل سجلات Supabase Development"); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!supabaseDevelopment) return;
    void supabaseDevelopment.auth.getSession().then(({ data }) => { const current = data.session; setSession(current ? { email: current.user.email ?? "", userId: current.user.id } : null); });
    const { data: listener } = supabaseDevelopment.auth.onAuthStateChange((_event, next) => setSession(next ? { email: next.user.email ?? "", userId: next.user.id } : null));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) { setProfile(null); setLicenses([]); return; }
    void getSupabaseProfile().then(setProfile).catch((error) => toast.error(error instanceof Error ? error.message : "تعذر التحقق من صلاحيات الحساب"));
    void refresh();
  }, [session]);
  useEffect(() => { if (session) setQueuedCount(getSupabaseDevelopmentQueue(session.userId).length); }, [session]);

  const signIn = async (event: FormEvent) => { event.preventDefault(); if (!supabaseDevelopment) return; setSigningIn(true); const { error } = await supabaseDevelopment.auth.signInWithPassword({ email, password }); setSigningIn(false); if (error) toast.error(error.message); else toast.success("تم تسجيل الدخول إلى Supabase Development"); };
  const signOut = async () => { await supabaseDevelopment?.auth.signOut(); setSession(null); setProfile(null); };
  const run = async (action: () => Promise<unknown>, success: string) => { setWorking(true); try { await action(); toast.success(success); await refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر إكمال العملية"); } finally { setWorking(false); } };
  const submitCreate = async (event: FormEvent) => { event.preventDefault(); if (!session) return; if (!createForm.licenseNo.trim() || !createForm.facilityName.trim() || !createForm.holderName.trim() || !createForm.holderNationalId.trim() || !createForm.governorate.trim() || !createForm.issueDate || !createForm.expiryDate) { toast.error("يرجى استكمال الحقول الإلزامية قبل الحفظ."); return; } if (!navigator.onLine) { const queued = enqueueSupabaseDevelopmentCreate(session.userId, createForm); if (!queued) toast.error("تعذر حفظ العملية في طابور المختبر"); else if (queued.queued) { setQueuedCount(getSupabaseDevelopmentQueue(session.userId).length); setCreateForm(blankCreate); toast.success("حُفظت العملية في طابور Offline وسيعاد إرسالها عند عودة الاتصال"); } else toast.info("توجد عملية مطابقة محفوظة في الطابور"); return; } await run(() => createSupabaseOperationalLicense(createForm), "تم إنشاء الترخيص في Supabase Development"); setCreateForm(blankCreate); };

  if (!supabaseDevelopmentEnabled || !supabaseDevelopment) return <LabShell><Status title="إعداد Supabase Development غير متاح" detail="لم تُحمّل متغيرات العميل العامة المطلوبة. لا توجد أي محاولة اتصال بقاعدة أخرى." /></LabShell>;
  if (!session) return <LabShell><section className="mx-auto max-w-md rounded-3xl border border-emerald-950/10 bg-white p-7 shadow-xl shadow-emerald-950/5"><div className="mb-5 flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-emerald-800" /><div><h2 className="font-bold text-emerald-950">دخول مختبر Supabase</h2><p className="text-sm text-slate-600">حساب اختبار Development فقط</p></div></div><form className="space-y-4" onSubmit={signIn}><Field label="البريد الإلكتروني"><Input aria-label="البريد الإلكتروني" dir="ltr" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field><Field label="كلمة المرور"><Input aria-label="كلمة المرور" dir="ltr" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field><Button disabled={signingIn} className="w-full bg-emerald-900 hover:bg-emerald-800">{signingIn ? <Loader2 className="animate-spin" /> : "تسجيل دخول المختبر"}</Button></form></section></LabShell>;
  if (!profile) return <LabShell><Status title="جارٍ التحقق من جلسة المختبر" detail="يجري تطبيق RLS حسب JWT المستخدم." /></LabShell>;
  if (profile.access_status !== "approved") return <LabShell><Status title="الحساب غير معتمد" detail="الحساب التجريبي مسجل لكنه لا يملك وصولاً تشغيلياً حتى يعتمد مدير المختبر الدور." /></LabShell>;

  return <LabShell><div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-950/10 bg-white p-4"><div><p className="font-bold text-emerald-950">{profile.display_name || session.email}</p><p className="text-sm text-slate-600">الدور: {isAdmin ? "مدير" : isArchivist ? "موظف أرشيف" : "مستخدم"} · RLS فعّال</p>{queuedCount > 0 && <p className="mt-2 text-sm font-medium text-amber-700">طابور Offline: {queuedCount} عملية تنتظر المزامنة</p>}</div><Button variant="outline" onClick={() => void signOut()}><LogOut className="ml-2 h-4 w-4" />تسجيل الخروج</Button></div><section className="mb-6 rounded-3xl border border-emerald-950/10 bg-white p-5"><div className="mb-4 flex items-center gap-2"><Search className="h-5 w-5 text-emerald-800" /><h2 className="font-bold text-emerald-950">البحث والاستعلام من Supabase Development</h2></div><div className="flex gap-2"><Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void refresh(); }} placeholder="رقم الترخيص أو الأرشفة أو المنشأة أو المالك" /><Button onClick={() => void refresh()}><Search className="ml-2 h-4 w-4" />بحث</Button></div><div className="mt-4 grid gap-3 md:grid-cols-3">{loading ? <p className="text-slate-600">جارٍ التحميل…</p> : licenses.length ? licenses.map((item) => <button key={item.id} onClick={() => { setSelectedId(item.id); setEditName(item.facilityName); setArchiveNumber(item.archiveNumber); }} className={`rounded-2xl border p-4 text-right transition ${selectedId === item.id ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}><p className="font-bold text-emerald-950">{item.facilityName}</p><p className="mt-1 text-sm text-slate-600">{item.licenseNo} · {item.archiveNumber}</p><p className="mt-2 text-xs text-slate-500">{item.status}</p></button>) : <p className="text-slate-600">لا توجد سجلات مطابقة.</p>}</div></section>{(isAdmin || isArchivist) && <section className="mb-6 rounded-3xl border border-emerald-950/10 bg-white p-5"><div className="mb-4 flex items-center gap-2"><Database className="h-5 w-5 text-emerald-800" /><h2 className="font-bold text-emerald-950">إنشاء ترخيص اختبار عبر RPC</h2></div><form onSubmit={(event) => void submitCreate(event)} className="grid gap-3 md:grid-cols-2"><Field label="رقم الترخيص اليدوي"><Input aria-label="رقم الترخيص اليدوي" value={createForm.licenseNo} onChange={(e) => setCreateForm({ ...createForm, licenseNo: e.target.value })} required /></Field><Field label="اسم المنشأة"><Input value={createForm.facilityName} onChange={(e) => setCreateForm({ ...createForm, facilityName: e.target.value })} required /></Field><Field label="صاحب الترخيص"><Input value={createForm.holderName} onChange={(e) => setCreateForm({ ...createForm, holderName: e.target.value })} required /></Field><Field label="رقم الهوية"><Input value={createForm.holderNationalId} onChange={(e) => setCreateForm({ ...createForm, holderNationalId: e.target.value })} required /></Field><Field label="المحافظة"><Input value={createForm.governorate} onChange={(e) => setCreateForm({ ...createForm, governorate: e.target.value })} required /></Field><Field label="النوع"><select className="h-10 rounded-md border border-input bg-background px-3" value={createForm.facilityType} onChange={(e) => setCreateForm({ ...createForm, facilityType: e.target.value as SupabaseDevelopmentCreatePayload["facilityType"] })}><option value="pharmacy">صيدلية</option><option value="warehouse">مخزن</option></select></Field><Field label="تاريخ الإصدار"><Input type="date" value={createForm.issueDate} onChange={(e) => setCreateForm({ ...createForm, issueDate: e.target.value })} required /></Field><Field label="تاريخ الانتهاء"><Input type="date" value={createForm.expiryDate} onChange={(e) => setCreateForm({ ...createForm, expiryDate: e.target.value })} required /></Field><div className="md:col-span-2"><Button disabled={working} className="bg-emerald-900 hover:bg-emerald-800">{working ? <Loader2 className="animate-spin" /> : "إنشاء مع رقم أرشفة مولّد"}</Button></div></form></section>}{selected && <section className="rounded-3xl border border-emerald-950/10 bg-white p-5"><div className="mb-4 flex items-center gap-2"><Archive className="h-5 w-5 text-emerald-800" /><h2 className="font-bold text-emerald-950">إجراءات السجل المحدد</h2></div><p className="mb-4 text-sm text-slate-600">{selected.facilityName} — <strong>{selected.archiveNumber}</strong></p>{isAdmin ? <div className="grid gap-4 lg:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><Field label="تعديل اسم المنشأة"><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></Field><Button className="mt-3" variant="outline" disabled={working} onClick={() => void run(() => updateSupabaseLicense(selected.id, { facilityName: editName }), "تم تعديل بيانات الترخيص مع إبقاء رقم الأرشفة ثابتاً")}>حفظ التعديل</Button></div><div className="rounded-2xl bg-slate-50 p-4"><Field label="رقم الأرشفة الجديد"><Input value={archiveNumber} onChange={(e) => setArchiveNumber(e.target.value)} /></Field><Field label="سبب موثق"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Button className="mt-3" variant="outline" disabled={working} onClick={() => void run(() => changeSupabaseArchiveNumber(selected.id, archiveNumber, reason), "تم تعديل رقم الأرشفة وتسجيل السبب")}>تعديل رقم الأرشفة</Button></div><div className="rounded-2xl bg-slate-50 p-4"><Field label="سبب موثق"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={working} onClick={() => void run(() => archiveSupabaseLicense(selected.id, reason), "تمت الأرشفة وتسجيلها")}>أرشفة</Button><Button variant="outline" disabled={working} onClick={() => void run(() => moveSupabaseLicenseToTrash(selected.id, reason), "تم نقل السجل إلى السلة")}><Trash2 className="ml-2 h-4 w-4" />إلى السلة</Button><Button variant="outline" disabled={working} onClick={() => void run(() => restoreSupabaseLicenseFromTrash(selected.id, reason), "تمت استعادة السجل")}>استعادة</Button></div></div></div> : <p className="text-sm text-slate-600">يمكن للمستخدم العادي القراءة وفق RLS، ولا يمكنه تنفيذ العمليات الإدارية.</p>}</section>}</LabShell>;
}

function LabShell({ children }: { children: React.ReactNode }) { return <main dir="rtl" className="min-h-screen bg-[#f6f8f3] px-4 py-8 text-slate-900 sm:px-6">{children}</main>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1 text-sm font-bold text-slate-700"><span>{label}</span>{children}</label>; }
function Status({ title, detail }: { title: string; detail: string }) { return <div className="mx-auto mt-16 max-w-xl rounded-3xl bg-amber-50 p-8 text-right text-amber-950"><h1 className="text-xl font-extrabold">{title}</h1><p className="mt-3 leading-7">{detail}</p></div>; }
