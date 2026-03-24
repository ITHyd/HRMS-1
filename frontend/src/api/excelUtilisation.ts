import client from "./client"
import type { ExecutiveDashboard, ResourceAllocationResponse } from "@/types/dashboard"
import type { TimesheetListResponse } from "@/types/timesheet"

export interface ExcelUploadResult {
  batch_id: string
  total_rows: number
  matched_rows: number
  periods: string[]
  rows_stored: number
}

export interface ExcelUploadLog {
  batch_id: string
  filename: string
  total_rows: number
  matched_rows: number
  periods: string[]
  uploaded_at: string
}

export async function uploadExcelReport(file: File): Promise<ExcelUploadResult> {
  const form = new FormData()
  form.append("file", file)
  const res = await client.post<ExcelUploadResult>("/excel-utilisation/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return res.data
}

export async function getExcelDashboard(period: string): Promise<ExecutiveDashboard & { data_source: string }> {
  const res = await client.get("/excel-utilisation/dashboard", { params: { period } })
  return res.data
}

export async function getExcelResources(params: {
  period: string
  search?: string
  classification?: string
  page?: number
  page_size?: number
}): Promise<ResourceAllocationResponse & { data_source: string }> {
  const res = await client.get("/excel-utilisation/resources", { params })
  return res.data
}

export async function getExcelTimesheets(params: {
  employee_id?: string
  project_id?: string
  period?: string
  status?: string
  is_billable?: boolean
  page?: number
  page_size?: number
}): Promise<TimesheetListResponse & { data_source: string }> {
  const res = await client.get("/excel-utilisation/timesheets", { params })
  return res.data
}

export async function getExcelUploadHistory(): Promise<ExcelUploadLog[]> {
  const res = await client.get<ExcelUploadLog[]>("/excel-utilisation/uploads")
  return res.data
}

export interface ExcelProjectsResponse {
  projects: import("@/types/project").ProjectBrief[]
  total: number
  active_count: number
  completed_count: number
  on_hold_count: number
  period: string
  data_source: string
  clients: string[]
}

export async function getExcelProjects(params: {
  period: string
  search?: string
  client_name?: string
  page?: number
  page_size?: number
}): Promise<ExcelProjectsResponse> {
  const res = await client.get<ExcelProjectsResponse>("/excel-utilisation/projects", { params })
  return res.data
}

export async function getExcelProjectDetail(projectId: string, period: string): Promise<import("@/types/project").ProjectDetail & { period: string; data_source: string }> {
  const res = await client.get(`/excel-utilisation/projects/${projectId}`, { params: { period } })
  return res.data
}

export async function triggerExcelReimport(): Promise<{ status: string; file: string }> {
  const res = await client.post("/excel-utilisation/reimport")
  return res.data
}

export interface PlannedWorkedEntry {
  period: string
  planned_days: number
  worked_days: number
  utilisation_percent: number
  projects: Array<{
    project_name: string
    client_name: string | null
    planned_days: number
    worked_days: number
  }>
}

export async function getEmployeePlannedWorkedTimeline(employeeId: string): Promise<{
  employee_id: string
  timeline: PlannedWorkedEntry[]
}> {
  const res = await client.get(`/excel-utilisation/employee/${employeeId}/timeline`)
  return res.data
}

export interface PlannedVsActualData {
  period: string
  total_planned_days: number
  total_worked_days: number
  employee_count: number
  planned_utilisation_pct: number
  actual_utilisation_pct: number
  variance_pct: number
  projects: Array<{
    project_name: string
    client_name: string | null
    planned_days: number
    worked_days: number
  }>
}

export async function getBranchPlannedVsActual(period: string): Promise<PlannedVsActualData> {
  const res = await client.get<PlannedVsActualData>("/excel-utilisation/planned-vs-actual", { params: { period } })
  return res.data
}

export interface ExcelEmployeeEntry {
  id: string
  name: string
  email: string
  designation: string
  department: string
  level: string
  location: string
  join_date: string | null
  is_active: boolean
  classification: string
  utilisation_percent: number
  availability_percent: number
}

export interface ExcelEmployeeListResponse {
  employees: ExcelEmployeeEntry[]
  total: number
  active_count: number
  inactive_count: number
  overall_total?: number
  overall_active_count?: number
  overall_inactive_count?: number
}

export async function listExcelEmployees(params: {
  period?: string
  search?: string
  page?: number
  page_size?: number
}): Promise<ExcelEmployeeListResponse> {
  const res = await client.get<ExcelEmployeeListResponse>("/excel-utilisation/employees", { params })
  return res.data
}
