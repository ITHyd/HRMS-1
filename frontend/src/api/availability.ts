import client from "./client"
import type {
  BenchPoolResponse,
  SkillTag,
  SkillCatalogEntry,
} from "@/types/availability"

export async function getBenchPool(params: {
  skill?: string
  location?: string
  classification?: string
  search?: string
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
  await client.delete(`/availability/skills/${employeeId}/${skillName}`)
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
  const res = await client.get("/export/bench", {
    params: { period: new Date().toISOString().slice(0, 7) },
    responseType: "blob",
  })
  return res.data
}
