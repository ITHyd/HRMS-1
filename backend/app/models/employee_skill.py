from datetime import datetime
from typing import Optional

from beanie import Document


class EmployeeSkill(Document):
    employee_id: str
    skill_name: str
    proficiency: str = "intermediate"  # beginner | intermediate | advanced | expert
    added_by: str
    added_at: datetime
    notes: Optional[str] = None

    class Settings:
        name = "employee_skills"
        indexes = [
            "employee_id",
            "skill_name",
            [("employee_id", 1), ("skill_name", 1)],
        ]
