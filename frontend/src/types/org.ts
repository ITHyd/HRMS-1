export interface OrgTreeNode {
  id: string
  name: string
  designation: string
  department: string
  department_id: string
  parent_department_id: string
  parent_department_name: string
  level: string
  location_id: string
  location_code: string
  location_city: string
  photo_url?: string
  is_active: boolean
  children: OrgTreeNode[]
  is_branch_head: boolean
  is_own_branch: boolean
  collapsed_child_count: number
}

export interface SecondaryEdge {
  from_id: string
  to_id: string
  type: string
}

export interface OrgTreeResponse {
  nodes: OrgTreeNode[]
  secondary_edges: SecondaryEdge[]
}

export interface TracePathResponse {
  path: string[]
  path_details: OrgTreeNode[]
}
