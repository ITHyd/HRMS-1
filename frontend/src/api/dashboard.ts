import client from "./client"
import type {
  ExecutiveDashboard,
  ResourceDashboardResponse,
  ProjectDashboardResponse,
  AllocationDashboardResponse,
  ResourceAllocationResponse,
} from "@/types/dashboard"

export async function getExecutiveDashboard(params: {
  period: string
  client_name?: string
}): Promise<ExecutiveDashboard> {
  const res = await client.get<ExecutiveDashboard>("/dashboard/executive", {
    params,
  })
  return res.data
}

export async function getResourceDashboard(params: {
  period: string
  search?: string
  classification?: string
  page?: number
  page_size?: number
}): Promise<ResourceDashboardResponse> {
  const res = await client.get<ResourceDashboardResponse>("/dashboard/resources", {
    params,
  })
  return res.data
}

export async function getProjectDashboard(params: {
  period: string
  project_id?: string
  client_name?: string
  page?: number
  page_size?: number
}): Promise<ProjectDashboardResponse> {
  const res = await client.get<ProjectDashboardResponse>("/dashboard/projects", {
    params,
  })
  return res.data
}

export async function getAllocationDashboard(params: {
  period: string
  search?: string
  page?: number
  page_size?: number
}): Promise<AllocationDashboardResponse> {
  const res = await client.get<AllocationDashboardResponse>("/dashboard/allocations", {
    params,
  })
  return res.data
}

export async function getResourceAllocationDashboard(params: {
  period: string
  search?: string
  classification?: string
  client_name?: string
  page?: number
  page_size?: number
}): Promise<ResourceAllocationResponse> {
  const res = await client.get<ResourceAllocationResponse>("/dashboard/resource-allocations", {
    params,
  })
  return res.data
}
