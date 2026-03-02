from datetime import datetime, timezone
from typing import Optional

from app.models.integration_config import IntegrationConfig
from app.models.sync_log import SyncLog
from app.services import audit_service


async def list_integration_configs() -> list[dict]:
    """Return all IntegrationConfig documents."""
    configs = await IntegrationConfig.find_all().to_list()

    return [
        {
            "id": str(cfg.id),
            "integration_type": cfg.integration_type,
            "name": cfg.name,
            "status": cfg.status,
            "config": cfg.config,
            "last_sync_at": cfg.last_sync_at,
            "last_sync_status": cfg.last_sync_status,
            "created_at": cfg.created_at,
            "updated_at": cfg.updated_at,
        }
        for cfg in configs
    ]


async def get_integration_config(config_id: str) -> dict:
    """Get a single IntegrationConfig by ID."""
    cfg = await IntegrationConfig.get(config_id)
    if not cfg:
        raise ValueError("Integration config not found")

    return {
        "id": str(cfg.id),
        "integration_type": cfg.integration_type,
        "name": cfg.name,
        "status": cfg.status,
        "config": cfg.config,
        "last_sync_at": cfg.last_sync_at,
        "last_sync_status": cfg.last_sync_status,
        "created_at": cfg.created_at,
        "updated_at": cfg.updated_at,
    }


async def create_integration_config(data: dict, user) -> dict:
    """Create a new IntegrationConfig document."""
    now = datetime.now(timezone.utc)

    cfg = IntegrationConfig(
        integration_type=data["integration_type"],
        name=data["name"],
        status="inactive",
        config=data.get("config", {}),
        created_at=now,
        updated_at=now,
        created_by=user.user_id,
    )
    await cfg.insert()

    await audit_service.log_change(
        action="CREATE",
        entity_type="IntegrationConfig",
        entity_id=str(cfg.id),
        changed_by=user.user_id,
        branch_location_id=user.branch_location_id,
        new_value={
            "integration_type": cfg.integration_type,
            "name": cfg.name,
        },
    )

    return {
        "id": str(cfg.id),
        "integration_type": cfg.integration_type,
        "name": cfg.name,
        "status": cfg.status,
        "config": cfg.config,
        "last_sync_at": cfg.last_sync_at,
        "last_sync_status": cfg.last_sync_status,
        "created_at": cfg.created_at,
        "updated_at": cfg.updated_at,
    }


async def update_integration_config(config_id: str, data: dict, user) -> dict:
    """Update fields on an existing IntegrationConfig."""
    cfg = await IntegrationConfig.get(config_id)
    if not cfg:
        raise ValueError("Integration config not found")

    now = datetime.now(timezone.utc)
    changes = {}

    for field in ("name", "status", "config"):
        if field in data and data[field] is not None:
            old_value = getattr(cfg, field)
            new_value = data[field]
            if old_value != new_value:
                changes[field] = (old_value, new_value)
                setattr(cfg, field, new_value)

    if not changes:
        return {
            "id": str(cfg.id),
            "integration_type": cfg.integration_type,
            "name": cfg.name,
            "status": cfg.status,
            "config": cfg.config,
            "last_sync_at": cfg.last_sync_at,
            "last_sync_status": cfg.last_sync_status,
            "created_at": cfg.created_at,
            "updated_at": cfg.updated_at,
        }

    cfg.updated_at = now
    await cfg.save()

    await audit_service.log_change(
        action="UPDATE",
        entity_type="IntegrationConfig",
        entity_id=str(cfg.id),
        changed_by=user.user_id,
        branch_location_id=user.branch_location_id,
        old_value={k: str(v[0]) for k, v in changes.items()},
        new_value={k: str(v[1]) for k, v in changes.items()},
    )

    return {
        "id": str(cfg.id),
        "integration_type": cfg.integration_type,
        "name": cfg.name,
        "status": cfg.status,
        "config": cfg.config,
        "last_sync_at": cfg.last_sync_at,
        "last_sync_status": cfg.last_sync_status,
        "created_at": cfg.created_at,
        "updated_at": cfg.updated_at,
    }


async def trigger_manual_sync(config_id: str, user) -> dict:
    """
    Trigger a manual sync for the given IntegrationConfig.
    Creates a SyncLog with status='running', simulates a sync
    (marks completed with fake counts), and updates the config's
    last_sync_at / last_sync_status.
    """
    cfg = await IntegrationConfig.get(config_id)
    if not cfg:
        raise ValueError("Integration config not found")

    now = datetime.now(timezone.utc)

    # Create the sync log entry
    sync_log = SyncLog(
        integration_type=cfg.integration_type,
        integration_config_id=str(cfg.id),
        direction="inbound",
        status="running",
        records_processed=0,
        records_succeeded=0,
        records_failed=0,
        error_details=[],
        started_at=now,
        triggered_by="manual",
        user_id=user.user_id,
        retry_count=0,
    )
    await sync_log.insert()

    # Simulate sync completion with fake counts
    sync_log.status = "completed"
    sync_log.records_processed = 25
    sync_log.records_succeeded = 24
    sync_log.records_failed = 1
    sync_log.error_details = [
        {"record": "sample_record", "error": "Simulated validation error"}
    ]
    sync_log.completed_at = datetime.now(timezone.utc)
    await sync_log.save()

    # Update the integration config with last sync info
    cfg.last_sync_at = sync_log.completed_at
    cfg.last_sync_status = sync_log.status
    cfg.updated_at = datetime.now(timezone.utc)
    await cfg.save()

    await audit_service.log_change(
        action="SYNC",
        entity_type="IntegrationConfig",
        entity_id=str(cfg.id),
        changed_by=user.user_id,
        branch_location_id=user.branch_location_id,
        new_value={
            "sync_log_id": str(sync_log.id),
            "status": sync_log.status,
            "records_processed": sync_log.records_processed,
        },
    )

    return {
        "id": str(sync_log.id),
        "integration_type": sync_log.integration_type,
        "direction": sync_log.direction,
        "status": sync_log.status,
        "records_processed": sync_log.records_processed,
        "records_succeeded": sync_log.records_succeeded,
        "records_failed": sync_log.records_failed,
        "error_details": sync_log.error_details,
        "started_at": sync_log.started_at,
        "completed_at": sync_log.completed_at,
        "triggered_by": sync_log.triggered_by,
        "retry_count": sync_log.retry_count,
    }


async def retry_sync(sync_log_id: str, user) -> dict:
    """
    Retry a failed sync. Creates a new SyncLog with parent_sync_id
    pointing to the original, and increments retry_count.
    """
    original = await SyncLog.get(sync_log_id)
    if not original:
        raise ValueError("Sync log not found")

    now = datetime.now(timezone.utc)

    new_log = SyncLog(
        integration_type=original.integration_type,
        integration_config_id=original.integration_config_id,
        direction=original.direction,
        status="running",
        records_processed=0,
        records_succeeded=0,
        records_failed=0,
        error_details=[],
        started_at=now,
        triggered_by="manual_retry",
        user_id=user.user_id,
        retry_count=original.retry_count + 1,
        parent_sync_id=str(original.id),
    )
    await new_log.insert()

    # Simulate retry completion
    new_log.status = "completed"
    new_log.records_processed = original.records_processed
    new_log.records_succeeded = original.records_processed
    new_log.records_failed = 0
    new_log.completed_at = datetime.now(timezone.utc)
    await new_log.save()

    # Update config if available
    if original.integration_config_id:
        cfg = await IntegrationConfig.get(original.integration_config_id)
        if cfg:
            cfg.last_sync_at = new_log.completed_at
            cfg.last_sync_status = new_log.status
            cfg.updated_at = datetime.now(timezone.utc)
            await cfg.save()

    await audit_service.log_change(
        action="SYNC",
        entity_type="SyncLog",
        entity_id=str(new_log.id),
        changed_by=user.user_id,
        branch_location_id=user.branch_location_id,
        new_value={
            "parent_sync_id": str(original.id),
            "retry_count": new_log.retry_count,
            "status": new_log.status,
        },
    )

    return {
        "id": str(new_log.id),
        "integration_type": new_log.integration_type,
        "direction": new_log.direction,
        "status": new_log.status,
        "records_processed": new_log.records_processed,
        "records_succeeded": new_log.records_succeeded,
        "records_failed": new_log.records_failed,
        "error_details": new_log.error_details,
        "started_at": new_log.started_at,
        "completed_at": new_log.completed_at,
        "triggered_by": new_log.triggered_by,
        "retry_count": new_log.retry_count,
    }


async def get_sync_logs(
    integration_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """List SyncLog entries with optional integration_type filter."""
    filters = {}
    if integration_type:
        filters["integration_type"] = integration_type

    skip = (page - 1) * page_size

    logs = await SyncLog.find(
        filters
    ).sort(-SyncLog.started_at).skip(skip).limit(page_size).to_list()

    total = await SyncLog.find(filters).count()

    return {
        "logs": [
            {
                "id": str(log.id),
                "integration_type": log.integration_type,
                "direction": log.direction,
                "status": log.status,
                "records_processed": log.records_processed,
                "records_succeeded": log.records_succeeded,
                "records_failed": log.records_failed,
                "error_details": log.error_details,
                "started_at": log.started_at,
                "completed_at": log.completed_at,
                "triggered_by": log.triggered_by,
                "retry_count": log.retry_count,
            }
            for log in logs
        ],
        "total": total,
    }
