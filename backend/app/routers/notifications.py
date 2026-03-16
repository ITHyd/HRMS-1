from fastapi import APIRouter, Depends

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.notification_service import get_notification_summary

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/summary")
async def notification_summary(user: CurrentUser = Depends(get_current_user)):
    """Contextual notification summary for the branch."""
    return await get_notification_summary(user.branch_location_id)


@router.delete("/{type}/{id}")
async def dismiss_notification(
    type: str,
    id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Acknowledge dismiss — client persists dismissal in localStorage."""
    return {"dismissed": True}
