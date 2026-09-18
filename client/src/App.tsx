import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch, Router as WouterRouter } from "wouter";

import ErrorBoundary from "./components/ErrorBoundary";
import PwaStatusBar from "./components/PwaStatusBar";
import OfflineSyncManager from "./components/OfflineSyncManager";
import SupabaseDevelopmentOfflineManager from "./components/SupabaseDevelopmentOfflineManager";

import { ThemeProvider } from "./contexts/ThemeContext";

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

const SupabaseDevelopmentLab = lazy(
  () => import("./pages/SupabaseDevelopmentLab")
);

const SupabaseOperationalLicenseDetails = lazy(
  () => import("./pages/SupabaseOperationalLicenseDetails")
);

const SupabaseOperationalLicenseForm = lazy(
  () => import("./pages/SupabaseOperationalLicenseForm")
);

const SupabaseTeamInvitation = lazy(
  () => import("./pages/SupabaseTeamInvitation")
);

const SupabaseOperationalTrash = lazy(
  () => import("./pages/SupabaseOperationalTrash")
);

const SupabaseOperationalDashboard = lazy(
  () => import("./pages/SupabaseOperationalDashboard")
);

const SupabaseOperationalArchive = lazy(
  () => import("./pages/SupabaseOperationalArchive")
);

const SupabaseOperationalTeam = lazy(
  () => import("./pages/SupabaseOperationalTeam")
);

const SupabaseOperationalPrint = lazy(
  () => import("./pages/SupabaseOperationalPrint")
);

const SupabaseOperationalQr = lazy(
  () => import("./pages/SupabaseOperationalQr")
);

function Router() {
  return (
    <Suspense
      fallback={
        <div
          dir="rtl"
          className="grid min-h-screen place-items-center bg-[#f6f8f3] text-sm font-bold text-emerald-900"
        >
          جارٍ تحميل الصفحة...
        </div>
      }
    >
      <WouterRouter base="/license-archive">
        <Switch>
          {/* الصفحة الرئيسية */}
          <Route path="/" component={Home} />

          {/* التراخيص */}
          <Route path="/licenses" component={Licenses} />

          <Route
            path="/licenses/new"
            component={LicenseForm}
          />

          <Route
            path="/licenses/:id/edit"
            component={LicenseEdit}
          />

          <Route
            path="/licenses/:id/print"
            component={LicensePrintPreview}
          />

          <Route
            path="/licenses/:id/ministry-print"
            component={MinistryLicensePrint}
          />

          <Route
            path="/licenses/:id"
            component={LicenseDetails}
          />

          {/* الأرشيف */}
          <Route
            path="/archive"
            component={ArchivePage}
          />

          {/* الفريق */}
          <Route
            path="/team"
            component={Team}
          />

          {/* سلة المحذوفات */}
          <Route
            path="/trash"
            component={TrashPage}
          />

          {/* إعدادات المعايرة */}
          <Route
            path="/settings/calibration"
            component={CalibrationSettings}
          />

          {/* مختبر Supabase Development */}
          <Route
            path="/migration-lab/supabase"
            component={SupabaseDevelopmentLab}
          />

          {/* Supabase Development Dashboard */}
          <Route
            path="/supabase-development/dashboard"
            component={SupabaseOperationalDashboard}
          />

          {/* إضافة ترخيص Supabase Development */}
          <Route
            path="/supabase-development/licenses/new"
            component={SupabaseOperationalLicenseForm}
          />

          {/* قبول دعوة الفريق */}
          <Route
            path="/supabase-development/invitations/accept"
            component={SupabaseTeamInvitation}
          />

          {/* أرشيف Supabase Development */}
          <Route
            path="/supabase-development/archive"
            component={SupabaseOperationalArchive}
          />

          {/* فريق Supabase Development */}
          <Route
            path="/supabase-development/team"
            component={SupabaseOperationalTeam}
          />

          {/* طباعة ترخيص Supabase Development */}
          <Route
            path="/supabase-development/licenses/:id/print"
            component={SupabaseOperationalPrint}
          />

          {/* QR ترخيص Supabase Development */}
          <Route
            path="/supabase-development/licenses/:id/qr"
            component={SupabaseOperationalQr}
          />

          {/* تفاصيل ترخيص Supabase Development */}
          <Route
            path="/supabase-development/licenses/:id"
            component={SupabaseOperationalLicenseDetails}
          />

          {/* سلة محذوفات Supabase Development */}
          <Route
            path="/supabase-development/trash"
            component={SupabaseOperationalTrash}
          />

          {/* صفحة 404 */}
          <Route
            path="/404"
            component={NotFound}
          />

          {/* أي مسار غير معروف */}
          <Route component={NotFound} />
        </Switch>
      </WouterRouter>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
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
