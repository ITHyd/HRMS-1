from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.models.user import User
from app.schemas.hrms_sync import HrmsSyncTriggerRequest
from app.services.hrms_sync_service import (
    get_hrms_integration_config,
    get_sync_logs,
    is_live_sync_enabled_for_user,
    sync_master_data,
    trigger_live_sync,
    trigger_sync,
)

router = APIRouter(prefix="/hrms-sync", tags=["HRMS Sync"])


@router.post("/trigger")
async def trigger_hrms_sync(
    data: HrmsSyncTriggerRequest,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        db_user = await User.get(user.user_id)
        user_email = db_user.email if db_user else None
        cfg_doc, hrms_cfg = await get_hrms_integration_config()
        mode_cfg = hrms_cfg.get("mode", {}) if isinstance(hrms_cfg, dict) else {}

        if is_live_sync_enabled_for_user(user_email, mode_cfg):
            result = await trigger_live_sync(
                data.period,
                user.user_id,
                integration_config_id=str(cfg_doc.id) if cfg_doc else None,
            )
        else:
            # Demo mode: keep existing mock behavior.
            result = await trigger_sync(data.period, user.branch_location_id, user.user_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/master-data")
async def trigger_master_data_sync(
    hrms_token: str | None = Body(None, embed=True),
    user: CurrentUser = Depends(get_current_user),
):
    """Full replacement sync of master data from the real HRMS portal."""
    try:
        db_user = await User.get(user.user_id)
        user_email = db_user.email if db_user else None
        cfg_doc, hrms_cfg = await get_hrms_integration_config()
        mode_cfg = hrms_cfg.get("mode", {}) if isinstance(hrms_cfg, dict) else {}
        if not is_live_sync_enabled_for_user(user_email, mode_cfg):
            raise HTTPException(
                status_code=403,
                detail="HRMS master-data sync is disabled for demo users.",
            )
        result = await sync_master_data(
            token=hrms_token,
            user_id=user.user_id,
            integration_config_id=str(cfg_doc.id) if cfg_doc else None,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs")
async def list_sync_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    return await get_sync_logs(user.branch_location_id, page, page_size)


@router.get("/logs/{batch_id}")
async def get_sync_log(
    batch_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    from app.models.hrms_sync_log import HrmsSyncLog

    log = await HrmsSyncLog.find_one({
        "batch_id": batch_id,
        "$or": [
            {"branch_location_id": user.branch_location_id},
            {"branch_location_id": "ALL"},
        ],
    })
    if not log:
        raise HTTPException(status_code=404, detail="Sync log not found")
    return {
        "batch_id": log.batch_id,
        "period": log.period,
        "status": log.status,
        "mode": log.mode,
        "total_records": log.total_records,
        "imported_count": log.imported_count,
        "duplicate_count": log.duplicate_count,
        "error_count": log.error_count,
        "errors": log.errors,
        "entity_counts": log.entity_counts,
        "cursor": log.cursor,
        "started_at": log.started_at.isoformat(),
        "completed_at": log.completed_at.isoformat() if log.completed_at else None,
    }
