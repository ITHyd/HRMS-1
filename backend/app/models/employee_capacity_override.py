from datetime import datetime
from typing import Optional

from beanie import Document


class EmployeeCapacityOverride(Document):
    employee_id: str
    branch_location_id: str
    custom_hours_per_week: float
    reason: Optional[str] = None
    effective_from: datetime
    effective_to: Optional[datetime] = None
    created_by: str

    class Settings:
        name = "employee_capacity_overrides"
        indexes = [
            [("employee_id", 1), ("effective_from", -1)],
            "branch_location_id",
        ]
