import { Route, Routes } from "react-router-dom";

import AppShell from "./components/AppShell";
import ProtectedRoute from "./auth/ProtectedRoute";
import RoleRoute from "./auth/RoleRoute";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Candidates from "./pages/Candidates";
import CandidateDetail from "./pages/CandidateDetail";
import AdminFreelanceQueue from "./pages/AdminFreelanceQueue";
import AdminOrganizations from "./pages/AdminOrganizations";
import OrgRecruiters from "./pages/OrgRecruiters";
import OrgProfile from "./pages/OrgProfile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Landing from "./pages/public/Landing";
import CareersBoard from "./pages/public/CareersBoard";
import ApplyPage from "./pages/public/ApplyPage";
import About from "./pages/public/About";
import FAQ from "./pages/public/FAQ";
import Pricing from "./pages/public/Pricing";
import NotFound from "./pages/public/NotFound";
import OpenProfiles from "./pages/OpenProfiles";
import FindCandidates from "./pages/FindCandidates";
import Profile from "./pages/Profile";
import Clients from "./pages/Clients";

// Authenticated product lives under /app/* — kept distinct from the
// public surface (/, /jobs/*, /apply/*, /login, /register) so the
// root path can be a marketing landing page rather than the dashboard.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/jobs" element={<CareersBoard all />} />
      <Route path="/jobs/:slug" element={<CareersBoard />} />
      <Route path="/apply/:jobSlug" element={<ApplyPage />} />
      <Route path="/about" element={<About />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route
        path="/app/dashboard"
        element={
          <ProtectedRoute>
            <AppShell>
              <Dashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/jobs"
        element={
          <ProtectedRoute>
            <AppShell>
              <Jobs />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/jobs/:jobId"
        element={
          <ProtectedRoute>
            <AppShell>
              <JobDetail />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/candidates"
        element={
          <ProtectedRoute>
            <AppShell>
              <Candidates />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/candidates/:candidateId"
        element={
          <ProtectedRoute>
            <AppShell>
              <CandidateDetail />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/admin/freelance-queue"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["superadmin"]}>
              <AppShell>
                <AdminFreelanceQueue />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/admin/organizations"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["superadmin"]}>
              <AppShell>
                <AdminOrganizations />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/candidates/find"
        element={
          <ProtectedRoute>
            <AppShell>
              <FindCandidates />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/open-profiles"
        element={
          <ProtectedRoute>
            <AppShell>
              <OpenProfiles />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/profile"
        element={
          <ProtectedRoute>
            <AppShell>
              <Profile />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/clients"
        element={
          <ProtectedRoute>
            <AppShell>
              <Clients />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/org/recruiters"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["org_admin"]}>
              <AppShell>
                <OrgRecruiters />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/org/profile"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["org_admin"]}>
              <AppShell>
                <OrgProfile />
              </AppShell>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      {/* Catch-all — must stay last; react-router matches routes in order. */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
