from datetime import datetime
from typing import Optional
from beanie import Document
from pymongo import IndexModel


class EmployeePlannedWorked(Document):
    """Monthly planned vs worked days per employee per project, from Excel sheets."""

    employee_id: str          # MongoDB employee ID or "unmatched:<norm_name>"
    employee_name: str
    project_name: str
    client_name: Optional[str] = None
    period: str               # YYYY-MM
    planned_days: float = 0.0
    worked_days: float = 0.0
    source_file: Optional[str] = None
    imported_at: datetime

    class Settings:
        name = "employee_planned_worked"
        indexes = [
            [("employee_id", 1), ("period", 1)],
            [("period", 1), ("project_name", 1)],
            IndexModel(
                [("employee_id", 1), ("period", 1), ("project_name", 1)],
                name="uniq_emp_period_project",
                unique=True,
            ),
        ]
