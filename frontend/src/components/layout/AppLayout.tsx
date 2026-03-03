import { useState } from "react"
import { Outlet, Navigate } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { EmployeeDrawer } from "@/components/employee-detail/EmployeeDrawer"
import { useAuthStore } from "@/store/authStore"

export function AppLayout() {
  const token = useAuthStore((s) => s.token)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <EmployeeDrawer />
    </div>
  )
}
