import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { APP_SYNC_STORAGE_KEY, formatSyncTime, getNextSyncTimestamp } from "@/lib/appSync";
import { trpc } from "@/lib/trpc";
import { Archive, Ban, Clock3, FilePlus2, LayoutDashboard, LogOut, RefreshCw, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "لوحة التحكم", path: "/" },
  { icon: Archive, label: "سجل التراخيص", path: "/licenses" },
  { icon: Archive, label: "الأرشفة", path: "/archive" },
  { icon: FilePlus2, label: "إضافة ترخيص", path: "/licenses/new" },
  { icon: Trash2, label: "سلة المحذوفات", path: "/trash", adminOnly: true },
  { icon: UsersRound, label: "المستخدمون", path: "/team", adminOnly: true },
  { icon: ShieldCheck, label: "إعدادات المعايرة", path: "/settings/calibration", adminOnly: true },
];

const roleLabel = (role?: string) => role === "admin" ? "مدير النظام" : role === "archivist" ? "موظف الأرشيف" : "مستخدم";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const utils = trpc.useUtils();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(() => {
    const stored = Number(window.localStorage.getItem(APP_SYNC_STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  });

  const syncApplication = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await utils.invalidate();
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      }
      const timestamp = getNextSyncTimestamp();
      window.localStorage.setItem(APP_SYNC_STORAGE_KEY, String(timestamp));
      setLastSyncAt(timestamp);
      toast.success("تمت مزامنة أحدث البيانات. يجري تحديث التطبيق الآن.");
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      toast.error(error instanceof Error ? `تعذرت المزامنة: ${error.message}` : "تعذرت المزامنة. تحقق من اتصال الإنترنت ثم أعد المحاولة.");
      setSyncing(false);
    }
  };
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#f5f7f3] grid place-items-center p-5">
        <section className="w-full max-w-md rounded-3xl border border-emerald-950/10 bg-white p-8 text-center shadow-xl shadow-emerald-950/5">
          <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-900 text-amber-100"><ShieldCheck /></div>
          <h1 className="text-2xl font-bold text-emerald-950">أرشيف التراخيص</h1>
          <p className="mt-3 leading-7 text-slate-600">يلزم تسجيل الدخول للوصول إلى السجلات والمستندات الخاصة.</p>
          <Button onClick={() => startLogin()} className="mt-7 h-12 w-full bg-emerald-900 text-white hover:bg-emerald-800">تسجيل الدخول الآمن</Button>
        </section>
      </div>
    );
  }

  if (user.accessStatus !== "approved") {
    const blocked = user.accessStatus === "blocked";
    const Icon = blocked ? Ban : Clock3;
    return (
      <div dir="rtl" className="min-h-screen bg-[#f5f7f3] grid place-items-center p-5">
        <section className="w-full max-w-md rounded-3xl border border-emerald-950/10 bg-white p-8 text-center shadow-xl shadow-emerald-950/5">
          <div className={`mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl ${blocked ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}><Icon /></div>
          <h1 className="text-2xl font-bold text-emerald-950">{blocked ? "تم حظر الحساب" : "الحساب بانتظار الاعتماد"}</h1>
          <p className="mt-3 leading-7 text-slate-600">{blocked ? "تم منع هذا الحساب من دخول أرشيف التراخيص. تواصل مع مدير النظام إذا كان ذلك غير متوقع." : "تم تسجيل بريدك بنجاح، لكن لا يمكن الوصول إلى التراخيص أو الوثائق قبل أن يعتمد مدير النظام هذا الحساب."}</p>
          <Button onClick={() => void logout()} variant="outline" className="mt-7 h-11 w-full border-emerald-900/15 text-emerald-900 hover:bg-emerald-50">تسجيل الخروج</Button>
        </section>
      </div>
    );
  }

  return (
    <SidebarProvider dir="rtl" defaultOpen>
      <Sidebar side="right" collapsible="icon" className="border-l border-r-0 border-emerald-950/10 bg-[#103c35] text-white">
        <SidebarHeader className="h-24 border-b border-white/10 px-3 py-4">
          <div className="flex items-center gap-3 px-1 group-data-[collapsible=icon]:justify-center">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-300 text-emerald-950 shadow-lg shadow-black/10"><ShieldCheck className="h-5 w-5" /></div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-bold tracking-wide">أرشيف التراخيص</p>
              <p className="mt-1 text-[11px] text-emerald-100/65">المنشآت الصيدلانية</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-5">
          <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.18em] text-emerald-100/45 group-data-[collapsible=icon]:hidden">القائمة الرئيسية</p>
          <SidebarMenu>
            {menuItems.filter(item => !item.adminOnly || user.role === "admin").map(item => <NavigationItem key={item.path} {...item} />)}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-white/10 p-3">
          <Button onClick={() => void syncApplication()} disabled={syncing} variant="ghost" className="mb-2 h-auto w-full justify-start rounded-xl py-2 text-emerald-50 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:justify-center"><RefreshCw className={`ml-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} /><span className="group-data-[collapsible=icon]:hidden"><span className="block font-medium">{syncing ? "جارٍ مزامنة التطبيق..." : "مزامنة أحدث البيانات"}</span><span className="mt-0.5 block text-[10px] text-emerald-100/55">{formatSyncTime(lastSyncAt)}</span></span></Button>
          <Button onClick={() => void logout()} variant="ghost" className="mb-2 h-10 w-full justify-start rounded-xl text-emerald-50 hover:bg-rose-500/15 hover:text-rose-100 group-data-[collapsible=icon]:justify-center"><LogOut className="ml-2 h-4 w-4" /><span className="group-data-[collapsible=icon]:hidden">تسجيل الخروج</span></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 text-right transition-colors hover:bg-white/10 group-data-[collapsible=icon]:justify-center">
                <Avatar className="h-9 w-9 shrink-0 border border-white/20"><AvatarFallback className="bg-emerald-800 text-xs text-amber-100">{user.name?.charAt(0) || "م"}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-semibold">{user.name || "المستخدم"}</p>
                  <p className="mt-0.5 truncate text-xs text-emerald-100/60">{roleLabel(user.role)}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <div dir="rtl"><DropdownMenuItem onClick={() => void logout()} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="ml-2 h-4 w-4" />تسجيل الخروج</DropdownMenuItem></div>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-[#f5f7f3]">
        <MobileHeader onLogout={() => void logout()} onSync={() => void syncApplication()} syncing={syncing} />
        <main className="min-h-screen px-4 py-5 sm:px-7 sm:py-7 lg:px-10">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function NavigationItem({ icon: Icon, label, path }: { icon: typeof LayoutDashboard; label: string; path: string }) {
  const [location, setLocation] = useLocation();
  const active = location === path || (path === "/licenses" && location.startsWith("/licenses/") && location !== "/licenses/new");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} tooltip={label} onClick={() => setLocation(path)} className="h-11 rounded-xl text-emerald-50 hover:bg-white/10 hover:text-white data-[active=true]:bg-amber-300 data-[active=true]:text-emerald-950 data-[active=true]:shadow-sm">
        <Icon className="h-4 w-4" /><span className="font-medium">{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function MobileHeader({ onLogout, onSync, syncing }: { onLogout: () => void; onSync: () => void; syncing: boolean }) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  return <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-emerald-950/10 bg-[#f5f7f3]/95 px-4 backdrop-blur"><SidebarTrigger className="rounded-xl border border-emerald-950/10 bg-white" /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-emerald-950">أرشيف التراخيص</p><p className="text-[11px] text-slate-500">إدارة المنشآت الصيدلانية</p></div><Button size="icon" variant="outline" onClick={onSync} disabled={syncing} className="shrink-0 border-emerald-200 text-emerald-800 hover:bg-emerald-50" aria-label="مزامنة أحدث البيانات"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /></Button><Button size="icon" variant="outline" onClick={onLogout} className="shrink-0 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800" aria-label="تسجيل الخروج"><LogOut className="h-4 w-4" /></Button></header>;
}
