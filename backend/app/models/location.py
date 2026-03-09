from datetime import datetime
from typing import Optional

from beanie import Document
from pymongo import IndexModel


class Location(Document):
    hrms_location_id: Optional[int] = None
    source_system: Optional[str] = None
    source_id: Optional[str] = None
    source_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    is_deleted: bool = False
    city: str
    country: str
    region: str  # "APAC" | "EMEA"
    code: str  # Short code like "HYD", "BLR", "LON", "SYD"

    class Settings:
        name = "locations"
        indexes = [
            "hrms_location_id",
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
