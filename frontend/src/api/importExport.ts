import client from "./client"

export async function exportTeamReport(): Promise<Blob> {
  const res = await client.get("/export/branch/report", { responseType: "blob" })
  return res.data
}
