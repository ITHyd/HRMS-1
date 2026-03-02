from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CapacityConfigUpdate(BaseModel):
    standard_hours_per_week: Optional[float] = Field(None, ge=1, le=80)
    standard_hours_per_day: Optional[float] = Field(None, ge=1, le=16)
    working_days_per_week: Optional[int] = Field(None, ge=1, le=7)
    bench_threshold_percent: Optional[float] = Field(None, ge=0, le=100)
    partial_billing_threshold: Optional[float] = Field(None, ge=0, le=100)


class CapacityConfigResponse(BaseModel):
    id: str
    standard_hours_per_week: float
    standard_hours_per_day: float
    working_days_per_week: int
    bench_threshold_percent: float
    partial_billing_threshold: float
    effective_from: datetime


class EmployeeCapacityOverrideCreate(BaseModel):
    employee_id: str
    custom_hours_per_week: float = Field(ge=1, le=80)
    reason: Optional[str] = None
    effective_from: datetime
    effective_to: Optional[datetime] = None


class UtilisationSnapshotResponse(BaseModel):
    employee_id: str
    employee_name: str
    period: str
    total_hours_logged: float
    billable_hours: float
    non_billable_hours: float
    capacity_hours: float
    utilisation_percent: float
    billable_percent: float
    classification: str
    finance_billable_status: Optional[str] = None


class UtilisationSummary(BaseModel):
    period: str
    total_employees: int
    fully_billed_count: int
    partially_billed_count: int
    bench_count: int
    average_utilisation: float
    average_billable_percent: float
    snapshots: list[UtilisationSnapshotResponse]
