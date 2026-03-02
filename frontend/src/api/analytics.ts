import client from "./client"
import type { BranchAnalytics } from "@/types/analytics"

export async function getBranchAnalytics(locationId: string): Promise<BranchAnalytics> {
  const res = await client.get<BranchAnalytics>(`/analytics/branch/${locationId}`)
  return res.data
}
