from datetime import datetime
from typing import Optional

from beanie import Document


class TimesheetPeriodLock(Document):
    period: str  # YYYY-MM
    branch_location_id: str
    is_locked: bool = False
    locked_by: Optional[str] = None
    locked_at: Optional[datetime] = None

    class Settings:
        name = "timesheet_period_locks"
        indexes = [
            [("branch_location_id", 1), ("period", 1)],
        ]
