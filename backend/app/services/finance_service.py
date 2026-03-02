import csv
import io
import secrets
from datetime import datetime, timezone

from bson import ObjectId

from app.models.employee import Employee
from app.models.finance_billable import FinanceBillable
from app.models.finance_upload_log import FinanceUploadLog
from app.models.project import Project
from app.services.audit_service import log_change

# In-memory store for pending uploads (mirrors import_service pattern)
_pending_uploads: dict[str, dict] = {}

VALID_BILLABLE_STATUSES = {"fully_billed", "partially_billed", "non_billable"}


def get_finance_template() -> str:
    """Return CSV header string for the finance billable upload template."""
    return "employee_email,billable_status,billable_hours,billed_amount,project_id,client_name\n"


async def validate_finance_csv(
    file_content: bytes,
    period: str,
    branch_location_id: str,
) -> dict:
    """
    Parse and validate a finance billable CSV.
    Returns validation results with an upload_token for confirmation.
    """
    text = file_content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    # Build lookup maps
    all_employees = await Employee.find(
        Employee.location_id == branch_location_id,
        Employee.is_active == True,
    ).to_list()
    email_to_employee = {e.email: e for e in all_employees}

    # Check for existing records in this period+branch to detect duplicates
    existing_records = await FinanceBillable.find(
        FinanceBillable.period == period,
        FinanceBillable.branch_location_id == branch_location_id,
    ).to_list()
    existing_keys = {
        (r.employee_id, r.project_id or "")
        for r in existing_records
    }

    # Calculate next version number
    latest_version_records = await FinanceBillable.find(
        FinanceBillable.period == period,
        FinanceBillable.branch_location_id == branch_location_id,
    ).sort(-FinanceBillable.version).limit(1).to_list()

    if latest_version_records:
        next_version = latest_version_records[0].version + 1
    else:
        next_version = 1

    rows = []
    seen_keys = set()
    valid_count = 0
    error_count = 0
    duplicate_count = 0
    warning_count = 0

    for i, row in enumerate(reader, start=1):
        errors = []
        warnings = []

        # Validate employee_email
        email = row.get("employee_email", "").strip()
        if not email:
            errors.append("Missing required field: employee_email")
        elif email not in email_to_employee:
            errors.append(f"Employee email not found in branch: {email}")

        # Validate billable_status
        billable_status = row.get("billable_status", "").strip()
        if not billable_status:
            errors.append("Missing required field: billable_status")
        elif billable_status not in VALID_BILLABLE_STATUSES:
            errors.append(
                f"Invalid billable_status: {billable_status}. "
                f"Must be one of: {', '.join(sorted(VALID_BILLABLE_STATUSES))}"
            )

        # Validate billable_hours
        billable_hours_str = row.get("billable_hours", "").strip()
        billable_hours = 0.0
        if not billable_hours_str:
            errors.append("Missing required field: billable_hours")
        else:
            try:
                billable_hours = float(billable_hours_str)
                if billable_hours < 0:
                    errors.append(f"billable_hours must be >= 0, got {billable_hours}")
            except ValueError:
                errors.append(f"Invalid billable_hours value: {billable_hours_str}")

        # Optional fields
        billed_amount_str = row.get("billed_amount", "").strip()
        if billed_amount_str:
            try:
                float(billed_amount_str)
            except ValueError:
                errors.append(f"Invalid billed_amount value: {billed_amount_str}")

        project_id = row.get("project_id", "").strip()
        client_name = row.get("client_name", "").strip()

        # Resolve employee_id for duplicate checks
        employee_id = ""
        if email and email in email_to_employee:
            employee_id = str(email_to_employee[email].id)

        # Check for duplicates within the CSV
        csv_key = (employee_id, project_id)
        if employee_id and csv_key in seen_keys:
            errors.append(f"Duplicate entry in CSV for employee {email} and project {project_id or 'none'}")
        if employee_id:
            seen_keys.add(csv_key)

        # Check for duplicates against existing data
        if employee_id and (employee_id, project_id) in existing_keys:
            warnings.append(
                f"Record already exists for employee {email} in period {period}. "
                f"Will be stored as version {next_version}."
            )
            duplicate_count += 1

        status = "valid"
        if errors:
            status = "error"
            error_count += 1
        elif warnings:
            status = "warning"
            warning_count += 1
        else:
            valid_count += 1

        rows.append({
            "row_number": i,
            "data": dict(row),
            "status": status,
            "errors": errors,
            "warnings": warnings,
        })

    upload_token = secrets.token_urlsafe(32)
    _pending_uploads[upload_token] = {
        "rows": rows,
        "period": period,
        "branch_location_id": branch_location_id,
        "next_version": next_version,
        "email_to_employee": {e: str(emp.id) for e, emp in email_to_employee.items()},
        "created_at": datetime.now(timezone.utc),
    }

    return {
        "total_rows": len(rows),
        "valid_count": valid_count,
        "error_count": error_count,
        "duplicate_count": duplicate_count,
        "warning_count": warning_count,
        "period": period,
        "version": next_version,
        "rows": rows,
        "upload_token": upload_token,
    }


async def confirm_finance_upload(
    upload_token: str,
    user_id: str,
    branch_location_id: str,
) -> dict | None:
    """
    Insert validated finance billable rows into the database
    and create an upload log entry.
    """
    pending = _pending_uploads.pop(upload_token, None)
    if not pending:
        return None

    rows = pending["rows"]
    period = pending["period"]
    version = pending["next_version"]
    email_map = pending["email_to_employee"]
    now = datetime.now(timezone.utc)

    batch_id = secrets.token_urlsafe(16)
    imported_count = 0
    error_count = 0
    upload_errors = []

    for row in rows:
        if row["status"] == "error":
            error_count += 1
            continue

        data = row["data"]
        email = data.get("employee_email", "").strip()
        employee_id = email_map.get(email)

        if not employee_id:
            error_count += 1
            upload_errors.append({"row": row["row_number"], "message": f"Employee not found: {email}"})
            continue

        billed_amount_str = data.get("billed_amount", "").strip()
        billed_amount = float(billed_amount_str) if billed_amount_str else None

        record = FinanceBillable(
            employee_id=employee_id,
            period=period,
            billable_status=data.get("billable_status", "").strip(),
            billable_hours=float(data.get("billable_hours", "0").strip()),
            billed_amount=billed_amount,
            project_id=data.get("project_id", "").strip() or None,
            client_name=data.get("client_name", "").strip() or None,
            branch_location_id=branch_location_id,
            upload_batch_id=batch_id,
            version=version,
            created_at=now,
        )
        await record.insert()
        imported_count += 1

    # Create upload log
    upload_log = FinanceUploadLog(
        batch_id=batch_id,
        period=period,
        branch_location_id=branch_location_id,
        uploaded_by=user_id,
        filename="finance_billable_upload.csv",
        total_rows=len(rows),
        valid_count=imported_count,
        error_count=error_count,
        duplicate_count=sum(1 for r in rows if any("already exists" in w for w in r.get("warnings", []))),
        version=version,
        errors=upload_errors,
        uploaded_at=now,
    )
    await upload_log.insert()

    # Audit log
    await log_change(
        action="IMPORT",
        entity_type="finance_billable",
        entity_id=batch_id,
        changed_by=user_id,
        branch_location_id=branch_location_id,
        new_value={
            "period": period,
            "version": version,
            "imported_count": imported_count,
        },
    )

    return {
        "imported_count": imported_count,
        "version": version,
        "message": f"Successfully imported {imported_count} finance billable records (version {version})",
    }


async def get_finance_billable(
    period: str,
    branch_location_id: str,
    version: int | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """
    List finance billable entries with employee name joins.
    Defaults to the latest version if none specified.
    """
    # Determine latest version if not provided
    if version is None:
        latest = await FinanceBillable.find(
            FinanceBillable.period == period,
            FinanceBillable.branch_location_id == branch_location_id,
        ).sort(-FinanceBillable.version).limit(1).to_list()
        version = latest[0].version if latest else 1

    skip = (page - 1) * page_size

    entries = await FinanceBillable.find(
        FinanceBillable.period == period,
        FinanceBillable.branch_location_id == branch_location_id,
        FinanceBillable.version == version,
    ).skip(skip).limit(page_size).to_list()

    total = await FinanceBillable.find(
        FinanceBillable.period == period,
        FinanceBillable.branch_location_id == branch_location_id,
        FinanceBillable.version == version,
    ).count()

    # Resolve employee names
    employee_ids = {e.employee_id for e in entries}
    employees = await Employee.find(
        {"_id": {"$in": [ObjectId(eid) for eid in employee_ids if ObjectId.is_valid(eid)]}},
    ).to_list()
    emp_map = {str(e.id): e.name for e in employees}

    # Resolve project names
    project_ids = {e.project_id for e in entries if e.project_id}
    proj_map = {}
    if project_ids:
        projects = await Project.find(
            {"_id": {"$in": [ObjectId(pid) for pid in project_ids if ObjectId.is_valid(pid)]}},
        ).to_list()
        proj_map = {str(p.id): p.name for p in projects}

    result = []
    for entry in entries:
        result.append({
            "id": str(entry.id),
            "employee_id": entry.employee_id,
            "employee_name": emp_map.get(entry.employee_id, "Unknown"),
            "period": entry.period,
            "billable_status": entry.billable_status,
            "billable_hours": entry.billable_hours,
            "billed_amount": entry.billed_amount,
            "project_name": proj_map.get(entry.project_id, None) if entry.project_id else None,
            "client_name": entry.client_name,
            "version": entry.version,
        })

    # Get latest version for metadata
    all_versions = await FinanceBillable.find(
        FinanceBillable.period == period,
        FinanceBillable.branch_location_id == branch_location_id,
    ).sort(-FinanceBillable.version).limit(1).to_list()
    latest_version = all_versions[0].version if all_versions else version

    return {
        "entries": result,
        "total": total,
        "period": period,
        "latest_version": latest_version,
    }


async def get_upload_history(branch_location_id: str) -> list[dict]:
    """List all finance upload log entries for a branch, most recent first."""
    logs = await FinanceUploadLog.find(
        FinanceUploadLog.branch_location_id == branch_location_id,
    ).sort(-FinanceUploadLog.uploaded_at).to_list()

    return [
        {
            "batch_id": log.batch_id,
            "period": log.period,
            "uploaded_by": log.uploaded_by,
            "filename": log.filename,
            "total_rows": log.total_rows,
            "valid_count": log.valid_count,
            "error_count": log.error_count,
            "duplicate_count": log.duplicate_count,
            "version": log.version,
            "errors": log.errors,
            "uploaded_at": log.uploaded_at,
        }
        for log in logs
    ]
