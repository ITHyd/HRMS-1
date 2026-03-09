from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import EmailStr
from pymongo import IndexModel


class Employee(Document):
    hrms_employee_id: Optional[int] = None
    source_system: Optional[str] = None
    source_id: Optional[str] = None
    source_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    is_deleted: bool = False
    name: str
    email: EmailStr
    designation: str
    department_id: str
    level: str  # "intern", "junior", "mid", "senior", "lead", "manager", "head", "director", "vp", "c-suite"
    location_id: str
    join_date: datetime
    photo_url: Optional[str] = None
    is_active: bool = True

    class Settings:
        name = "employees"
        indexes = [
            "hrms_employee_id",
            "email",
            "location_id",
            "department_id",
            [("location_id", 1), ("department_id", 1)],
            [("location_id", 1), ("is_active", 1)],
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
