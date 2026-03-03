from datetime import datetime
from typing import Optional

from beanie import Document


class Project(Document):
    name: str
    status: str  # "ACTIVE" | "COMPLETED" | "ON_HOLD"
    project_type: str = "client"  # "client" | "internal"
    description: Optional[str] = None
    department_id: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None

    class Settings:
        name = "projects"
        indexes = [
            "department_id",
            "status",
            "project_type",
        ]
