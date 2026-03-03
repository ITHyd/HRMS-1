from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from app.models.department import Department
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.location import Location
from app.models.project import Project
from app.services.audit_service import log_change


async def list_projects(
    branch_location_id: str,
    search: Optional[str] = None,
    project_type: Optional[str] = None,
    status: Optional[str] = None,
):
    """List projects scoped to branch via employee assignments."""
    branch_emps = await Employee.find(
        Employee.location_id == branch_location_id,
    ).to_list()
    branch_emp_ids = [str(e.id) for e in branch_emps]

    assignments = await EmployeeProject.find(
        {"employee_id": {"$in": branch_emp_ids}}
    ).to_list()
    proj_ids = list({a.project_id for a in assignments})

    if not proj_ids:
        return []

    filters = {"_id": {"$in": [ObjectId(pid) for pid in proj_ids if ObjectId.is_valid(pid)]}}
    if status:
        filters["status"] = status
    if project_type:
        filters["project_type"] = project_type

    projects = await Project.find(filters).to_list()

    if search:
        search_lower = search.lower()
        projects = [p for p in projects if search_lower in p.name.lower()]

    dept_ids = list({p.department_id for p in projects})
    depts = await Department.find(
        {"_id": {"$in": [ObjectId(d) for d in dept_ids if ObjectId.is_valid(d)]}}
    ).to_list()
    dept_map = {str(d.id): d.name for d in depts}

    # Count members per project
    member_counts = {}
    for a in assignments:
        if a.project_id not in member_counts:
            member_counts[a.project_id] = 0
        member_counts[a.project_id] += 1

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    result = []
    for p in projects:
        pid = str(p.id)
        progress = 0.0
        if p.start_date and p.end_date:
            start = p.start_date.replace(tzinfo=None) if p.start_date.tzinfo else p.start_date
            end = p.end_date.replace(tzinfo=None) if p.end_date.tzinfo else p.end_date
            total = (end - start).total_seconds()
            elapsed = (now - start).total_seconds()
            if total > 0:
                progress = min(100.0, max(0.0, (elapsed / total) * 100))

        result.append({
            "id": pid,
            "name": p.name,
            "project_type": p.project_type,
            "description": p.description,
            "status": p.status,
            "department_name": dept_map.get(p.department_id, "Unknown"),
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "end_date": p.end_date.isoformat() if p.end_date else None,
            "member_count": member_counts.get(pid, 0),
            "progress_percent": round(progress, 1),
        })

    return result


async def create_project(
    name: str,
    project_type: str,
    department_id: str,
    start_date: datetime,
    end_date: Optional[datetime],
    description: Optional[str],
    user_id: str,
    branch_location_id: str,
):
    """Create a new project."""
    project = Project(
        name=name,
        status="ACTIVE",
        project_type=project_type,
        description=description,
        department_id=department_id,
        start_date=start_date,
        end_date=end_date,
    )
    await project.insert()

    await log_change(
        action="CREATE",
        entity_type="Project",
        entity_id=str(project.id),
        changed_by=user_id,
        branch_location_id=branch_location_id,
        new_value={"name": name, "project_type": project_type},
    )

    return project


async def assign_employees(
    employee_ids: list[str],
    project_id: str,
    role_in_project: str,
    user_id: str,
    branch_location_id: str,
):
    """Assign employees to a project, skip duplicates."""
    project = await Project.get(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    now = datetime.now(timezone.utc)
    assigned_count = 0

    for emp_id in employee_ids:
        existing = await EmployeeProject.find_one(
            EmployeeProject.employee_id == emp_id,
            EmployeeProject.project_id == project_id,
        )
        if existing:
            continue

        ep = EmployeeProject(
            employee_id=emp_id,
            project_id=project_id,
            role_in_project=role_in_project,
            assigned_at=now,
            assigned_by=user_id,
        )
        await ep.insert()
        assigned_count += 1

        await log_change(
            action="ASSIGN",
            entity_type="EmployeeProject",
            entity_id=str(ep.id),
            changed_by=user_id,
            branch_location_id=branch_location_id,
            new_value={
                "employee_id": emp_id,
                "project_id": project_id,
                "role": role_in_project,
            },
        )

    return {
        "assigned_count": assigned_count,
        "project_id": str(project.id),
        "project_name": project.name,
    }


async def get_project_detail(project_id: str):
    """Get project detail with members."""
    project = await Project.get(project_id)
    if not project:
        return None

    dept = await Department.get(project.department_id)
    assignments = await EmployeeProject.find(
        EmployeeProject.project_id == project_id
    ).to_list()

    members = []
    for a in assignments:
        emp = await Employee.get(a.employee_id)
        if emp:
            loc = await Location.get(emp.location_id)
            members.append({
                "employee_id": str(emp.id),
                "employee_name": emp.name,
                "designation": emp.designation,
                "location_code": loc.code if loc else "UNK",
                "role_in_project": a.role_in_project,
                "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
            })

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    progress = 0.0
    if project.start_date and project.end_date:
        start = project.start_date.replace(tzinfo=None) if project.start_date.tzinfo else project.start_date
        end = project.end_date.replace(tzinfo=None) if project.end_date.tzinfo else project.end_date
        total = (end - start).total_seconds()
        elapsed = (now - start).total_seconds()
        if total > 0:
            progress = min(100.0, max(0.0, (elapsed / total) * 100))

    return {
        "id": str(project.id),
        "name": project.name,
        "project_type": project.project_type,
        "description": project.description,
        "status": project.status,
        "department_name": dept.name if dept else "Unknown",
        "start_date": project.start_date.isoformat() if project.start_date else None,
        "end_date": project.end_date.isoformat() if project.end_date else None,
        "progress_percent": round(progress, 1),
        "member_count": len(members),
        "members": members,
    }
