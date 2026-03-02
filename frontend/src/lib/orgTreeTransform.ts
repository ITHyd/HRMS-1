import dagre from "@dagrejs/dagre"
import type { Node, Edge } from "@xyflow/react"
import type { OrgTreeNode, SecondaryEdge } from "@/types/org"

const NODE_WIDTH = 240
const NODE_HEIGHT = 84

export interface EmployeeNodeData {
  name: string
  designation: string
  department: string
  locationCode: string
  locationCity: string
  level: string
  photoUrl?: string
  isBranchHead: boolean
  isOwnBranch: boolean
  childCount: number
  isExpanded: boolean
  [key: string]: unknown
}

interface TransformOptions {
  branchLocationId: string
  branchHeadEmployeeId: string
  expandedNodeIds: Set<string>
}

function flattenTree(
  nodes: OrgTreeNode[],
  rfNodes: Node[],
  rfEdges: Edge[],
  options: TransformOptions,
  parentId?: string
) {
  for (const node of nodes) {
    const isExpanded = options.expandedNodeIds.has(node.id)
    const childCount = countDescendants(node)

    rfNodes.push({
      id: node.id,
      type: "employeeNode",
      position: { x: 0, y: 0 },
      data: {
        name: node.name,
        designation: node.designation,
        department: node.department,
        locationCode: node.location_code,
        locationCity: node.location_city,
        level: node.level,
        photoUrl: node.photo_url,
        isBranchHead: node.is_branch_head,
        isOwnBranch: node.is_own_branch,
        childCount: node.children.length,
        isExpanded,
      } satisfies EmployeeNodeData,
    })

    if (parentId) {
      rfEdges.push({
        id: `e-${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: "reportingEdge",
        data: { relationType: "PRIMARY" },
      })
    }

    if (isExpanded && node.children.length > 0) {
      flattenTree(node.children, rfNodes, rfEdges, options, node.id)
    }
  }
}

function countDescendants(node: OrgTreeNode): number {
  let count = node.children.length
  for (const child of node.children) {
    count += countDescendants(child)
  }
  return count
}

export function transformOrgTree(
  treeRoots: OrgTreeNode[],
  secondaryEdges: SecondaryEdge[],
  options: TransformOptions
): { nodes: Node[]; edges: Edge[] } {
  const rfNodes: Node[] = []
  const rfEdges: Edge[] = []

  flattenTree(treeRoots, rfNodes, rfEdges, options)

  // Add secondary (dashed) edges — only if both source and target are visible
  const visibleIds = new Set(rfNodes.map((n) => n.id))
  for (const rel of secondaryEdges) {
    if (visibleIds.has(rel.from_id) && visibleIds.has(rel.to_id)) {
      rfEdges.push({
        id: `sec-${rel.from_id}-${rel.to_id}`,
        source: rel.to_id,
        target: rel.from_id,
        type: "reportingEdge",
        data: { relationType: rel.type },
      })
    }
  }

  // Dagre layout
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 120 })

  rfNodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  // Only use primary edges for layout
  rfEdges
    .filter((e) => !e.id.startsWith("sec-"))
    .forEach((edge) => {
      g.setEdge(edge.source, edge.target)
    })

  dagre.layout(g)

  rfNodes.forEach((node) => {
    const pos = g.node(node.id)
    if (pos) {
      node.position = { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 }
    }
  })

  return { nodes: rfNodes, edges: rfEdges }
}

export function collectOwnBranchIds(
  nodes: OrgTreeNode[],
  result: string[] = []
): string[] {
  for (const node of nodes) {
    if (node.is_own_branch) {
      result.push(node.id)
    }
    if (node.children.length > 0) {
      collectOwnBranchIds(node.children, result)
    }
  }
  return result
}

export function findNodeById(
  nodes: OrgTreeNode[],
  id: string
): OrgTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNodeById(node.children, id)
    if (found) return found
  }
  return null
}
