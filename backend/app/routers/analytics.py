from fastapi import APIRouter, Depends, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.analytics_service import get_branch_analytics
from app.services.excel_utilisation_service import get_excel_analytics

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/branch/{location_id}")
async def branch_analytics(
    location_id: str,
    period: str = Query(None, description="Period in YYYY-MM format for Excel mode"),
    data_source: str = Query("hrms", pattern="^(hrms|excel)$"),
    user: CurrentUser = Depends(get_current_user),
):
    if data_source == "excel":
        data = await get_excel_analytics(location_id, period=period)
        if data:
            return data
        return {
            "period": None,
            "data_source": "excel",
            "total_headcount": 0,
            "active_count": 0,
            "client_breakdown": [],
            "level_breakdown": [],
            "monthly_trend": [],
            "span_of_control": [],
            "hierarchy_depth": 0,
            "departments_without_manager": [],
            "cross_reports": [],
            "projects": [],
            "orphaned_projects": [],
        }
    return await get_branch_analytics(location_id)
