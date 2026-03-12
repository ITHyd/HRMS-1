from collections import defaultdict
from datetime import datetime, timezone

from bson import ObjectId

from app.models.department import Department
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.location import Location
from app.models.project import Project
from app.models.reporting_relationship import ReportingRelationship


async def get_branch_analytics(location_id: str):
    employees = await Employee.find(
        Employee.location_id == location_id,
        Employee.is_active == True,
    ).to_list()

    all_employees = await Employee.find(Employee.is_active == True).to_list()
    departments = await Department.find_all().to_list()
    dept_map = {str(d.id): d for d in departments}
    locations = await Location.find_all().to_list()
    loc_map = {str(l.id): l for l in locations}

    total_headcount = len(employees)
    emp_ids = {str(e.id) for e in employees}

    # Client breakdown — count employees per client (via project assignments)
    emp_projs_for_clients = await EmployeeProject.find(
        {"employee_id": {"$in": list(emp_ids)}}
    ).to_list()
    all_projects_list = await Project.find_all().to_list()
    proj_client_map = {str(p.id): p.client_name or "General" for p in all_projects_list}

    client_counts: dict[str, set[str]] = defaultdict(set)
    for ep in emp_projs_for_clients:
        client = proj_client_map.get(ep.project_id, "General")
        client_counts[client].add(ep.employee_id)

    client_breakdown = sorted(
        [{"client": k, "count": len(v)} for k, v in client_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )

    # Level breakdown
    level_order = ["intern", "junior", "mid", "senior", "lead", "manager", "head", "director", "vp", "c-suite"]
    level_counts = defaultdict(int)
    for emp in employees:
        level_counts[emp.level] += 1
    level_breakdown = [
        {"level": lvl, "count": level_counts.get(lvl, 0)} for lvl in level_order if level_counts.get(lvl, 0) > 0
    ]

    # Monthly trend (last 12 months)
    now = datetime.now(timezone.utc)
    monthly = defaultdict(int)
    for emp in employees:
        if emp.join_date:
            key = emp.join_date.strftime("%Y-%m")
            monthly[key] += 1

    sorted_months = sorted(monthly.keys())
    cumulative = 0
    monthly_trend = []
    for month in sorted_months:
        cumulative += monthly[month]
        monthly_trend.append({
            "month": month,
            "new_hires": monthly[month],
            "cumulative": cumulative,
        })

    # Span of control
    primary_rels = await ReportingRelationship.find(
        ReportingRelationship.type == "PRIMARY"
    ).to_list()

    manager_reports = defaultdict(list)
    parent_of = {}
    for rel in primary_rels:
        if rel.employee_id in emp_ids:
            manager_reports[rel.manager_id].append(rel.employee_id)
        parent_of[rel.employee_id] = rel.manager_id

    all_emp_map = {str(e.id): e for e in all_employees}
    span_data = []
    for mgr_id, reports in manager_reports.items():
        if mgr_id in emp_ids:
            mgr = all_emp_map.get(mgr_id)
            if mgr:
                count = len(reports)
                span_data.append({
                    "manager_id": mgr_id,
                    "manager_name": mgr.name,
                    "designation": mgr.designation,
                    "direct_report_count": count,
                    "is_outlier": count < 2 or count > 10,
                })

    # Hierarchy depth
    def get_depth(emp_id, visited=None):
        if visited is None:
            visited = set()
        if emp_id in visited:
            return 0
        visited.add(emp_id)
        parent = parent_of.get(emp_id)
        if not parent or parent not in emp_ids:
            return 0
        return 1 + get_depth(parent, visited)

    max_depth = 0
    for eid in emp_ids:
        d = get_depth(eid)
        if d > max_depth:
            max_depth = d

    # Departments without manager
    dept_has_manager = set()
    for emp in employees:
        if emp.level in ("manager", "head", "director", "vp", "c-suite"):
            dept_has_manager.add(emp.department_id)
    branch_depts = {emp.department_id for emp in employees}
    depts_without_mgr = [
        dept_map[did].name
        for did in branch_depts - dept_has_manager
        if did in dept_map
    ]

    # Cross-reporting
    all_rels = await ReportingRelationship.find(
        ReportingRelationship.type != "PRIMARY"
    ).to_list()

    cross_reports = []
    for rel in all_rels:
        if rel.employee_id in emp_ids:
            mgr = all_emp_map.get(rel.manager_id)
            emp = all_emp_map.get(rel.employee_id)
            if mgr and emp and mgr.location_id != location_id:
                mgr_loc = loc_map.get(mgr.location_id)
                cross_reports.append({
                    "employee_id": rel.employee_id,
                    "employee_name": emp.name,
                    "employee_designation": emp.designation,
                    "external_manager_id": rel.manager_id,
                    "external_manager_name": mgr.name,
                    "external_manager_location": mgr_loc.city if mgr_loc else "Unknown",
                    "relationship_type": rel.type,
                })

    # Also check primary rels where manager is outside
    for rel in primary_rels:
        if rel.employee_id in emp_ids:
            mgr = all_emp_map.get(rel.manager_id)
            emp = all_emp_map.get(rel.employee_id)
            if mgr and emp and mgr.location_id != location_id:
                mgr_loc = loc_map.get(mgr.location_id)
                cross_reports.append({
                    "employee_id": rel.employee_id,
                    "employee_name": emp.name,
                    "employee_designation": emp.designation,
                    "external_manager_id": rel.manager_id,
                    "external_manager_name": mgr.name,
                    "external_manager_location": mgr_loc.city if mgr_loc else "Unknown",
                    "relationship_type": "PRIMARY",
                })

    # Projects - reuse earlier queries
    emp_projs = emp_projs_for_clients
    proj_map = {str(p.id): p for p in all_projects_list}

    proj_member_count = defaultdict(int)
    for ep in emp_projs:
        proj_member_count[ep.project_id] += 1

    project_summaries = []
    for pid, proj in proj_map.items():
        project_summaries.append({
            "id": pid,
            "name": proj.name,
            "status": proj.status,
            "member_count": proj_member_count.get(pid, 0),
            "client_name": proj.client_name or "General",
        })

    # Orphaned projects (projects with no employees assigned from any branch)
    all_emp_projs = await EmployeeProject.find_all().to_list()
    assigned_project_ids = {ep.project_id for ep in all_emp_projs}
    orphaned = []
    for proj in all_projects:
        if str(proj.id) not in assigned_project_ids:
            orphaned.append({
                "id": str(proj.id),
                "name": proj.name,
                "status": proj.status,
                "member_count": 0,
                "client_name": proj.client_name or "General",
            })

    return {
        "total_headcount": total_headcount,
        "active_count": total_headcount,
        "client_breakdown": client_breakdown,
        "level_breakdown": level_breakdown,
        "monthly_trend": monthly_trend,
        "span_of_control": span_data,
        "hierarchy_depth": max_depth,
        "departments_without_manager": depts_without_mgr,
        "cross_reports": cross_reports,
        "projects": project_summaries,
        "orphaned_projects": orphaned,
    }
