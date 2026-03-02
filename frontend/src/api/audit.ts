import client from "./client"
import type { AuditLogResponse } from "@/types/api"

export async function getAuditLog(
  locationId: string,
  page = 1,
  pageSize = 50
): Promise<AuditLogResponse> {
  const res = await client.get<AuditLogResponse>(`/audit/branch/${locationId}`, {
    params: { page, page_size: pageSize },
  })
  return res.data
}
