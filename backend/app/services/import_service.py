import csv
import io
import secrets
from collections import defaultdict
from datetime import datetime, timezone

from app.models.employee import Employee
from app.models.reporting_relationship import ReportingRelationship
from app.services.audit_service import log_change

# In-memory store for pending imports (TTL managed by cleanup)
_pending_imports: dict[str, dict] = {}


async def validate_csv(file_content: bytes, branch_location_id: str):
    text = file_content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    required_fields = {"name", "email", "designation", "department_id", "level", "manager_email", "location_id", "join_date"}

    rows = []
    existing_emails = {e.email async for e in Employee.find(Employee.is_active == True)}
    all_employees = await Employee.find(Employee.is_active == True).to_list()
    email_to_id = {e.email: str(e.id) for e in all_employees}

    row_emails = {}
    valid_count = 0
    error_count = 0
    warning_count = 0

    for i, row in enumerate(reader, start=1):
        errors = []
        warnings = []

        # Check required fields
        for field in required_fields:
            if field not in row or not row.get(field, "").strip():
                if field != "manager_email":
                    errors.append(f"Missing required field: {field}")

        email = row.get("email", "").strip()
        if email:
            if email in existing_emails:
                errors.append(f"Email already exists: {email}")
            if email in row_emails:
                errors.append(f"Duplicate email in CSV at row {row_emails[email]}")
            row_emails[email] = i

        # Validate manager reference
        mgr_email = row.get("manager_email", "").strip()
        if mgr_email and mgr_email not in email_to_id and mgr_email not in row_emails:
            errors.append(f"Manager email not found: {mgr_email}")

        # Validate secondary manager
        sec_mgr = row.get("secondary_manager_email", "").strip()
        if sec_mgr and sec_mgr not in email_to_id and sec_mgr not in row_emails:
            warnings.append(f"Secondary manager email not found: {sec_mgr}")

        # Validate join_date
        join_date = row.get("join_date", "").strip()
        if join_date:
            try:
                datetime.strptime(join_date, "%Y-%m-%d")
            except ValueError:
                errors.append(f"Invalid date format: {join_date} (expected YYYY-MM-DD)")

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

    # Detect circular chains within the CSV
    graph = defaultdict(list)
    for row in rows:
        email = row["data"].get("email", "").strip()
        mgr = row["data"].get("manager_email", "").strip()
        if email and mgr:
            graph[mgr].append(email)

    def detect_cycle(start, graph, visited, rec_stack):
        visited.add(start)
        rec_stack.add(start)
        for neighbor in graph.get(start, []):
            if neighbor not in visited:
                if detect_cycle(neighbor, graph, visited, rec_stack):
                    return True
            elif neighbor in rec_stack:
                return True
        rec_stack.discard(start)
        return False

    visited = set()
    has_cycle = False
    for node in graph:
        if node not in visited:
            if detect_cycle(node, graph, visited, set()):
                has_cycle = True
                break

    if has_cycle:
        for row in rows:
            if row["status"] != "error":
                row["errors"].append("Circular reporting chain detected in CSV")
                row["status"] = "error"
                error_count += 1
                valid_count = max(0, valid_count - 1)

    import_token = secrets.token_urlsafe(32)
    _pending_imports[import_token] = {
        "rows": rows,
        "branch_location_id": branch_location_id,
        "created_at": datetime.now(timezone.utc),
    }

    return {
        "total_rows": len(rows),
        "valid_count": valid_count,
        "error_count": error_count,
        "warning_count": warning_count,
        "rows": rows,
        "import_token": import_token,
    }


async def confirm_import(import_token: str, user_id: str, branch_location_id: str):
    pending = _pending_imports.pop(import_token, None)
    if not pending:
        return None

    rows = pending["rows"]
    imported = 0
    all_employees = await Employee.find(Employee.is_active == True).to_list()
    email_to_id = {e.email: str(e.id) for e in all_employees}

    new_employees = []

    for row in rows:
        if row["status"] == "error":
            continue

        data = row["data"]
        emp = Employee(
            name=data["name"].strip(),
            email=data["email"].strip(),
            designation=data["designation"].strip(),
            department_id=data["department_id"].strip(),
            level=data["level"].strip(),
            location_id=data.get("location_id", branch_location_id).strip(),
            join_date=datetime.strptime(data["join_date"].strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc),
        )
        await emp.insert()
        new_employees.append(emp)
        email_to_id[emp.email] = str(emp.id)

        # Create primary reporting relationship
        mgr_email = data.get("manager_email", "").strip()
        if mgr_email and mgr_email in email_to_id:
            rel = ReportingRelationship(
                employee_id=str(emp.id),
                manager_id=email_to_id[mgr_email],
                type="PRIMARY",
            )
            await rel.insert()

        # Create secondary reporting relationship
        sec_mgr = data.get("secondary_manager_email", "").strip()
        if sec_mgr and sec_mgr in email_to_id:
            rel = ReportingRelationship(
                employee_id=str(emp.id),
                manager_id=email_to_id[sec_mgr],
                type="FUNCTIONAL",
            )
            await rel.insert()

        await log_change(
            action="CREATE",
            entity_type="employee",
            entity_id=str(emp.id),
            changed_by=user_id,
            branch_location_id=branch_location_id,
            new_value={"name": emp.name, "email": emp.email, "designation": emp.designation},
        )
        imported += 1

    return {"imported_count": imported, "message": f"Successfully imported {imported} employees"}


def get_csv_template():
    return "name,email,designation,department_id,level,manager_email,location_id,join_date,secondary_manager_email\n"
