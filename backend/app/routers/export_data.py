from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.export_service import export_team_report

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
