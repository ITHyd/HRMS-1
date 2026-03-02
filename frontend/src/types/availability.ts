export interface SkillTag {
  id: string
  employee_id: string
  skill_name: string
  proficiency: "beginner" | "intermediate" | "advanced" | "expert"
  added_by: string
  added_at: string
  notes?: string
}

export interface SkillCatalogEntry {
  id: string
  name: string
  category: string
  display_name: string
}

export interface AvailableEmployee {
  employee_id: string
  employee_name: string
  designation: string
  department: string
  location: string
  skills: SkillTag[]
  utilisation_percent: number
  classification: string
  available_from?: string
  current_projects: Array<{
    project_id: string
    project_name: string
    hours: number
  }>
}

export interface BenchPoolResponse {
  employees: AvailableEmployee[]
  total: number
  bench_count: number
  partial_count: number
}
