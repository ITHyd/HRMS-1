from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class IntegrationConfigCreate(BaseModel):
    integration_type: str  # hrms | finance | dynamics
    name: str
    config: dict = {}


class IntegrationConfigUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None  # active | inactive
    config: Optional[dict] = None


class IntegrationConfigResponse(BaseModel):
    id: str
    integration_type: str
    name: str
    status: str
    config: dict
    last_sync_at: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class SyncLogResponse(BaseModel):
    id: str
    integration_type: str
    direction: str
    status: str
    records_processed: int
    records_succeeded: int
    records_failed: int
    error_details: list[dict]
    started_at: datetime
    completed_at: Optional[datetime] = None
    triggered_by: str
    retry_count: int


class SyncLogsListResponse(BaseModel):
    logs: list[SyncLogResponse]
    total: int


class DynamicsExportRequest(BaseModel):
    export_type: str  # employee | project | timesheet


class DynamicsExportResponse(BaseModel):
    id: str
    export_type: str
    status: str
    record_count: int
    created_at: datetime
    processed_at: Optional[datetime] = None
    error_message: Optional[str] = None
