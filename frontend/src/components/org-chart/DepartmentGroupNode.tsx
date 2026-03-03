import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { DEPARTMENT_COLORS, LOCATION_COLORS } from "@/lib/constants"
import { useOrgChartStore } from "@/store/orgChartStore"
import { ChevronDown, ChevronRight, Users } from "lucide-react"
import type { DepartmentGroupNodeData } from "@/lib/orgTreeTransform"

function DepartmentGroupNodeComponent({ data, id }: NodeProps) {
  const d = data as DepartmentGroupNodeData
  const toggleDeptGroupExpand = useOrgChartStore((s) => s.toggleDeptGroupExpand)
  const deptColor = DEPARTMENT_COLORS[d.department] || "#6b7280"

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleDeptGroupExpand(id)
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative cursor-pointer rounded-lg border-2 border-dashed px-3 py-2 shadow-sm transition-all hover:shadow-md",
        "min-w-[260px] bg-slate-50/80"
      )}
      style={{ borderColor: deptColor + "60" }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />

      <div className="flex items-center gap-2">
        <div
          className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center"
          style={{ backgroundColor: deptColor + "20" }}
        >
          <Users className="h-4 w-4" style={{ color: deptColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{d.department}</p>
          <p className="text-xs text-muted-foreground">
            {d.headcount} {d.headcount === 1 ? "person" : "people"}
          </p>
        </div>
        {d.isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </div>

      <div className="flex gap-1 mt-1.5">
        {Object.entries(d.locationBreakdown).map(([code, count]) => (
          <span
            key={code}
            className="text-[9px] px-1 rounded"
            style={{
              backgroundColor: (LOCATION_COLORS[code] || "#6b7280") + "20",
              color: LOCATION_COLORS[code] || "#6b7280",
            }}
          >
            {code}: {count}
          </span>
        ))}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-lg"
        style={{ backgroundColor: deptColor }}
      />
    </div>
  )
}

export const DepartmentGroupNode = memo(DepartmentGroupNodeComponent)
