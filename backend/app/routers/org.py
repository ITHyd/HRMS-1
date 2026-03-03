from bson import ObjectId
from fastapi import APIRouter, Depends

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.models.department import Department
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.project import Project
from app.services.org_tree_service import (
    build_full_org_tree,
    get_branch_subtree,
    get_reporting_chain,
    trace_path,
)

router = APIRouter(prefix="/org", tags=["Org Tree"])


@router.get("/tree")
async def get_full_tree(user: CurrentUser = Depends(get_current_user)):
    return await build_full_org_tree(
        branch_location_id=user.branch_location_id,
        branch_head_id=user.employee_id,
    )


@router.get("/branch/{location_id}/tree")
async def get_branch_tree(
    location_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    return await get_branch_subtree(location_id, branch_head_id=user.employee_id)


@router.get("/chain/{employee_id}")
async def get_chain(
    employee_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    chain = await get_reporting_chain(employee_id)
    return {"chain": chain}


@router.get("/trace")
async def get_trace(
    from_id: str,
    to_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    return await trace_path(from_id, to_id)


@router.get("/projects")
async def list_projects(user: CurrentUser = Depends(get_current_user)):
    """List all active projects that have employees from the user's branch."""
    # Get branch employee IDs
    branch_emps = await Employee.find(
        Employee.location_id == user.branch_location_id
    ).to_list()
    branch_emp_ids = [str(e.id) for e in branch_emps]

    # Find projects with assignments from this branch
    assignments = await EmployeeProject.find(
        {"employee_id": {"$in": branch_emp_ids}}
    ).to_list()
    proj_ids = list({a.project_id for a in assignments})

    projects = await Project.find(
        {"_id": {"$in": [ObjectId(pid) for pid in proj_ids if ObjectId.is_valid(pid)]},
         "status": "ACTIVE"}
    ).to_list() if proj_ids else []
    return [{"id": str(p.id), "name": p.name} for p in projects]


@router.get("/employees")
async def list_employees(user: CurrentUser = Depends(get_current_user)):
    """List all employees in the user's branch."""
    employees = await Employee.find(
        Employee.location_id == user.branch_location_id
    ).to_list()
    return [{"id": str(e.id), "name": e.name} for e in employees]
