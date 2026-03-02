from datetime import datetime
from typing import Optional

from beanie import Document


class HrmsSyncLog(Document):
    batch_id: str
    branch_location_id: str
    period: str  # YYYY-MM
    status: str  # running | completed | failed
    total_records: int = 0
    imported_count: int = 0
    duplicate_count: int = 0
    error_count: int = 0
    errors: list[dict] = []
    started_at: datetime
    completed_at: Optional[datetime] = None
    triggered_by: str  # user_id or "system"

    class Settings:
        name = "hrms_sync_logs"
        indexes = [
            [("branch_location_id", 1), ("started_at", -1)],
            "batch_id",
        ]
