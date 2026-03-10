from datetime import datetime
from typing import Optional

from beanie import Document
from pymongo import IndexModel


class Project(Document):
    hrms_project_id: Optional[int] = None
    source_system: Optional[str] = None
    source_id: Optional[str] = None
    source_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    is_deleted: bool = False
    name: str
    status: str  # "ACTIVE" | "COMPLETED" | "ON_HOLD"
    project_type: str = "client"  # "client" | "internal"
    client_name: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None

    class Settings:
        name = "projects"
        indexes = [
            "hrms_project_id",
            "department_id",
            "status",
            "project_type",
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
