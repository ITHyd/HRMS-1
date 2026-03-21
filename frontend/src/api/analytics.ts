import client from "./client"
import type { BranchAnalytics } from "@/types/analytics"

export async function getBranchAnalytics(
  locationId: string,
  dataSource: "hrms" | "excel" = "hrms",
  period?: string
): Promise<BranchAnalytics> {
  const res = await client.get<BranchAnalytics>(`/analytics/branch/${locationId}`, {
    params: { data_source: dataSource, period },
  })
  return res.data
}
