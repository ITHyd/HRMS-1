from datetime import datetime
from typing import Optional

from beanie import Document


class AuditLog(Document):
    action: str  # CREATE | UPDATE | DELETE | IMPORT | SYNC | EXPORT | UPLOAD | SKILL_TAG | APPROVE | REJECT | LOCK | COMPUTE
    entity_type: str  # employee | relationship | project | timesheet | finance | utilisation | integration | skill
    entity_id: str
    changed_by: str  # user id
    timestamp: datetime
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    branch_location_id: str
    metadata: Optional[dict] = None

    class Settings:
        name = "audit_log"
        indexes = [
            [("branch_location_id", 1), ("timestamp", -1)],
            [("entity_type", 1), ("entity_id", 1)],
            [("action", 1)],
        ]
