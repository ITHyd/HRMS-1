from datetime import datetime
from typing import Optional

from beanie import Document


class FinanceBillable(Document):
    employee_id: str
    period: str  # YYYY-MM
    billable_status: str  # fully_billed | partially_billed | non_billable
    billable_hours: float = 0.0
    billed_amount: Optional[float] = None
    project_id: Optional[str] = None
    client_name: Optional[str] = None
    branch_location_id: str
    upload_batch_id: str
    version: int = 1
    created_at: datetime

    class Settings:
        name = "finance_billable"
        indexes = [
            [("employee_id", 1), ("period", 1), ("version", -1)],
            [("branch_location_id", 1), ("period", 1)],
            "upload_batch_id",
            [("period", 1), ("billable_status", 1)],
        ]
