from fastapi import APIRouter, Depends, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.dashboard_service import (
    get_allocation_dashboard,
    get_executive_dashboard,
    get_project_dashboard,
    get_resource_allocation_dashboard,
    get_resource_dashboard,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/executive")
async def executive_dashboard(
    period: str = Query(..., description="Period in YYYY-MM format", pattern=r"^\d{4}-\d{2}$"),
    user: CurrentUser = Depends(get_current_user),
):
    """Executive-level utilisation dashboard with KPIs, trends, and breakdowns."""
    return await get_executive_dashboard(period, user.branch_location_id)


@router.get("/resources")
async def resource_dashboard(
    period: str = Query(..., description="Period in YYYY-MM format", pattern=r"^\d{4}-\d{2}$"),
    search: str = Query(None, description="Search by employee name"),
    classification: str = Query(None, description="Filter by classification: fully_billed, partially_billed, bench"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user: CurrentUser = Depends(get_current_user),
):
    """Per-employee resource utilisation dashboard with search and filters."""
    return await get_resource_dashboard(
        period=period,
        branch_location_id=user.branch_location_id,
        search=search,
        classification=classification,
        page=page,
        page_size=page_size,
    )


@router.get("/projects")
async def project_dashboard(
    period: str = Query(..., description="Period in YYYY-MM format", pattern=r"^\d{4}-\d{2}$"),
    project_id: str = Query(None, description="Filter by specific project ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user: CurrentUser = Depends(get_current_user),
):
    """Per-project utilisation dashboard with health status and member details."""
    return await get_project_dashboard(
        period=period,
        branch_location_id=user.branch_location_id,
        project_id=project_id,
        page=page,
        page_size=page_size,
    )


@router.get("/allocations")
async def allocation_dashboard(
    period: str = Query(..., description="Period in YYYY-MM format", pattern=r"^\d{4}-\d{2}$"),
    search: str = Query(None, description="Search by employee name"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user: CurrentUser = Depends(get_current_user),
):
    """HRMS project allocation data for a given period."""
    return await get_allocation_dashboard(
        period=period,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get("/resource-allocations")
async def resource_allocation_dashboard(
    period: str = Query(..., description="Period in YYYY-MM format", pattern=r"^\d{4}-\d{2}$"),
    search: str = Query(None, description="Search by name, project, or client"),
    classification: str = Query(None, description="Filter: fully_billed, partially_billed, bench"),
    client_name: str = Query(None, description="Filter by client name"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user: CurrentUser = Depends(get_current_user),
):
    """Combined resource + allocation view per employee-project."""
    return await get_resource_allocation_dashboard(
        period=period,
        branch_location_id=user.branch_location_id,
        search=search,
        classification=classification,
        client_name=client_name,
        page=page,
        page_size=page_size,
    )
