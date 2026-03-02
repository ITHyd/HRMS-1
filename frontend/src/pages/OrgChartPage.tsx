import { ReactFlowProvider } from "@xyflow/react"
import { OrgChartCanvas } from "@/components/org-chart/OrgChartCanvas"
import { EmployeeDrawer } from "@/components/employee-detail/EmployeeDrawer"

export function OrgChartPage() {
  return (
    <div className="relative h-full">
      <ReactFlowProvider>
        <OrgChartCanvas />
      </ReactFlowProvider>
      <EmployeeDrawer />
    </div>
  )
}
