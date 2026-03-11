import axios from "axios"

const API_BASE = "http://localhost:8001"

// Use a separate client without auth interceptor (mode endpoints are public)
const adminClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
})

export async function getMode(): Promise<{ mode: string }> {
  const res = await adminClient.get<{ mode: string }>("/admin/mode")
  return res.data
}

export async function switchMode(mode: "demo" | "live"): Promise<{ mode: string }> {
  const res = await adminClient.post<{ mode: string }>("/admin/switch-mode", { mode })
  return res.data
}
