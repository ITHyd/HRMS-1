import { ReactFlowProvider } from "@xyflow/react"
import { OrgChartCanvas } from "@/components/org-chart/OrgChartCanvas"

export function OrgChartPage() {
  return (
    <div className="relative h-full">
      <ReactFlowProvider>
        <OrgChartCanvas />
      </ReactFlowProvider>
    </div>
  )
}
