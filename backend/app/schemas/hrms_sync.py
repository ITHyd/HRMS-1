from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HrmsSyncTriggerRequest(BaseModel):
    period: str  # YYYY-MM


class HrmsSyncLogResponse(BaseModel):
    batch_id: str
    period: str
    status: str
    total_records: int
    imported_count: int
    duplicate_count: int
    error_count: int
    errors: list[dict]
    started_at: datetime
    completed_at: Optional[datetime] = None


class HrmsSyncLogsListResponse(BaseModel):
    logs: list[HrmsSyncLogResponse]
    total: int
