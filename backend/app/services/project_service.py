from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from app.models.department import Department
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.location import Location
from app.models.project import Project
from app.models.project_allocation import ProjectAllocation
from app.models.timesheet_entry import TimesheetEntry
from app.services.audit_service import log_change


async def list_projects(
    branch_location_id: str,
    search: Optional[str] = None,
    project_type: Optional[str] = None,
    status: Optional[str] = None,
    client_name: Optional[str] = None,
    period: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """List projects scoped to branch via employee assignments (paginated)."""
    branch_emps = await Employee.find(
        Employee.location_id == branch_location_id,
        Employee.is_deleted != True,
    ).to_list()
    branch_emp_ids = [str(e.id) for e in branch_emps]

    assignments = await EmployeeProject.find(
        {"employee_id": {"$in": branch_emp_ids}},
        EmployeeProject.is_deleted != True,
    ).to_list()
    proj_ids = list({a.project_id for a in assignments})

    if not proj_ids:
        return {"projects": [], "total": 0, "active_count": 0, "completed_count": 0, "on_hold_count": 0}

    filters = {"_id": {"$in": [ObjectId(pid) for pid in proj_ids if ObjectId.is_valid(pid)]}}
    if status:
        filters["status"] = status
    if project_type:
        filters["project_type"] = project_type
    filters["is_deleted"] = {"$ne": True}

    projects = await Project.find(filters).to_list()

    if search:
        search_lower = search.lower()
        projects = [p for p in projects if search_lower in p.name.lower()]

    if client_name:
        client_lower = client_name.lower()
        projects = [p for p in projects if p.client_name and client_lower in p.client_name.lower()]

    # Count members per project
    member_counts = {}
    for a in assignments:
        if a.project_id not in member_counts:
            member_counts[a.project_id] = 0
        member_counts[a.project_id] += 1

    # Compute planned_days, worked_days, and allocated member counts from allocation + timesheet data
    planned_by_project: dict[str, float] = {}
    worked_by_project: dict[str, float] = {}
    allocated_members_by_project: dict[str, int] = {}
    if period:
        allocs = await ProjectAllocation.find(
            ProjectAllocation.period == period,
            ProjectAllocation.is_deleted != True,
        ).to_list()
        for a in allocs:
            planned_by_project[a.project_id] = (
                planned_by_project.get(a.project_id, 0.0) + a.allocated_days
            )
            allocated_members_by_project[a.project_id] = (
                allocated_members_by_project.get(a.project_id, 0) + 1
            )

        timesheets = await TimesheetEntry.find(
            TimesheetEntry.period == period,
            TimesheetEntry.status != "rejected",
            TimesheetEntry.is_deleted != True,
        ).to_list()
        for t in timesheets:
            worked_by_project[t.project_id] = (
                worked_by_project.get(t.project_id, 0.0) + t.hours
            )
        # Convert hours to days (8 hours = 1 day)
        worked_by_project = {k: round(v / 8, 1) for k, v in worked_by_project.items()}

    # Status counts
    active_count = sum(1 for p in projects if p.status == "ACTIVE")
    completed_count = sum(1 for p in projects if p.status == "COMPLETED")
    on_hold_count = sum(1 for p in projects if p.status == "ON_HOLD")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    result = []
    for p in projects:
        pid = str(p.id)
        planned_days = planned_by_project.get(pid, 0.0)
        worked_days = worked_by_project.get(pid, 0.0)

        if period and planned_days > 0:
            progress = min(100.0, (worked_days / planned_days) * 100)
        elif p.start_date and p.end_date:
            start = p.start_date.replace(tzinfo=None) if p.start_date.tzinfo else p.start_date
            end = p.end_date.replace(tzinfo=None) if p.end_date.tzinfo else p.end_date
            total = (end - start).total_seconds()
            elapsed = (now - start).total_seconds()
            progress = min(100.0, max(0.0, (elapsed / total) * 100)) if total > 0 else 0.0
        else:
            progress = 0.0

        result.append({
            "id": pid,
            "name": p.name,
            "project_type": p.project_type,
            "client_name": p.client_name or "General",
            "description": p.description,
            "status": p.status,
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "end_date": p.end_date.isoformat() if p.end_date else None,
            "member_count": member_counts.get(pid, 0),
            "planned_days": round(planned_days, 1),
            "worked_days": round(worked_days, 1),
            "progress_percent": round(progress, 1),
        })

    total = len(result)
    skip = (page - 1) * page_size
    paginated = result[skip : skip + page_size]

    return {
        "projects": paginated,
        "total": total,
        "active_count": active_count,
        "completed_count": completed_count,
        "on_hold_count": on_hold_count,
    }


async def get_project_timeline(branch_location_id: str) -> dict:
    """Return active/on-hold projects with end-dates, freeing-up employees, and client opportunities."""
    now = datetime.now(timezone.utc)

    branch_emps = await Employee.find(
        Employee.location_id == branch_location_id,
        Employee.is_deleted != True,
    ).to_list()
    branch_emp_ids = [str(e.id) for e in branch_emps]
    emp_map = {str(e.id): e for e in branch_emps}

    assignments = await EmployeeProject.find(
        {"employee_id": {"$in": branch_emp_ids}},
        EmployeeProject.is_deleted != True,
    ).to_list()
    proj_ids = list({a.project_id for a in assignments})

    if not proj_ids:
        return {"projects": [], "freeing_up_by_month": {}, "client_opportunities": []}

    projects = await Project.find(
        {
            "_id": {"$in": [ObjectId(pid) for pid in proj_ids if ObjectId.is_valid(pid)]},
            "status": {"$in": ["ACTIVE", "ON_HOLD"]},
            "is_deleted": {"$ne": True},
        }
    ).to_list()

    proj_assignments: dict[str, list] = {}
    for a in assignments:
        proj_assignments.setdefault(a.project_id, []).append(a)

    result_projects = []
    freeing_up_by_month: dict[str, dict] = {}

    for proj in projects:
        proj_id = str(proj.id)
        members = []
        for a in proj_assignments.get(proj_id, []):
            emp = emp_map.get(a.employee_id)
            if emp:
                members.append({
                    "employee_id": a.employee_id,
                    "employee_name": emp.name,
                    "designation": emp.designation or "",
                    "role_in_project": a.role_in_project,
                })

        days_until_end = None
        urgency = "no_date"
        if proj.end_date:
            end_aware = proj.end_date.replace(tzinfo=timezone.utc) if proj.end_date.tzinfo is None else proj.end_date
            days_until_end = (end_aware - now).days
            if days_until_end < 0:
                urgency = "overdue"
            elif days_until_end <= 30:
                urgency = "critical"
            elif days_until_end <= 60:
                urgency = "warning"
            elif days_until_end <= 90:
                urgency = "upcoming"
            else:
                urgency = "future"

            # Collect freeing-up data for projects ending within 90 days (including overdue)
            if days_until_end <= 90:
                month_key = end_aware.strftime("%Y-%m")
                for m in members:
                    emp_id = m["employee_id"]
                    if month_key not in freeing_up_by_month:
                        freeing_up_by_month[month_key] = {}
                    if emp_id not in freeing_up_by_month[month_key]:
                        freeing_up_by_month[month_key][emp_id] = {**m, "projects_ending": []}
                    freeing_up_by_month[month_key][emp_id]["projects_ending"].append(proj.name)

        result_projects.append({
            "project_id": proj_id,
            "name": proj.name,
            "status": proj.status,
            "project_type": proj.project_type,
            "client_name": proj.client_name or "General",
            "start_date": proj.start_date.isoformat() if proj.start_date else None,
            "end_date": proj.end_date.isoformat() if proj.end_date else None,
            "days_until_end": days_until_end,
            "urgency": urgency,
            "member_count": len(members),
            "members": members,
        })

    result_projects.sort(key=lambda p: (p["end_date"] or "9999-99-99"))

    freeing_sorted = {
        month: list(emp_dict.values())
        for month, emp_dict in sorted(freeing_up_by_month.items())
    }

    # Client renewal opportunities: clients with projects ending within 90 days
    client_opp: dict[str, dict] = {}
    for p in result_projects:
        if p["client_name"] and p["urgency"] in ("overdue", "critical", "warning", "upcoming"):
            cn = p["client_name"]
            if cn not in client_opp:
                client_opp[cn] = {
                    "client_name": cn,
                    "projects": [],
                    "earliest_end_date": None,
                    "total_freeing_employees": 0,
                }
            client_opp[cn]["projects"].append({
                "project_id": p["project_id"],
                "name": p["name"],
                "end_date": p["end_date"],
                "urgency": p["urgency"],
                "member_count": p["member_count"],
            })
            client_opp[cn]["total_freeing_employees"] += p["member_count"]
            if not client_opp[cn]["earliest_end_date"] or (
                p["end_date"] and p["end_date"] < client_opp[cn]["earliest_end_date"]
            ):
                client_opp[cn]["earliest_end_date"] = p["end_date"]

    return {
        "projects": result_projects,
        "freeing_up_by_month": freeing_sorted,
        "client_opportunities": sorted(
            client_opp.values(), key=lambda c: c["earliest_end_date"] or "9999-99-99"
        ),
    }


async def create_project(
    name: str,
    project_type: str,
    department_id: str,
    start_date: datetime,
    end_date: Optional[datetime],
    description: Optional[str],
    client_name: Optional[str],
    user_id: str,
    branch_location_id: str,
):
    """Create a new project."""
    project = Project(
        name=name,
        status="ACTIVE",
        project_type=project_type,
        client_name=client_name,
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
    if not project or project.is_deleted:
        raise ValueError(f"Project {project_id} not found")

    now = datetime.now(timezone.utc)
    assigned_count = 0

    for emp_id in employee_ids:
        existing = await EmployeeProject.find_one(
            EmployeeProject.employee_id == emp_id,
            EmployeeProject.project_id == project_id,
            EmployeeProject.is_deleted != True,
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


async def get_project_detail(project_id: str, period: Optional[str] = None):
    """Get project detail with members and allocation-based progress."""
    project = await Project.get(project_id)
    if not project or project.is_deleted:
        return None

    assignments = await EmployeeProject.find(
        EmployeeProject.project_id == project_id,
        EmployeeProject.is_deleted != True,
    ).to_list()

    # Batch-fetch employees and lookups for members
    emp_ids = [a.employee_id for a in assignments]
    emps = await Employee.find(
        {"_id": {"$in": [ObjectId(eid) for eid in emp_ids if ObjectId.is_valid(eid)]}},
        Employee.is_deleted != True,
    ).to_list() if emp_ids else []
    emp_map = {str(e.id): e for e in emps}

    all_dept_ids = list({e.department_id for e in emps if e.department_id})
    all_loc_ids = list({e.location_id for e in emps if e.location_id})
    member_depts = await Department.find(
        {"_id": {"$in": [ObjectId(d) for d in all_dept_ids if ObjectId.is_valid(d)]}}
    ).to_list() if all_dept_ids else []
    member_locs = await Location.find(
        {"_id": {"$in": [ObjectId(l) for l in all_loc_ids if ObjectId.is_valid(l)]}}
    ).to_list() if all_loc_ids else []
    mdept_map = {str(d.id): d.name for d in member_depts}
    mloc_map = {str(l.id): l for l in member_locs}

    # Fetch per-member allocation and timesheet data for the period
    alloc_map: dict[str, ProjectAllocation] = {}
    worked_map: dict[str, float] = {}
    if period:
        proj_allocs = await ProjectAllocation.find(
            ProjectAllocation.project_id == project_id,
            ProjectAllocation.period == period,
            ProjectAllocation.is_deleted != True,
        ).to_list()
        for pa in proj_allocs:
            alloc_map[pa.employee_id] = pa

        proj_timesheets = await TimesheetEntry.find(
            TimesheetEntry.project_id == project_id,
            TimesheetEntry.period == period,
            TimesheetEntry.status != "rejected",
            TimesheetEntry.is_deleted != True,
        ).to_list()
        for t in proj_timesheets:
            worked_map[t.employee_id] = worked_map.get(t.employee_id, 0.0) + t.hours

    members = []
    for a in assignments:
        emp = emp_map.get(a.employee_id)
        if emp:
            eid = str(emp.id)
            alloc = alloc_map.get(eid)
            worked_hours = worked_map.get(eid, 0.0)
            loc = mloc_map.get(emp.location_id)
            members.append({
                "employee_id": eid,
                "employee_name": emp.name,
                "designation": emp.designation,
                "department": mdept_map.get(emp.department_id, "Unknown"),
                "location": f"{loc.city}, {loc.country}" if loc else "Unknown",
                "location_code": loc.code if loc else "UNK",
                "role_in_project": a.role_in_project,
                "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
                "allocation_percentage": alloc.allocation_percentage if alloc else None,
                "allocated_days": alloc.allocated_days if alloc else None,
                "worked_days": round(worked_hours / 8, 1) if worked_hours > 0 else None,
            })

    # Project-level progress from allocation + timesheet
    total_planned = sum(a.allocated_days for a in alloc_map.values()) if alloc_map else 0.0
    total_worked_hours = sum(worked_map.values()) if worked_map else 0.0
    total_worked = total_worked_hours / 8

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if period and total_planned > 0:
        progress = min(100.0, (total_worked / total_planned) * 100)
    elif project.start_date and project.end_date:
        start = project.start_date.replace(tzinfo=None) if project.start_date.tzinfo else project.start_date
        end = project.end_date.replace(tzinfo=None) if project.end_date.tzinfo else project.end_date
        total = (end - start).total_seconds()
        elapsed = (now - start).total_seconds()
        progress = min(100.0, max(0.0, (elapsed / total) * 100)) if total > 0 else 0.0
    else:
        progress = 0.0

    return {
        "id": str(project.id),
        "name": project.name,
        "project_type": project.project_type,
        "client_name": project.client_name or "General",
        "description": project.description,
        "status": project.status,
        "start_date": project.start_date.isoformat() if project.start_date else None,
        "end_date": project.end_date.isoformat() if project.end_date else None,
        "planned_days": round(total_planned, 1),
        "worked_days": round(total_worked, 1),
        "progress_percent": round(progress, 1),
        "member_count": len(members),
        "members": members,
    }


async def get_distinct_clients(branch_location_id: str) -> list[str]:
    """Return sorted list of distinct non-null client names for projects in this branch."""
    branch_emps = await Employee.find(
        Employee.location_id == branch_location_id,
        Employee.is_deleted != True,
    ).to_list()
    branch_emp_ids = [str(e.id) for e in branch_emps]

    assignments = await EmployeeProject.find(
        {"employee_id": {"$in": branch_emp_ids}},
        EmployeeProject.is_deleted != True,
    ).to_list()
    proj_ids = list({a.project_id for a in assignments})

    if not proj_ids:
        return []

    projects = await Project.find(
        {"_id": {"$in": [ObjectId(pid) for pid in proj_ids if ObjectId.is_valid(pid)]}},
        Project.is_deleted != True,
    ).to_list()

    clients = sorted({p.client_name for p in projects if p.client_name})
    return clients


async def get_employee_timeline(
    employee_id: str,
    from_period: str,
    to_period: str,
) -> dict:
    """
    Returns a month-by-month project timeline for an employee.
    Uses ProjectAllocation for allocated months, UtilisationSnapshot for bench periods.
    """
    from app.models.project_allocation import ProjectAllocation
    from app.models.utilisation_snapshot import UtilisationSnapshot
    from collections import defaultdict

    allocations = await ProjectAllocation.find(
        ProjectAllocation.employee_id == employee_id,
        ProjectAllocation.period >= from_period,
        ProjectAllocation.period <= to_period,
        ProjectAllocation.is_deleted != True,
    ).sort("+period").to_list()

    assignments = await EmployeeProject.find(
        EmployeeProject.employee_id == employee_id,
        EmployeeProject.is_deleted != True,
    ).to_list()
    role_map = {a.project_id: a.role_in_project for a in assignments}

    by_period: dict[str, list] = defaultdict(list)
    for a in allocations:
        by_period[a.period].append(a)

    timeline = []
    y, m = int(from_period[:4]), int(from_period[5:7])
    end_y, end_m = int(to_period[:4]), int(to_period[5:7])

    while (y, m) <= (end_y, end_m):
        period = f"{y:04d}-{m:02d}"
        period_allocs = by_period.get(period, [])

        if period_allocs:
            timeline.append({
                "period": period,
                "status": "allocated",
                "projects": [
                    {
                        "project_id": a.project_id,
                        "project_name": a.project_name,
                        "client_name": a.client_name,
                        "allocated_days": a.allocated_days,
                        "allocation_percentage": a.allocation_percentage,
                        "role": role_map.get(a.project_id, "contributor"),
                    }
                    for a in period_allocs
                ],
            })
        else:
            snap = await UtilisationSnapshot.find_one(
                UtilisationSnapshot.employee_id == employee_id,
                UtilisationSnapshot.period == period,
            )
            timeline.append({
                "period": period,
                "status": snap.classification if snap else "bench",
                "projects": [],
            })

        m += 1
        if m > 12:
            m = 1
            y += 1

    return {
        "employee_id": employee_id,
        "from_period": from_period,
        "to_period": to_period,
        "timeline": timeline,
    }
