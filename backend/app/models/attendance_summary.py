from datetime import datetime
from typing import Optional

from beanie import Document


class AttendanceSummary(Document):
    """Monthly attendance summary per employee from HRMS."""

    period: str  # YYYY-MM
    employee_id: str  # Our MongoDB employee ID
    hrms_employee_id: int
    employee_name: str
    present_days: int = 0
    wfh_days: int = 0
    leave_days: int = 0
    total_hours: float = 0.0
    sync_batch_id: Optional[str] = None
    synced_at: Optional[datetime] = None

    class Settings:
        name = "attendance_summaries"
        indexes = [
            [("period", 1), ("employee_id", 1)],
            "sync_batch_id",
        ]
