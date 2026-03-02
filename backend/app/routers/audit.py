from fastapi import APIRouter, Depends, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.audit_service import get_audit_log

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/branch/{location_id}")
async def get_branch_audit(
    location_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    return await get_audit_log(location_id, page, page_size)
