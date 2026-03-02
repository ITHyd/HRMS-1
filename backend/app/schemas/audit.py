from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AuditEntry(BaseModel):
    id: str
    action: str
    entity_type: str
    entity_id: str
    changed_by: str
    changed_by_name: str
    timestamp: datetime
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    description: str  # human-readable summary


class AuditLogResponse(BaseModel):
    entries: list[AuditEntry]
    total: int
    page: int
    page_size: int
