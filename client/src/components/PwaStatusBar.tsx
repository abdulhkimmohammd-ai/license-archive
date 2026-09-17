import { Download, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getPwaConnectionLabel, isStandaloneDisplayMode } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaStatusBar() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = () => isStandaloneDisplayMode(
      window.matchMedia("(display-mode: standalone)").matches ? "standalone" : undefined,
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    );
    setInstalled(standalone());

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  };

  const showStatus = !online || Boolean(installPrompt && !installed);
  if (!showStatus) return null;

  return (
    <div dir="rtl" className="no-print fixed inset-x-3 top-3 z-[60] mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-950/10 bg-white/95 px-4 py-3 text-sm text-emerald-950 shadow-xl shadow-emerald-950/10 backdrop-blur" role="status" aria-live="polite">
      <div className="flex min-w-0 items-start gap-2">
        {online ? <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> : <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />}
        <div>
          <p className="font-bold">الحالة: {getPwaConnectionLabel(online ? "online" : "offline")}</p>
          {!online && <p className="mt-0.5 text-xs leading-5 text-slate-600">يمكن فتح الواجهة المثبتة، لكن تحميل السجلات والمزامنة يحتاجان إلى عودة الاتصال.</p>}
        </div>
      </div>
      {installPrompt && !installed && (
        <Button size="sm" onClick={() => void install()} className="shrink-0 bg-emerald-900 text-white hover:bg-emerald-800">
          <Download className="ml-2 h-4 w-4" /> تثبيت التطبيق
        </Button>
      )}
    </div>
  );
}
