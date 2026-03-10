import csv
import io
import json
from datetime import datetime, timezone

from app.models.department import Department
from app.models.dynamics_export import DynamicsExport
from app.models.employee import Employee
from app.models.project import Project
from app.models.timesheet_entry import TimesheetEntry
from app.services import audit_service
from app.services import hrms_mode_service


async def create_dynamics_export(export_type: str, branch_location_id: str, user) -> dict:
    """
    Create a Dynamics 365 export based on export_type.
    Queries the relevant models, transforms data to D365 schemas,
    and stores the result in a DynamicsExport document.
    """
    if export_type not in ("employee", "project", "timesheet"):
        raise ValueError(f"Invalid export_type: {export_type}. Must be one of: employee, project, timesheet")

    now = datetime.now(timezone.utc)
    sync_mode = await hrms_mode_service.resolve_user_sync_mode(
        user_id=user.user_id,
        user_email=getattr(user, "email", None),
    )

    export_doc = DynamicsExport(
        export_type=export_type,
        status="processing",
        data_snapshot={},
        record_count=0,
        created_at=now,
        created_by=user.user_id,
    )
    await export_doc.insert()

    try:
        if export_type == "employee":
            data = await _export_employees(branch_location_id)
        elif export_type == "project":
            data = await _export_projects(branch_location_id)
        else:
            data = await _export_timesheets(branch_location_id, sync_mode=sync_mode)

        export_doc.data_snapshot = data
        export_doc.record_count = len(data.get("records", []))
        export_doc.status = "completed"
        export_doc.processed_at = datetime.now(timezone.utc)

    except Exception as e:
        export_doc.status = "failed"
        export_doc.error_message = str(e)
        export_doc.processed_at = datetime.now(timezone.utc)

    await export_doc.save()

    await audit_service.log_change(
        action="EXPORT",
        entity_type="DynamicsExport",
        entity_id=str(export_doc.id),
        changed_by=user.user_id,
        branch_location_id=branch_location_id,
        new_value={
            "export_type": export_type,
            "status": export_doc.status,
            "record_count": export_doc.record_count,
        },
    )

    return {
        "id": str(export_doc.id),
        "export_type": export_doc.export_type,
        "status": export_doc.status,
        "record_count": export_doc.record_count,
        "created_at": export_doc.created_at,
        "processed_at": export_doc.processed_at,
        "error_message": export_doc.error_message,
    }


async def list_dynamics_exports(page: int = 1, page_size: int = 50) -> dict:
    """List DynamicsExport entries sorted by created_at descending."""
    skip = (page - 1) * page_size

    exports = await DynamicsExport.find_all().sort(
        -DynamicsExport.created_at
    ).skip(skip).limit(page_size).to_list()

    total = await DynamicsExport.find_all().count()

    return {
        "exports": [
            {
                "id": str(exp.id),
                "export_type": exp.export_type,
                "status": exp.status,
                "record_count": exp.record_count,
                "created_at": exp.created_at,
                "processed_at": exp.processed_at,
                "error_message": exp.error_message,
            }
            for exp in exports
        ],
        "total": total,
    }


async def get_dynamics_export(export_id: str) -> dict:
    """Get a single DynamicsExport by ID."""
    exp = await DynamicsExport.get(export_id)
    if not exp:
        raise ValueError("Dynamics export not found")

    return {
        "id": str(exp.id),
        "export_type": exp.export_type,
        "status": exp.status,
        "record_count": exp.record_count,
        "data_snapshot": exp.data_snapshot,
        "created_at": exp.created_at,
        "processed_at": exp.processed_at,
        "error_message": exp.error_message,
    }


async def get_export_download(export_id: str, format: str = "json") -> bytes:
    """
    Return the data_snapshot as JSON or CSV bytes for download.
    """
    exp = await DynamicsExport.get(export_id)
    if not exp:
        raise ValueError("Dynamics export not found")

    if exp.status != "completed":
        raise ValueError(f"Export is not completed (status: {exp.status})")

    records = exp.data_snapshot.get("records", [])

    if format == "csv":
        return _records_to_csv(records)

    return json.dumps(exp.data_snapshot, indent=2, default=str).encode("utf-8")


# ---------------------------------------------------------------------------
# Internal helpers - D365 schema transformations
# ---------------------------------------------------------------------------


async def _export_employees(branch_location_id: str) -> dict:
    """
    Query employees for the branch and transform to
    D365 HCM hcm_workers schema.
    """
    # Get departments for this branch
    departments = await Department.find(
        Department.location_id == branch_location_id
    ).to_list()
    dept_map = {str(d.id): d.name for d in departments}

    employees = await Employee.find(
        Employee.location_id == branch_location_id,
        Employee.is_active == True,
    ).to_list()

    records = []
    for emp in employees:
        records.append({
            "worker_number": str(emp.id),
            "name": emp.name,
            "email": emp.email,
            "department": dept_map.get(emp.department_id, "Unknown"),
            "designation": emp.designation,
            "join_date": emp.join_date.isoformat() if emp.join_date else None,
        })

    return {
        "schema": "hcm_workers",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "record_count": len(records),
        "records": records,
    }


async def _export_projects(branch_location_id: str) -> dict:
    """
    Query projects via departments in the branch and transform to
    D365 msdyn_project schema.
    """
    departments = await Department.find(
        Department.location_id == branch_location_id
    ).to_list()
    dept_ids = [str(d.id) for d in departments]
    dept_map = {str(d.id): d.name for d in departments}

    projects = await Project.find(
        {"department_id": {"$in": dept_ids}}
    ).to_list()

    records = []
    for proj in projects:
        records.append({
            "project_id": str(proj.id),
            "name": proj.name,
            "status": proj.status,
            "department": dept_map.get(proj.department_id, "Unknown"),
            "start_date": proj.start_date.isoformat() if proj.start_date else None,
            "end_date": proj.end_date.isoformat() if proj.end_date else None,
        })

    return {
        "schema": "msdyn_project",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "record_count": len(records),
        "records": records,
    }


async def _export_timesheets(branch_location_id: str, sync_mode: str = "live") -> dict:
    """
    Query timesheet entries for the branch for the current period
    and transform to D365 msdyn_timeentry schema.
    """
    current_period = datetime.now(timezone.utc).strftime("%Y-%m")

    entries = await TimesheetEntry.find(
        TimesheetEntry.branch_location_id == branch_location_id,
        TimesheetEntry.period == current_period,
        hrms_mode_service.get_timesheet_visibility_filter(sync_mode),
    ).to_list()

    records = []
    for entry in entries:
        records.append({
            "employee_id": entry.employee_id,
            "project_id": entry.project_id,
            "date": entry.date.isoformat() if entry.date else None,
            "hours": entry.hours,
            "is_billable": entry.is_billable,
        })

    return {
        "schema": "msdyn_timeentry",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "period": current_period,
        "record_count": len(records),
        "records": records,
    }


def _records_to_csv(records: list[dict]) -> bytes:
    """Convert a list of dicts to CSV bytes."""
    if not records:
        return b""

    output = io.StringIO()
    fieldnames = list(records[0].keys())
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in records:
        writer.writerow(row)

    return output.getvalue().encode("utf-8")
