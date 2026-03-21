from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.models.user import User
from app.schemas.hrms_sync import HrmsSyncTriggerRequest
from app.services.hrms_sync_service import (
    get_billable_diagnostic,
    get_hrms_integration_config,
    get_sync_logs,
    is_live_sync_enabled_for_user,
    sync_master_data,
    trigger_live_sync,
    trigger_sync,
)

router = APIRouter(prefix="/hrms-sync", tags=["HRMS Sync"])


def _ensure_branch_admin(user: CurrentUser) -> None:
    if user.role not in {"branch_head", "admin"}:
        raise HTTPException(status_code=403, detail="Branch admin access required")


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


@router.get("/billable-diagnostic")
async def billable_diagnostic(
    period: str = Query(..., description="Period in YYYY-MM format", pattern=r"^\d{4}-\d{2}$"),
    branch_location_id: str | None = Query(None, description="Optional branch location override"),
    user: CurrentUser = Depends(get_current_user),
):
    _ensure_branch_admin(user)
    target_branch = branch_location_id or user.branch_location_id
    if user.role != "admin" and target_branch != user.branch_location_id:
        raise HTTPException(status_code=403, detail="You can only diagnose your own branch")
    return await get_billable_diagnostic(period=period, branch_location_id=target_branch)


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


@router.get("/raw-debug")
async def raw_hrms_debug(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    user: CurrentUser = Depends(get_current_user),
):
    """
    Debug endpoint: fetches raw HRMS data for a period and returns a summary
    showing what allocations and daily attendance look like, so we can diagnose
    why is_billable is not being set correctly.
    """
    from app.models.employee import Employee
    from app.models.project import Project
    from app.services.hrms_sync_service import (
        _resolve_hrms_auth,
        _to_int,
    )
    from app.services.hrms_client import HrmsClient

    cfg_doc, hrms_cfg = await get_hrms_integration_config()
    access_token, hr_id, base_url = await _resolve_hrms_auth(None, hrms_cfg)
    client = HrmsClient(base_url=base_url, token=access_token)

    year, month = int(period[:4]), int(period[5:7])

    # Fetch allocations
    allocations_raw = await client.get_allocations(period)
    alloc_employees = allocations_raw.get("employees", []) if isinstance(allocations_raw, dict) else []

    # Fetch attendance summary
    attendance_raw = await client.get_attendance_summary(hr_id=hr_id, year=year, month=month)
    if not isinstance(attendance_raw, list):
        attendance_raw = []

    # Sample: fetch daily for first 3 employees with hours > 0
    sample_daily = []
    sample_eids = [
        int(a["employee_id"])
        for a in attendance_raw
        if a.get("employee_id") is not None and float(a.get("total_hours", 0) or 0) > 0
    ][:3]
    for eid in sample_eids:
        try:
            daily = await client.get_daily_attendance(employee_id=eid, year=year, month=month)
            # Show first 3 days only
            sample_daily.append({
                "employee_id": eid,
                "days_sample": (daily or [])[:3],
            })
        except Exception as e:
            sample_daily.append({"employee_id": eid, "error": str(e)})

    await client.close()

    # Summarise allocations
    alloc_summary = []
    for ea in alloc_employees[:10]:  # first 10 employees
        alloc_summary.append({
            "employee_id": ea.get("employee_id"),
            "employee_name": ea.get("employee_name"),
            "allocations": [
                {
                    "project_id": a.get("project_id"),
                    "project_name": a.get("project_name"),
                    "client_name": a.get("client_name"),
                    "allocation_percentage": a.get("allocation_percentage"),
                }
                for a in (ea.get("allocations") or [])
            ],
        })

    # Check project_type values in DB
    projects = await Project.find({"hrms_project_id": {"$ne": None}, "is_deleted": {"$ne": True}}).to_list()
    proj_type_summary = {
        "client": sum(1 for p in projects if (p.project_type or "").lower() == "client"),
        "internal": sum(1 for p in projects if (p.project_type or "").lower() == "internal"),
        "other": sum(1 for p in projects if (p.project_type or "").lower() not in ("client", "internal")),
        "sample_projects": [
            {"name": p.name, "project_type": p.project_type, "client_name": p.client_name}
            for p in projects[:10]
        ],
    }

    return {
        "period": period,
        "attendance_count": len(attendance_raw),
        "employees_with_hours": len(sample_eids),
        "allocation_employees_count": len(alloc_employees),
        "allocation_sample": alloc_summary,
        "daily_sample": sample_daily,
        "project_type_summary": proj_type_summary,
    }
