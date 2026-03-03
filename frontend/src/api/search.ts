import client from "./client"
import type { GlobalSearchResponse, EmployeesBySkillResponse } from "@/types/search"

export async function globalSearch(params: {
  q: string
  employee_limit?: number
  project_limit?: number
  skill_limit?: number
  department_limit?: number
}): Promise<GlobalSearchResponse> {
  const res = await client.get<GlobalSearchResponse>("/search/global", { params })
  return res.data
}

export async function getEmployeesBySkill(params: {
  skill: string
  page?: number
  page_size?: number
}): Promise<EmployeesBySkillResponse> {
  const res = await client.get<EmployeesBySkillResponse>("/search/employees-by-skill", { params })
  return res.data
}
