import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { LoginPage } from "@/pages/LoginPage"
import { OrgChartPage } from "@/pages/OrgChartPage"
import { AnalyticsPage } from "@/pages/AnalyticsPage"
import { ImportPage } from "@/pages/ImportPage"
import { AuditPage } from "@/pages/AuditPage"
import { useAuthStore } from "@/store/authStore"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<OrgChartPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/audit" element={<AuditPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
