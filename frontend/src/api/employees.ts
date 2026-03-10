import client from "./client"
import type { EmployeeDetail, EmployeeMasterEntry } from "@/types/employee"
import type { SearchResult } from "@/types/api"

export async function getEmployee(id: string): Promise<EmployeeDetail> {
  const res = await client.get<EmployeeDetail>(`/employees/${id}`)
  return res.data
}

export async function searchEmployees(params: {
  q?: string
  location_id?: string
  department_id?: string
  level?: string
  limit?: number
}): Promise<SearchResult> {
  const res = await client.get<SearchResult>("/employees/search", { params })
  return res.data
}

export async function listEmployees(params?: {
  search?: string
  department_id?: string
  level?: string
  is_active?: boolean
  page?: number
  page_size?: number
}): Promise<{
  employees: EmployeeMasterEntry[]
  total: number
  active_count: number
  inactive_count: number
}> {
  const res = await client.get("/employees/", { params })
  return res.data
}

export async function getEmployeeDepartments(): Promise<
  Array<{ id: string; name: string }>
> {
  const res = await client.get("/employees/departments")
  return res.data
}

export async function getHrmsStatus(): Promise<{ total: number; synced: boolean }> {
  const res = await client.get<{ total: number; synced: boolean }>("/employees/status")
  return res.data
}
