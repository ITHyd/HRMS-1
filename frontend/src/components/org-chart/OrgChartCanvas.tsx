import { useEffect, useMemo, useCallback, useRef } from "react"
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { EmployeeNode } from "./EmployeeNode"
import { ReportingEdge } from "./ReportingEdge"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useAuthStore } from "@/store/authStore"
import { getFullOrgTree } from "@/api/org"
import { tracePath } from "@/api/org"
import { transformOrgTree, collectOwnBranchIds } from "@/lib/orgTreeTransform"
import { LOCATION_COLORS } from "@/lib/constants"

const nodeTypes: NodeTypes = {
  employeeNode: EmployeeNode,
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
  const expandBranch = useOrgChartStore((s) => s.expandBranch)
  const setLoading = useOrgChartStore((s) => s.setLoading)
  const isLoading = useOrgChartStore((s) => s.isLoading)
  const highlightedPath = useOrgChartStore((s) => s.highlightedPath)
  const setHighlightedPath = useOrgChartStore((s) => s.setHighlightedPath)
  const traceMode = useOrgChartStore((s) => s.traceMode)
  const clearTrace = useOrgChartStore((s) => s.clearTrace)
  const initialized = useRef(false)

  // Fetch org tree on mount
  useEffect(() => {
    async function load() {
      if (!user) return
      setLoading(true)
      try {
        const data = await getFullOrgTree()
        setTreeData(data)

        // Auto-expand own branch nodes
        if (!initialized.current) {
          const branchIds = collectOwnBranchIds(data.nodes)
          expandBranch(branchIds)
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
    })
  }, [treeData, expandedNodeIds, user])

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
    if (nodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100)
    }
  }, [nodes.length])

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
          { zoom: 1.2, duration: 500 }
        )
      }
    }
    window.addEventListener("focus-my-branch", handleFocusBranch)
    return () => window.removeEventListener("focus-my-branch", handleFocusBranch)
  }, [nodes, user, setCenter])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      {traceMode.active && traceMode.fromId && !traceMode.toId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 shadow">
          Click on another employee to trace the reporting path
        </div>
      )}
      {highlightedPath.length > 0 && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => setHighlightedPath([])}
            className="bg-white border rounded-lg px-3 py-1.5 text-sm shadow hover:bg-gray-50"
          >
            Clear highlight
          </button>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls position="bottom-right" />
        <MiniMap
          position="bottom-left"
          nodeColor={(node) => {
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
