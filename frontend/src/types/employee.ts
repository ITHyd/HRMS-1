export interface EmployeeBrief {
  id: string
  name: string
  designation: string
  department: string
  department_id: string
  level: string
  location_id: string
  location_code: string
  location_city: string
  photo_url?: string
  is_active: boolean
}

export interface ManagerInfo {
  id: string
  name: string
  designation: string
  location_code: string
  relationship_type: string
}

export interface ProjectInfo {
  id: string
  name: string
  status: string
  role_in_project: string
  start_date: string
  end_date?: string
  progress_percent: number
}

export interface EmployeeDetail {
  id: string
  name: string
  email?: string
  designation: string
  department: string
  department_id: string
  level: string
  location_id: string
  location_code: string
  location_city: string
  photo_url?: string
  is_active: boolean
  join_date?: string
  tenure_months?: number
  managers: ManagerInfo[]
  reporting_chain: EmployeeBrief[]
  direct_reports: EmployeeBrief[]
  projects: ProjectInfo[]
  is_own_branch: boolean
}
