from datetime import datetime
from typing import Optional

from beanie import Document
from pymongo import IndexModel


class EmployeeProject(Document):
    source_system: Optional[str] = None
    source_id: Optional[str] = None
    source_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    is_deleted: bool = False
    employee_id: str
    project_id: str
    role_in_project: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    assigned_by: Optional[str] = None

    class Settings:
        name = "employee_projects"
        indexes = [
            "employee_id",
            "project_id",
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
