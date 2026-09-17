import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabaseDevelopment, supabaseDevelopmentEnabled } from "@/lib/supabaseDevelopment";
import { getSupabaseProfile, restoreSupabaseLicenseFromTrash } from "@/lib/licenseApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function SupabaseOperationalTrash() {
  const [, setLocation] = useLocation();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [reason, setReason] = useState("استعادة إدارية موثقة في Development");
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!supabaseDevelopmentEnabled || !supabaseDevelopment) return;
    void supabaseDevelopment.auth.getSession().then(({ data }) => setAccessToken(data.session?.access_token ?? null));
    const { data: listener } = supabaseDevelopment.auth.onAuthStateChange((_event, session) => setAccessToken(session?.access_token ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);
  const profile = useQuery({ queryKey: ["supabase-development", "profile"], enabled: Boolean(accessToken), retry: false, queryFn: getSupabaseProfile });
  const rows = useQuery({ queryKey: ["supabase-development", "trash"], enabled: Boolean(accessToken) && profile.data?.role === "admin", retry: false, queryFn: async () => {
    if (!supabaseDevelopment) throw new Error("Supabase Development غير مضبوط");
    const { data, error } = await supabaseDevelopment.from("licenses").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({ id: String(row.id), facilityName: String(row.facility_name), licenseNo: String(row.license_no), archiveNumber: String(row.archive_number) }));
  } });
  const restore = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => restoreSupabaseLicenseFromTrash(id, reason),
    onSuccess: async () => { toast.success("تمت استعادة السجل من السلة"); await queryClient.invalidateQueries({ queryKey: ["supabase-development", "trash"] }); await queryClient.invalidateQueries({ queryKey: ["supabase-development", "operational-list"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!supabaseDevelopmentEnabled || !supabaseDevelopment) return <Shell><State title="إعداد Supabase Development غير متاح" detail="لم تُحمّل إعدادات العميل العامة." /></Shell>;
  if (!accessToken) return <Shell><State title="يلزم حساب اختبار Supabase" detail="سجل الدخول إلى حساب Development معتمد من صفحة المختبر قبل استخدام السلة التجريبية." action={() => setLocation("/migration-lab/supabase")} /></Shell>;
  if (profile.isLoading || rows.isLoading) return <Shell><div className="grid min-h-96 place-items-center"><Loader2 className="animate-spin text-emerald-700" /></div></Shell>;
  if (profile.data?.role !== "admin") return <Shell><State title="السلة الإدارية محجوبة" detail="تُطبق الصلاحية داخل Supabase RLS وRPC؛ لا يملك هذا الحساب صلاحية الاستعادة." /></Shell>;
  return <Shell><div dir="rtl" className="mx-auto max-w-5xl space-y-6"><header><Button variant="ghost" onClick={() => setLocation("/supabase-development/archive")} className="-mr-3 text-slate-600"><ArrowRight className="ml-1 h-4 w-4" />العودة إلى سجل Supabase</Button><h1 className="mt-3 text-3xl font-extrabold text-emerald-950">سلة المحذوفات — Supabase Development</h1><p className="mt-2 text-slate-500">تحتوي فقط على الحذف الناعم من المسار التجريبي. لا يوجد حذف نهائي في هذه المرحلة.</p></header><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="p-5"><label className="block max-w-xl space-y-2 text-sm font-bold text-slate-700">سبب الاستعادة<Input value={reason} onChange={(event) => setReason(event.target.value)} /></label></CardContent></Card><div className="space-y-3">{rows.error ? <State title="تعذر تحميل السلة" detail={rows.error.message} /> : rows.data?.length ? rows.data.map((row) => <Card key={row.id} className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-extrabold text-emerald-950">{row.facilityName}</p><p className="mt-1 text-sm text-slate-600">{row.licenseNo} · {row.archiveNumber}</p></div><Button variant="outline" disabled={restore.isPending} onClick={() => restore.mutate({ id: row.id, reason })}><RotateCcw className="ml-2 h-4 w-4" />استعادة من السلة</Button></CardContent></Card>) : <Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="grid min-h-48 place-items-center text-slate-500"><div className="text-center"><Trash2 className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3">لا توجد سجلات محذوفة في Supabase Development.</p></div></CardContent></Card>}</div></div></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#f5f7f4] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">{children}</main>; }
function State({ title, detail, action }: { title: string; detail: string; action?: () => void }) { return <div dir="rtl" className="mx-auto mt-16 max-w-xl rounded-3xl bg-amber-50 p-8 text-right text-amber-950"><h1 className="text-xl font-extrabold">{title}</h1><p className="mt-3 leading-7">{detail}</p>{action && <Button className="mt-5 bg-emerald-900 text-white hover:bg-emerald-800" onClick={action}>فتح مختبر Supabase</Button>}</div>; }
