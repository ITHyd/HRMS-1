from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class FinanceValidationRow(BaseModel):
    row_number: int
    data: dict
    status: str  # valid | error | warning
    errors: list[str]
    warnings: list[str]


class FinanceUploadValidationResponse(BaseModel):
    total_rows: int
    valid_count: int
    error_count: int
    duplicate_count: int
    warning_count: int
    period: str
    version: int
    rows: list[FinanceValidationRow]
    upload_token: str


class FinanceUploadConfirmRequest(BaseModel):
    upload_token: str


class FinanceUploadConfirmResponse(BaseModel):
    imported_count: int
    version: int
    message: str


class FinanceBillableResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    period: str
    billable_status: str
    billable_hours: float
    billed_amount: Optional[float] = None
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    version: int


class FinanceBillableListResponse(BaseModel):
    entries: list[FinanceBillableResponse]
    total: int
    period: str
    latest_version: int
