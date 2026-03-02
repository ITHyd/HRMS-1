from datetime import datetime

from beanie import Document


class CapacityConfig(Document):
    branch_location_id: str
    standard_hours_per_week: float = 40.0
    standard_hours_per_day: float = 8.0
    working_days_per_week: int = 5
    bench_threshold_percent: float = 30.0
    partial_billing_threshold: float = 70.0
    effective_from: datetime
    created_by: str
    updated_at: datetime

    class Settings:
        name = "capacity_config"
        indexes = [
            "branch_location_id",
        ]
