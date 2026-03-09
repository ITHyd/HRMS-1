from datetime import datetime
from typing import Optional

from beanie import Document
from pymongo import IndexModel


class ProjectAllocation(Document):
    """Monthly employee-project allocation from HRMS."""

    source_system: Optional[str] = None
    source_id: Optional[str] = None
    source_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    is_deleted: bool = False
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
