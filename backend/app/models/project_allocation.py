from datetime import datetime
from typing import Optional

from beanie import Document


class ProjectAllocation(Document):
    """Monthly employee-project allocation from HRMS."""

    period: str  # YYYY-MM
    employee_id: str  # Our MongoDB employee ID
    hrms_employee_id: int
    employee_name: str
    project_id: str  # Our MongoDB project ID
    hrms_project_id: int
    project_name: str
    client_name: Optional[str] = None
    allocated_days: float = 0.0
    allocation_percentage: float = 0.0
    total_working_days: int = 22
    total_allocated_days: float = 0.0
    available_days: float = 0.0
    sync_batch_id: Optional[str] = None
    synced_at: Optional[datetime] = None

    class Settings:
        name = "project_allocations"
        indexes = [
            [("period", 1), ("employee_id", 1)],
            [("period", 1), ("project_id", 1)],
            "sync_batch_id",
        ]
