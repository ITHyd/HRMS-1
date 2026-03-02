export const LEVEL_ORDER = [
  "intern",
  "junior",
  "mid",
  "senior",
  "lead",
  "manager",
  "head",
  "director",
  "vp",
  "c-suite",
] as const

export const LEVEL_LABELS: Record<string, string> = {
  "intern": "Intern",
  "junior": "Junior",
  "mid": "Mid-Level",
  "senior": "Senior",
  "lead": "Lead",
  "manager": "Manager",
  "head": "Head",
  "director": "Director",
  "vp": "VP",
  "c-suite": "C-Suite",
}

export const LOCATION_COLORS: Record<string, string> = {
  HYD: "#6366f1",
  BLR: "#22c55e",
  LON: "#f59e0b",
  SYD: "#ef4444",
}

export const DEPARTMENT_COLORS: Record<string, string> = {
  Engineering: "#6366f1",
  Product: "#22c55e",
  Design: "#f59e0b",
  Operations: "#ef4444",
  HR: "#8b5cf6",
  Finance: "#06b6d4",
  Sales: "#ec4899",
}
