from datetime import datetime, date
from typing import Optional

from beanie import Document
from pymongo import IndexModel


class TimesheetEntry(Document):
    source_system: Optional[str] = None
    source_id: Optional[str] = None
    source_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    is_deleted: bool = False
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
            IndexModel(
                [("source_system", 1), ("source_id", 1)],
                name="uniq_source_system_source_id",
                unique=True,
                partialFilterExpression={
                    "source_system": {"$exists": True, "$type": "string"},
                    "source_id": {"$exists": True, "$type": "string"},
                },
            ),
        ]
