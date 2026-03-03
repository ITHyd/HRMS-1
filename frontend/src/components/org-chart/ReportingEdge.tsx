import { memo } from "react"
import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
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
  const isGridBranch = (data as Record<string, unknown>)?.isGridBranch === true

  let edgePath: string
  if (isGridBranch) {
    // Simple L-shape: horizontal from backbone then vertical down to child
    edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${sourceY} L ${targetX} ${targetY}`
  } else if (isDashed) {
    // Curved bezier for secondary/functional relationships
    ;[edgePath] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    })
  } else {
    ;[edgePath] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 0,
    })
  }

  const strokeColor = isOnPath ? "#3b82f6" : isDashed ? "#a3a3a3" : "#737373"
  const markerId = `arrow-${id}`

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="8"
          viewBox="0 0 8 8"
          refX="4"
          refY="4"
          orient="auto-start-reverse"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" fill={strokeColor} />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: isOnPath ? 3 : isDashed ? 1.5 : 2,
          strokeDasharray: isDashed ? "6 4" : undefined,
          markerEnd: `url(#${markerId})`,
        }}
      />
    </>
  )
}

export const ReportingEdge = memo(ReportingEdgeComponent)
