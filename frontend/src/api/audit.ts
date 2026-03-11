import client from "./client"
import type { AuditLogResponse } from "@/types/api"

export interface AuditFilterParams {
  action?: string
  entity_type?: string
  date_from?: string
  date_to?: string
  search?: string
}

export interface AuditStatsResponse {
  total_events: number
  period: string
  by_action: Record<string, number>
  by_entity: Record<string, number>
}

export async function getAuditLog(
  locationId: string,
  page = 1,
  pageSize = 20,
  filters?: AuditFilterParams
): Promise<AuditLogResponse> {
  const params: Record<string, string | number> = { page, page_size: pageSize }

  if (filters?.action) params.action = filters.action
  if (filters?.entity_type) params.entity_type = filters.entity_type
  if (filters?.date_from) params.date_from = filters.date_from
  if (filters?.date_to) params.date_to = filters.date_to
  if (filters?.search) params.search = filters.search

  const res = await client.get<AuditLogResponse>(`/audit/branch/${locationId}`, {
    params,
  })
  return res.data
}

export async function getAuditStats(
  locationId: string
): Promise<AuditStatsResponse> {
  const res = await client.get<AuditStatsResponse>(
    `/audit/branch/${locationId}/stats`
  )
  return res.data
}

export async function exportAuditLog(locationId: string): Promise<Blob> {
  const res = await client.get(`/audit/branch/${locationId}/export`, {
    responseType: "blob",
  })
  return res.data
}
