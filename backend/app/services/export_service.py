import csv
import io
from collections import defaultdict
from datetime import datetime, timezone

from bson import ObjectId
from openpyxl import Workbook

from app.models.department import Department
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.employee_skill import EmployeeSkill
from app.models.finance_billable import FinanceBillable
from app.models.location import Location
from app.models.project import Project
from app.models.reporting_relationship import ReportingRelationship
from app.models.timesheet_entry import TimesheetEntry
from app.models.utilisation_snapshot import UtilisationSnapshot


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


# ---------------------------------------------------------------------------
# Shared CSV helper
# ---------------------------------------------------------------------------

def _build_csv(headers: list[str], rows: list[list]) -> bytes:
    """Build CSV bytes from a list of headers and rows."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


# ---------------------------------------------------------------------------
# CSV export functions
# ---------------------------------------------------------------------------

async def export_billable_list(location_id: str, period: str) -> bytes:
    """Export billable list for a branch and period as CSV bytes."""
    CORPORATE_LEVELS = {"c-suite", "vp"}

    billables = await FinanceBillable.find(
        FinanceBillable.branch_location_id == location_id,
        FinanceBillable.period == period,
    ).to_list()

    # Build employee name map for all referenced employees
    employee_ids = list({b.employee_id for b in billables})
    employees = await Employee.find(
        {"_id": {"$in": [ObjectId(eid) for eid in employee_ids]}}
    ).to_list() if employee_ids else []
    # Filter out corporate-level employees
    employees = [e for e in employees if e.level not in CORPORATE_LEVELS]
    branch_emp_ids = {str(e.id) for e in employees}
    billables = [b for b in billables if b.employee_id in branch_emp_ids]
    emp_map = {str(e.id): e.name for e in employees}

    # Build project name map
    project_ids = list({b.project_id for b in billables if b.project_id})
    projects = await Project.find(
        {"_id": {"$in": [ObjectId(pid) for pid in project_ids]}}
    ).to_list() if project_ids else []
    proj_map = {str(p.id): p.name for p in projects}

    headers = [
        "Employee Name", "Employee ID", "Period", "Billable Status",
        "Billable Hours", "Billed Amount", "Project", "Client",
    ]

    rows = []
    for b in billables:
        rows.append([
            emp_map.get(b.employee_id, "Unknown"),
            b.employee_id,
            b.period,
            b.billable_status,
            b.billable_hours,
            b.billed_amount if b.billed_amount is not None else "",
            proj_map.get(b.project_id, "") if b.project_id else "",
            b.client_name or "",
        ])

    return _build_csv(headers, rows)


async def export_bench_list(location_id: str, period: str) -> bytes:
    """Export bench list for a branch and period as CSV bytes."""
    CORPORATE_LEVELS = {"c-suite", "vp"}

    snapshots = await UtilisationSnapshot.find(
        UtilisationSnapshot.branch_location_id == location_id,
        UtilisationSnapshot.period == period,
        UtilisationSnapshot.classification == "bench",
        {"employee_level": {"$nin": list(CORPORATE_LEVELS)}},
    ).to_list()

    # Get employee details for designation / department
    employee_ids = list({s.employee_id for s in snapshots})
    employees = await Employee.find(
        {"_id": {"$in": [ObjectId(eid) for eid in employee_ids]}}
    ).to_list() if employee_ids else []
    emp_map = {str(e.id): e for e in employees}

    # Department map
    departments = await Department.find_all().to_list()
    dept_map = {str(d.id): d.name for d in departments}

    # Skills map  (employee_id -> comma-separated skills)
    all_skills = await EmployeeSkill.find(
        {"employee_id": {"$in": employee_ids}}
    ).to_list() if employee_ids else []
    skills_map: dict[str, list[str]] = defaultdict(list)
    for sk in all_skills:
        skills_map[sk.employee_id].append(sk.skill_name)

    headers = [
        "Employee Name", "Designation", "Department",
        "Utilisation %", "Billable %", "Classification", "Skills",
    ]

    rows = []
    for s in snapshots:
        emp = emp_map.get(s.employee_id)
        rows.append([
            s.employee_name,
            emp.designation if emp else "",
            dept_map.get(emp.department_id, "Unknown") if emp else "",
            s.utilisation_percent,
            s.billable_percent,
            s.classification,
            ", ".join(skills_map.get(s.employee_id, [])),
        ])

    return _build_csv(headers, rows)


async def export_project_utilisation(location_id: str, period: str) -> bytes:
    """Export project utilisation for a branch and period as CSV bytes."""
    CORPORATE_LEVELS = {"c-suite", "vp"}

    # Get branch-level employee IDs (exclude corporate)
    branch_employees = await Employee.find(
        Employee.location_id == location_id,
        Employee.is_active == True,
        {"level": {"$nin": list(CORPORATE_LEVELS)}},
    ).to_list()
    branch_emp_ids = [str(e.id) for e in branch_employees]

    entries = await TimesheetEntry.find(
        TimesheetEntry.branch_location_id == location_id,
        TimesheetEntry.period == period,
        {"employee_id": {"$in": branch_emp_ids}},
    ).to_list()

    # Aggregate by project
    proj_data: dict[str, dict] = defaultdict(lambda: {
        "total_hours": 0.0,
        "billable_hours": 0.0,
        "members": set(),
    })
    for e in entries:
        pd = proj_data[e.project_id]
        pd["total_hours"] += e.hours
        if e.is_billable:
            pd["billable_hours"] += e.hours
        pd["members"].add(e.employee_id)

    # Project name map
    project_ids = list(proj_data.keys())
    projects = await Project.find(
        {"_id": {"$in": [ObjectId(pid) for pid in project_ids]}}
    ).to_list() if project_ids else []
    proj_map = {str(p.id): p.name for p in projects}

    headers = [
        "Project Name", "Total Hours", "Billable Hours",
        "Billable %", "Member Count",
    ]

    rows = []
    for pid, data in proj_data.items():
        total = data["total_hours"]
        billable = data["billable_hours"]
        billable_pct = round((billable / total) * 100, 2) if total > 0 else 0.0
        rows.append([
            proj_map.get(pid, "Unknown"),
            round(total, 2),
            round(billable, 2),
            billable_pct,
            len(data["members"]),
        ])

    return _build_csv(headers, rows)


async def export_employee_allocation(location_id: str, period: str) -> bytes:
    """Export employee allocation for a branch and period as CSV bytes."""
    CORPORATE_LEVELS = {"c-suite", "vp"}

    snapshots = await UtilisationSnapshot.find(
        UtilisationSnapshot.branch_location_id == location_id,
        UtilisationSnapshot.period == period,
        {"employee_level": {"$nin": list(CORPORATE_LEVELS)}},
    ).to_list()

    # Get employee details
    employee_ids = list({s.employee_id for s in snapshots})
    employees = await Employee.find(
        {"_id": {"$in": [ObjectId(eid) for eid in employee_ids]}}
    ).to_list() if employee_ids else []
    emp_map = {str(e.id): e for e in employees}

    # Department map
    departments = await Department.find_all().to_list()
    dept_map = {str(d.id): d.name for d in departments}

    headers = [
        "Employee Name", "Designation", "Department",
        "Total Hours", "Billable Hours", "Non-Billable Hours",
        "Capacity Hours", "Utilisation %", "Billable %", "Classification",
    ]

    rows = []
    for s in snapshots:
        emp = emp_map.get(s.employee_id)
        rows.append([
            s.employee_name,
            emp.designation if emp else "",
            dept_map.get(emp.department_id, "Unknown") if emp else "",
            s.total_hours_logged,
            s.billable_hours,
            s.non_billable_hours,
            s.capacity_hours,
            s.utilisation_percent,
            s.billable_percent,
            s.classification,
        ])

    return _build_csv(headers, rows)
