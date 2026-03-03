from fastapi import APIRouter, Depends, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.global_search_service import global_search, get_employees_by_skill

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("/global")
async def search_global(
    q: str = Query(..., min_length=1),
    employee_limit: int = Query(5, ge=1, le=20),
    project_limit: int = Query(5, ge=1, le=20),
    skill_limit: int = Query(5, ge=1, le=20),
    department_limit: int = Query(3, ge=1, le=10),
    user: CurrentUser = Depends(get_current_user),
):
    return await global_search(
        query=q,
        branch_location_id=user.branch_location_id,
        employee_limit=employee_limit,
        project_limit=project_limit,
        skill_limit=skill_limit,
        department_limit=department_limit,
    )


@router.get("/employees-by-skill")
async def search_employees_by_skill(
    skill: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    return await get_employees_by_skill(
        skill_name=skill,
        branch_location_id=user.branch_location_id,
        page=page,
        page_size=page_size,
    )
