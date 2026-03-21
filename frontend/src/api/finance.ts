import client from "./client"
import type {
  FinanceUploadValidationResponse,
  FinanceBillableListResponse,
  FinanceUploadHistoryEntry,
} from "@/types/finance"

export async function downloadFinanceTemplate(): Promise<Blob> {
  const res = await client.get("/finance/template", { responseType: "blob" })
  return res.data
}

export async function uploadFinanceCsv(
  file: File,
  period: string
): Promise<FinanceUploadValidationResponse> {
  const form = new FormData()
  form.append("file", file)
  const res = await client.post<FinanceUploadValidationResponse>(
    "/finance/billable/upload",
    form,
    {
      params: { period },
      headers: { "Content-Type": "multipart/form-data" },
    }
  )
  return res.data
}

export async function confirmFinanceUpload(
  uploadToken: string
): Promise<{ imported_count: number; version: number; message: string }> {
  const res = await client.post<{
    imported_count: number
    version: number
    message: string
  }>("/finance/billable/confirm", { upload_token: uploadToken })
  return res.data
}

export async function getFinanceBillable(params: {
  period: string
  data_source?: "hrms" | "excel"
  version?: number
  page?: number
  page_size?: number
}): Promise<FinanceBillableListResponse> {
  const res = await client.get<FinanceBillableListResponse>("/finance/billable", {
    params,
  })
  return res.data
}

export async function getFinanceUploadHistory(
  dataSource: "hrms" | "excel" = "hrms"
): Promise<FinanceUploadHistoryEntry[]> {
  const res = await client.get<FinanceUploadHistoryEntry[]>("/finance/uploads", {
    params: { data_source: dataSource },
  })
  return res.data
}
