from datetime import datetime
from typing import Optional

from beanie import Document


class EmployeeProject(Document):
    employee_id: str
    project_id: str
    role_in_project: str
    assigned_at: Optional[datetime] = None
    assigned_by: Optional[str] = None

    class Settings:
        name = "employee_projects"
        indexes = [
            "employee_id",
            "project_id",
        ]
