import client from "./client"
import type { LoginRequest, LoginResponse } from "@/types/api"

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await client.post<LoginResponse>("/auth/login", data)
  return res.data
}

export async function getMe(): Promise<LoginResponse> {
  const res = await client.get<LoginResponse>("/auth/me")
  return res.data
}
