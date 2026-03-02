import client from "./client"
import type {
  TimesheetListResponse,
  TimesheetEntry,
  TimesheetEntryCreate,
  TimesheetEntryUpdate,
  TimesheetEditHistory,
  HrmsSyncLog,
  HrmsSyncLogsResponse,
} from "@/types/timesheet"

export async function getTimesheets(params: {
  employee_id?: string
  project_id?: string
  period?: string
  status?: string
  page?: number
  page_size?: number
}): Promise<TimesheetListResponse> {
  const res = await client.get<TimesheetListResponse>("/timesheets", { params })
  return res.data
}

export async function createTimesheetEntry(
  data: TimesheetEntryCreate
): Promise<TimesheetEntry> {
  const res = await client.post<TimesheetEntry>("/timesheets", data)
  return res.data
}

export async function updateTimesheetEntry(
  entryId: string,
  data: TimesheetEntryUpdate
): Promise<TimesheetEntry> {
  const res = await client.put<TimesheetEntry>(`/timesheets/${entryId}`, data)
  return res.data
}

export async function deleteTimesheetEntry(entryId: string): Promise<void> {
  await client.delete(`/timesheets/${entryId}`)
}

export async function submitTimesheetEntries(
  entryIds: string[]
): Promise<{ submitted_count: number }> {
  const res = await client.post<{ submitted_count: number }>("/timesheets/submit", {
    entry_ids: entryIds,
  })
  return res.data
}

export async function approveRejectEntries(params: {
  entry_ids: string[]
  action: "approve" | "reject"
  rejection_reason?: string
}): Promise<{ processed_count: number }> {
  const res = await client.post<{ processed_count: number }>("/timesheets/approve", params)
  return res.data
}

export async function getEntryHistory(
  entryId: string
): Promise<TimesheetEditHistory[]> {
  const res = await client.get<TimesheetEditHistory[]>(`/timesheets/${entryId}/history`)
  return res.data
}

export async function checkPeriodLock(
  period: string
): Promise<{ period: string; is_locked: boolean }> {
  const res = await client.get<{ period: string; is_locked: boolean }>(
    "/timesheets/period-lock",
    { params: { period } }
  )
  return res.data
}

export async function togglePeriodLock(
  period: string,
  lock: boolean
): Promise<{ period: string; is_locked: boolean }> {
  const res = await client.post<{ period: string; is_locked: boolean }>(
    "/timesheets/period-lock",
    { period, lock }
  )
  return res.data
}

export async function triggerHrmsSync(period: string): Promise<HrmsSyncLog> {
  const res = await client.post<HrmsSyncLog>("/hrms-sync/trigger", { period })
  return res.data
}

export async function getHrmsSyncLogs(params?: {
  page?: number
  page_size?: number
}): Promise<HrmsSyncLogsResponse> {
  const res = await client.get<HrmsSyncLogsResponse>("/hrms-sync/logs", { params })
  return res.data
}

export async function approveTimesheetEntries(
  entryIds: string[]
): Promise<{ processed_count: number }> {
  return approveRejectEntries({ entry_ids: entryIds, action: "approve" })
}

export async function rejectTimesheetEntries(
  entryIds: string[],
  reason: string
): Promise<{ processed_count: number }> {
  return approveRejectEntries({
    entry_ids: entryIds,
    action: "reject",
    rejection_reason: reason,
  })
}

export async function getPeriodLockStatus(
  _locationId: string,
  period: string
): Promise<{ locked: boolean; period: string }> {
  const data = await checkPeriodLock(period)
  return { locked: data.is_locked, period: data.period }
}

export async function getProjects(
  _locationId: string
): Promise<{ id: string; name: string }[]> {
  const res = await client.get<{ id: string; name: string }[]>("/org/projects")
  return res.data
}

export async function getEmployees(
  _locationId: string
): Promise<{ id: string; name: string }[]> {
  const res = await client.get<{ id: string; name: string }[]>("/org/employees")
  return res.data
}
