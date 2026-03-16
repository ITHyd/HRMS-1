import client from "./client"

export interface Alert {
  type: string
  title: string
  severity: "high" | "medium" | "low"
  details?: string
}

export async function generateAlerts(): Promise<Alert[]> {
  const res = await client.post<Alert[]>("/alerts/generate")
  return res.data
}
