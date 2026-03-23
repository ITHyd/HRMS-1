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
  search?: string
  client_name?: string
  page?: number
  page_size?: number
}): Promise<ExcelProjectsResponse> {
  const res = await client.get<ExcelProjectsResponse>("/excel-utilisation/projects", { params })
  return res.data
}

export async function getExcelProjectDetail(projectId: string): Promise<import("@/types/project").ProjectDetail & { period: string; data_source: string }> {
  const res = await client.get(`/excel-utilisation/projects/${projectId}`)
  return res.data
}
