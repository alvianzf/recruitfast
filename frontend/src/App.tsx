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
import OrgRecruiters from "./pages/OrgRecruiters";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Landing from "./pages/public/Landing";
import CareersBoard from "./pages/public/CareersBoard";
import ApplyPage from "./pages/public/ApplyPage";
import OpenProfiles from "./pages/OpenProfiles";

// Authenticated product lives under /app/* — kept distinct from the
// public surface (/, /careers/*, /apply/*, /login, /register) so the
// root path can be a marketing landing page rather than the dashboard.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/careers/public" element={<CareersBoard freelance />} />
      <Route path="/careers/:slug" element={<CareersBoard />} />
      <Route path="/apply/:jobSlug" element={<ApplyPage />} />
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
    </Routes>
  );
}
