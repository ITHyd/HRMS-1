from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.schemas.availability import SkillTagRequest
from app.services import availability_service
from app.services.excel_utilisation_service import (
    get_excel_bench_pool,
    get_excel_designations,
)

router = APIRouter(prefix="/availability", tags=["Availability"])


@router.get("/bench")
async def get_bench_pool(
    period: str = Query(None, description="Period in YYYY-MM format for Excel mode"),
    skill: str = Query(None, description="Filter by skill name"),
    location: str = Query(None, description="Filter by location code"),
    classification: str = Query(None, description="Filter by classification (bench | partially_billed)"),
    designation: str = Query(None, description="Filter by role/designation"),
    utilisation_min: float = Query(None, ge=0, le=100, description="Min utilisation %"),
    utilisation_max: float = Query(None, ge=0, le=100, description="Max utilisation %"),
    search: str = Query(None, description="Search by employee name or designation"),
    data_source: str = Query("hrms", pattern="^(hrms|excel)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    """Get bench pool - employees classified as bench or partially billed."""
    if data_source == "excel":
        return await get_excel_bench_pool(
            branch_location_id=user.branch_location_id,
            period=period,
            skill_filter=skill,
            location_filter=location,
            classification_filter=classification,
            designation_filter=designation,
            utilisation_min=utilisation_min,
            utilisation_max=utilisation_max,
            search=search,
            page=page,
            page_size=page_size,
        )
    return await availability_service.get_bench_pool(
        branch_location_id=user.branch_location_id,
        skill_filter=skill,
        location_filter=location,
        classification_filter=classification,
        designation_filter=designation,
        utilisation_min=utilisation_min,
        utilisation_max=utilisation_max,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get("/locations")
async def get_locations(
    user: CurrentUser = Depends(get_current_user),
):
    """List all locations for filter dropdowns."""
    return await availability_service.get_locations()


@router.get("/designations")
async def get_designations(
    period: str = Query(None, description="Period in YYYY-MM format for Excel mode"),
    data_source: str = Query("hrms", pattern="^(hrms|excel)$"),
    user: CurrentUser = Depends(get_current_user),
):
    """List distinct designations for bench/available employees."""
    if data_source == "excel":
        return await get_excel_designations(user.branch_location_id, period=period)
    return await availability_service.get_bench_designations(user.branch_location_id)


@router.get("/skills/{employee_id}")
async def get_employee_skills(
    employee_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get all skills tagged on an employee."""
    return await availability_service.get_employee_skills(employee_id)


@router.post("/skills/{employee_id}")
async def add_employee_skill(
    employee_id: str,
    body: SkillTagRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Tag a skill on an employee."""
    try:
        return await availability_service.add_employee_skill(
            employee_id, body.model_dump(), user
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/skills/{employee_id}/{skill_name}")
async def remove_employee_skill(
    employee_id: str,
    skill_name: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Remove a skill tag from an employee."""
    try:
        return await availability_service.remove_employee_skill(
            employee_id, skill_name, user
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/skill-catalog")
async def get_skill_catalog(
    category: str = Query(None, description="Filter by category"),
    user: CurrentUser = Depends(get_current_user),
):
    """List all entries in the skill catalog."""
    return await availability_service.get_skill_catalog(category)


@router.get("/skill-catalog/search")
async def search_skill_catalog(
    q: str = Query(..., description="Search query"),
    user: CurrentUser = Depends(get_current_user),
):
    """Search the skill catalog by name (case-insensitive)."""
    return await availability_service.search_skill_catalog(q)
