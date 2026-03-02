from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.employee_service import get_employee_detail, search_employees

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("/search")
async def search(
    q: str = Query("", description="Search query"),
    location_id: str = Query(None),
    department_id: str = Query(None),
    level: str = Query(None),
    limit: int = Query(20, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    return await search_employees(q, location_id, department_id, level, limit)


@router.get("/{employee_id}")
async def get_employee(
    employee_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    result = await get_employee_detail(employee_id, user.branch_location_id)
    if not result:
        raise HTTPException(status_code=404, detail="Employee not found")
    return result
