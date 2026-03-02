import client from "./client"
import type { EmployeeDetail } from "@/types/employee"
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
