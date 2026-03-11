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

    # Department breakdown (from both employees and projects)
    dept_counts = defaultdict(int)
    
    # Count employees by department
    for emp in employees:
        dept = dept_map.get(emp.department_id)
        dept_name = dept.name if dept else "Unknown"
        dept_counts[dept_name] += 1
    
    # Get all projects to include their departments in the breakdown
    all_projects = await Project.find_all().to_list()
    
    # Add all project departments to the breakdown (with 0 employees if not already counted)
    for proj in all_projects:
        dept = dept_map.get(proj.department_id)
        if dept:
            dept_name = dept.name
            # Only add if not already counted (this ensures we don't overwrite employee counts)
            if dept_name not in dept_counts:
                dept_counts[dept_name] = 0
    
    department_breakdown = [
        {"department": k, "count": v} for k, v in sorted(dept_counts.items())
    ]

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

    # Projects - show all projects, not just those with employees from this branch
    emp_projs = await EmployeeProject.find(
        {"employee_id": {"$in": list(emp_ids)}}
    ).to_list()
    
    all_projects = await Project.find_all().to_list()
    proj_map = {str(p.id): p for p in all_projects}

    proj_member_count = defaultdict(int)
    for ep in emp_projs:
        proj_member_count[ep.project_id] += 1

    project_summaries = []
    for pid, proj in proj_map.items():
        dept = dept_map.get(proj.department_id)
        project_summaries.append({
            "id": pid,
            "name": proj.name,
            "status": proj.status,
            "member_count": proj_member_count.get(pid, 0),
            "department": dept.name if dept else "Unknown",
        })

    # Orphaned projects (projects with no employees assigned from any branch)
    all_emp_projs = await EmployeeProject.find_all().to_list()
    assigned_project_ids = {ep.project_id for ep in all_emp_projs}
    orphaned = []
    for proj in all_projects:
        if str(proj.id) not in assigned_project_ids:
            dept = dept_map.get(proj.department_id)
            orphaned.append({
                "id": str(proj.id),
                "name": proj.name,
                "status": proj.status,
                "member_count": 0,
                "department": dept.name if dept else "Unknown",
            })

    return {
        "total_headcount": total_headcount,
        "active_count": total_headcount,
        "department_breakdown": department_breakdown,
        "level_breakdown": level_breakdown,
        "monthly_trend": monthly_trend,
        "span_of_control": span_data,
        "hierarchy_depth": max_depth,
        "departments_without_manager": depts_without_mgr,
        "cross_reports": cross_reports,
        "projects": project_summaries,
        "orphaned_projects": orphaned,
    }
