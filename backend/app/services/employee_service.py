from datetime import datetime, timezone

from app.models.department import Department
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.employee_skill import EmployeeSkill
from app.models.location import Location
from app.models.project import Project
from app.models.reporting_relationship import ReportingRelationship
from app.models.timesheet_entry import TimesheetEntry
from app.models.utilisation_snapshot import UtilisationSnapshot


async def get_employee_detail(employee_id: str, requester_branch_location_id: str):
    emp = await Employee.get(employee_id)
    if not emp:
        return None

    loc = await Location.get(emp.location_id)
    dept = await Department.get(emp.department_id)
    is_own_branch = emp.location_id == requester_branch_location_id

    result = {
        "id": str(emp.id),
        "name": emp.name,
        "designation": emp.designation,
        "department": dept.name if dept else "Unknown",
        "department_id": emp.department_id,
        "level": emp.level,
        "location_id": emp.location_id,
        "location_code": loc.code if loc else "UNK",
        "location_city": loc.city if loc else "Unknown",
        "photo_url": emp.photo_url,
        "is_active": emp.is_active,
        "is_own_branch": is_own_branch,
        "managers": [],
        "reporting_chain": [],
        "direct_reports": [],
        "projects": [],
    }

    if is_own_branch:
        result["email"] = emp.email
        result["join_date"] = emp.join_date.isoformat() if emp.join_date else None
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if emp.join_date:
            join_date = emp.join_date.replace(tzinfo=None) if emp.join_date.tzinfo else emp.join_date
            delta = now - join_date
            result["tenure_months"] = int(delta.days / 30)

    # Get all managers (always visible)
    manager_rels = await ReportingRelationship.find(
        ReportingRelationship.employee_id == employee_id
    ).to_list()

    for rel in manager_rels:
        mgr = await Employee.get(rel.manager_id)
        if mgr:
            mgr_loc = await Location.get(mgr.location_id)
            result["managers"].append({
                "id": str(mgr.id),
                "name": mgr.name,
                "designation": mgr.designation,
                "location_code": mgr_loc.code if mgr_loc else "UNK",
                "relationship_type": rel.type,
            })

    # Get direct reports (always visible)
    report_rels = await ReportingRelationship.find(
        ReportingRelationship.manager_id == employee_id,
        ReportingRelationship.type == "PRIMARY",
    ).to_list()

    for rel in report_rels:
        report = await Employee.get(rel.employee_id)
        if report:
            r_loc = await Location.get(report.location_id)
            r_dept = await Department.get(report.department_id)
            result["direct_reports"].append({
                "id": str(report.id),
                "name": report.name,
                "designation": report.designation,
                "department": r_dept.name if r_dept else "Unknown",
                "department_id": report.department_id,
                "level": report.level,
                "location_id": report.location_id,
                "location_code": r_loc.code if r_loc else "UNK",
                "location_city": r_loc.city if r_loc else "Unknown",
                "photo_url": report.photo_url,
                "is_active": report.is_active,
            })

    # Projects (only for own branch)
    if is_own_branch:
        emp_projects = await EmployeeProject.find(
            EmployeeProject.employee_id == employee_id
        ).to_list()

        for ep in emp_projects:
            project = await Project.get(ep.project_id)
            if project:
                now = datetime.now(timezone.utc).replace(tzinfo=None)
                progress = 0.0
                if project.start_date and project.end_date:
                    start = project.start_date.replace(tzinfo=None) if project.start_date.tzinfo else project.start_date
                    end = project.end_date.replace(tzinfo=None) if project.end_date.tzinfo else project.end_date
                    total = (end - start).total_seconds()
                    elapsed = (now - start).total_seconds()
                    if total > 0:
                        progress = min(100.0, max(0.0, (elapsed / total) * 100))

                result["projects"].append({
                    "id": str(project.id),
                    "name": project.name,
                    "status": project.status,
                    "project_type": project.project_type,
                    "role_in_project": ep.role_in_project,
                    "start_date": project.start_date.isoformat(),
                    "end_date": project.end_date.isoformat() if project.end_date else None,
                    "progress_percent": round(progress, 1),
                })

    # Skills (own branch only)
    if is_own_branch:
        skills = await EmployeeSkill.find(
            EmployeeSkill.employee_id == employee_id
        ).to_list()
        result["skills"] = [
            {
                "skill_name": s.skill_name,
                "proficiency": s.proficiency,
                "notes": s.notes,
            }
            for s in skills
        ]

    # Utilisation — latest snapshot (own branch only)
    if is_own_branch:
        latest_util = await UtilisationSnapshot.find(
            UtilisationSnapshot.employee_id == employee_id,
        ).sort([("period", -1)]).limit(1).to_list()

        if latest_util:
            u = latest_util[0]
            result["utilisation"] = {
                "period": u.period,
                "utilisation_percent": u.utilisation_percent,
                "billable_percent": u.billable_percent,
                "total_hours": u.total_hours_logged,
                "billable_hours": u.billable_hours,
                "non_billable_hours": u.non_billable_hours,
                "capacity_hours": u.capacity_hours,
                "classification": u.classification,
            }

    # Timesheet summary — current period (own branch only)
    if is_own_branch:
        now = datetime.now(timezone.utc)
        current_period = f"{now.year:04d}-{now.month:02d}"
        ts_entries = await TimesheetEntry.find(
            TimesheetEntry.employee_id == employee_id,
            TimesheetEntry.period == current_period,
            TimesheetEntry.status != "rejected",
        ).to_list()

        if ts_entries:
            total_hours = sum(e.hours for e in ts_entries)
            billable_hours = sum(e.hours for e in ts_entries if e.is_billable)
            result["timesheet_summary"] = {
                "period": current_period,
                "total_hours": round(total_hours, 2),
                "billable_hours": round(billable_hours, 2),
                "entry_count": len(ts_entries),
            }

    return result


async def search_employees(query: str, location_id: str = None, department_id: str = None, level: str = None, limit: int = 20):
    filters = {"is_active": True}

    if location_id:
        filters["location_id"] = location_id
    if department_id:
        filters["department_id"] = department_id
    if level:
        filters["level"] = level

    if query:
        employees = await Employee.find(
            {"$and": [
                filters,
                {"$or": [
                    {"name": {"$regex": query, "$options": "i"}},
                    {"email": {"$regex": query, "$options": "i"}},
                    {"designation": {"$regex": query, "$options": "i"}},
                ]},
            ]}
        ).limit(limit).to_list()
    else:
        employees = await Employee.find(filters).limit(limit).to_list()

    locations = await Location.find_all().to_list()
    departments = await Department.find_all().to_list()
    loc_map = {str(l.id): l for l in locations}
    dept_map = {str(d.id): d for d in departments}

    results = []
    for emp in employees:
        loc = loc_map.get(emp.location_id)
        dept = dept_map.get(emp.department_id)
        results.append({
            "id": str(emp.id),
            "name": emp.name,
            "designation": emp.designation,
            "department": dept.name if dept else "Unknown",
            "department_id": emp.department_id,
            "level": emp.level,
            "location_id": emp.location_id,
            "location_code": loc.code if loc else "UNK",
            "location_city": loc.city if loc else "Unknown",
            "photo_url": emp.photo_url,
            "is_active": emp.is_active,
        })

    total = len(results)
    return {"employees": results, "total": total}
