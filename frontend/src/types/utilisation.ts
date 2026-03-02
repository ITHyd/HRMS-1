export interface CapacityConfig {
  id: string
  standard_hours_per_week: number
  standard_hours_per_day: number
  working_days_per_week: number
  bench_threshold_percent: number
  partial_billing_threshold: number
  effective_from: string
}

export interface CapacityConfigUpdate {
  standard_hours_per_week?: number
  standard_hours_per_day?: number
  working_days_per_week?: number
  bench_threshold_percent?: number
  partial_billing_threshold?: number
}

export interface EmployeeCapacityOverrideCreate {
  employee_id: string
  custom_hours_per_week: number
  reason?: string
  effective_from: string
  effective_to?: string
}

export interface EmployeeCapacityOverride {
  id: string
  employee_id: string
  custom_hours_per_week: number
  reason?: string
  effective_from: string
  effective_to?: string
}

export interface UtilisationSnapshot {
  employee_id: string
  employee_name: string
  period: string
  total_hours_logged: number
  billable_hours: number
  non_billable_hours: number
  capacity_hours: number
  utilisation_percent: number
  billable_percent: number
  classification: string
  finance_billable_status?: string
}

export interface UtilisationSummary {
  period: string
  total_employees: number
  fully_billed_count: number
  partially_billed_count: number
  bench_count: number
  average_utilisation: number
  average_billable_percent: number
  snapshots: UtilisationSnapshot[]
}
