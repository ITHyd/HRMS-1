export interface IntegrationConfig {
  id: string
  integration_type: "hrms" | "finance" | "dynamics"
  name: string
  status: "active" | "inactive" | "error"
  config: Record<string, unknown>
  last_sync_at?: string
  last_sync_status?: string
  created_at: string
  updated_at: string
}

export interface SyncLogEntry {
  id: string
  integration_type: string
  direction: "inbound" | "outbound"
  status: "running" | "completed" | "failed"
  records_processed: number
  records_succeeded: number
  records_failed: number
  error_details: Array<{ message: string }>
  started_at: string
  completed_at?: string
  triggered_by: string
  retry_count: number
}

export interface SyncLogsResponse {
  logs: SyncLogEntry[]
  total: number
}

export interface DynamicsExport {
  id: string
  export_type: "employee" | "project" | "timesheet"
  status: "pending" | "processing" | "completed" | "failed"
  record_count: number
  created_at: string
  processed_at?: string
  error_message?: string
}
