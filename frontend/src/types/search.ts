export interface GlobalSearchEmployeeResult {
  id: string
  name: string
  designation: string
  department: string
  department_id: string
  level: string
  location_code: string
  photo_url?: string
  is_active: boolean
}

export interface GlobalSearchProjectResult {
  id: string
  name: string
  status: string
  project_type: string
  department_name: string
  member_count: number
}

export interface GlobalSearchSkillResult {
  id: string
  name: string
  display_name: string
  category: string
  employee_count: number
}

export interface GlobalSearchDepartmentResult {
  id: string
  name: string
  employee_count: number
}

export interface GlobalSearchResponse {
  query: string
  employees: {
    items: GlobalSearchEmployeeResult[]
    total: number
  }
  projects: {
    items: GlobalSearchProjectResult[]
    total: number
  }
  skills: {
    items: GlobalSearchSkillResult[]
    total: number
  }
  departments: {
    items: GlobalSearchDepartmentResult[]
    total: number
  }
}

export interface EmployeeBySkillResult {
  id: string
  name: string
  email: string
  designation: string
  department: string
  level: string
  location: string
  location_code: string
  proficiency: string
}

export interface EmployeesBySkillResponse {
  employees: EmployeeBySkillResult[]
  total: number
  skill_name: string
}

export type SearchTab = "all" | "employees" | "projects" | "skills" | "departments"
