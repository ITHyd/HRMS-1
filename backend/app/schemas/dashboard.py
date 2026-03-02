from typing import Optional

from pydantic import BaseModel


class ExecutiveDashboardResponse(BaseModel):
    period: str
    total_active_employees: int
    billable_count: int
    non_billable_count: int
    bench_count: int
    overall_utilisation_percent: float
    overall_billable_percent: float
    top_consuming_projects: list[dict]
    resource_availability: dict
    classification_breakdown: list[dict]
    trend: list[dict]


class ResourceDashboardEntry(BaseModel):
    employee_id: str
    employee_name: str
    designation: str
    department: str
    projects: list[dict]
    total_hours: float
    billable_hours: float
    utilisation_percent: float
    billable_percent: float
    classification: str
    availability: str


class ResourceDashboardResponse(BaseModel):
    period: str
    entries: list[ResourceDashboardEntry]
    total: int


class ProjectDashboardEntry(BaseModel):
    project_id: str
    project_name: str
    status: str
    department: str
    total_hours_consumed: float
    billable_hours: float
    billable_percent: float
    member_count: int
    members: list[dict]
    health: str
    over_utilised_members: list[str]
    resource_variance: float


class ProjectDashboardResponse(BaseModel):
    period: str
    projects: list[ProjectDashboardEntry]
    total: int
