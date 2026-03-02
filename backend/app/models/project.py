from datetime import datetime
from typing import Optional

from beanie import Document


class Project(Document):
    name: str
    status: str  # "ACTIVE" | "COMPLETED" | "ON_HOLD"
    department_id: str
    start_date: datetime
    end_date: Optional[datetime] = None

    class Settings:
        name = "projects"
        indexes = [
            "department_id",
            "status",
        ]
