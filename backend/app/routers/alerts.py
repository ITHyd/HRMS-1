from fastapi import APIRouter, Depends

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.alert_service import generate_alerts

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.post("/generate")
async def generate_project_alerts(user: CurrentUser = Depends(get_current_user)):
    """Generate automated alerts from current branch data (bench, endings, billable)."""
    return await generate_alerts(user.branch_location_id)
