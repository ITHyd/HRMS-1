from datetime import datetime
from typing import Optional

from beanie import Document


class TimesheetEditHistory(Document):
    timesheet_entry_id: str
    changed_by: str
    changed_at: datetime
    field_changed: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None

    class Settings:
        name = "timesheet_edit_history"
        indexes = [
            "timesheet_entry_id",
            [("timesheet_entry_id", 1), ("changed_at", -1)],
        ]
