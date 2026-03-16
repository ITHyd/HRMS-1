import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ToastContainer } from "@/components/shared/ToastContainer"
import { AppLayout } from "@/components/layout/AppLayout"
import { LoginPage } from "@/pages/LoginPage"
import { OrgChartPage } from "@/pages/OrgChartPage"
import { AnalyticsPage } from "@/pages/AnalyticsPage"
import { AuditPage } from "@/pages/AuditPage"
import { TimesheetPage } from "@/pages/TimesheetPage"
import { FinancePage } from "@/pages/FinancePage"
import { DashboardPage } from "@/pages/DashboardPage"
import { AvailabilityPage } from "@/pages/AvailabilityPage"
import { IntegrationPage } from "@/pages/IntegrationPage"
import { EmployeeMasterPage } from "@/pages/EmployeeMasterPage"
import { ProjectListPage } from "@/pages/ProjectListPage"
import { ProjectDetailPage } from "@/pages/ProjectDetailPage"
import { ProjectTimelinePage } from "@/pages/ProjectTimelinePage"
import { SearchResultsPage } from "@/pages/SearchResultsPage"

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/org-chart" element={<OrgChartPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/timesheets" element={<TimesheetPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/availability" element={<AvailabilityPage />} />
          <Route path="/employees" element={<EmployeeMasterPage />} />
          <Route path="/projects" element={<ProjectListPage />} />
          <Route path="/project-timeline" element={<ProjectTimelinePage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/integrations" element={<IntegrationPage />} />
          <Route path="/audit" element={<AuditPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
