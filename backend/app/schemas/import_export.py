from pydantic import BaseModel


class ValidationRow(BaseModel):
    row_number: int
    data: dict
    status: str  # "valid" | "error" | "warning"
    errors: list[str] = []
    warnings: list[str] = []


class ImportValidationResponse(BaseModel):
    total_rows: int
    valid_count: int
    error_count: int
    warning_count: int
    rows: list[ValidationRow]
    import_token: str  # token to confirm this specific import


class ImportConfirmRequest(BaseModel):
    import_token: str


class ImportConfirmResponse(BaseModel):
    imported_count: int
    message: str
