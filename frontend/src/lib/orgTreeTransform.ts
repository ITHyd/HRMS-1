import dagre from "@dagrejs/dagre"
import type { Node, Edge } from "@xyflow/react"
import type { OrgTreeNode, SecondaryEdge } from "@/types/org"

const NODE_WIDTH = 240
const NODE_HEIGHT = 84
const GROUP_NODE_WIDTH = 280
const GROUP_NODE_HEIGHT = 72
export const DEPT_GROUP_THRESHOLD = 10
const MAX_CHILDREN_PER_ROW = 8
const NODES_PER_SIDE = 4

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

export interface DepartmentGroupNodeData {
  parentId: string
  department: string
  departmentId: string
  headcount: number
  employeeIds: string[]
  isExpanded: boolean
  locationBreakdown: Record<string, number>
  [key: string]: unknown
}

interface TransformOptions {
  branchLocationId: string
  branchHeadEmployeeId: string
  expandedNodeIds: Set<string>
  expandedDeptGroups: Set<string>
}

function emitDepartmentGroups(
  parentNode: OrgTreeNode,
  rfNodes: Node[],
  rfEdges: Edge[],
  options: TransformOptions
) {
  const deptMap = new Map<string, OrgTreeNode[]>()
  for (const child of parentNode.children) {
    const key = child.department_id || "general"
    if (!deptMap.has(key)) deptMap.set(key, [])
    deptMap.get(key)!.push(child)
  }

  for (const [deptId, children] of deptMap) {
    const groupId = `dept-group-${parentNode.id}-${deptId}`
    const isGroupExpanded = options.expandedDeptGroups.has(groupId)
    const deptName = children[0].department || "General"

    const locationBreakdown: Record<string, number> = {}
    for (const c of children) {
      const code = c.location_code || "?"
      locationBreakdown[code] = (locationBreakdown[code] || 0) + 1
    }

    rfNodes.push({
      id: groupId,
      type: "departmentGroupNode",
      position: { x: 0, y: 0 },
      width: GROUP_NODE_WIDTH,
      height: GROUP_NODE_HEIGHT,
      data: {
        parentId: parentNode.id,
        department: deptName,
        departmentId: deptId,
        headcount: children.length,
        employeeIds: children.map((c) => c.id),
        isExpanded: isGroupExpanded,
        locationBreakdown,
      } satisfies DepartmentGroupNodeData,
    })

    rfEdges.push({
      id: `e-${parentNode.id}-${groupId}`,
      source: parentNode.id,
      target: groupId,
      type: "reportingEdge",
      data: { relationType: "PRIMARY" },
    })

    if (isGroupExpanded) {
      flattenTree(children, rfNodes, rfEdges, options, groupId)
    }
  }
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

    rfNodes.push({
      id: node.id,
      type: "employeeNode",
      position: { x: 0, y: 0 },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
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
      if (node.children.length > DEPT_GROUP_THRESHOLD) {
        emitDepartmentGroups(node, rfNodes, rfEdges, options)
      } else {
        flattenTree(node.children, rfNodes, rfEdges, options, node.id)
      }
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

/**
 * After dagre layout, rearrange sibling groups that exceed MAX_CHILDREN_PER_ROW
 * into a multi-row grid so the tree doesn't stretch infinitely wide.
 */
function rearrangeWideRows(rfNodes: Node[], rfEdges: Edge[]) {
  const primaryEdges = rfEdges.filter((e) => !e.id.startsWith("sec-"))

  // Build parent → child IDs map
  const childrenMap = new Map<string, string[]>()
  for (const edge of primaryEdges) {
    if (!childrenMap.has(edge.source)) childrenMap.set(edge.source, [])
    childrenMap.get(edge.source)!.push(edge.target)
  }

  const nodeMap = new Map<string, Node>()
  for (const node of rfNodes) nodeMap.set(node.id, node)

  // Recursively collect all descendant IDs
  function collectDescendants(id: string, result: Set<string>) {
    const kids = childrenMap.get(id)
    if (!kids) return
    for (const kid of kids) {
      result.add(kid)
      collectDescendants(kid, result)
    }
  }

  for (const [parentId, childIds] of childrenMap) {
    if (childIds.length <= MAX_CHILDREN_PER_ROW) continue

    const parent = nodeMap.get(parentId)
    if (!parent) continue

    const children = childIds
      .map((id) => nodeMap.get(id))
      .filter((n): n is Node => !!n)

    // Sort by dagre X position to preserve relative order
    children.sort((a, b) => a.position.x - b.position.x)

    const isGroup = children[0].type === "departmentGroupNode"
    const nodeW = isGroup ? GROUP_NODE_WIDTH : NODE_WIDTH
    const nodeH = isGroup ? GROUP_NODE_HEIGHT : NODE_HEIGHT
    const colGap = 80
    const rowGap = 300
    const colWidth = nodeW + colGap
    const rowHeight = nodeH + rowGap

    const originalY = children[0].position.y
    const parentW = parent.type === "departmentGroupNode" ? GROUP_NODE_WIDTH : NODE_WIDTH
    const parentCenterX = parent.position.x + parentW / 2

    const spineGap = 40 // gap between backbone and first node in the row

    for (let i = 0; i < children.length; i++) {
      const row = Math.floor(i / MAX_CHILDREN_PER_ROW)
      const posInRow = i % MAX_CHILDREN_PER_ROW

      // Split each row: first half LEFT, second half RIGHT
      const nodesInRow = Math.min(MAX_CHILDREN_PER_ROW, children.length - row * MAX_CHILDREN_PER_ROW)
      const leftCount = Math.min(NODES_PER_SIDE, Math.ceil(nodesInRow / 2))
      const isLeftSide = posInRow < leftCount

      let newX: number
      if (isLeftSide) {
        const col = posInRow
        const leftWidth = leftCount * colWidth - colGap
        const startX = parentCenterX - spineGap - leftWidth
        newX = startX + col * colWidth
      } else {
        const col = posInRow - leftCount
        const startX = parentCenterX + spineGap
        newX = startX + col * colWidth
      }

      const newY = originalY + row * rowHeight
      const yDelta = newY - children[i].position.y

      children[i].position = { x: newX, y: newY }

      // Shift all descendants by the same Y delta
      if (yDelta !== 0) {
        const descendants = new Set<string>()
        collectDescendants(children[i].id, descendants)
        for (const descId of descendants) {
          const desc = nodeMap.get(descId)
          if (desc) {
            desc.position = { x: desc.position.x, y: desc.position.y + yDelta }
          }
        }
      }
    }

    // Chain edges row-by-row so they don't cross through intermediate rows.
    // Row 0 children keep their direct parent → child edges.
    // Row N (N>0) children connect from the backbone-adjacent child in row N-1.
    const rowCount = Math.ceil(children.length / MAX_CHILDREN_PER_ROW)
    for (let r = 1; r < rowCount; r++) {
      const prevRowStart = (r - 1) * MAX_CHILDREN_PER_ROW
      const prevNodesInRow = Math.min(MAX_CHILDREN_PER_ROW, children.length - prevRowStart)
      const prevLeftCount = Math.min(NODES_PER_SIDE, Math.ceil(prevNodesInRow / 2))
      // Connector: rightmost left-side child (closest to backbone)
      const connector = children[prevRowStart + prevLeftCount - 1]

      const currRowStart = r * MAX_CHILDREN_PER_ROW
      const currRowEnd = Math.min(currRowStart + MAX_CHILDREN_PER_ROW, children.length)

      for (let i = currRowStart; i < currRowEnd; i++) {
        const childId = children[i].id
        const edgeIdx = rfEdges.findIndex(
          (e) => e.source === parentId && e.target === childId
        )
        if (edgeIdx !== -1) {
          rfEdges[edgeIdx] = {
            ...rfEdges[edgeIdx],
            id: `e-${connector.id}-${childId}`,
            source: connector.id,
          }
        }
      }
    }
  }
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
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 120 })

  rfNodes.forEach((node) => {
    if (node.type === "departmentGroupNode") {
      g.setNode(node.id, { width: GROUP_NODE_WIDTH, height: GROUP_NODE_HEIGHT })
    } else {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    }
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
    const w = node.type === "departmentGroupNode" ? GROUP_NODE_WIDTH : NODE_WIDTH
    const h = node.type === "departmentGroupNode" ? GROUP_NODE_HEIGHT : NODE_HEIGHT
    if (pos) {
      node.position = { x: pos.x - w / 2, y: pos.y - h / 2 }
    }
  })

  // Wrap wide sibling rows into a multi-row grid
  rearrangeWideRows(rfNodes, rfEdges)

  return { nodes: rfNodes, edges: rfEdges }
}

export function computeFocusedNodeIds(
  treeRoots: OrgTreeNode[],
  secondaryEdges: SecondaryEdge[],
  focusedId: string
): Set<string> {
  const focused = new Set<string>()
  focused.add(focusedId)

  // Build parent map
  const parentMap = new Map<string, string>()
  function buildParentMap(nodes: OrgTreeNode[], parentId?: string) {
    for (const node of nodes) {
      if (parentId) parentMap.set(node.id, parentId)
      buildParentMap(node.children, node.id)
    }
  }
  buildParentMap(treeRoots)

  // Add parent (manager)
  const parentId = parentMap.get(focusedId)
  if (parentId) focused.add(parentId)

  // Add direct reports
  const focusedNode = findNodeById(treeRoots, focusedId)
  if (focusedNode) {
    for (const child of focusedNode.children) {
      focused.add(child.id)
    }
  }

  // Add secondary relationship endpoints
  for (const edge of secondaryEdges) {
    if (edge.from_id === focusedId) focused.add(edge.to_id)
    if (edge.to_id === focusedId) focused.add(edge.from_id)
  }

  return focused
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

export function collectIdsUpToDepth(
  nodes: OrgTreeNode[],
  maxDepth: number,
  currentDepth: number = 0,
  result: string[] = []
): string[] {
  if (currentDepth >= maxDepth) return result
  for (const node of nodes) {
    if (node.children.length > 0) {
      result.push(node.id)
      collectIdsUpToDepth(node.children, maxDepth, currentDepth + 1, result)
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

/** Walk the tree and return all ancestor IDs leading to the target node. */
export function collectAncestorIds(
  nodes: OrgTreeNode[],
  targetId: string,
  path: string[] = []
): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return path
    const result = collectAncestorIds(node.children, targetId, [...path, node.id])
    if (result) return result
  }
  return null
}
