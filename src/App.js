import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSession } from './state/session';
import { useUi } from './state/uiStore';
import AppShell from './layouts/AppShell';
import LoginPage from './pages/auth/LoginPage';
import CommandCentre from './pages/command-centre/CommandCentre';
import SituationalOverview from './pages/command-centre/SituationalOverview';
import HazardModule from './pages/hazards/HazardModule';
import MultiHazard from './pages/hazards/MultiHazard';
import AlertsPage from './pages/alerts/AlertsPage';
import IncidentsPage from './pages/incidents/IncidentsPage';
import IncidentDetail from './pages/incidents/IncidentDetail';
import FieldOperations from './pages/operations/FieldOperations';
import Resources from './pages/operations/Resources';
import HistoricalAnalytics from './pages/analytics/HistoricalAnalytics';
import SimulationPage from './pages/simulation/SimulationPage';
import Integrations from './pages/integrations/Integrations';
import ReportsAudit from './pages/admin/ReportsAudit';
import Administration from './pages/admin/Administration';

function RequireAuth({ children }) {
  const session = useSession();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

function ThemeSync() {
  const theme = useUi((s) => s.theme);
  useEffect(() => {
    document.body.dataset.theme = theme;
    try { window.localStorage.setItem('app_theme', theme); } catch { /* ignore */ }
  }, [theme]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<Navigate to="/command-centre" replace />} />
          <Route path="/command-centre" element={<CommandCentre />} />
          <Route path="/situational-overview" element={<SituationalOverview />} />
          <Route path="/hazards/:hazard" element={<HazardModule />} />
          <Route path="/multi-hazard" element={<MultiHazard />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
          <Route path="/field-operations" element={<FieldOperations />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/risk-analysis" element={<Navigate to="/command-centre" replace />} />
          <Route path="/analytics" element={<HistoricalAnalytics />} />
          <Route path="/simulation" element={<SimulationPage />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/reports" element={<ReportsAudit />} />
          <Route path="/administration" element={<Administration />} />
          <Route path="*" element={<Navigate to="/command-centre" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
