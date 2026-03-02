from fastapi import APIRouter, Depends

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.analytics_service import get_branch_analytics

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/branch/{location_id}")
async def branch_analytics(
    location_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    return await get_branch_analytics(location_id)
