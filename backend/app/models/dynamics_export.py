from datetime import datetime
from typing import Optional

from beanie import Document


class DynamicsExport(Document):
    export_type: str  # employee | project | timesheet
    status: str = "pending"  # pending | processing | completed | failed
    data_snapshot: dict = {}
    record_count: int = 0
    created_at: datetime = datetime.utcnow()
    processed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_by: str = ""

    class Settings:
        name = "dynamics_export_queue"
        indexes = [
            "export_type",
            "status",
        ]
