from datetime import datetime
from typing import Optional

from beanie import Document
from pymongo import IndexModel


class ReportingRelationship(Document):
    source_system: Optional[str] = None
    source_id: Optional[str] = None
    source_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    is_deleted: bool = False
    employee_id: str
    manager_id: str
    type: str  # "PRIMARY" | "FUNCTIONAL" | "PROJECT"

    class Settings:
        name = "reporting_relationships"
        indexes = [
            "employee_id",
            "manager_id",
            [("employee_id", 1), ("type", 1)],
            [("manager_id", 1), ("type", 1)],
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
