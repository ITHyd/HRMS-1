import dagre from "@dagrejs/dagre"
import type { Node, Edge } from "@xyflow/react"
import type { OrgTreeNode, SecondaryEdge } from "@/types/org"

const NODE_WIDTH = 240
const NODE_HEIGHT = 84
const GROUP_NODE_WIDTH = 280
const GROUP_NODE_HEIGHT = 72
export const DEPT_GROUP_THRESHOLD = 10
const MAX_CHILDREN_PER_ROW = 10
const NODES_PER_SIDE = 5

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
  // Group children by parent_department_id first (two-level hierarchy)
  const parentDeptMap = new Map<string, OrgTreeNode[]>()
  for (const child of parentNode.children) {
    // Skip employees in "Internal Projects" category
    if (child.parent_department_name === "Internal Projects") continue
    const key = child.parent_department_id || child.department_id || "general"
    if (!parentDeptMap.has(key)) parentDeptMap.set(key, [])
    parentDeptMap.get(key)!.push(child)
  }

  for (const [parentDeptId, children] of parentDeptMap) {
    // Check if this parent department has sub-departments
    const subDeptMap = new Map<string, OrgTreeNode[]>()
    for (const child of children) {
      const key = child.department_id || "general"
      if (!subDeptMap.has(key)) subDeptMap.set(key, [])
      subDeptMap.get(key)!.push(child)
    }

    const hasSubDepts =
      subDeptMap.size > 1 ||
      (subDeptMap.size === 1 && !subDeptMap.has(parentDeptId))

    const groupId = `dept-group-${parentNode.id}-${parentDeptId}`
    const isGroupExpanded = options.expandedDeptGroups.has(groupId)
    const deptName = children[0].parent_department_name || children[0].department || "General"

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
        departmentId: parentDeptId,
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
      if (hasSubDepts) {
        // Emit sub-department groups within this parent group
        emitSubDepartmentGroups(groupId, subDeptMap, rfNodes, rfEdges, options)
      } else {
        // No sub-departments — show employees directly
        flattenTree(children, rfNodes, rfEdges, options, groupId)
      }
    }
  }
}

function emitSubDepartmentGroups(
  parentGroupId: string,
  subDeptMap: Map<string, OrgTreeNode[]>,
  rfNodes: Node[],
  rfEdges: Edge[],
  options: TransformOptions
) {
  for (const [deptId, children] of subDeptMap) {
    const subGroupId = `dept-subgroup-${parentGroupId}-${deptId}`
    const isSubGroupExpanded = options.expandedDeptGroups.has(subGroupId)
    const deptName = children[0].department || "General"

    const locationBreakdown: Record<string, number> = {}
    for (const c of children) {
      const code = c.location_code || "?"
      locationBreakdown[code] = (locationBreakdown[code] || 0) + 1
    }

    rfNodes.push({
      id: subGroupId,
      type: "departmentGroupNode",
      position: { x: 0, y: 0 },
      width: GROUP_NODE_WIDTH,
      height: GROUP_NODE_HEIGHT,
      data: {
        parentId: parentGroupId,
        department: deptName,
        departmentId: deptId,
        headcount: children.length,
        employeeIds: children.map((c) => c.id),
        isExpanded: isSubGroupExpanded,
        locationBreakdown,
      } satisfies DepartmentGroupNodeData,
    })

    rfEdges.push({
      id: `e-${parentGroupId}-${subGroupId}`,
      source: parentGroupId,
      target: subGroupId,
      type: "reportingEdge",
      data: { relationType: "PRIMARY" },
    })

    if (isSubGroupExpanded) {
      flattenTree(children, rfNodes, rfEdges, options, subGroupId)
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
    const rowGap = 100
    const colWidth = nodeW + colGap
    const rowHeight = nodeH + rowGap

    const parentH = parent.type === "departmentGroupNode" ? GROUP_NODE_HEIGHT : NODE_HEIGHT
    const parentW = parent.type === "departmentGroupNode" ? GROUP_NODE_WIDTH : NODE_WIDTH
    const parentCenterX = parent.position.x + parentW / 2
    // Use child's Dagre Y if it was positioned, otherwise calculate from parent
    const firstChildY = children[0].position.y
    const originalY = firstChildY > parent.position.y
      ? firstChildY
      : parent.position.y + parentH + 120

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
      const xDelta = newX - children[i].position.x
      const yDelta = newY - children[i].position.y

      children[i].position = { x: newX, y: newY }

      // Shift all descendants by the same X and Y delta so subtrees follow their parent
      if (xDelta !== 0 || yDelta !== 0) {
        const descendants = new Set<string>()
        collectDescendants(children[i].id, descendants)
        for (const descId of descendants) {
          const desc = nodeMap.get(descId)
          if (desc) {
            desc.position = { x: desc.position.x + xDelta, y: desc.position.y + yDelta }
          }
        }
      }
    }

    // Create invisible junction nodes on the backbone for each row.
    // Edges route: parent → j0 → j1 → ... and jN → children in row N.
    const rowCount = Math.ceil(children.length / MAX_CHILDREN_PER_ROW)
    const junctionIds: string[] = []

    for (let r = 0; r < rowCount; r++) {
      const jId = `junction-${parentId}-r${r}`
      junctionIds.push(jId)
      const jY = originalY + r * rowHeight - 40
      const jNode: Node = {
        id: jId,
        type: "junctionNode",
        position: { x: parentCenterX - 1, y: jY },
        data: { label: "" },
        style: {
          width: 2,
          height: 2,
          minWidth: 0,
          minHeight: 0,
          padding: 0,
          background: "transparent",
          border: "none",
          opacity: 0,
        },
        selectable: false,
        draggable: false,
      }
      rfNodes.push(jNode)
      nodeMap.set(jId, jNode)
    }

    // Remove all parent → grid-child edges
    const gridChildIds = new Set(children.map((c) => c.id))
    for (let j = rfEdges.length - 1; j >= 0; j--) {
      if (rfEdges[j].source === parentId && gridChildIds.has(rfEdges[j].target)) {
        rfEdges.splice(j, 1)
      }
    }

    // Backbone: parent → j0
    rfEdges.push({
      id: `e-${parentId}-${junctionIds[0]}`,
      source: parentId,
      target: junctionIds[0],
      type: "reportingEdge",
      data: { relationType: "PRIMARY" },
    })

    // Backbone chain: j0 → j1 → j2 → ...
    for (let r = 1; r < rowCount; r++) {
      rfEdges.push({
        id: `e-${junctionIds[r - 1]}-${junctionIds[r]}`,
        source: junctionIds[r - 1],
        target: junctionIds[r],
        type: "reportingEdge",
        data: { relationType: "PRIMARY" },
      })
    }

    // Branches: jN → each child in row N
    for (let r = 0; r < rowCount; r++) {
      const rowStart = r * MAX_CHILDREN_PER_ROW
      const rowEnd = Math.min(rowStart + MAX_CHILDREN_PER_ROW, children.length)
      for (let i = rowStart; i < rowEnd; i++) {
        rfEdges.push({
          id: `e-${junctionIds[r]}-${children[i].id}`,
          source: junctionIds[r],
          target: children[i].id,
          type: "reportingEdge",
          data: { relationType: "PRIMARY", isGridBranch: true },
        })
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

  // Add secondary (dashed) edges — only if both source and target are visible.
  // Skip edges between employees in the same expanded department group to avoid clutter.
  const visibleIds = new Set(rfNodes.map((n) => n.id))
  const employeeToGridGroup = new Map<string, string>()
  for (const node of rfNodes) {
    if (node.type === "departmentGroupNode") {
      const d = node.data as Record<string, unknown>
      if (d.isExpanded) {
        const empIds = d.employeeIds as string[] | undefined
        if (empIds) {
          for (const empId of empIds) employeeToGridGroup.set(empId, node.id)
        }
      }
    }
  }

  for (const rel of secondaryEdges) {
    if (visibleIds.has(rel.from_id) && visibleIds.has(rel.to_id)) {
      const g1 = employeeToGridGroup.get(rel.from_id)
      const g2 = employeeToGridGroup.get(rel.to_id)
      if (g1 && g2 && g1 === g2) continue

      rfEdges.push({
        id: `sec-${rel.from_id}-${rel.to_id}`,
        source: rel.to_id,
        target: rel.from_id,
        type: "reportingEdge",
        data: { relationType: rel.type },
      })
    }
  }

  // Identify children that will be grid-arranged (> MAX_CHILDREN_PER_ROW siblings).
  // Skip them in Dagre to prevent over-allocation of horizontal space.
  const primaryEdgeList = rfEdges.filter((e) => !e.id.startsWith("sec-"))
  const parentChildMap = new Map<string, string[]>()
  for (const edge of primaryEdgeList) {
    if (!parentChildMap.has(edge.source)) parentChildMap.set(edge.source, [])
    parentChildMap.get(edge.source)!.push(edge.target)
  }

  const skipInDagre = new Set<string>()
  const gridParentWidths = new Map<string, number>()

  for (const [pid, childIds] of parentChildMap) {
    if (childIds.length > MAX_CHILDREN_PER_ROW) {
      // Mark all children and their descendants to skip
      const markSkip = (id: string) => {
        skipInDagre.add(id)
        const kids = parentChildMap.get(id)
        if (kids) kids.forEach(markSkip)
      }
      childIds.forEach(markSkip)

      // Calculate expected grid width so Dagre allocates proper space for the parent
      const firstChild = rfNodes.find((n) => n.id === childIds[0])
      const isGroup = firstChild?.type === "departmentGroupNode"
      const nodeW = isGroup ? GROUP_NODE_WIDTH : NODE_WIDTH
      const colGap = 80
      const spineGap = 40
      const colWidth = nodeW + colGap
      const gridWidth =
        NODES_PER_SIDE * colWidth - colGap +
        2 * spineGap +
        (MAX_CHILDREN_PER_ROW - NODES_PER_SIDE) * colWidth - colGap
      gridParentWidths.set(pid, gridWidth)
    }
  }

  // Dagre layout
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 120 })

  rfNodes.forEach((node) => {
    if (skipInDagre.has(node.id)) return // grid children positioned by rearrangeWideRows
    const gridW = gridParentWidths.get(node.id)
    if (gridW) {
      // Parent of a grid: use grid width so siblings are spaced correctly
      const h = node.type === "departmentGroupNode" ? GROUP_NODE_HEIGHT : NODE_HEIGHT
      g.setNode(node.id, { width: gridW, height: h })
    } else if (node.type === "departmentGroupNode") {
      g.setNode(node.id, { width: GROUP_NODE_WIDTH, height: GROUP_NODE_HEIGHT })
    } else {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    }
  })

  // Only use primary edges for layout, skip edges to grid children
  rfEdges
    .filter((e) => !e.id.startsWith("sec-"))
    .forEach((edge) => {
      if (skipInDagre.has(edge.target)) return
      g.setEdge(edge.source, edge.target)
    })

  dagre.layout(g)

  rfNodes.forEach((node) => {
    const pos = g.node(node.id)
    if (!pos) return // grid children stay at (0,0), positioned by rearrangeWideRows
    const w = node.type === "departmentGroupNode" ? GROUP_NODE_WIDTH : NODE_WIDTH
    const h = node.type === "departmentGroupNode" ? GROUP_NODE_HEIGHT : NODE_HEIGHT
    node.position = { x: pos.x - w / 2, y: pos.y - h / 2 }
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
