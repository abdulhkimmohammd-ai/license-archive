import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { normalizeLicenseNumber } from "@shared/licenseNumber";
import { Archive, Download, FilePenLine, Pencil, Printer, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type LicenseActionTarget = { id: number; licenseNo: string; archiveNumber?: string; facilityName: string; effectiveStatus?: string };

export function LicenseAdminActions({ license, onChanged, compact = false, mode = "all" }: { license: LicenseActionTarget; onChanged?: () => void; compact?: boolean; mode?: "all" | "destructive" }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveNumberOpen, setArchiveNumberOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [archiveNumberReason, setArchiveNumberReason] = useState("");
  const [archiveNumberDraft, setArchiveNumberDraft] = useState(license.archiveNumber || "");
  const [typedLicenseNo, setTypedLicenseNo] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const archive = trpc.licenses.archive.useMutation({
    onSuccess: async () => { toast.success("تمت أرشفة الترخيص مع حفظ السبب في السجل"); setArchiveOpen(false); setReason(""); await utils.licenses.list.invalidate(); await utils.licenses.dashboard.invalidate(); onChanged?.(); },
    onError: error => toast.error(error.message),
  });
  const moveToTrash = trpc.licenses.moveToTrash.useMutation({
    onSuccess: async () => { toast.success("تم نقل الترخيص إلى سلة المحذوفات ويمكن استعادته لاحقاً"); setDeleteOpen(false); setTypedLicenseNo(""); setAcknowledged(false); setReason(""); await utils.licenses.list.invalidate(); await utils.licenses.archiveList.invalidate(); await utils.licenses.dashboard.invalidate(); onChanged?.(); },
    onError: error => toast.error(error.message),
  });
  const changeArchiveNumber = trpc.licenses.changeArchiveNumber.useMutation({
    onSuccess: async () => { toast.success("تم تعديل رقم الأرشفة مع حفظ السبب في سجل التدقيق"); setArchiveNumberOpen(false); setArchiveNumberReason(""); await utils.licenses.list.invalidate(); await utils.licenses.archiveList.invalidate(); onChanged?.(); },
    onError: error => toast.error(error.message),
  });
  const canArchive = license.effectiveStatus !== "archived";
  const confirmationMatches = normalizeLicenseNumber(typedLicenseNo) === normalizeLicenseNumber(license.licenseNo);
  const iconButton = "h-8 w-8";

  return <><div className={`flex flex-wrap items-center gap-1 ${compact ? "justify-start" : "justify-end"}`} onClick={event => event.stopPropagation()}>{mode === "all" && <><Button title="تعديل الترخيص" aria-label="تعديل الترخيص" size="icon" variant="outline" className={iconButton} onClick={() => setLocation(`/licenses/${license.id}/edit`)}><Pencil className="h-3.5 w-3.5" /></Button><Button title="معاينة وطباعة" aria-label="معاينة وطباعة" size="icon" variant="outline" className={iconButton} onClick={() => window.open(`/licenses/${license.id}/print`, "_blank", "noopener,noreferrer")}><Printer className="h-3.5 w-3.5" /></Button><Button title="تصدير PDF" aria-label="تصدير PDF" size="icon" variant="outline" className={iconButton} onClick={() => window.open(`/licenses/${license.id}/print?export=pdf`, "_blank", "noopener,noreferrer")}><Download className="h-3.5 w-3.5" /></Button></>}<Button title="تعديل رقم الأرشفة" aria-label="تعديل رقم الأرشفة" size="icon" variant="outline" className={iconButton} onClick={() => { setArchiveNumberDraft(license.archiveNumber || ""); setArchiveNumberOpen(true); }}><FilePenLine className="h-3.5 w-3.5" /></Button><Button title={canArchive ? "أرشفة الترخيص" : "الترخيص مؤرشف"} aria-label="أرشفة الترخيص" size="icon" variant="outline" disabled={!canArchive} className={iconButton} onClick={() => setArchiveOpen(true)}><Archive className="h-3.5 w-3.5" /></Button><Button title="نقل إلى سلة المحذوفات" aria-label="نقل إلى سلة المحذوفات" size="icon" variant="outline" className={`${iconButton} border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800`} onClick={() => setDeleteOpen(true)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
    <AlertDialog open={archiveNumberOpen} onOpenChange={setArchiveNumberOpen}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>تعديل رقم الأرشفة</AlertDialogTitle><AlertDialogDescription>هذه عملية إدارية حساسة. يجب أن يطابق الرقم الجديد صيغة رقم الترخيص والتسلسل والنوع، ويُحجز نهائياً مع السبب في سجل التدقيق.</AlertDialogDescription></AlertDialogHeader><div className="space-y-4 py-2"><div><Label className="mb-2 block font-bold text-emerald-950">رقم الأرشفة الجديد</Label><Input value={archiveNumberDraft} onChange={event => setArchiveNumberDraft(event.target.value)} dir="ltr" /></div><div><Label className="mb-2 block font-bold text-emerald-950">سبب تعديل رقم الأرشفة</Label><Textarea value={archiveNumberReason} onChange={event => setArchiveNumberReason(event.target.value)} placeholder="اذكر سبباً واضحاً للتعديل" className="min-h-20" /></div></div><AlertDialogFooter><AlertDialogCancel disabled={changeArchiveNumber.isPending}>إلغاء</AlertDialogCancel><AlertDialogAction disabled={changeArchiveNumber.isPending || archiveNumberDraft.trim().length < 10 || archiveNumberReason.trim().length < 5} onClick={event => { event.preventDefault(); changeArchiveNumber.mutate({ id: license.id, archiveNumber: archiveNumberDraft.trim(), reason: archiveNumberReason.trim() }); }} className="bg-emerald-800 text-white hover:bg-emerald-900">{changeArchiveNumber.isPending ? "جارٍ الحفظ..." : "تأكيد تعديل الرقم"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>أرشفة الترخيص</AlertDialogTitle><AlertDialogDescription>ستبقى بيانات الترخيص ووثائقه محفوظة، لكن ستتحول حالته إلى «مؤرشف». يجب كتابة سبب واضح لهذه العملية.</AlertDialogDescription></AlertDialogHeader><div className="py-2"><Label className="mb-2 block font-bold text-emerald-950">سبب الأرشفة</Label><Textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="مثال: إصدار ترخيص بديل برقم جديد" className="min-h-24" /></div><AlertDialogFooter><AlertDialogCancel disabled={archive.isPending}>إلغاء</AlertDialogCancel><AlertDialogAction disabled={archive.isPending || reason.trim().length < 5} onClick={event => { event.preventDefault(); archive.mutate({ id: license.id, reason }); }} className="bg-amber-600 text-white hover:bg-amber-700">{archive.isPending ? "جارٍ الأرشفة..." : "تأكيد الأرشفة"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle className="text-rose-800">نقل إلى سلة المحذوفات</AlertDialogTitle><AlertDialogDescription>سيُخفى الترخيص ومستنداته من السجل والأرشفة والطباعة، لكنه سيبقى محفوظاً وقابلاً للاستعادة من سلة المحذوفات. للتأكيد اكتب رقم الترخيص كما هو تماماً: <strong>{license.licenseNo}</strong>.</AlertDialogDescription></AlertDialogHeader><div className="space-y-4 py-2"><div><Label className="mb-2 block font-bold text-slate-800">رقم الترخيص للتأكيد</Label><Input value={typedLicenseNo} onChange={event => setTypedLicenseNo(event.target.value)} placeholder={license.licenseNo} /></div><div><Label className="mb-2 block font-bold text-slate-800">سبب النقل إلى السلة</Label><Textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="مثال: سجل مكرر أو أُدخل بالخطأ" className="min-h-20" /></div><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><Checkbox checked={acknowledged} onCheckedChange={checked => setAcknowledged(checked === true)} /><span>أقر بأن الترخيص سيُخفى من السجلات، ويمكن لمدير النظام استعادته من سلة المحذوفات.</span></label></div><AlertDialogFooter><AlertDialogCancel disabled={moveToTrash.isPending}>إلغاء</AlertDialogCancel><AlertDialogAction disabled={moveToTrash.isPending || !acknowledged || !confirmationMatches || reason.trim().length < 5} onClick={event => { event.preventDefault(); moveToTrash.mutate({ id: license.id, confirmation: typedLicenseNo, acknowledged: true, reason }); }} className="bg-rose-700 text-white hover:bg-rose-800">{moveToTrash.isPending ? "جارٍ النقل..." : "نقل إلى السلة"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
