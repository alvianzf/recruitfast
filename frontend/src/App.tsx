import { Route, Routes } from "react-router-dom";

import AppShell from "./components/AppShell";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Candidates from "./pages/Candidates";
import Login from "./pages/Login";
import Register from "./pages/Register";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <AppShell>
            <Dashboard />
          </AppShell>
        }
      />
      <Route
        path="/jobs"
        element={
          <AppShell>
            <Jobs />
          </AppShell>
        }
      />
      <Route
        path="/candidates"
        element={
          <AppShell>
            <Candidates />
          </AppShell>
        }
      />
    </Routes>
  );
}
