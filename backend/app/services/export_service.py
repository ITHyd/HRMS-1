import io
from datetime import datetime, timezone

from openpyxl import Workbook

from app.models.department import Department
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.location import Location
from app.models.project import Project
from app.models.reporting_relationship import ReportingRelationship


async def export_team_report(location_id: str) -> bytes:
    employees = await Employee.find(
        Employee.location_id == location_id,
        Employee.is_active == True,
    ).to_list()

    departments = await Department.find_all().to_list()
    locations = await Location.find_all().to_list()
    dept_map = {str(d.id): d.name for d in departments}
    loc_map = {str(l.id): l for l in locations}

    primary_rels = await ReportingRelationship.find(
        ReportingRelationship.type == "PRIMARY"
    ).to_list()
    secondary_rels = await ReportingRelationship.find(
        ReportingRelationship.type != "PRIMARY"
    ).to_list()

    all_employees = await Employee.find_all().to_list()
    emp_map = {str(e.id): e for e in all_employees}

    primary_mgr = {}
    secondary_mgrs = {}
    for rel in primary_rels:
        primary_mgr[rel.employee_id] = rel.manager_id
    for rel in secondary_rels:
        if rel.employee_id not in secondary_mgrs:
            secondary_mgrs[rel.employee_id] = []
        secondary_mgrs[rel.employee_id].append(rel.manager_id)

    all_emp_projs = await EmployeeProject.find_all().to_list()
    all_projects = await Project.find_all().to_list()
    proj_map = {str(p.id): p.name for p in all_projects}
    emp_proj_map = {}
    for ep in all_emp_projs:
        if ep.employee_id not in emp_proj_map:
            emp_proj_map[ep.employee_id] = []
        emp_proj_map[ep.employee_id].append(proj_map.get(ep.project_id, "Unknown"))

    wb = Workbook()
    ws = wb.active
    ws.title = "Team Report"

    headers = [
        "Name", "Designation", "Department", "Level",
        "Primary Manager", "Secondary Manager(s)", "Location",
        "Current Projects", "Joining Date", "Email",
    ]
    ws.append(headers)

    for emp in employees:
        p_mgr_id = primary_mgr.get(str(emp.id))
        p_mgr = emp_map.get(p_mgr_id)
        s_mgr_ids = secondary_mgrs.get(str(emp.id), [])
        s_mgrs = [emp_map.get(mid) for mid in s_mgr_ids if emp_map.get(mid)]

        loc = loc_map.get(emp.location_id)
        projects = emp_proj_map.get(str(emp.id), [])

        ws.append([
            emp.name,
            emp.designation,
            dept_map.get(emp.department_id, "Unknown"),
            emp.level,
            p_mgr.name if p_mgr else "N/A",
            ", ".join(m.name for m in s_mgrs) if s_mgrs else "N/A",
            f"{loc.city}, {loc.country}" if loc else "Unknown",
            ", ".join(projects) if projects else "None",
            emp.join_date.strftime("%Y-%m-%d") if emp.join_date else "N/A",
            emp.email,
        ])

    # Auto-adjust column widths
    for col in ws.columns:
        max_length = 0
        col_letter = col[0].column_letter
        for cell in col:
            if cell.value:
                max_length = max(max_length, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = min(max_length + 2, 50)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
