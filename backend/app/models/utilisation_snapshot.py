from datetime import datetime
from typing import Optional

from beanie import Document


class UtilisationSnapshot(Document):
    sync_mode: str = "live"  # live | demo
    employee_id: str
    employee_name: str
    employee_level: str = ""  # mirrors Employee.level for filtering
    period: str  # YYYY-MM
    branch_location_id: str
    total_hours_logged: float = 0.0
    billable_hours: float = 0.0
    non_billable_hours: float = 0.0
    capacity_hours: float = 0.0
    utilisation_percent: float = 0.0
    billable_percent: float = 0.0
    classification: str = "bench"  # fully_billed | partially_billed | bench
    finance_billable_status: Optional[str] = None
    computed_at: datetime

    class Settings:
        name = "utilisation_snapshots"
        indexes = [
            [("branch_location_id", 1), ("period", 1), ("sync_mode", 1)],
            [("employee_id", 1), ("period", 1)],
            [("period", 1), ("classification", 1)],
        ]
