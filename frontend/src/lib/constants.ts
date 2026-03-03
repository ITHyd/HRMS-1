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
  Management: "#f59e0b",
  HR: "#8b5cf6",
  "Account Management": "#ec4899",
  "IT Admin": "#06b6d4",
  Intern: "#10b981",
  Product: "#22c55e",
  Design: "#f97316",
  Operations: "#ef4444",
  Finance: "#0ea5e9",
  Sales: "#e11d48",
  "Digital & Engineering Services": "#6366f1",
  Executive: "#dc2626",
  Growth: "#16a34a",
  IT: "#06b6d4",
  "Legal Governance & Compliance": "#7c3aed",
  Marketing: "#ea580c",
  "P&C": "#8b5cf6",
  "Strategic Delivery": "#0d9488",
  General: "#6b7280",
  Internal: "#64748b",
}
