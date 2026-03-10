from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services import hrms_mode_service
from app.services.project_service import (
    assign_employees,
    create_project,
    get_distinct_clients,
    get_employee_timeline,
    get_project_detail,
    list_projects,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


class ProjectCreateRequest(BaseModel):
    name: str
    project_type: str = "client"
    client_name: Optional[str] = None
    description: Optional[str] = None
    department_id: str
    start_date: datetime
    end_date: Optional[datetime] = None


class AssignRequest(BaseModel):
    employee_ids: list[str]
    project_id: Optional[str] = None
    new_project: Optional[ProjectCreateRequest] = None
    role_in_project: str = "contributor"


@router.get("/clients")
async def list_clients(user: CurrentUser = Depends(get_current_user)):
    """Return distinct client names for projects in this branch."""
    return await get_distinct_clients(user.branch_location_id)


@router.get("/")
async def get_projects(
    search: Optional[str] = Query(None),
    project_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    client_name: Optional[str] = Query(None),
    period: Optional[str] = Query(None, description="Period in YYYY-MM format", pattern=r"^\d{4}-\d{2}$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    sync_mode = await hrms_mode_service.resolve_user_sync_mode(
        user_id=user.user_id,
        user_email=getattr(user, "email", None),
    )
    return await list_projects(
        branch_location_id=user.branch_location_id,
        sync_mode=sync_mode,
        search=search,
        project_type=project_type,
        status=status,
        client_name=client_name,
        period=period,
        page=page,
        page_size=page_size,
    )


@router.post("/")
async def create_new_project(
    data: ProjectCreateRequest,
    user: CurrentUser = Depends(get_current_user),
):
    project = await create_project(
        name=data.name,
        project_type=data.project_type,
        client_name=data.client_name,
        department_id=data.department_id,
        start_date=data.start_date,
        end_date=data.end_date,
        description=data.description,
        user_id=user.user_id,
        branch_location_id=user.branch_location_id,
    )
    return {"id": str(project.id), "name": project.name}


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    period: Optional[str] = Query(None, description="Period in YYYY-MM format", pattern=r"^\d{4}-\d{2}$"),
    user: CurrentUser = Depends(get_current_user),
):
    sync_mode = await hrms_mode_service.resolve_user_sync_mode(
        user_id=user.user_id,
        user_email=getattr(user, "email", None),
    )
    detail = await get_project_detail(project_id, period=period, sync_mode=sync_mode)
    if not detail:
        raise HTTPException(status_code=404, detail="Project not found")
    return detail


@router.post("/assign")
async def assign_to_project(
    data: AssignRequest,
    user: CurrentUser = Depends(get_current_user),
):
    project_id = data.project_id

    if not project_id and data.new_project:
        project = await create_project(
            name=data.new_project.name,
            project_type=data.new_project.project_type,
            client_name=data.new_project.client_name,
            department_id=data.new_project.department_id,
            start_date=data.new_project.start_date,
            end_date=data.new_project.end_date,
            description=data.new_project.description,
            user_id=user.user_id,
            branch_location_id=user.branch_location_id,
        )
        project_id = str(project.id)

    if not project_id:
        raise HTTPException(status_code=400, detail="Either project_id or new_project is required")

    try:
        result = await assign_employees(
            employee_ids=data.employee_ids,
            project_id=project_id,
            role_in_project=data.role_in_project,
            user_id=user.user_id,
            branch_location_id=user.branch_location_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/employees/{employee_id}/timeline")
async def employee_timeline(
    employee_id: str,
    from_period: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}$"),
    to_period: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}$"),
    user: CurrentUser = Depends(get_current_user),
):
    """Return month-by-month project timeline for an employee."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    if not to_period:
        to_period = now.strftime("%Y-%m")
    if not from_period:
        # Default: 12 months back
        y, m = now.year, now.month - 11
        if m <= 0:
            m += 12
            y -= 1
        from_period = f"{y:04d}-{m:02d}"
    sync_mode = await hrms_mode_service.resolve_user_sync_mode(
        user_id=user.user_id,
        user_email=getattr(user, "email", None),
    )
    return await get_employee_timeline(employee_id, from_period, to_period, sync_mode=sync_mode)
