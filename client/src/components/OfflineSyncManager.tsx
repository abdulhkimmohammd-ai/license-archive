import { useAuth } from "@/_core/hooks/useAuth";
import { buildLicenseCreateInput } from "@/lib/licenseSubmission";
import { getQueuedLicenses, OFFLINE_DATA_EVENT, removeQueuedLicense, setQueuedLicenseError } from "@/lib/offlineLicenses";
import { trpc } from "@/lib/trpc";
import { CloudUpload, Loader2, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";

export default function OfflineSyncManager() {
  const { user } = useAuth();
  const userId = user?.id;
  const utils = trpc.useUtils();
  const create = trpc.licenses.create.useMutation();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState<ReturnType<typeof getQueuedLicenses>>([]);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const refresh = useCallback(() => {
    const items = userId ? getQueuedLicenses(userId) : [];
    setPending((current) => current === items.length ? current : items.length);
    setFailed((current) => {
      const next = items.filter((item) => Boolean(item.error));
      return current.length === next.length && current.every((item, index) => item.id === next[index]?.id && item.error === next[index]?.error) ? current : next;
    });
  }, [userId]);

  const sync = useCallback(async (retryFailed = false) => {
    if (!userId || !navigator.onLine || syncingRef.current) return;
    const items = getQueuedLicenses(userId).filter((item) => retryFailed || !item.error);
    if (!items.length) return refresh();
    syncingRef.current = true;
    setSyncing(true);
    let saved = 0;
    for (const item of items) {
      try { await create.mutateAsync(buildLicenseCreateInput(item.form, item.idempotencyKey || item.id)); removeQueuedLicense(userId, item.id); saved += 1; }
      catch (error) { setQueuedLicenseError(userId, item.id, error instanceof Error ? error.message : "تعذرت مزامنة هذا الترخيص"); }
    }
    await utils.licenses.list.invalidate(); await utils.licenses.dashboard.invalidate(); refresh(); syncingRef.current = false; setSyncing(false);
    if (saved) toast.success(`تمت مزامنة ${saved} ترخيص/تراخيص محفوظة محلياً.`);
  }, [create, refresh, userId, utils]);

  const syncRef = useRef(sync);
  useEffect(() => { syncRef.current = sync; }, [sync]);
  useEffect(() => { refresh(); const onOnline = () => { setOnline(true); void syncRef.current(); }; const onOffline = () => setOnline(false); window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline); window.addEventListener(OFFLINE_DATA_EVENT, refresh); return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener(OFFLINE_DATA_EVENT, refresh); }; }, [refresh]);
  if (!pending) return null;
  return <div dir="rtl" className="no-print fixed bottom-3 left-3 z-[60] max-w-sm rounded-2xl border border-amber-300 bg-amber-50 p-3 shadow-lg"><div className="flex items-start gap-3"><WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" /><div><p className="font-bold text-amber-950">{pending} ترخيص بانتظار المزامنة</p><p className="mt-1 text-xs leading-5 text-amber-900/80">المستندات لا تُحفظ دون اتصال، ويمكن رفعها بعد اكتمال المزامنة.</p>{failed.length > 0 && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs leading-5 text-rose-900">تعذرت مزامنة {failed.length} سجل: {failed[0]?.form.licenseNo} — {failed[0]?.error}</p>}{online && <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => void sync()} disabled={syncing || pending === failed.length} className="bg-emerald-900 text-white hover:bg-emerald-800">{syncing ? <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="ml-2 h-3.5 w-3.5" />}مزامنة الآن</Button>{failed.length > 0 && <Button size="sm" variant="outline" onClick={() => void sync(true)} disabled={syncing}>إعادة محاولة الفاشل</Button>}</div>}</div></div></div>;
}
