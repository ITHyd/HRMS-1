import client from "./client"
import type { ProjectListResponse, ProjectDetail, AssignToProjectRequest, AssignmentResponse, EmployeeTimeline, ProjectTimelineResponse } from "@/types/project"

export async function listProjects(params?: {
  search?: string
  project_type?: string
  status?: string
  client_name?: string
  period?: string
  page?: number
  page_size?: number
}): Promise<ProjectListResponse> {
  const res = await client.get<ProjectListResponse>("/projects/", { params })
  return res.data
}

export async function listProjectClients(): Promise<string[]> {
  const res = await client.get<string[]>("/projects/clients")
  return res.data
}

export async function getEmployeeTimeline(
  employeeId: string,
  fromPeriod?: string,
  toPeriod?: string,
): Promise<EmployeeTimeline> {
  const res = await client.get<EmployeeTimeline>(
    `/projects/employees/${employeeId}/timeline`,
    { params: { from_period: fromPeriod, to_period: toPeriod } },
  )
  return res.data
}

export async function createProject(data: {
  name: string
  project_type: string
  department_id: string
  start_date: string
  end_date?: string
  description?: string
}): Promise<{ id: string; name: string }> {
  const res = await client.post<{ id: string; name: string }>("/projects/", data)
  return res.data
}

export async function getProjectDetail(projectId: string, period?: string): Promise<ProjectDetail> {
  const res = await client.get<ProjectDetail>(`/projects/${projectId}`, {
    params: period ? { period } : undefined,
  })
  return res.data
}

export async function getProjectTimeline(): Promise<ProjectTimelineResponse> {
  const res = await client.get<ProjectTimelineResponse>("/projects/timeline")
  return res.data
}

export async function assignToProject(data: AssignToProjectRequest): Promise<AssignmentResponse> {
  const res = await client.post<AssignmentResponse>("/projects/assign", data)
  return res.data
}
