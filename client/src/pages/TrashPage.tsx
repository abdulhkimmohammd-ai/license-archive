import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { facilityTypeMap, formatDate } from "@/lib/licenses";
import { normalizeLicenseNumber } from "@shared/licenseNumber";
import { trpc } from "@/lib/trpc";
import { RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function TrashPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ id: number; licenseNo: string; facilityName: string } | null>(null);
  const [hardDelete, setHardDelete] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const trash = trpc.licenses.trashList.useQuery({ page }, { enabled: user?.role === "admin" });
  const restore = trpc.licenses.restoreFromTrash.useMutation({
    onSuccess: async () => { toast.success("تمت استعادة الترخيص إلى السجل بنجاح"); setSelected(null); await utils.licenses.trashList.invalidate(); await utils.licenses.list.invalidate(); await utils.licenses.archiveList.invalidate(); await utils.licenses.dashboard.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.licenses.deletePermanently.useMutation({
    onSuccess: async () => { toast.success("تم الحذف النهائي للترخيص من السلة وتوثيق العملية"); setSelected(null); setConfirmation(""); await utils.licenses.trashList.invalidate(); await utils.licenses.dashboard.invalidate(); },
    onError: error => toast.error(error.message),
  });

  if (user?.role !== "admin") return <DashboardLayout><div dir="rtl" className="mx-auto max-w-xl py-16 text-center"><ShieldAlert className="mx-auto h-12 w-12 text-rose-700" /><h1 className="mt-4 text-xl font-extrabold text-emerald-950">صلاحية المدير مطلوبة</h1><p className="mt-2 text-slate-600">سلة المحذوفات والاستعادة والحذف النهائي متاحة لمدير النظام فقط.</p></div></DashboardLayout>;

  const items = trash.data?.items ?? [];
  const pagination = trash.data?.pagination;
  const confirmationMatches = selected ? normalizeLicenseNumber(confirmation) === normalizeLicenseNumber(selected.licenseNo) : false;
  const closeDialog = () => { if (!restore.isPending && !remove.isPending) { setSelected(null); setHardDelete(false); setConfirmation(""); } };

  return <DashboardLayout><div dir="rtl" className="mx-auto max-w-6xl space-y-6"><header><p className="text-sm font-bold text-rose-700">إدارة آمنة للبيانات</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold text-emerald-950"><Trash2 className="h-7 w-7 text-rose-700" />سلة المحذوفات</h1><p className="mt-2 max-w-3xl leading-7 text-slate-600">لا تظهر هذه السجلات في البحث أو الأرشفة أو الطباعة. يمكنك استعادتها بالكامل، ولا يظهر الحذف النهائي إلا بعد نقل السجل إلى هذه الصفحة.</p></header>{trash.isLoading ? <Card><CardContent className="p-10 text-center text-slate-500">جارٍ تحميل سلة المحذوفات...</CardContent></Card> : items.length ? <div className="grid gap-4 md:grid-cols-2">{items.map(item => <Card key={item.id} className="border-rose-100 bg-white shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-extrabold text-emerald-950">{item.facilityName}</p><p className="mt-1 text-sm text-slate-600">{item.licenseNo} · {facilityTypeMap[item.facilityType]}</p><p dir="ltr" className="mt-2 text-sm font-bold text-rose-700">{item.archiveNumber}</p></div><span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">في السلة</span></div><div className="mt-4 space-y-1 border-t border-rose-100 pt-4 text-sm text-slate-600"><p>نُقل في: {item.deletedAt ? formatDate(item.deletedAt) : "غير معروف"}</p><p>السبب: {item.deletionReason || "غير مذكور"}</p></div><div className="mt-5 flex flex-wrap gap-2"><Button size="sm" className="bg-emerald-900 text-white hover:bg-emerald-800" onClick={() => { setSelected(item); setHardDelete(false); }}><RotateCcw className="ml-2 h-4 w-4" />استعادة</Button><Button size="sm" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => { setSelected(item); setHardDelete(true); }}><Trash2 className="ml-2 h-4 w-4" />حذف نهائي</Button></div></CardContent></Card>)}</div> : <Card><CardContent className="p-12 text-center text-slate-500">سلة المحذوفات فارغة حالياً.</CardContent></Card>}{pagination && pagination.totalPages > 1 && <div className="flex justify-center gap-2"><Button variant="outline" disabled={page === 1} onClick={() => setPage(current => current - 1)}>السابق</Button><span className="px-4 py-2 text-sm font-bold text-emerald-950">صفحة {pagination.page} من {pagination.totalPages}</span><Button variant="outline" disabled={page === pagination.totalPages} onClick={() => setPage(current => current + 1)}>التالي</Button></div>}<AlertDialog open={Boolean(selected)} onOpenChange={open => !open && closeDialog()}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle className={hardDelete ? "text-rose-800" : "text-emerald-950"}>{hardDelete ? "حذف نهائي من سلة المحذوفات" : "استعادة الترخيص"}</AlertDialogTitle><AlertDialogDescription>{hardDelete ? <>سيُحذف الترخيص ومستنداته وأحداثه المرتبطة نهائياً. اكتب رقم الترخيص للتأكيد: <strong>{selected?.licenseNo}</strong>.</> : <>سيعود ترخيص <strong>{selected?.facilityName}</strong> إلى السجل والأرشفة مع بياناته ووثائقه كما كانت قبل نقله إلى السلة.</>}</AlertDialogDescription></AlertDialogHeader>{hardDelete && <div><Label className="mb-2 block">رقم الترخيص للتأكيد</Label><Input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder={selected?.licenseNo} /></div>}<AlertDialogFooter><AlertDialogCancel disabled={restore.isPending || remove.isPending}>إلغاء</AlertDialogCancel><AlertDialogAction disabled={!selected || restore.isPending || remove.isPending || (hardDelete && !confirmationMatches)} onClick={event => { event.preventDefault(); if (!selected) return; if (hardDelete) remove.mutate({ id: selected.id, confirmation, acknowledged: true }); else restore.mutate({ id: selected.id }); }} className={hardDelete ? "bg-rose-700 text-white hover:bg-rose-800" : "bg-emerald-900 text-white hover:bg-emerald-800"}>{hardDelete ? (remove.isPending ? "جارٍ الحذف..." : "حذف نهائي") : (restore.isPending ? "جارٍ الاستعادة..." : "تأكيد الاستعادة")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></DashboardLayout>;
}
