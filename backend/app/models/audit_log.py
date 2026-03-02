from datetime import datetime
from typing import Optional

from beanie import Document


class AuditLog(Document):
    action: str  # "CREATE" | "UPDATE" | "DELETE" | "IMPORT"
    entity_type: str  # "employee" | "relationship" | "project"
    entity_id: str
    changed_by: str  # user id
    timestamp: datetime
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    branch_location_id: str

    class Settings:
        name = "audit_log"
        indexes = [
            [("branch_location_id", 1), ("timestamp", -1)],
            [("entity_type", 1), ("entity_id", 1)],
        ]
