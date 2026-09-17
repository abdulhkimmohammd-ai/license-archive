import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Ban, CheckCircle2, Clock3, ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";

const roleMap = { admin: "مدير النظام", archivist: "موظف الأرشيف", user: "غير مفعّل" } as const;
const accessMap = {
  pending: { label: "بانتظار الموافقة", className: "bg-amber-100 text-amber-900", icon: Clock3 },
  approved: { label: "معتمد", className: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  blocked: { label: "محظور", className: "bg-rose-100 text-rose-800", icon: Ban },
} as const;

export default function Team() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.team.list.useQuery();
  const setRole = trpc.team.setRole.useMutation({
    onSuccess: () => { toast.success("تم تحديث صلاحية المستخدم"); void utils.team.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const setAccessStatus = trpc.team.setAccessStatus.useMutation({
    onSuccess: (_, variables) => { toast.success(variables.accessStatus === "approved" ? "تم اعتماد الحساب" : variables.accessStatus === "blocked" ? "تم حظر الحساب" : "أعيد الحساب إلى قائمة الانتظار"); void utils.team.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  return <DashboardLayout><div dir="rtl" className="mx-auto max-w-5xl space-y-6"><header><p className="text-sm font-bold text-emerald-700">إدارة الوصول</p><h1 className="mt-1 text-3xl font-extrabold text-emerald-950">المستخدمون والصلاحيات</h1><p className="mt-2 text-slate-500">لا يصل أي حساب إلى التراخيص أو الوثائق قبل اعتماد بريده من مدير النظام.</p></header><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="p-0"><div className="flex items-center gap-3 border-b border-emerald-950/7 p-5"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><UsersRound className="h-5 w-5" /></span><div><p className="font-extrabold text-emerald-950">الحسابات المخولة</p><p className="mt-1 text-sm text-slate-500">اعتمد البريد أولاً، ثم عيّن الدور المناسب للحساب.</p></div></div>{error ? <p className="p-6 text-rose-700">تعذر تحميل المستخدمين: {error.message}</p> : <div className="divide-y divide-emerald-950/7">{isLoading ? <p className="p-6 text-slate-500">جارٍ التحميل...</p> : data?.map(member => { const access = accessMap[member.accessStatus]; const AccessIcon = access.icon; const isBusy = setRole.isPending || setAccessStatus.isPending; return <div key={member.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-bold text-emerald-950">{member.name || "مستخدم بدون اسم"}</p><p className="mt-1 text-sm text-slate-500" dir="ltr">{member.email || "لا يوجد بريد ظاهر"}</p></div><div className="flex flex-wrap items-center gap-2"><Badge className={access.className}><AccessIcon className="ml-1 h-3.5 w-3.5" />{access.label}</Badge><Badge className={member.role === "admin" ? "bg-amber-100 text-amber-900" : member.role === "archivist" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}>{roleMap[member.role]}</Badge><Select value={member.role} onValueChange={role => setRole.mutate({ userId: member.id, role: role as "user" | "archivist" | "admin" })} disabled={isBusy}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">مدير النظام</SelectItem><SelectItem value="archivist">موظف الأرشيف</SelectItem><SelectItem value="user">غير مفعّل</SelectItem></SelectContent></Select>{member.accessStatus === "pending" ? <Button size="sm" onClick={() => setAccessStatus.mutate({ userId: member.id, accessStatus: "approved" })} disabled={isBusy} className="bg-emerald-800 text-white hover:bg-emerald-700">اعتماد</Button> : member.accessStatus === "approved" ? <Button size="sm" variant="outline" onClick={() => setAccessStatus.mutate({ userId: member.id, accessStatus: "blocked" })} disabled={isBusy} className="border-rose-200 text-rose-700 hover:bg-rose-50">حظر</Button> : <Button size="sm" variant="outline" onClick={() => setAccessStatus.mutate({ userId: member.id, accessStatus: "pending" })} disabled={isBusy} className="border-amber-200 text-amber-800 hover:bg-amber-50">إلغاء الحظر</Button>}</div></div>; })}</div>}</CardContent></Card><div className="rounded-2xl border border-emerald-900/10 bg-emerald-50 p-5 text-sm leading-7 text-emerald-900"><ShieldCheck className="mb-2 h-5 w-5" />تُطبّق حالة الاعتماد والصلاحيات في الخادم؛ لذلك لا يمكن تجاوزها عبر تغيير الواجهة أو فتح رابط مباشر.</div></div></DashboardLayout>;
}
