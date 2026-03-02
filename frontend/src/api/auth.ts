import client from "./client"
import type { LoginRequest, LoginResponse } from "@/types/api"

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await client.post<LoginResponse>("/auth/login", data)
  return res.data
}
