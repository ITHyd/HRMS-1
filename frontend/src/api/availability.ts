import client from "./client"
import type {
  BenchPoolResponse,
  SkillTag,
  SkillCatalogEntry,
} from "@/types/availability"

export async function getLocations(): Promise<
  { code: string; label: string }[]
> {
  const res = await client.get<{ code: string; label: string }[]>(
    "/availability/locations"
  )
  return res.data
}

export async function getDesignations(
  period?: string,
  dataSource: "hrms" | "excel" = "hrms"
): Promise<string[]> {
  const res = await client.get<string[]>("/availability/designations", {
    params: { data_source: dataSource, period },
  })
  return res.data
}

export async function getBenchPool(params: {
  period?: string
  skill?: string
  location?: string
  classification?: string
  designation?: string
  utilisation_min?: number
  utilisation_max?: number
  search?: string
  data_source?: "hrms" | "excel"
  page?: number
  page_size?: number
}): Promise<BenchPoolResponse> {
  const res = await client.get<BenchPoolResponse>("/availability/bench", {
    params,
  })
  return res.data
}

export async function getEmployeeSkills(
  employeeId: string
): Promise<SkillTag[]> {
  const res = await client.get<SkillTag[]>(
    `/availability/skills/${employeeId}`
  )
  return res.data
}

export async function addEmployeeSkill(
  employeeId: string,
  data: { skill_name: string; proficiency: string; notes?: string }
): Promise<SkillTag> {
  const res = await client.post<SkillTag>(
    `/availability/skills/${employeeId}`,
    data
  )
  return res.data
}

export async function removeEmployeeSkill(
  employeeId: string,
  skillName: string
): Promise<void> {
  await client.delete(`/availability/skills/${employeeId}/${encodeURIComponent(skillName)}`)
}

export async function getSkillCatalog(
  category?: string
): Promise<SkillCatalogEntry[]> {
  const res = await client.get<SkillCatalogEntry[]>(
    "/availability/skill-catalog",
    { params: category ? { category } : {} }
  )
  return res.data
}

export async function searchSkillCatalog(
  query: string
): Promise<SkillCatalogEntry[]> {
  const res = await client.get<SkillCatalogEntry[]>(
    "/availability/skill-catalog/search",
    { params: { q: query } }
  )
  return res.data
}

export async function exportBenchPool(): Promise<Blob> {
  // Use previous month since current month data may not exist yet
  const now = new Date()
  now.setMonth(now.getMonth() - 1)
  const period = now.toISOString().slice(0, 7)
  const res = await client.get("/export/bench", {
    params: { period },
    responseType: "blob",
  })
  return res.data
}
