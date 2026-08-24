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
import CareersBoard from "./pages/public/CareersBoard";
import ApplyPage from "./pages/public/ApplyPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/careers/public" element={<CareersBoard freelance />} />
      <Route path="/careers/:slug" element={<CareersBoard />} />
      <Route path="/apply/:jobId" element={<ApplyPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <Dashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs"
        element={
          <ProtectedRoute>
            <AppShell>
              <Jobs />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/:jobId"
        element={
          <ProtectedRoute>
            <AppShell>
              <JobDetail />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidates"
        element={
          <ProtectedRoute>
            <AppShell>
              <Candidates />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidates/:candidateId"
        element={
          <ProtectedRoute>
            <AppShell>
              <CandidateDetail />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/freelance-queue"
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
        path="/org/recruiters"
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
