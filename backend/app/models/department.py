from datetime import datetime
from typing import Optional

from beanie import Document
from pymongo import IndexModel


class Department(Document):
    source_system: Optional[str] = None
    source_id: Optional[str] = None
    source_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    is_deleted: bool = False
    name: str
    location_id: str
    parent_id: Optional[str] = None  # ID of parent department (for hierarchy)

    class Settings:
        name = "departments"
        indexes = [
            "location_id",
            "parent_id",
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
