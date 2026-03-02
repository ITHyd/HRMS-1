import { memo } from "react"
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react"
import { useOrgChartStore } from "@/store/orgChartStore"

function ReportingEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  source,
  target,
}: EdgeProps) {
  const highlightedPath = useOrgChartStore((s) => s.highlightedPath)
  const relationType = (data as Record<string, unknown>)?.relationType as string

  const isDashed = relationType !== "PRIMARY"
  const isOnPath =
    highlightedPath.includes(source) && highlightedPath.includes(target)

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: isOnPath ? "#3b82f6" : isDashed ? "#a3a3a3" : "#737373",
        strokeWidth: isOnPath ? 3 : isDashed ? 1.5 : 2,
        strokeDasharray: isDashed ? "6 4" : undefined,
      }}
    />
  )
}

export const ReportingEdge = memo(ReportingEdgeComponent)
