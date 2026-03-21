export interface FinanceBillableEntry {
  id: string
  employee_id: string
  employee_name: string
  period: string
  billable_status: string
  billable_hours: number
  billed_amount?: number
  project_name?: string
  client_name?: string
  version: number
}

export interface FinanceValidationRow {
  row_number: number
  data: Record<string, string>
  status: "valid" | "error" | "warning"
  errors: string[]
  warnings: string[]
}

export interface FinanceUploadValidationResponse {
  total_rows: number
  valid_count: number
  error_count: number
  duplicate_count: number
  warning_count: number
  period: string
  version: number
  rows: FinanceValidationRow[]
  upload_token: string
}

export interface FinanceBillableListResponse {
  data_source?: "hrms" | "excel"
  entries: FinanceBillableEntry[]
  total: number
  period: string
  latest_version: number
}

export interface FinanceUploadHistoryEntry {
  batch_id: string
  period: string
  uploaded_by: string
  filename: string
  total_rows: number
  valid_count: number
  error_count: number
  duplicate_count: number
  version: number
  errors: { row: number; message: string }[]
  uploaded_at: string
}
