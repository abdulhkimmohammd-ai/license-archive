import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { acceptSupabaseTeamInvitation, getSupabaseProfile, rejectSupabaseTeamInvitation } from "@/lib/licenseApi";
import { supabaseDevelopment, supabaseDevelopmentEnabled } from "@/lib/supabaseDevelopment";
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function SupabaseTeamInvitation() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const invitationId = params.get("invitation") ?? "";
  const token = params.get("token") ?? "";
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  useEffect(() => {
    if (!supabaseDevelopment) return;
    void supabaseDevelopment.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: listener } = supabaseDevelopment.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => listener.subscription.unsubscribe();
  }, []);
  const act = async (action: "accept" | "reject") => {
    if (!signedIn) { toast.error("سجل الدخول بحساب الاختبار المطابق للبريد المدعو أولاً."); return; }
    if (!invitationId || !token) { toast.error("رابط الدعوة غير مكتمل أو غير صالح."); return; }
    setBusy(true);
    try {
      if (action === "accept") await acceptSupabaseTeamInvitation(invitationId, token);
      else await rejectSupabaseTeamInvitation(invitationId, token);
      setDone(action === "accept" ? "accepted" : "rejected");
      toast.success(action === "accept" ? "تم قبول الدعوة واعتماد الحساب" : "تم رفض الدعوة");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تنفيذ الدعوة"); } finally { setBusy(false); }
  };
  if (!supabaseDevelopmentEnabled || !supabaseDevelopment) return <Shell><Notice title="إعداد Supabase Development غير متاح" detail="لم تُضبط متغيرات العميل العامة." /></Shell>;
  if (done) return <Shell><Card className="mx-auto mt-20 max-w-xl border-0 shadow-sm"><CardContent className="p-8 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">{done === "accepted" ? <CheckCircle2 /> : <XCircle />}</div><h1 className="mt-5 text-2xl font-extrabold text-emerald-950">{done === "accepted" ? "تم قبول الدعوة" : "تم رفض الدعوة"}</h1><p className="mt-3 text-slate-600">يمكنك العودة إلى مختبر Supabase Development لمراجعة الحالة.</p><Button onClick={() => setLocation("/migration-lab/supabase")} className="mt-6 bg-emerald-900 text-white hover:bg-emerald-800">فتح المختبر</Button></CardContent></Card></Shell>;
  if (!signedIn) return <Shell><Notice title="تسجيل الدخول مطلوب" detail="افتح الرابط بعد تسجيل الدخول بحساب الاختبار المطابق للبريد الذي أنشأ له المدير الدعوة. لا تُرسل رمز الدعوة إلى الخادم إلا عند الضغط على قبول أو رفض." action={() => setLocation("/migration-lab/supabase")} /></Shell>;
  return <Shell><Card dir="rtl" className="mx-auto mt-20 max-w-xl border-0 shadow-sm"><CardContent className="p-8 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-800"><ShieldAlert /></div><h1 className="mt-5 text-2xl font-extrabold text-emerald-950">دعوة إلى أرشيف التراخيص</h1><p className="mt-3 leading-7 text-slate-600">تحقق من أن هذا الحساب هو الحساب المقصود قبل قبول الدعوة. سيُطبق الدور داخل Supabase ويسجل القرار في Audit Log.</p><div className="mt-7 flex justify-center gap-3"><Button disabled={busy} onClick={() => void act("accept")} className="bg-emerald-900 text-white hover:bg-emerald-800">{busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="ml-2 h-4 w-4" />}قبول الدعوة</Button><Button disabled={busy} variant="outline" onClick={() => void act("reject")}><XCircle className="ml-2 h-4 w-4" />رفض الدعوة</Button></div></CardContent></Card></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#f5f7f4] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">{children}</main>; }
function Notice({ title, detail, action }: { title: string; detail: string; action?: () => void }) { return <div dir="rtl" className="mx-auto mt-16 max-w-xl rounded-3xl bg-amber-50 p-8 text-right text-amber-950"><h1 className="text-xl font-extrabold">{title}</h1><p className="mt-3 leading-7">{detail}</p>{action && <Button className="mt-5 bg-emerald-900 text-white hover:bg-emerald-800" onClick={action}>فتح مختبر Supabase</Button>}</div>; }
