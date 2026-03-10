from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.schemas.timesheet import (
    TimesheetEntryCreate,
    TimesheetEntryUpdate,
    TimesheetSubmitRequest,
    TimesheetApprovalRequest,
    PeriodLockRequest,
)
from app.services import timesheet_service

router = APIRouter(prefix="/timesheets", tags=["Timesheets"])


@router.post("/")
async def create_entry(
    body: TimesheetEntryCreate,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        return await timesheet_service.create_entry(body.model_dump(), user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{entry_id}")
async def update_entry(
    entry_id: str,
    body: TimesheetEntryUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        return await timesheet_service.update_entry(
            entry_id, body.model_dump(exclude_unset=True), user
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{entry_id}")
async def delete_entry(
    entry_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        return await timesheet_service.delete_entry(entry_id, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
async def list_entries(
    employee_id: str = Query(None),
    project_id: str = Query(None),
    period: str = Query(None),
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    return await timesheet_service.list_entries(
        employee_id=employee_id,
        project_id=project_id,
        period=period,
        status=status,
        branch_location_id=user.branch_location_id,
        page=page,
        page_size=page_size,
    )


@router.post("/submit")
async def submit_entries(
    body: TimesheetSubmitRequest,
    user: CurrentUser = Depends(get_current_user),
):
    return await timesheet_service.submit_entries(body.entry_ids, user)


@router.post("/approve")
async def approve_reject_entries(
    body: TimesheetApprovalRequest,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        return await timesheet_service.approve_reject_entries(
            entry_ids=body.entry_ids,
            action=body.action,
            rejection_reason=body.rejection_reason,
            user=user,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/heatmap")
async def get_workload_heatmap(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    user: CurrentUser = Depends(get_current_user),
):
    return await timesheet_service.get_workload_heatmap(
        period=period,
        branch_location_id=user.branch_location_id,
    )


@router.get("/period-lock")
async def check_period_lock(
    period: str = Query(...),
    user: CurrentUser = Depends(get_current_user),
):
    return await timesheet_service.check_period_lock(period, user.branch_location_id)


@router.get("/{entry_id}/history")
async def get_entry_history(
    entry_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    return await timesheet_service.get_entry_history(entry_id)


@router.post("/period-lock")
async def toggle_period_lock(
    body: PeriodLockRequest,
    user: CurrentUser = Depends(get_current_user),
):
    return await timesheet_service.toggle_period_lock(
        period=body.period,
        branch_location_id=user.branch_location_id,
        lock=body.lock,
        user=user,
    )
