import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { LOCATION_COLORS, DEPARTMENT_COLORS } from "@/lib/constants"
import { useOrgChartStore } from "@/store/orgChartStore"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { EmployeeNodeData } from "@/lib/orgTreeTransform"

function EmployeeNodeComponent({ data, id }: NodeProps) {
  const d = data as EmployeeNodeData
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)
  const toggleNodeExpand = useOrgChartStore((s) => s.toggleNodeExpand)
  const highlightedPath = useOrgChartStore((s) => s.highlightedPath)
  const traceMode = useOrgChartStore((s) => s.traceMode)
  const startTrace = useOrgChartStore((s) => s.startTrace)
  const completeTrace = useOrgChartStore((s) => s.completeTrace)
  const focusOnEmployee = useOrgChartStore((s) => s.focusOnEmployee)
  const focusedEmployeeId = useOrgChartStore((s) => s.focusedEmployeeId)

  const isHighlighted = highlightedPath.includes(id)
  const isFocused = focusedEmployeeId === id
  const locColor = LOCATION_COLORS[d.locationCode] || "#6b7280"
  const deptColor = DEPARTMENT_COLORS[d.department] || "#6b7280"

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (traceMode.active && traceMode.fromId && !traceMode.toId) {
      completeTrace(id)
    } else {
      focusOnEmployee(id)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    selectEmployee(id)
  }

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleNodeExpand(id)
  }

  const initials = d.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault()
        startTrace(id)
      }}
      className={cn(
        "relative cursor-pointer rounded-lg border bg-white px-3 py-2 shadow-sm transition-all hover:shadow-md",
        "min-w-[220px]",
        d.isBranchHead && "ring-2 ring-amber-400 ring-offset-1",
        d.isOwnBranch && !d.isBranchHead && "border-indigo-200 bg-indigo-50/30",
        isFocused && "ring-2 ring-blue-500 ring-offset-2 shadow-lg",
        isHighlighted && "ring-2 ring-blue-500 ring-offset-1 shadow-md",
        traceMode.active && "hover:ring-2 hover:ring-green-400"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />

      <div className="flex items-center gap-2.5">
        <div
          className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: locColor }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate leading-tight">{d.name}</p>
          <p className="text-xs text-muted-foreground truncate">{d.designation}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: deptColor }}
            />
            <span className="text-[10px] text-muted-foreground">{d.department}</span>
            <span className="text-[10px] font-medium ml-auto px-1 rounded"
              style={{ backgroundColor: locColor + "20", color: locColor }}
            >
              {d.locationCode}
            </span>
          </div>
        </div>
      </div>

      {d.childCount > 0 && (
        <button
          onClick={handleExpand}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 flex h-5 w-5 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-gray-50 text-gray-500"
        >
          {d.isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
      )}

      {d.childCount > 0 && !d.isExpanded && (
        <span className="absolute -bottom-3 left-1/2 translate-x-3 text-[10px] text-muted-foreground font-medium">
          +{d.childCount}
        </span>
      )}

    </div>
  )
}

export const EmployeeNode = memo(EmployeeNodeComponent)
