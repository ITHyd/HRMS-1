from datetime import datetime
from typing import Optional

from beanie import Document


class SyncLog(Document):
    integration_type: str  # hrms | finance | dynamics
    integration_config_id: Optional[str] = None
    direction: str = "inbound"  # inbound | outbound
    status: str = "running"  # running | completed | failed
    records_processed: int = 0
    records_succeeded: int = 0
    records_failed: int = 0
    error_details: list[dict] = []
    detail_sections: list[dict] = []
    started_at: datetime
    completed_at: Optional[datetime] = None
    triggered_by: str = "system"
    user_id: Optional[str] = None
    retry_count: int = 0
    parent_sync_id: Optional[str] = None

    class Settings:
        name = "sync_logs"
        indexes = [
            "integration_type",
            [("integration_type", 1), ("started_at", -1)],
        ]
