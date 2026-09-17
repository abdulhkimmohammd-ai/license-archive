import { Button } from "@/components/ui/button";
import { createSupabaseOperationalLicense } from "@/lib/licenseApi";
import { getSupabaseDevelopmentQueue, SUPABASE_OFFLINE_DATA_EVENT, syncSupabaseDevelopmentQueue, type SupabaseDevelopmentQueueItem } from "@/lib/supabaseDevelopmentOffline";
import { supabaseDevelopment } from "@/lib/supabaseDevelopment";
import { CloudUpload, Loader2, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function SupabaseDevelopmentOfflineManager() {
  const [userId, setUserId] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [items, setItems] = useState<SupabaseDevelopmentQueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const syncRef = useRef<(retryFailed?: boolean) => Promise<void>>(async () => undefined);
  const refresh = useCallback(() => { if (userId) setItems(getSupabaseDevelopmentQueue(userId)); }, [userId]);
  const sync = useCallback(async (retryFailed = false) => {
    if (!userId || !navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await syncSupabaseDevelopmentQueue(userId, (payload, idempotencyKey) => createSupabaseOperationalLicense(payload, idempotencyKey), retryFailed);
      refresh();
      if (result.saved) toast.success(`تمت مزامنة ${result.saved} عملية من Supabase Offline`);
    } finally { syncingRef.current = false; setSyncing(false); }
  }, [refresh, userId]);
  useEffect(() => { syncRef.current = sync; }, [sync]);
  useEffect(() => {
    if (!supabaseDevelopment) return;
    void supabaseDevelopment.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: listener } = supabaseDevelopment.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const onOnline = () => { setOnline(true); void syncRef.current(); };
    const onOffline = () => setOnline(false);
    const onData = () => refresh();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(SUPABASE_OFFLINE_DATA_EVENT, onData);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener(SUPABASE_OFFLINE_DATA_EVENT, onData); };
  }, [refresh]);
  useEffect(() => { if (online) void sync(); }, [online, sync]);
  if (!userId || !items.length) return null;
  const failed = items.filter((item) => Boolean(item.error));
  return <div dir="rtl" className="no-print fixed bottom-3 left-3 z-[60] max-w-sm rounded-2xl border border-amber-300 bg-amber-50 p-3 shadow-lg"><div className="flex items-start gap-3"><span className="mt-0.5 text-amber-800">{online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}</span><div className="min-w-0"><p className="font-bold text-amber-950">{items.length} عملية في طابور Supabase Offline</p><p className="mt-1 text-xs leading-5 text-amber-900/80">{online ? "يمكن مزامنتها مع عودة الاتصال." : "سيتم الاحتفاظ بها محلياً حتى عودة الاتصال."}</p>{failed.length > 0 && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs leading-5 text-rose-900">تعذرت مزامنة {failed.length} عملية. آخر خطأ: {failed[0]?.error}</p>} {online && <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => void sync()} disabled={syncing || items.length === failed.length} className="bg-emerald-900 text-white hover:bg-emerald-800">{syncing ? <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="ml-2 h-3.5 w-3.5" />}مزامنة الآن</Button>{failed.length > 0 && <Button size="sm" variant="outline" onClick={() => void sync(true)} disabled={syncing}>إعادة محاولة الفاشل</Button>}</div>}</div></div></div>;
}
