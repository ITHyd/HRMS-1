from datetime import date
from typing import Optional

from beanie import Document


class HrmsHoliday(Document):
    """Holiday calendar entry from HRMS."""

    hrms_id: int
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
        ]
