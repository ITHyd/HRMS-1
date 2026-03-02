import client from "./client"
import type { OrgTreeResponse, TracePathResponse } from "@/types/org"

export async function getFullOrgTree(): Promise<OrgTreeResponse> {
  const res = await client.get<OrgTreeResponse>("/org/tree")
  return res.data
}

export async function getBranchTree(locationId: string): Promise<OrgTreeResponse> {
  const res = await client.get<OrgTreeResponse>(`/org/branch/${locationId}/tree`)
  return res.data
}

export async function getReportingChain(employeeId: string) {
  const res = await client.get<{ chain: Record<string, unknown>[] }>(`/org/chain/${employeeId}`)
  return res.data
}

export async function tracePath(fromId: string, toId: string): Promise<TracePathResponse> {
  const res = await client.get<TracePathResponse>(`/org/trace`, {
    params: { from_id: fromId, to_id: toId },
  })
  return res.data
}
