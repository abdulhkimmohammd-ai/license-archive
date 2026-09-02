import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";

const SupabaseDevelopmentLab = lazy(() => import("./pages/SupabaseDevelopmentLab"));
const SupabaseOperationalDashboard = lazy(() => import("./pages/SupabaseOperationalDashboard"));
const SupabaseOperationalLicenseForm = lazy(() => import("./pages/SupabaseOperationalLicenseForm"));
const SupabaseTeamInvitation = lazy(() => import("./pages/SupabaseTeamInvitation"));
const SupabaseOperationalArchive = lazy(() => import("./pages/SupabaseOperationalArchive"));
const SupabaseOperationalTeam = lazy(() => import("./pages/SupabaseOperationalTeam"));
const SupabaseOperationalPrint = lazy(() => import("./pages/SupabaseOperationalPrint"));
const SupabaseOperationalQr = lazy(() => import("./pages/SupabaseOperationalQr"));
const SupabaseOperationalLicenseDetails = lazy(() => import("./pages/SupabaseOperationalLicenseDetails"));
const SupabaseOperationalTrash = lazy(() => import("./pages/SupabaseOperationalTrash"));
const NotFound = lazy(() => import("./pages/NotFound"));

function IndependentRouter() {
  return <Suspense fallback={<div dir="rtl" className="grid min-h-screen place-items-center bg-[#f6f8f3] text-sm font-bold text-emerald-900">جارٍ تحميل الصفحة...</div>}><Switch>
    <Route path="/" component={SupabaseDevelopmentLab} />
    <Route path="/migration-lab/supabase" component={SupabaseDevelopmentLab} />
    <Route path="/supabase-development/dashboard" component={SupabaseOperationalDashboard} />
    <Route path="/supabase-development/licenses/new" component={SupabaseOperationalLicenseForm} />
    <Route path="/supabase-development/invitations/accept" component={SupabaseTeamInvitation} />
    <Route path="/supabase-development/archive" component={SupabaseOperationalArchive} />
    <Route path="/supabase-development/team" component={SupabaseOperationalTeam} />
    <Route path="/supabase-development/licenses/:id/print" component={SupabaseOperationalPrint} />
    <Route path="/supabase-development/licenses/:id/qr" component={SupabaseOperationalQr} />
    <Route path="/supabase-development/licenses/:id" component={SupabaseOperationalLicenseDetails} />
    <Route path="/supabase-development/trash" component={SupabaseOperationalTrash} />
    <Route component={NotFound} />
  </Switch></Suspense>;
}

export default function IndependentApp() {
  return <IndependentRouter />;
}
