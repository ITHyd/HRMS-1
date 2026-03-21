from datetime import datetime

from beanie import Document


class ExcelUploadLog(Document):
    """Tracks each Excel utilisation report upload."""
    batch_id: str
    branch_location_id: str
    uploaded_by: str
    filename: str
    total_rows: int
    matched_rows: int   # rows where employee was resolved in DB
    periods: list[str]  # YYYY-MM periods found in the file
    uploaded_at: datetime

    class Settings:
        name = "excel_upload_logs"
        indexes = [
            [("branch_location_id", 1), ("uploaded_at", -1)],
            "batch_id",
        ]
