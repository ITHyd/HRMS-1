from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.models.employee import Employee
from app.services.employee_service import (
    get_employee_departments,
    get_employee_detail,
    list_employees,
    search_employees,
)

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("/")
async def get_employees(
    search: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    return await list_employees(
        branch_location_id=user.branch_location_id,
        search=search,
        department_id=department_id,
        level=level,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )


@router.get("/status")
async def get_hrms_status(
    user: CurrentUser = Depends(get_current_user),
):
    """Return whether HRMS data has been synced (employee count > 0)."""
    total = await Employee.find_all().count()
    return {"total": total, "synced": total > 0}


@router.get("/departments")
async def get_departments(
    user: CurrentUser = Depends(get_current_user),
):
    return await get_employee_departments(user.branch_location_id)


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
