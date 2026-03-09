from datetime import date
from datetime import datetime
from typing import Optional

from beanie import Document
from pymongo import IndexModel


class HrmsHoliday(Document):
    """Holiday calendar entry from HRMS."""

    hrms_id: int
    source_system: Optional[str] = None
    source_id: Optional[str] = None
    source_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    is_deleted: bool = False
    location_id: Optional[str] = None  # Our MongoDB location_id
    hrms_location_id: Optional[int] = None
    holiday_date: date
    holiday_name: str
    holiday_type: Optional[str] = None
    year: int

    class Settings:
        name = "hrms_holidays"
        indexes = [
            [("year", 1), ("location_id", 1)],
            [("holiday_date", 1)],
            "hrms_id",
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
