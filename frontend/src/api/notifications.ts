import client from "./client"

export interface BenchLongDetail {
  employee_id: string
  employee_name: string
  bench_days: number
  bench_periods: string[]
}

export interface ProjectEndingDetail {
  project_id: string
  project_name: string
  days_remaining: number
  team_size: number
  end_date: string
}

export interface BillableLowDetail {
  metric: string
  current_pct: number
  target_pct: number
}

export interface RecentSyncDetail {
  sync_id: string
  integration_type: string
  type_label: string
  status: "completed" | "failed" | "running"
  records_processed: number
  records_succeeded: number
  records_failed: number
  completed_at: string | null
}

export interface NotificationSummary {
  bench_long: number
  project_ending: number
  billable_low: number
  recent_syncs: number
  total: number
  details: {
    bench_long: BenchLongDetail[]
    project_ending: ProjectEndingDetail[]
    billable_low: BillableLowDetail[]
    recent_syncs: RecentSyncDetail[]
  }
}

export async function getNotificationSummary(): Promise<NotificationSummary> {
  const res = await client.get<NotificationSummary>("/notifications/summary")
  return res.data
}

export async function dismissNotification(type: string, id: string): Promise<void> {
  await client.delete(`/notifications/${encodeURIComponent(type)}/${encodeURIComponent(id)}`)
}
