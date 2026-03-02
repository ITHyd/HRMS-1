from datetime import datetime, date
from typing import Optional

from beanie import Document


class TimesheetEntry(Document):
    employee_id: str
    project_id: str
    date: date
    hours: float
    is_billable: bool = True
    description: Optional[str] = None
    status: str = "draft"  # draft | submitted | approved | rejected
    submitted_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    source: str = "manual"  # manual | hrms_sync
    sync_batch_id: Optional[str] = None
    period: str  # YYYY-MM
    branch_location_id: str
    created_at: datetime
    updated_at: datetime

    class Settings:
        name = "timesheet_entries"
        indexes = [
            [("employee_id", 1), ("date", 1), ("project_id", 1)],
            [("branch_location_id", 1), ("period", 1)],
            [("employee_id", 1), ("period", 1), ("status", 1)],
            [("project_id", 1), ("period", 1)],
            "sync_batch_id",
        ]
