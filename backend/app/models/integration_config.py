from datetime import datetime
from typing import Optional

from beanie import Document


class IntegrationConfig(Document):
    integration_type: str  # hrms | finance | dynamics
    name: str
    status: str = "inactive"  # active | inactive | error
    config: dict = {}
    last_sync_at: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()
    created_by: str = ""

    class Settings:
        name = "integration_configs"
        indexes = [
            "integration_type",
            "status",
        ]
