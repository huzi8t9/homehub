import { Navigate, Route, Routes } from "react-router-dom";
import DashboardTemplate from "./components/templates/DashboardTemplate.jsx";
import ActiveDevicesPage from "./pages/ActiveDevicesPage.jsx";
import HistoricDevicesPage from "./pages/HistoricDevicesPage.jsx";
import NetworkView from "./pages/NetworkView.jsx";

export default function App() {
  return (
    <DashboardTemplate>
      <Routes>
        <Route path="/" element={<ActiveDevicesPage />} />
        <Route path="/historic" element={<HistoricDevicesPage />} />
        <Route path="/network" element={<NetworkView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardTemplate>
  );
}

