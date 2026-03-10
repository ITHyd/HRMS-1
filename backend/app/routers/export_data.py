from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services import hrms_mode_service
from app.services.export_service import (
    export_bench_list,
    export_billable_list,
    export_employee_allocation,
    export_project_utilisation,
    export_team_report,
)

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/branch/report")
async def export_branch_report(
    user: CurrentUser = Depends(get_current_user),
):
    xlsx_bytes = await export_team_report(user.branch_location_id)
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=team_report.xlsx"},
    )


@router.get("/billable")
async def export_billable(
    period: str,
    user: CurrentUser = Depends(get_current_user),
):
    csv_bytes = await export_billable_list(user.branch_location_id, period)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=billable_{period}.csv"},
    )


@router.get("/bench")
async def export_bench(
    period: str,
    user: CurrentUser = Depends(get_current_user),
):
    sync_mode = await hrms_mode_service.resolve_user_sync_mode(
        user_id=user.user_id,
        user_email=getattr(user, "email", None),
    )
    csv_bytes = await export_bench_list(user.branch_location_id, period, sync_mode=sync_mode)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=bench_{period}.csv"},
    )


@router.get("/project-utilisation")
async def export_project_util(
    period: str,
    user: CurrentUser = Depends(get_current_user),
):
    sync_mode = await hrms_mode_service.resolve_user_sync_mode(
        user_id=user.user_id,
        user_email=getattr(user, "email", None),
    )
    csv_bytes = await export_project_utilisation(user.branch_location_id, period, sync_mode=sync_mode)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=project_utilisation_{period}.csv"},
    )


@router.get("/employee-allocation")
async def export_emp_allocation(
    period: str,
    user: CurrentUser = Depends(get_current_user),
):
    sync_mode = await hrms_mode_service.resolve_user_sync_mode(
        user_id=user.user_id,
        user_email=getattr(user, "email", None),
    )
    csv_bytes = await export_employee_allocation(user.branch_location_id, period, sync_mode=sync_mode)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=employee_allocation_{period}.csv"},
    )
