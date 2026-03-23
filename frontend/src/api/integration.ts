import client from "./client"
import type {
  IntegrationConfig,
  SyncLogEntry,
  SyncLogsResponse,
  DynamicsExport,
  DynamicsExportsResponse,
} from "@/types/integration"

export async function getIntegrationConfigs(): Promise<IntegrationConfig[]> {
  const res = await client.get<IntegrationConfig[]>("/integrations/configs")
  return res.data
}

export async function createIntegrationConfig(data: {
  integration_type: string
  name: string
  config?: Record<string, unknown>
}): Promise<IntegrationConfig> {
  const res = await client.post<IntegrationConfig>(
    "/integrations/configs",
    data
  )
  return res.data
}

export async function updateIntegrationConfig(
  configId: string,
  data: { name?: string; status?: string; config?: Record<string, unknown> }
): Promise<IntegrationConfig> {
  const res = await client.put<IntegrationConfig>(
    `/integrations/configs/${configId}`,
    data
  )
  return res.data
}

export async function triggerSync(
  configId: string
): Promise<{ sync_log_id: string; status: string }> {
  const res = await client.post<{ sync_log_id: string; status: string }>(
    `/integrations/sync/${configId}`
  )
  return res.data
}

export async function retrySync(
  syncLogId: string
): Promise<{ sync_log_id: string; status: string }> {
  const res = await client.post<{ sync_log_id: string; status: string }>(
    `/integrations/sync/${syncLogId}/retry`
  )
  return res.data
}

export async function getSyncLogDetail(syncId: string): Promise<SyncLogEntry & { integration_config_id?: string; config_name?: string; user_id?: string; parent_sync_id?: string }> {
  const res = await client.get(`/integrations/sync-logs/${syncId}`)
  return res.data
}

export async function getSyncLogs(params?: {
  integration_type?: string
  page?: number
  page_size?: number
}): Promise<SyncLogsResponse> {
  const res = await client.get<SyncLogsResponse>("/integrations/sync-logs", {
    params,
  })
  return res.data
}

export async function createDynamicsExport(
  exportType: string
): Promise<DynamicsExport> {
  const res = await client.post<DynamicsExport>("/integrations/dynamics/export", {
    export_type: exportType,
  })
  return res.data
}

export async function getDynamicsExports(params?: {
  page?: number
  page_size?: number
}): Promise<DynamicsExportsResponse> {
  const res = await client.get<DynamicsExportsResponse>(
    "/integrations/dynamics/exports",
    { params }
  )
  return res.data
}

export async function downloadDynamicsExport(
  exportId: string,
  format: "json" | "csv" = "json"
): Promise<Blob> {
  const res = await client.get(
    `/integrations/dynamics/exports/${exportId}/download`,
    { params: { format }, responseType: "blob" }
  )
  return res.data
}
