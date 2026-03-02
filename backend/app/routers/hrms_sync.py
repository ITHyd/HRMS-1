from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.schemas.hrms_sync import HrmsSyncTriggerRequest
from app.services.hrms_sync_service import trigger_sync, get_sync_logs

router = APIRouter(prefix="/hrms-sync", tags=["HRMS Sync"])


@router.post("/trigger")
async def trigger_hrms_sync(
    data: HrmsSyncTriggerRequest,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await trigger_sync(data.period, user.branch_location_id, user.user_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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

    log = await HrmsSyncLog.find_one(
        HrmsSyncLog.batch_id == batch_id,
        HrmsSyncLog.branch_location_id == user.branch_location_id,
    )
    if not log:
        raise HTTPException(status_code=404, detail="Sync log not found")
    return {
        "batch_id": log.batch_id,
        "period": log.period,
        "status": log.status,
        "total_records": log.total_records,
        "imported_count": log.imported_count,
        "duplicate_count": log.duplicate_count,
        "error_count": log.error_count,
        "errors": log.errors,
        "started_at": log.started_at.isoformat(),
        "completed_at": log.completed_at.isoformat() if log.completed_at else None,
    }
