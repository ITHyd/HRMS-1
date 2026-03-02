from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.schemas.availability import SkillTagRequest
from app.services import availability_service

router = APIRouter(prefix="/availability", tags=["Availability"])


@router.get("/bench")
async def get_bench_pool(
    skill: str = Query(None, description="Filter by skill name"),
    location: str = Query(None, description="Filter by location code"),
    classification: str = Query(None, description="Filter by classification (bench | partially_billed)"),
    search: str = Query(None, description="Search by employee name or designation"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    """Get bench pool - employees classified as bench or partially billed."""
    return await availability_service.get_bench_pool(
        branch_location_id=user.branch_location_id,
        skill_filter=skill,
        location_filter=location,
        classification_filter=classification,
        search=search,
        page=page,
        page_size=page_size,
    )


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
