from datetime import datetime
from typing import Optional

from beanie import Document


class ExcelUtilisationReport(Document):
    """Stores per-employee monthly availability imported from the Excel utilisation report."""
    branch_location_id: str
    upload_batch_id: str
    uploaded_at: datetime
    uploaded_by: str
    filename: str

    # Per-employee per-period row
    employee_name: str
    employee_email: Optional[str] = None
    employee_id: Optional[str] = None  # resolved from email if matched
    department: Optional[str] = None
    period: str  # YYYY-MM
    # 0% = fully utilised, 100% = fully available (Excel convention)
    availability_percent: float
    # Derived: utilisation_percent = 100 - availability_percent
    utilisation_percent: float
    classification: str  # fully_billed | partially_billed | bench

    class Settings:
        name = "excel_utilisation_reports"
        indexes = [
            [("branch_location_id", 1), ("upload_batch_id", 1)],
            [("branch_location_id", 1), ("period", 1)],
            [("employee_id", 1), ("period", 1)],
        ]
