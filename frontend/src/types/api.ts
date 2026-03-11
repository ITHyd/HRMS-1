export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  employee_id: string
  branch_location_id: string
  branch_code: string
  name: string
  role: string
}

export interface SearchResult {
  employees: import("./employee").EmployeeBrief[]
  total: number
}

export interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_label: string
  entity_id: string
  changed_by: string
  changed_by_name: string
  timestamp: string
  old_value?: Record<string, string>
  new_value?: Record<string, string>
  description: string
}

export interface AuditLogResponse {
  entries: AuditEntry[]
  total: number
  page: number
  page_size: number
}
