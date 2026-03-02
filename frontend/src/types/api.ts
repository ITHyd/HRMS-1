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
}

export interface SearchResult {
  employees: import("./employee").EmployeeBrief[]
  total: number
}

export interface ValidationRow {
  row_number: number
  data: Record<string, string>
  status: "valid" | "error" | "warning"
  errors: string[]
  warnings: string[]
}

export interface ImportValidationResponse {
  total_rows: number
  valid_count: number
  error_count: number
  warning_count: number
  rows: ValidationRow[]
  import_token: string
}

export interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string
  changed_by: string
  changed_by_name: string
  timestamp: string
  old_value?: Record<string, unknown>
  new_value?: Record<string, unknown>
  description: string
}

export interface AuditLogResponse {
  entries: AuditEntry[]
  total: number
  page: number
  page_size: number
}
