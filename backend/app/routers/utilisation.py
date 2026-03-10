from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.schemas.utilisation import CapacityConfigUpdate, EmployeeCapacityOverrideCreate
from app.services.utilisation_service import (
    compute_utilisation,
    create_employee_override,
    get_cached_utilisation,
    get_or_create_capacity_config,
    get_overrides,
    update_capacity_config,
)

router = APIRouter(prefix="/utilisation", tags=["Utilisation"])


@router.get("/config")
async def get_capacity_config(
    user: CurrentUser = Depends(get_current_user),
):
    """Get the capacity configuration for the user's branch."""
    config = await get_or_create_capacity_config(user.branch_location_id)
    return {
        "id": str(config.id),
        "standard_hours_per_week": config.standard_hours_per_week,
        "standard_hours_per_day": config.standard_hours_per_day,
        "working_days_per_week": config.working_days_per_week,
        "bench_threshold_percent": config.bench_threshold_percent,
        "partial_billing_threshold": config.partial_billing_threshold,
        "effective_from": config.effective_from.isoformat(),
    }


@router.put("/config")
async def update_config(
    body: CapacityConfigUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    """Update the capacity configuration for the user's branch."""
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    config = await update_capacity_config(user.branch_location_id, data, user)
    return {
        "id": str(config.id),
        "standard_hours_per_week": config.standard_hours_per_week,
        "standard_hours_per_day": config.standard_hours_per_day,
        "working_days_per_week": config.working_days_per_week,
        "bench_threshold_percent": config.bench_threshold_percent,
        "partial_billing_threshold": config.partial_billing_threshold,
        "effective_from": config.effective_from.isoformat(),
    }


@router.post("/overrides")
async def create_override(
    body: EmployeeCapacityOverrideCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create an employee capacity override."""
    data = body.model_dump()
    override = await create_employee_override(data, user)
    return {
        "id": str(override.id),
        "employee_id": override.employee_id,
        "custom_hours_per_week": override.custom_hours_per_week,
        "reason": override.reason,
        "effective_from": override.effective_from.isoformat(),
        "effective_to": override.effective_to.isoformat() if override.effective_to else None,
    }


@router.get("/overrides")
async def list_overrides(
    user: CurrentUser = Depends(get_current_user),
):
    """List all employee capacity overrides for the branch."""
    overrides = await get_overrides(user.branch_location_id)
    return [
        {
            "id": str(o.id),
            "employee_id": o.employee_id,
            "custom_hours_per_week": o.custom_hours_per_week,
            "reason": o.reason,
            "effective_from": o.effective_from.isoformat(),
            "effective_to": o.effective_to.isoformat() if o.effective_to else None,
        }
        for o in overrides
    ]


@router.post("/compute")
async def compute(
    period: str = Query(..., description="Period in YYYY-MM format", pattern=r"^\d{4}-\d{2}$"),
    user: CurrentUser = Depends(get_current_user),
):
    """Compute utilisation for all employees in the branch for the given period."""
    summary = await compute_utilisation(period, user.branch_location_id)
    return summary.model_dump()


@router.get("/summary")
async def get_summary(
    period: str = Query(..., description="Period in YYYY-MM format", pattern=r"^\d{4}-\d{2}$"),
    user: CurrentUser = Depends(get_current_user),
):
    """Get cached utilisation summary without recomputing."""
    summary = await get_cached_utilisation(period, user.branch_location_id)
    if not summary:
        raise HTTPException(
            status_code=404,
            detail=f"No utilisation data found for period {period}. Run /compute first.",
        )
    return summary.model_dump()


@router.get("/employee/{employee_id}")
async def get_employee_utilisation(
    employee_id: str,
    period: str = Query(..., description="Period in YYYY-MM format", pattern=r"^\d{4}-\d{2}$"),
    user: CurrentUser = Depends(get_current_user),
):
    """Get utilisation snapshot for a single employee."""
    from app.models.utilisation_snapshot import UtilisationSnapshot

    snapshot = await UtilisationSnapshot.find_one(
        UtilisationSnapshot.employee_id == employee_id,
        UtilisationSnapshot.period == period,
        UtilisationSnapshot.branch_location_id == user.branch_location_id,
    )

    if not snapshot:
        raise HTTPException(
            status_code=404,
            detail=f"No utilisation data found for employee {employee_id} in period {period}.",
        )

    return {
        "employee_id": snapshot.employee_id,
        "employee_name": snapshot.employee_name,
        "period": snapshot.period,
        "total_hours_logged": snapshot.total_hours_logged,
        "billable_hours": snapshot.billable_hours,
        "non_billable_hours": snapshot.non_billable_hours,
        "capacity_hours": snapshot.capacity_hours,
        "utilisation_percent": snapshot.utilisation_percent,
        "billable_percent": snapshot.billable_percent,
        "classification": snapshot.classification,
        "finance_billable_status": snapshot.finance_billable_status,
    }
