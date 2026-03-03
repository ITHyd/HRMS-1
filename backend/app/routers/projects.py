from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.project_service import (
    assign_employees,
    create_project,
    get_project_detail,
    list_projects,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


class ProjectCreateRequest(BaseModel):
    name: str
    project_type: str = "client"
    description: Optional[str] = None
    department_id: str
    start_date: datetime
    end_date: Optional[datetime] = None


class AssignRequest(BaseModel):
    employee_ids: list[str]
    project_id: Optional[str] = None
    new_project: Optional[ProjectCreateRequest] = None
    role_in_project: str = "contributor"


@router.get("/")
async def get_projects(
    search: Optional[str] = Query(None),
    project_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    return await list_projects(
        branch_location_id=user.branch_location_id,
        search=search,
        project_type=project_type,
        status=status,
    )


@router.post("/")
async def create_new_project(
    data: ProjectCreateRequest,
    user: CurrentUser = Depends(get_current_user),
):
    project = await create_project(
        name=data.name,
        project_type=data.project_type,
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
    user: CurrentUser = Depends(get_current_user),
):
    detail = await get_project_detail(project_id)
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
