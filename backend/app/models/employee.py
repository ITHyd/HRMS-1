from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import EmailStr, Field


class Employee(Document):
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
            "email",
            "location_id",
            "department_id",
            [("location_id", 1), ("department_id", 1)],
            [("location_id", 1), ("is_active", 1)],
        ]
