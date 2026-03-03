import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  ReactFlow,
  MiniMap,
  Controls,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { EmployeeNode } from "./EmployeeNode"
import { DepartmentGroupNode } from "./DepartmentGroupNode"
import { ReportingEdge } from "./ReportingEdge"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useAuthStore } from "@/store/authStore"
import { getFullOrgTree } from "@/api/org"
import { tracePath } from "@/api/org"
import {
  transformOrgTree,
  collectIdsUpToDepth,
  computeFocusedNodeIds,
} from "@/lib/orgTreeTransform"
import { LOCATION_COLORS, DEPARTMENT_COLORS } from "@/lib/constants"
import { Maximize, Minimize, X, UserRoundSearch } from "lucide-react"

const nodeTypes: NodeTypes = {
  employeeNode: EmployeeNode,
  departmentGroupNode: DepartmentGroupNode,
}

const edgeTypes: EdgeTypes = {
  reportingEdge: ReportingEdge,
}

export function OrgChartCanvas() {
  const { fitView, setCenter } = useReactFlow()
  const user = useAuthStore((s) => s.user)
  const treeData = useOrgChartStore((s) => s.treeData)
  const setTreeData = useOrgChartStore((s) => s.setTreeData)
  const expandedNodeIds = useOrgChartStore((s) => s.expandedNodeIds)
  const expandedDeptGroups = useOrgChartStore((s) => s.expandedDeptGroups)
  const expandBranch = useOrgChartStore((s) => s.expandBranch)
  const setLoading = useOrgChartStore((s) => s.setLoading)
  const isLoading = useOrgChartStore((s) => s.isLoading)
  const highlightedPath = useOrgChartStore((s) => s.highlightedPath)
  const setHighlightedPath = useOrgChartStore((s) => s.setHighlightedPath)
  const traceMode = useOrgChartStore((s) => s.traceMode)
  const clearTrace = useOrgChartStore((s) => s.clearTrace)
  const focusedEmployeeId = useOrgChartStore((s) => s.focusedEmployeeId)
  const exitFocus = useOrgChartStore((s) => s.exitFocus)
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)
  const initialized = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
      setTimeout(() => fitView({ padding: 0.05, duration: 300 }), 200)
    }
    document.addEventListener("fullscreenchange", handleChange)
    return () => document.removeEventListener("fullscreenchange", handleChange)
  }, [fitView])

  // Fetch org tree on mount
  useEffect(() => {
    async function load() {
      if (!user) return
      setLoading(true)
      try {
        const data = await getFullOrgTree()
        setTreeData(data)

        if (!initialized.current) {
          const initialIds = collectIdsUpToDepth(data.nodes, 2)
          expandBranch(initialIds)
          initialized.current = true
        }
      } catch (err) {
        console.error("Failed to load org tree:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  // Transform tree data into React Flow nodes/edges
  const { nodes, edges } = useMemo(() => {
    if (!treeData || !user)
      return { nodes: [], edges: [] }

    return transformOrgTree(treeData.nodes, treeData.secondary_edges, {
      branchLocationId: user.branch_location_id,
      branchHeadEmployeeId: user.employee_id,
      expandedNodeIds,
      expandedDeptGroups,
    })
  }, [treeData, expandedNodeIds, expandedDeptGroups, user])

  // Compute focused node IDs when focus mode is active
  const focusedNodeIds = useMemo(() => {
    if (!focusedEmployeeId || !treeData) return null
    return computeFocusedNodeIds(
      treeData.nodes,
      treeData.secondary_edges,
      focusedEmployeeId
    )
  }, [focusedEmployeeId, treeData])

  // Style nodes with focus opacity
  const styledNodes = useMemo((): Node[] => {
    if (!focusedNodeIds) return nodes

    return nodes.map((node) => {
      let isFocused = focusedNodeIds.has(node.id)

      // For department group nodes, check if the group's parent is the focused person
      // or if any of its employees are in the focused set
      if (!isFocused && node.type === "departmentGroupNode") {
        const data = node.data as Record<string, unknown>
        const parentId = data.parentId as string
        const employeeIds = data.employeeIds as string[]
        if (focusedNodeIds.has(parentId)) {
          isFocused = true
        } else if (employeeIds?.some((eid) => focusedNodeIds.has(eid))) {
          isFocused = true
        }
      }

      return {
        ...node,
        style: {
          ...node.style,
          opacity: isFocused ? 1 : 0.15,
          transition: "opacity 0.3s ease",
        },
      }
    })
  }, [nodes, focusedNodeIds])

  // Style edges with focus opacity
  const styledEdges = useMemo((): Edge[] => {
    if (!focusedNodeIds) return edges

    const visibleNodeIds = new Set<string>()
    for (const node of styledNodes) {
      if ((node.style?.opacity as number) > 0.5) {
        visibleNodeIds.add(node.id)
      }
    }

    return edges.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        opacity:
          visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
            ? 1
            : 0.08,
        transition: "opacity 0.3s ease",
      },
    }))
  }, [edges, focusedNodeIds, styledNodes])

  // Handle trace mode completion
  useEffect(() => {
    if (traceMode.active && traceMode.fromId && traceMode.toId) {
      tracePath(traceMode.fromId, traceMode.toId)
        .then((res) => {
          setHighlightedPath(res.path)
        })
        .catch(console.error)
        .finally(() => clearTrace())
    }
  }, [traceMode.toId])

  // Auto-fit on data change
  useEffect(() => {
    if (nodes.length > 0 && !focusedEmployeeId) {
      setTimeout(() => fitView({ padding: 0.05, duration: 300 }), 100)
    }
  }, [nodes.length])

  // Focus mode: fit view to focused nodes
  useEffect(() => {
    if (focusedEmployeeId && focusedNodeIds && nodes.length > 0) {
      const focusedNodes = nodes.filter(
        (n) =>
          focusedNodeIds.has(n.id) ||
          (n.type === "departmentGroupNode" &&
            focusedNodeIds.has((n.data as Record<string, unknown>).parentId as string))
      )
      if (focusedNodes.length > 0) {
        setTimeout(() => {
          fitView({
            nodes: focusedNodes,
            padding: 0.3,
            duration: 500,
          })
        }, 100)
      }
    }
  }, [focusedEmployeeId, focusedNodeIds, nodes, fitView])

  // "My Branch" button event
  useEffect(() => {
    const handleFocusBranch = () => {
      if (!user) return
      const branchNode = nodes.find(
        (n) => n.id === user.employee_id
      )
      if (branchNode) {
        setCenter(
          branchNode.position.x + 120,
          branchNode.position.y + 42,
          { zoom: 1.0, duration: 500 }
        )
      }
    }
    window.addEventListener("focus-my-branch", handleFocusBranch)
    return () => window.removeEventListener("focus-my-branch", handleFocusBranch)
  }, [nodes, user, setCenter])

  // Click on canvas background exits focus mode
  const handlePaneClick = useCallback(() => {
    if (focusedEmployeeId) {
      exitFocus()
    }
  }, [focusedEmployeeId, exitFocus])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Get focused employee name for the overlay
  const focusedEmployeeName = focusedEmployeeId
    ? (nodes.find((n) => n.id === focusedEmployeeId)?.data as Record<string, unknown>)?.name as string
    : null

  return (
    <div ref={containerRef} className="h-full w-full bg-white">
      <button
        onClick={toggleFullscreen}
        className="cursor-pointer absolute top-4 right-4 z-20 bg-white border rounded-lg p-2 shadow hover:bg-gray-50 transition-colors"
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
      </button>

      {/* Focus mode overlay */}
      {focusedEmployeeId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          <div className="bg-white border border-blue-200 rounded-lg shadow-md px-4 py-2 flex items-center gap-3">
            <UserRoundSearch className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              Focused on {focusedEmployeeName || "employee"}
            </span>
            <button
              onClick={() => {
                selectEmployee(focusedEmployeeId)
              }}
              className="cursor-pointer text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md transition-colors"
            >
              View Details
            </button>
            <button
              onClick={() => exitFocus()}
              className="cursor-pointer text-gray-400 hover:text-gray-600 transition-colors"
              title="Exit focus"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {traceMode.active && traceMode.fromId && !traceMode.toId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 shadow">
          Click on another employee to trace the reporting path
        </div>
      )}
      {highlightedPath.length > 0 && (
        <div className="absolute top-4 right-16 z-20">
          <button
            onClick={() => setHighlightedPath([])}
            className="cursor-pointer bg-white border rounded-lg px-3 py-1.5 text-sm shadow hover:bg-gray-50"
          >
            Clear highlight
          </button>
        </div>
      )}
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneClick={handlePaneClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls position="bottom-right" />
        <MiniMap
          position="bottom-left"
          nodeColor={(node) => {
            if (node.type === "departmentGroupNode") {
              const data = node.data as Record<string, unknown>
              const dept = data?.department as string
              return DEPARTMENT_COLORS[dept] || "#94a3b8"
            }
            const data = node.data as Record<string, unknown>
            const code = data?.locationCode as string
            return LOCATION_COLORS[code] || "#d1d5db"
          }}
          maskColor="rgba(0,0,0,0.08)"
          className="!bg-white !border"
        />
      </ReactFlow>
    </div>
  )
}
