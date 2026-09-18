import SupabaseDevelopmentLab from "./pages/SupabaseDevelopmentLab";
import SupabaseOperationalDashboard from "./pages/SupabaseOperationalDashboard";
import SupabaseOperationalLicenseForm from "./pages/SupabaseOperationalLicenseForm";
import SupabaseTeamInvitation from "./pages/SupabaseTeamInvitation";
import SupabaseOperationalArchive from "./pages/SupabaseOperationalArchive";
import SupabaseOperationalTeam from "./pages/SupabaseOperationalTeam";
import SupabaseOperationalPrint from "./pages/SupabaseOperationalPrint";
import SupabaseOperationalQr from "./pages/SupabaseOperationalQr";
import SupabaseOperationalLicenseDetails from "./pages/SupabaseOperationalLicenseDetails";
import SupabaseOperationalTrash from "./pages/SupabaseOperationalTrash";
import NotFound from "./pages/NotFound";

import { Route, Switch, Router as WouterRouter } from "wouter";

function IndependentRouter() {
  return (
    <WouterRouter base="/license-archive">
      <Switch>
        <Route
          path="/"
          component={SupabaseDevelopmentLab}
        />

        <Route
          path="/migration-lab/supabase"
          component={SupabaseDevelopmentLab}
        />

        <Route
          path="/supabase-development/dashboard"
          component={SupabaseOperationalDashboard}
        />

        <Route
          path="/supabase-development/licenses/new"
          component={SupabaseOperationalLicenseForm}
        />

        <Route
          path="/supabase-development/invitations/accept"
          component={SupabaseTeamInvitation}
        />

        <Route
          path="/supabase-development/archive"
          component={SupabaseOperationalArchive}
        />

        <Route
          path="/supabase-development/team"
          component={SupabaseOperationalTeam}
        />

        <Route
          path="/supabase-development/licenses/:id/print"
          component={SupabaseOperationalPrint}
        />

        <Route
          path="/supabase-development/licenses/:id/qr"
          component={SupabaseOperationalQr}
        />

        <Route
          path="/supabase-development/licenses/:id"
          component={SupabaseOperationalLicenseDetails}
        />

        <Route
          path="/supabase-development/trash"
          component={SupabaseOperationalTrash}
        />

        <Route
          component={NotFound}
        />
      </Switch>
    </WouterRouter>
  );
}

export default function IndependentApp() {
  return <IndependentRouter />;
}
