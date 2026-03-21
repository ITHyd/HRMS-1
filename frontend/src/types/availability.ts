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

export interface ProjectRef {
  project_id: string
  project_name: string
  status: string
  role: string
  end_date?: string | null
  client_name?: string | null
  /** YYYY-MM period string — shown as "last active: Jan 2026" in the table */
  period?: string | null
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
  /** Active / on-hold projects (backward compat alias for active_projects) */
  current_projects: ProjectRef[]
  active_projects: ProjectRef[]
  /** Last completed projects — shows why the person is on bench */
  last_projects: ProjectRef[]
  /** Date the last project ended (ISO date string) */
  bench_since?: string | null
  /** Days since bench_since */
  bench_duration_days?: number | null
}

export interface BenchPoolResponse {
  period?: string | null
  data_source?: "hrms" | "excel"
  employees: AvailableEmployee[]
  total: number
  bench_count: number
  partial_count: number
  avg_bench_days?: number | null
}
