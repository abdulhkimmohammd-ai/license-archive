import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";

const Home = lazy(() => import("./pages/Home"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const ArchivePage = lazy(() => import("./pages/ArchivePage"));
const CalibrationSettings = lazy(() => import("./pages/CalibrationSettings"));
const LicenseDetails = lazy(() => import("./pages/LicenseDetails"));
const LicenseEdit = lazy(() => import("./pages/LicenseEdit"));
const LicenseForm = lazy(() => import("./pages/LicenseForm"));
const LicensePrintPreview = lazy(() => import("./pages/LicensePrintPreview"));
const Licenses = lazy(() => import("./pages/Licenses"));
const MinistryLicensePrint = lazy(() => import("./pages/MinistryLicensePrint"));
const Team = lazy(() => import("./pages/Team"));
const TrashPage = lazy(() => import("./pages/TrashPage"));
const SupabaseDevelopmentLab = lazy(() => import("./pages/SupabaseDevelopmentLab"));
const SupabaseOperationalLicenseDetails = lazy(() => import("./pages/SupabaseOperationalLicenseDetails"));
const SupabaseOperationalLicenseForm = lazy(() => import("./pages/SupabaseOperationalLicenseForm"));
const SupabaseTeamInvitation = lazy(() => import("./pages/SupabaseTeamInvitation"));
const SupabaseOperationalTrash = lazy(() => import("./pages/SupabaseOperationalTrash"));
const SupabaseOperationalDashboard = lazy(() => import("./pages/SupabaseOperationalDashboard"));
const SupabaseOperationalArchive = lazy(() => import("./pages/SupabaseOperationalArchive"));
const SupabaseOperationalTeam = lazy(() => import("./pages/SupabaseOperationalTeam"));
const SupabaseOperationalPrint = lazy(() => import("./pages/SupabaseOperationalPrint"));
const SupabaseOperationalQr = lazy(() => import("./pages/SupabaseOperationalQr"));
import ErrorBoundary from "./components/ErrorBoundary";
import PwaStatusBar from "./components/PwaStatusBar";
import { ThemeProvider } from "./contexts/ThemeContext";
import OfflineSyncManager from "./components/OfflineSyncManager";
import SupabaseDevelopmentOfflineManager from "./components/SupabaseDevelopmentOfflineManager";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Suspense fallback={<div dir="rtl" className="grid min-h-screen place-items-center bg-[#f6f8f3] text-sm font-bold text-emerald-900">جارٍ تحميل الصفحة...</div>}>
      <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/licenses"} component={Licenses} />
      <Route path={"/archive"} component={ArchivePage} />
      <Route path={"/licenses/new"} component={LicenseForm} />
      <Route path={"/licenses/:id/edit"} component={LicenseEdit} />
      <Route path={"/licenses/:id/print"} component={LicensePrintPreview} />
      <Route path={"/licenses/:id/ministry-print"} component={MinistryLicensePrint} />
      <Route path={"/licenses/:id"} component={LicenseDetails} />
      <Route path={"/team"} component={Team} />
      <Route path={"/trash"} component={TrashPage} />
      <Route path={"/settings/calibration"} component={CalibrationSettings} />
      <Route path={"/migration-lab/supabase"} component={SupabaseDevelopmentLab} />
      <Route path={"/supabase-development/dashboard"} component={SupabaseOperationalDashboard} />
      <Route path={"/supabase-development/licenses/new"} component={SupabaseOperationalLicenseForm} />
      <Route path={"/supabase-development/invitations/accept"} component={SupabaseTeamInvitation} />
      <Route path={"/supabase-development/archive"} component={SupabaseOperationalArchive} />
      <Route path={"/supabase-development/team"} component={SupabaseOperationalTeam} />
      <Route path={"/supabase-development/licenses/:id/print"} component={SupabaseOperationalPrint} />
      <Route path={"/supabase-development/licenses/:id/qr"} component={SupabaseOperationalQr} />
      <Route path={"/supabase-development/licenses/:id"} component={SupabaseOperationalLicenseDetails} />
      <Route path={"/supabase-development/trash"} component={SupabaseOperationalTrash} />
      <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <PwaStatusBar />
          <OfflineSyncManager />
          <SupabaseDevelopmentOfflineManager />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
