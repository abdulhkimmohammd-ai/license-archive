import { lazy, Suspense } from "react";
import { Route, Switch, Router as WouterRouter } from "wouter";

const SupabaseDevelopmentLab = lazy(
  () => import("./pages/SupabaseDevelopmentLab")
);

const SupabaseOperationalDashboard = lazy(
  () => import("./pages/SupabaseOperationalDashboard")
);

const SupabaseOperationalLicenseForm = lazy(
  () => import("./pages/SupabaseOperationalLicenseForm")
);

const SupabaseTeamInvitation = lazy(
  () => import("./pages/SupabaseTeamInvitation")
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

const SupabaseOperationalLicenseDetails = lazy(
  () => import("./pages/SupabaseOperationalLicenseDetails")
);

const SupabaseOperationalTrash = lazy(
  () => import("./pages/SupabaseOperationalTrash")
);

const NotFound = lazy(
  () => import("./pages/NotFound")
);

function LoadingPage() {
  return (
    <div
      dir="rtl"
      className="grid min-h-screen place-items-center bg-[#f6f8f3] text-sm font-bold text-emerald-900"
    >
      جارٍ تحميل الصفحة...
    </div>
  );
}

function IndependentRouter() {
  return (
    <WouterRouter base="/license-archive">
      <Suspense fallback={<LoadingPage />}>
        <Switch>
          {/* الصفحة الرئيسية */}
          <Route
            path="/"
            component={SupabaseDevelopmentLab}
          />

          {/* مختبر Supabase */}
          <Route
            path="/migration-lab/supabase"
            component={SupabaseDevelopmentLab}
          />

          {/* لوحة التحكم */}
          <Route
            path="/supabase-development/dashboard"
            component={SupabaseOperationalDashboard}
          />

          {/* إضافة ترخيص */}
          <Route
            path="/supabase-development/licenses/new"
            component={SupabaseOperationalLicenseForm}
          />

          {/* قبول دعوة الفريق */}
          <Route
            path="/supabase-development/invitations/accept"
            component={SupabaseTeamInvitation}
          />

          {/* الأرشيف */}
          <Route
            path="/supabase-development/archive"
            component={SupabaseOperationalArchive}
          />

          {/* الفريق */}
          <Route
            path="/supabase-development/team"
            component={SupabaseOperationalTeam}
          />

          {/* طباعة الترخيص */}
          <Route
            path="/supabase-development/licenses/:id/print"
            component={SupabaseOperationalPrint}
          />

          {/* QR للترخيص */}
          <Route
            path="/supabase-development/licenses/:id/qr"
            component={SupabaseOperationalQr}
          />

          {/* تفاصيل الترخيص */}
          <Route
            path="/supabase-development/licenses/:id"
            component={SupabaseOperationalLicenseDetails}
          />

          {/* سلة المحذوفات */}
          <Route
            path="/supabase-development/trash"
            component={SupabaseOperationalTrash}
          />

          {/* أي مسار غير معروف */}
          <Route
            component={NotFound}
          />
        </Switch>
      </Suspense>
    </WouterRouter>
  );
}

export default function IndependentApp() {
  return <IndependentRouter />;
}
