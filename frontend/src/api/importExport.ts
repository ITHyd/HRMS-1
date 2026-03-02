import client from "./client"
import type { ImportValidationResponse } from "@/types/api"

export async function uploadCsv(file: File): Promise<ImportValidationResponse> {
  const form = new FormData()
  form.append("file", file)
  const res = await client.post<ImportValidationResponse>("/import/employees", form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return res.data
}

export async function confirmImport(importToken: string) {
  const res = await client.post("/import/employees/confirm", {
    import_token: importToken,
  })
  return res.data
}

export async function downloadTemplate(): Promise<Blob> {
  const res = await client.get("/import/template", { responseType: "blob" })
  return res.data
}

export async function exportTeamReport(): Promise<Blob> {
  const res = await client.get("/export/branch/report", { responseType: "blob" })
  return res.data
}
