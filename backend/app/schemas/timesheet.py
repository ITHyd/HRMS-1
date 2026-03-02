from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class TimesheetEntryCreate(BaseModel):
    employee_id: str
    project_id: str
    date: date
    hours: float = Field(ge=0.5, le=24.0)
    is_billable: bool = True
    description: Optional[str] = None


class TimesheetEntryUpdate(BaseModel):
    hours: Optional[float] = Field(None, ge=0.5, le=24.0)
    is_billable: Optional[bool] = None
    description: Optional[str] = None
    project_id: Optional[str] = None


class TimesheetEntryResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    project_id: str
    project_name: str
    date: date
    hours: float
    is_billable: bool
    description: Optional[str] = None
    status: str
    source: str
    period: str
    created_at: datetime
    updated_at: datetime


class TimesheetSubmitRequest(BaseModel):
    entry_ids: list[str]


class TimesheetApprovalRequest(BaseModel):
    entry_ids: list[str]
    action: str  # approve | reject
    rejection_reason: Optional[str] = None


class TimesheetListResponse(BaseModel):
    entries: list[TimesheetEntryResponse]
    total: int
    period: str
    is_locked: bool


class TimesheetEditHistoryResponse(BaseModel):
    id: str
    field_changed: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by_name: str
    changed_at: datetime


class PeriodLockRequest(BaseModel):
    period: str
    lock: bool
