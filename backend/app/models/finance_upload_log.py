from datetime import datetime

from beanie import Document


class FinanceUploadLog(Document):
    batch_id: str
    period: str
    branch_location_id: str
    uploaded_by: str
    filename: str
    total_rows: int
    valid_count: int
    error_count: int
    duplicate_count: int
    version: int
    errors: list[dict] = []
    uploaded_at: datetime

    class Settings:
        name = "finance_upload_logs"
        indexes = [
            [("branch_location_id", 1), ("period", 1), ("version", -1)],
            "batch_id",
        ]
