import client from "./client"
import type {
  CapacityConfig,
  CapacityConfigUpdate,
  EmployeeCapacityOverride,
  EmployeeCapacityOverrideCreate,
  UtilisationSummary,
  UtilisationSnapshot,
} from "@/types/utilisation"

export async function getCapacityConfig(): Promise<CapacityConfig> {
  const res = await client.get<CapacityConfig>("/utilisation/config")
  return res.data
}

export async function updateCapacityConfig(
  data: CapacityConfigUpdate
): Promise<CapacityConfig> {
  const res = await client.put<CapacityConfig>("/utilisation/config", data)
  return res.data
}

export async function createCapacityOverride(
  data: EmployeeCapacityOverrideCreate
): Promise<EmployeeCapacityOverride> {
  const res = await client.post<EmployeeCapacityOverride>(
    "/utilisation/overrides",
    data
  )
  return res.data
}

export async function getCapacityOverrides(): Promise<EmployeeCapacityOverride[]> {
  const res = await client.get<EmployeeCapacityOverride[]>("/utilisation/overrides")
  return res.data
}

export async function computeUtilisation(
  period: string
): Promise<UtilisationSummary> {
  const res = await client.post<UtilisationSummary>("/utilisation/compute", null, {
    params: { period },
  })
  return res.data
}

export async function getUtilisationSummary(
  period: string
): Promise<UtilisationSummary> {
  const res = await client.get<UtilisationSummary>("/utilisation/summary", {
    params: { period },
  })
  return res.data
}

export async function getEmployeeUtilisation(
  employeeId: string,
  period: string
): Promise<UtilisationSnapshot> {
  const res = await client.get<UtilisationSnapshot>(
    `/utilisation/employee/${employeeId}`,
    { params: { period } }
  )
  return res.data
}
