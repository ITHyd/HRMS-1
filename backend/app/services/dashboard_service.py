from collections import defaultdict
from datetime import datetime, timezone

from bson import ObjectId

from app.models.department import Department
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.project import Project
from app.models.project_allocation import ProjectAllocation
from app.models.timesheet_entry import TimesheetEntry
from app.models.utilisation_snapshot import UtilisationSnapshot
from app.models.reporting_relationship import ReportingRelationship
from app.models.reporting_relationship import ReportingRelationship


CORPORATE_LEVELS = {"c-suite", "vp"}


def _previous_periods(period: str, count: int) -> list[str]:
    """Return a list of `count` periods (YYYY-MM) ending at and including `period`."""
    year, month = int(period[:4]), int(period[5:7])
    periods = []
    for _ in range(count):
        periods.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month < 1:
            month = 12
            year -= 1
    periods.reverse()
    return periods


async def get_executive_dashboard(
    period: str,
    branch_location_id: str,
    client_name: str | None = None,
) -> dict:
    """
    Executive-level dashboard aggregated from UtilisationSnapshot.

    Returns headline KPIs, classification breakdown, top projects, resource
    availability, and a 6-period trend.
    """
    # Current period snapshots (exclude corporate-level employees)
    snapshots = await UtilisationSnapshot.find(
        UtilisationSnapshot.branch_location_id == branch_location_id,
        UtilisationSnapshot.period == period,
        {"employee_level": {"$nin": list(CORPORATE_LEVELS)}},
    ).to_list()

    # If filtering by client, narrow snapshots to employees who worked on that client's projects
    client_proj_ids: set[str] | None = None
    if client_name:
        client_projects = await Project.find(
            {"client_name": {"$regex": client_name, "$options": "i"}, "is_deleted": {"$ne": True}}
        ).to_list()
        client_proj_ids = {str(p.id) for p in client_projects}
        if client_proj_ids:
            client_ts = await TimesheetEntry.find(
                TimesheetEntry.branch_location_id == branch_location_id,
                TimesheetEntry.period == period,
                TimesheetEntry.status != "rejected",
                {"project_id": {"$in": list(client_proj_ids)}},
            ).to_list()
            client_emp_ids = {e.employee_id for e in client_ts}
            snapshots = [s for s in snapshots if s.employee_id in client_emp_ids]
        else:
            snapshots = []

    total_active = len(snapshots)
    billable_count = 0
    non_billable_count = 0
    bench_count = 0
    total_util = 0.0
    total_billable_pct = 0.0

    for s in snapshots:
        if s.classification == "fully_billed":
            billable_count += 1
        elif s.classification == "partially_billed":
            non_billable_count += 1
        else:
            bench_count += 1
        total_util += s.utilisation_percent
        total_billable_pct += s.billable_percent

    overall_util = round(total_util / total_active, 2) if total_active > 0 else 0.0
    overall_billable = round(total_billable_pct / total_active, 2) if total_active > 0 else 0.0

    # Top consuming projects: aggregate TimesheetEntry by project for the period
    # Only include timesheet entries from branch-level employees (not corporate)
    branch_emp_ids = [s.employee_id for s in snapshots]
    entry_filters: list = [
        TimesheetEntry.branch_location_id == branch_location_id,
        TimesheetEntry.period == period,
        TimesheetEntry.status != "rejected",
        {"employee_id": {"$in": branch_emp_ids}},
    ]
    if client_proj_ids is not None:
        entry_filters.append({"project_id": {"$in": list(client_proj_ids)}})
    entries = await TimesheetEntry.find(*entry_filters).to_list()

    project_hours: dict[str, float] = defaultdict(float)
    project_members: dict[str, set] = defaultdict(set)
    for e in entries:
        project_hours[e.project_id] += e.hours
        project_members[e.project_id].add(e.employee_id)

    sorted_projects = sorted(project_hours.items(), key=lambda x: x[1], reverse=True)[:10]

    # Resolve project names
    proj_ids = [pid for pid, _ in sorted_projects]
    projects = (
        await Project.find(
            {"_id": {"$in": [ObjectId(pid) for pid in proj_ids if ObjectId.is_valid(pid)]}}
        ).to_list()
        if proj_ids
        else []
    )
    proj_map = {str(p.id): p.name for p in projects}

    top_consuming_projects = [
        {
            "project_id": pid,
            "project_name": proj_map.get(pid, "Unknown"),
            "total_hours": round(hours, 2),
            "member_count": len(project_members.get(pid, set())),
        }
        for pid, hours in sorted_projects
    ]

    # Resource availability – derived from utilisation percent
    over_allocated_count = sum(1 for s in snapshots if s.utilisation_percent > 100)
    fully_allocated_non_over = sum(
        1 for s in snapshots
        if s.classification == "fully_billed" and s.utilisation_percent <= 100
    )
    resource_availability = {
        "available": bench_count + non_billable_count,
        "fully_allocated": fully_allocated_non_over,
        "over_allocated": over_allocated_count,
    }

    # Classification breakdown
    classification_breakdown = []
    for cls_name, cls_count in [
        ("fully_billed", billable_count),
        ("partially_billed", non_billable_count),
        ("bench", bench_count),
    ]:
        pct = round(cls_count / total_active * 100, 2) if total_active > 0 else 0.0
        classification_breakdown.append({
            "classification": cls_name,
            "count": cls_count,
            "percent": pct,
        })

    # Trend: last 6 periods
    trend_periods = _previous_periods(period, 6)
    trend_filters: list = [
        UtilisationSnapshot.branch_location_id == branch_location_id,
        {"period": {"$in": trend_periods}},
        {"employee_level": {"$nin": list(CORPORATE_LEVELS)}},
    ]
    if branch_emp_ids:
        trend_filters.append({"employee_id": {"$in": branch_emp_ids}})
    elif client_name:
        # client filter active but no employees matched — return empty trend
        trend_filters.append({"employee_id": {"$in": []}})
    trend_snapshots = await UtilisationSnapshot.find(*trend_filters).to_list()

    period_groups: dict[str, list[UtilisationSnapshot]] = defaultdict(list)
    for s in trend_snapshots:
        period_groups[s.period].append(s)

    trend = []
    for tp in trend_periods:
        group = period_groups.get(tp, [])
        count = len(group)
        avg_util = round(sum(s.utilisation_percent for s in group) / count, 2) if count > 0 else 0.0
        avg_bill = round(sum(s.billable_percent for s in group) / count, 2) if count > 0 else 0.0
        trend.append({
            "period": tp,
            "headcount": count,
            "utilisation_percent": avg_util,
            "billable_percent": avg_bill,
        })

    return {
        "period": period,
        "total_active_employees": total_active,
        "billable_count": billable_count,
        "non_billable_count": non_billable_count,
        "bench_count": bench_count,
        "overall_utilisation_percent": overall_util,
        "overall_billable_percent": overall_billable,
        "top_consuming_projects": top_consuming_projects,
        "resource_availability": resource_availability,
        "classification_breakdown": classification_breakdown,
        "trend": trend,
    }


async def get_resource_dashboard(
    period: str,
    branch_location_id: str,
    search: str | None = None,
    classification: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """
    Per-employee resource dashboard.

    Joins snapshots with Employee for designation and department.
    Supports text search by name and filter by classification.
    Includes per-employee project hours from TimesheetEntry.
    """
    # Build query filters (exclude corporate-level employees)
    filters: list = [
        UtilisationSnapshot.branch_location_id == branch_location_id,
        UtilisationSnapshot.period == period,
        {"employee_level": {"$nin": list(CORPORATE_LEVELS)}},
    ]
    if classification:
        filters.append(UtilisationSnapshot.classification == classification)

    snapshots = await UtilisationSnapshot.find(*filters).to_list()

    # Resolve employee details for all snapshots (needed for search across fields)
    all_emp_ids = [s.employee_id for s in snapshots]
    employees = await Employee.find(
        {"_id": {"$in": [ObjectId(eid) for eid in all_emp_ids if ObjectId.is_valid(eid)]}}
    ).to_list()
    emp_map = {str(e.id): e for e in employees}

    # Resolve departments
    dept_ids = {e.department_id for e in employees}
    departments = (
        await Department.find(
            {"_id": {"$in": [ObjectId(did) for did in dept_ids if ObjectId.is_valid(did)]}}
        ).to_list()
        if dept_ids
        else []
    )
    dept_map = {str(d.id): d.name for d in departments}

    # Search across employee name, designation, and department
    if search:
        search_lower = search.lower()
        filtered = []
        for s in snapshots:
            emp = emp_map.get(s.employee_id)
            designation = (emp.designation if emp else "").lower()
            department = (dept_map.get(emp.department_id, "") if emp else "").lower()
            if (
                search_lower in s.employee_name.lower()
                or search_lower in designation
                or search_lower in department
            ):
                filtered.append(s)
        snapshots = filtered

    total = len(snapshots)

    # Paginate
    start = (page - 1) * page_size
    page_snapshots = snapshots[start : start + page_size]

    if not page_snapshots:
        return {"period": period, "entries": [], "total": total}

    # Build list of employee IDs for the current page
    emp_ids = [s.employee_id for s in page_snapshots]

    # Get timesheet entries for these employees to derive project hours
    ts_entries = await TimesheetEntry.find(
        TimesheetEntry.branch_location_id == branch_location_id,
        TimesheetEntry.period == period,
        TimesheetEntry.status != "rejected",
        {"employee_id": {"$in": emp_ids}},
    ).to_list()

    # Resolve project names
    ts_project_ids = {e.project_id for e in ts_entries}
    projects = (
        await Project.find(
            {"_id": {"$in": [ObjectId(pid) for pid in ts_project_ids if ObjectId.is_valid(pid)]}}
        ).to_list()
        if ts_project_ids
        else []
    )
    proj_name_map = {str(p.id): p.name for p in projects}

    # Group timesheet by employee -> project
    emp_proj_hours: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for e in ts_entries:
        emp_proj_hours[e.employee_id][e.project_id] += e.hours

    entries = []
    for s in page_snapshots:
        emp = emp_map.get(s.employee_id)
        designation = emp.designation if emp else "Unknown"
        department = dept_map.get(emp.department_id, "Unknown") if emp else "Unknown"

        proj_hours = emp_proj_hours.get(s.employee_id, {})
        project_list = [
            {
                "project_id": pid,
                "project_name": proj_name_map.get(pid, "Unknown"),
                "hours": round(hrs, 2),
            }
            for pid, hrs in proj_hours.items()
        ]

        if s.classification == "bench":
            availability = "available"
        elif s.classification == "partially_billed":
            availability = "partially_allocated"
        else:
            availability = "fully_allocated"

        entries.append({
            "employee_id": s.employee_id,
            "employee_name": s.employee_name,
            "designation": designation,
            "department": department,
            "projects": project_list,
            "total_hours": s.total_hours_logged,
            "billable_hours": s.billable_hours,
            "utilisation_percent": s.utilisation_percent,
            "billable_percent": s.billable_percent,
            "classification": s.classification,
            "availability": availability,
        })

    return {"period": period, "entries": entries, "total": total}


async def get_project_dashboard(
    period: str,
    branch_location_id: str,
    project_id: str | None = None,
    client_name: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """
    Per-project dashboard.

    Aggregates timesheet hours by project, lists members and billable
    breakdown, computes health status and identifies over-utilised members.
    """
    # First get branch-level employee IDs (exclude corporate)
    branch_employees = await Employee.find(
        Employee.location_id == branch_location_id,
        Employee.is_active == True,
        {"level": {"$nin": list(CORPORATE_LEVELS)}},
    ).to_list()
    branch_emp_ids = [str(e.id) for e in branch_employees]

    # Fetch timesheet entries for the period (only branch-level employees)
    ts_filters: list = [
        TimesheetEntry.branch_location_id == branch_location_id,
        TimesheetEntry.period == period,
        TimesheetEntry.status != "rejected",
        {"employee_id": {"$in": branch_emp_ids}},
    ]
    if project_id:
        ts_filters.append(TimesheetEntry.project_id == project_id)
    if client_name:
        client_projects = await Project.find(
            {"client_name": {"$regex": client_name, "$options": "i"}, "is_deleted": {"$ne": True}}
        ).to_list()
        client_proj_ids = [str(p.id) for p in client_projects]
        ts_filters.append({"project_id": {"$in": client_proj_ids}})

    entries = await TimesheetEntry.find(*ts_filters).to_list()

    # Group by project
    project_data: dict[str, dict] = defaultdict(
        lambda: {"total_hours": 0.0, "billable_hours": 0.0, "members": defaultdict(lambda: {"hours": 0.0, "billable": 0.0})}
    )
    for e in entries:
        pd = project_data[e.project_id]
        pd["total_hours"] += e.hours
        if e.is_billable:
            pd["billable_hours"] += e.hours
        pd["members"][e.employee_id]["hours"] += e.hours
        if e.is_billable:
            pd["members"][e.employee_id]["billable"] += e.hours

    # Pagination over projects
    project_ids = list(project_data.keys())
    total = len(project_ids)
    start = (page - 1) * page_size
    page_project_ids = project_ids[start : start + page_size]

    if not page_project_ids:
        return {"period": period, "projects": [], "total": total}

    # Resolve project details
    projects = await Project.find(
        {"_id": {"$in": [ObjectId(pid) for pid in page_project_ids if ObjectId.is_valid(pid)]}}
    ).to_list()
    proj_map = {str(p.id): p for p in projects}

    # Resolve all member employee ids across page projects
    all_member_ids: set[str] = set()
    for pid in page_project_ids:
        all_member_ids.update(project_data[pid]["members"].keys())

    employees = (
        await Employee.find(
            {"_id": {"$in": [ObjectId(eid) for eid in all_member_ids if ObjectId.is_valid(eid)]}}
        ).to_list()
        if all_member_ids
        else []
    )
    emp_map = {str(e.id): e for e in employees}

    # Get utilisation snapshots for these members to check over-utilisation
    snapshots = (
        await UtilisationSnapshot.find(
            UtilisationSnapshot.period == period,
            UtilisationSnapshot.branch_location_id == branch_location_id,
            {"employee_id": {"$in": list(all_member_ids)}},
            {"employee_level": {"$nin": list(CORPORATE_LEVELS)}},
        ).to_list()
        if all_member_ids
        else []
    )
    util_map = {s.employee_id: s.utilisation_percent for s in snapshots}

    # Get employee-project assignments for member role information
    emp_proj_assignments = (
        await EmployeeProject.find(
            {"employee_id": {"$in": list(all_member_ids)}}
        ).to_list()
        if all_member_ids
        else []
    )
    role_map: dict[tuple[str, str], str] = {}
    for ep in emp_proj_assignments:
        role_map[(ep.employee_id, ep.project_id)] = ep.role_in_project

    result_projects = []
    for pid in page_project_ids:
        proj = proj_map.get(pid)
        proj_name = proj.name if proj else "Unknown"
        proj_status = proj.status if proj else "UNKNOWN"
        proj_dept = (proj.client_name or "General") if proj else "Unknown"

        pd = project_data[pid]
        total_hours = pd["total_hours"]
        billable_hours = pd["billable_hours"]
        billable_pct = round(billable_hours / total_hours * 100, 2) if total_hours > 0 else 0.0

        members_data = pd["members"]
        member_count = len(members_data)

        members_list = []
        over_utilised_members = []

        for eid, mdata in members_data.items():
            emp = emp_map.get(eid)
            emp_name = emp.name if emp else "Unknown"
            role = role_map.get((eid, pid), "contributor")

            members_list.append({
                "employee_id": eid,
                "employee_name": emp_name,
                "role": role,
                "hours": round(mdata["hours"], 2),
                "billable_hours": round(mdata["billable"], 2),
            })

            emp_util = util_map.get(eid, 0.0)
            if emp_util > 100:
                over_utilised_members.append(eid)

        # Health: compare actual billable % against expected
        # "healthy" if variance < 10%, "warning" if < 25%, "critical" otherwise
        variance = abs(100 - billable_pct)
        if variance < 10:
            health = "healthy"
        elif variance < 25:
            health = "warning"
        else:
            health = "critical"

        # Project type, dates, and progress
        proj_type = proj.project_type if proj else "client"
        proj_start = proj.start_date.isoformat() if proj and proj.start_date else None
        proj_end = proj.end_date.isoformat() if proj and proj.end_date else None

        progress_percent = 0.0
        if proj and proj.start_date and proj.end_date:
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            start = proj.start_date.replace(tzinfo=None) if proj.start_date.tzinfo else proj.start_date
            end = proj.end_date.replace(tzinfo=None) if proj.end_date.tzinfo else proj.end_date
            total_dur = (end - start).total_seconds()
            elapsed = (now - start).total_seconds()
            if total_dur > 0:
                progress_percent = min(100.0, max(0.0, (elapsed / total_dur) * 100))

        result_projects.append({
            "project_id": pid,
            "project_name": proj_name,
            "status": proj_status,
            "project_type": proj_type,
            "department": proj_dept,
            "start_date": proj_start,
            "end_date": proj_end,
            "progress_percent": round(progress_percent, 1),
            "total_hours_consumed": round(total_hours, 2),
            "billable_hours": round(billable_hours, 2),
            "billable_percent": billable_pct,
            "member_count": member_count,
            "members": members_list,
            "health": health,
            "over_utilised_members": over_utilised_members,
            "resource_variance": round(variance, 2),
        })

    return {"period": period, "projects": result_projects, "total": total}


async def get_allocation_dashboard(
    period: str,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """HRMS project allocation data for a given period."""
    allocations = await ProjectAllocation.find(
        ProjectAllocation.period == period,
        ProjectAllocation.is_deleted != True,
    ).to_list()

    if search:
        search_lower = search.lower()
        allocations = [
            a for a in allocations
            if search_lower in a.employee_name.lower()
            or search_lower in a.project_name.lower()
            or (a.client_name and search_lower in a.client_name.lower())
        ]

    total = len(allocations)
    start = (page - 1) * page_size
    page_allocations = allocations[start : start + page_size]

    entries = [
        {
            "employee_id": a.employee_id,
            "employee_name": a.employee_name,
            "project_id": a.project_id,
            "project_name": a.project_name,
            "client_name": a.client_name,
            "allocation_percentage": a.allocation_percentage,
            "allocated_days": a.allocated_days,
            "total_working_days": a.total_working_days,
            "total_allocated_days": a.total_allocated_days,
            "available_days": a.available_days,
        }
        for a in page_allocations
    ]

    return {"period": period, "allocations": entries, "total": total}


async def get_resource_allocation_dashboard(
    period: str,
    branch_location_id: str,
    search: str | None = None,
    classification: str | None = None,
    client_name: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """
    Combined resource + allocation view.

    One row per employee-project allocation.  Bench employees (no allocations)
    get a single row with project/client = None.

    Columns: Name, Project, Client, Allocation %, Billable Hrs,
             Non-Billable Hrs, Classification, Availability (days).
    """
    # 1. Utilisation snapshots → classification + hours per employee
    snap_filters: list = [
        UtilisationSnapshot.branch_location_id == branch_location_id,
        UtilisationSnapshot.period == period,
        {"employee_level": {"$nin": list(CORPORATE_LEVELS)}},
    ]
    if classification:
        snap_filters.append(UtilisationSnapshot.classification == classification)

    snapshots = await UtilisationSnapshot.find(*snap_filters).to_list()
    snap_map = {s.employee_id: s for s in snapshots}
    branch_emp_ids = [s.employee_id for s in snapshots]

    if not branch_emp_ids:
        return {"period": period, "entries": [], "total": 0}

    # 2. Allocations for those employees
    allocations = await ProjectAllocation.find(
        ProjectAllocation.period == period,
        {"employee_id": {"$in": branch_emp_ids}},
        ProjectAllocation.is_deleted != True,
    ).to_list()

    # 3. Timesheet hours per employee-project → billable vs non-billable
    ts_entries = await TimesheetEntry.find(
        TimesheetEntry.period == period,
        TimesheetEntry.status != "rejected",
        {"employee_id": {"$in": branch_emp_ids}},
    ).to_list()

    # employee_id → project_id → {billable, non_billable}
    emp_proj_hours: dict[str, dict[str, dict[str, float]]] = defaultdict(
        lambda: defaultdict(lambda: {"billable": 0.0, "non_billable": 0.0})
    )
    for t in ts_entries:
        bucket = "billable" if t.is_billable else "non_billable"
        emp_proj_hours[t.employee_id][t.project_id][bucket] += t.hours

    # Also build employee-level totals for bench rows
    emp_total_hours: dict[str, dict[str, float]] = defaultdict(
        lambda: {"billable": 0.0, "non_billable": 0.0}
    )
    for t in ts_entries:
        bucket = "billable" if t.is_billable else "non_billable"
        emp_total_hours[t.employee_id][bucket] += t.hours

    # 4. Resolve project client_name for allocations that don't have it
    proj_ids = {a.project_id for a in allocations}
    projects = (
        await Project.find(
            {"_id": {"$in": [ObjectId(pid) for pid in proj_ids if ObjectId.is_valid(pid)]}}
        ).to_list()
        if proj_ids
        else []
    )
    proj_client_map = {str(p.id): p.client_name or "General" for p in projects}

    # 5. Get line manager information for all employees
    reporting_relationships = await ReportingRelationship.find(
        {"employee_id": {"$in": branch_emp_ids}},
        ReportingRelationship.type == "PRIMARY",
        ReportingRelationship.is_deleted != True,
    ).to_list()
    
    # Get manager employee details
    manager_ids = [r.manager_id for r in reporting_relationships]
    managers = (
        await Employee.find(
            {"_id": {"$in": [ObjectId(mid) for mid in manager_ids if ObjectId.is_valid(mid)]}}
        ).to_list()
        if manager_ids
        else []
    )
    manager_map = {str(m.id): m.name for m in managers}
    
    # Create employee to line manager mapping
    emp_manager_map = {}
    for rel in reporting_relationships:
        emp_manager_map[rel.employee_id] = manager_map.get(rel.manager_id, "No Manager")

    # 6. Build rows
    rows: list[dict] = []
    employees_with_alloc: set[str] = set()

    for a in allocations:
        snap = snap_map.get(a.employee_id)
        if not snap:
            continue  # not in branch or filtered out by classification
        employees_with_alloc.add(a.employee_id)

        hours = emp_proj_hours.get(a.employee_id, {}).get(a.project_id, {"billable": 0.0, "non_billable": 0.0})
        client = a.client_name or proj_client_map.get(a.project_id, "General")

        rows.append({
            "employee_id": a.employee_id,
            "employee_name": a.employee_name or snap.employee_name,
            "line_manager": emp_manager_map.get(a.employee_id, "No Manager"),
            "project_name": a.project_name,
            "client_name": client,
            "allocation_percentage": a.allocation_percentage,
            "billable_hours": round(hours["billable"], 1),
            "non_billable_hours": round(hours["non_billable"], 1),
            "classification": snap.classification,
            "available_days": a.available_days,
        })

    # Bench / unallocated employees
    for snap in snapshots:
        if snap.employee_id in employees_with_alloc:
            continue
        totals = emp_total_hours.get(snap.employee_id, {"billable": 0.0, "non_billable": 0.0})
        # available_days = total working days (default 22) since no allocation
        rows.append({
            "employee_id": snap.employee_id,
            "employee_name": snap.employee_name,
            "line_manager": emp_manager_map.get(snap.employee_id, "No Manager"),
            "project_name": None,
            "client_name": None,
            "allocation_percentage": 0.0,
            "billable_hours": round(totals["billable"], 1),
            "non_billable_hours": round(totals["non_billable"], 1),
            "classification": snap.classification,
            "available_days": 22.0,
        })

    # 6. Filters
    if search:
        sl = search.lower()
        rows = [
            r for r in rows
            if sl in r["employee_name"].lower()
            or (r["project_name"] and sl in r["project_name"].lower())
            or (r["client_name"] and sl in r["client_name"].lower())
        ]
    if client_name:
        cl = client_name.lower()
        rows = [r for r in rows if r["client_name"] and cl in r["client_name"].lower()]

    total = len(rows)
    start = (page - 1) * page_size
    page_rows = rows[start : start + page_size]

    return {"period": period, "entries": page_rows, "total": total}
