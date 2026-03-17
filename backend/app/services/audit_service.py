from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId

from app.models.audit_log import AuditLog
from app.models.employee import Employee
from app.models.project import Project
from app.models.user import User

# Friendly labels for entity types
ENTITY_LABELS: dict[str, str] = {
    "EmployeeProject": "Project Assignment",
    "TimesheetEntry": "Timesheet",
    "Employee": "Employee",
    "Project": "Project",
    "ReportingRelationship": "Reporting Line",
    "FinanceBillable": "Billable Record",
    "UtilisationSnapshot": "Utilisation",
    "EmployeeSkill": "Skill",
    "Department": "Department",
    "Integration": "Integration",
}

# Friendly labels for field names in audit values
FIELD_LABELS: dict[str, str] = {
    "employee_id": "Employee",
    "project_id": "Project",
    "role_in_project": "Role",
    "role": "Role",
    "allocation_percent": "Allocation",
    "start_date": "Start Date",
    "end_date": "End Date",
    "is_billable": "Billable",
    "hours": "Hours",
    "period": "Period",
    "status": "Status",
    "skill_name": "Skill",
    "proficiency": "Proficiency",
    "name": "Name",
    "designation": "Designation",
    "department_id": "Department",
    "location_id": "Location",
    "is_active": "Active",
    "billable_status": "Billable Status",
    "billable_hours": "Billable Hours",
    "billed_amount": "Billed Amount",
    "project_name": "Project",
    "client_name": "Client",
    "employee_name": "Employee",
    "description": "Description",
    "project_type": "Type",
    "integration_type": "Integration",
    "records_processed": "Processed",
    "records_succeeded": "Succeeded",
    "records_failed": "Failed",
}


async def log_change(
    action: str,
    entity_type: str,
    entity_id: str,
    changed_by: str,
    branch_location_id: str,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    metadata: Optional[dict] = None,
):
    entry = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        changed_by=changed_by,
        timestamp=datetime.now(timezone.utc),
        old_value=old_value,
        new_value=new_value,
        branch_location_id=branch_location_id,
        metadata=metadata,
    )
    await entry.insert()
    return entry


async def _build_name_maps(entries: list[AuditLog]) -> tuple[dict[str, str], dict[str, str]]:
    """Collect all employee_id and project_id references from audit values and resolve to names."""
    emp_ids: set[str] = set()
    proj_ids: set[str] = set()

    for e in entries:
        for val in (e.old_value, e.new_value):
            if not val:
                continue
            if "employee_id" in val and ObjectId.is_valid(val["employee_id"]):
                emp_ids.add(val["employee_id"])
            if "project_id" in val and ObjectId.is_valid(val["project_id"]):
                proj_ids.add(val["project_id"])
        # Also check entity_id for Employee/Project entity types
        if e.entity_type in ("Employee",) and ObjectId.is_valid(e.entity_id):
            emp_ids.add(e.entity_id)
        if e.entity_type in ("Project",) and ObjectId.is_valid(e.entity_id):
            proj_ids.add(e.entity_id)

    emp_map: dict[str, str] = {}
    proj_map: dict[str, str] = {}

    if emp_ids:
        emps = await Employee.find(
            {"_id": {"$in": [ObjectId(eid) for eid in emp_ids]}}
        ).to_list()
        emp_map = {str(emp.id): emp.name for emp in emps}

    if proj_ids:
        projs = await Project.find(
            {"_id": {"$in": [ObjectId(pid) for pid in proj_ids]}}
        ).to_list()
        proj_map = {str(p.id): p.name for p in projs}

    return emp_map, proj_map


def _humanize_value(val: dict, emp_map: dict[str, str], proj_map: dict[str, str]) -> dict:
    """Replace raw IDs with human-readable names and use friendly field labels."""
    result: dict[str, str] = {}
    for key, v in val.items():
        label = FIELD_LABELS.get(key, key.replace("_", " ").title())
        if key == "employee_id" and isinstance(v, str) and v in emp_map:
            result[label] = emp_map[v]
        elif key == "project_id" and isinstance(v, str) and v in proj_map:
            result[label] = proj_map[v]
        elif isinstance(v, bool):
            result[label] = "Yes" if v else "No"
        else:
            result[label] = str(v) if v is not None else "—"
    return result


def _build_description(
    entry: AuditLog, emp_map: dict[str, str], proj_map: dict[str, str]
) -> str:
    entity_label = ENTITY_LABELS.get(entry.entity_type, entry.entity_type)
    nv = entry.new_value or {}
    ov = entry.old_value or {}

    # Try to find a human-readable subject name
    subject = (
        nv.get("name")
        or nv.get("employee_name")
        or nv.get("project_name")
        or ov.get("name")
        or ov.get("employee_name")
        or ov.get("project_name")
        or ""
    )
    # Resolve employee/project references for the subject
    if not subject:
        eid = nv.get("employee_id") or ov.get("employee_id") or ""
        if eid and eid in emp_map:
            subject = emp_map[eid]
    if not subject:
        pid = nv.get("project_id") or ov.get("project_id") or ""
        if pid and pid in proj_map:
            subject = proj_map[pid]
    # Resolve entity_id for Employee/Project
    if not subject and entry.entity_type == "Employee" and entry.entity_id in emp_map:
        subject = emp_map[entry.entity_id]
    if not subject and entry.entity_type == "Project" and entry.entity_id in proj_map:
        subject = proj_map[entry.entity_id]

    if entry.action == "CREATE":
        if entry.entity_type == "TimesheetEntry":
            period = nv.get("period", "")
            hours = nv.get("hours", "")
            return f"Timesheet entry logged: {hours}h for {period}" if hours else f"New timesheet entry for {period}"
        return f"New {entity_label.lower()} created{': ' + subject if subject else ''}"
    elif entry.action == "ASSIGN":
        emp_name = emp_map.get(nv.get("employee_id", ""), "an employee")
        proj_name = proj_map.get(nv.get("project_id", ""), "a project")
        role = nv.get("role_in_project") or nv.get("role") or "member"
        return f"{emp_name} assigned to {proj_name} as {role}"
    elif entry.action == "UPDATE":
        return f"{entity_label} updated{': ' + subject if subject else ''}"
    elif entry.action == "DELETE":
        return f"{entity_label} removed{': ' + subject if subject else ''}"
    elif entry.action == "IMPORT":
        return f"Bulk import of {entity_label.lower()} data"
    elif entry.action == "SYNC":
        sync_type = nv.get("integration_type", "")
        sync_name = nv.get("name", "")
        sync_status = nv.get("status", "completed")
        records = nv.get("records_processed", "")
        if sync_type:
            label = f"{sync_type} sync"
            if sync_name:
                label = f"{sync_type} sync ({sync_name})"
            status_text = "completed" if sync_status == "completed" else f"failed"
            suffix = f" — {records} records" if records else ""
            return f"{label} {status_text}{suffix}"
        return f"Sync completed for {entity_label.lower()}"
    elif entry.action == "EXPORT":
        return f"{entity_label} data exported"
    elif entry.action == "UPLOAD":
        return f"File uploaded for {entity_label.lower()}"
    elif entry.action == "SKILL_TAG":
        skill = nv.get("skill_name", "")
        return f"Skill '{skill}' tagged{' on ' + subject if subject else ''}" if skill else f"Skill tagged{' on ' + subject if subject else ''}"
    elif entry.action == "APPROVE":
        return f"{entity_label} approved{': ' + subject if subject else ''}"
    elif entry.action == "REJECT":
        return f"{entity_label} rejected{': ' + subject if subject else ''}"
    elif entry.action == "LOCK":
        return f"Period lock toggled for {entity_label.lower()}"
    elif entry.action == "COMPUTE":
        return f"Utilisation computed"
    return f"{entry.action.capitalize()} on {entity_label.lower()}"


async def get_audit_log(
    location_id: str,
    page: int = 1,
    page_size: int = 50,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
):
    filters: list = [{"$or": [
        {"branch_location_id": location_id},
        {"entity_type": "Integration", "action": "SYNC"},
    ]}]

    if action:
        filters.append(AuditLog.action == action)
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if date_from:
        filters.append(AuditLog.timestamp >= datetime.fromisoformat(date_from))
    if date_to:
        filters.append(AuditLog.timestamp <= datetime.fromisoformat(date_to + "T23:59:59"))

    # If search is provided, we need to resolve names first then filter,
    # so we query a larger set, enrich, filter, then paginate.
    if search:
        return await _search_audit_log(filters, search, page, page_size)

    skip = (page - 1) * page_size

    total = await AuditLog.find(*filters).count()
    entries = await AuditLog.find(*filters).sort(-AuditLog.timestamp).skip(skip).limit(page_size).to_list()

    result = await _enrich_entries(entries)

    return {
        "entries": result,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def _enrich_entries(entries: list[AuditLog]) -> list[dict]:
    """Resolve names and humanize audit entries."""
    if not entries:
        return []

    # Resolve user names
    user_ids = {e.changed_by for e in entries}
    users = await User.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]}}).to_list()
    user_map = {str(u.id): u.name for u in users}

    # Resolve employee/project names for values
    emp_map, proj_map = await _build_name_maps(entries)

    result = []
    for entry in entries:
        desc = _build_description(entry, emp_map, proj_map)
        entity_label = ENTITY_LABELS.get(entry.entity_type, entry.entity_type)

        old_val = _humanize_value(entry.old_value, emp_map, proj_map) if entry.old_value else None
        new_val = _humanize_value(entry.new_value, emp_map, proj_map) if entry.new_value else None

        item = {
            "id": str(entry.id),
            "action": entry.action,
            "entity_type": entry.entity_type,
            "entity_label": entity_label,
            "entity_id": entry.entity_id,
            "changed_by": entry.changed_by,
            "changed_by_name": user_map.get(entry.changed_by, "System"),
            "timestamp": entry.timestamp.isoformat(),
            "old_value": old_val,
            "new_value": new_val,
            "description": desc,
        }
        if entry.metadata:
            item["metadata"] = entry.metadata
        result.append(item)

    return result


async def _search_audit_log(
    filters: list, search: str, page: int, page_size: int
) -> dict:
    """Fetch all matching entries, enrich, then filter by search and paginate."""
    # Cap at 5000 to avoid memory issues
    all_entries = await AuditLog.find(*filters).sort(-AuditLog.timestamp).limit(5000).to_list()
    enriched = await _enrich_entries(all_entries)

    search_lower = search.lower()

    def _matches(r: dict) -> bool:
        # Search in description, user name, entity label, action
        if search_lower in r["description"].lower():
            return True
        if search_lower in r.get("changed_by_name", "").lower():
            return True
        if search_lower in r.get("entity_label", "").lower():
            return True
        if search_lower in r.get("action", "").lower():
            return True
        # Search in old_value / new_value fields
        for val in (r.get("old_value"), r.get("new_value")):
            if val:
                for k, v in val.items():
                    if search_lower in str(k).lower() or search_lower in str(v).lower():
                        return True
        return False

    filtered = [r for r in enriched if _matches(r)]

    total = len(filtered)
    skip = (page - 1) * page_size
    page_entries = filtered[skip : skip + page_size]

    return {
        "entries": page_entries,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_audit_stats(location_id: str):
    """Return action-type counts for the last 7 days."""
    since = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    since = since - timedelta(days=7)

    entries = await AuditLog.find(
        {"$or": [
            {"branch_location_id": location_id},
            {"entity_type": "Integration", "action": "SYNC"},
        ]},
        AuditLog.timestamp >= since,
    ).to_list()

    action_counts: dict[str, int] = {}
    entity_counts: dict[str, int] = {}
    for e in entries:
        action_counts[e.action] = action_counts.get(e.action, 0) + 1
        entity_counts[e.entity_type] = entity_counts.get(e.entity_type, 0) + 1

    return {
        "period": "last_7_days",
        "total_events": len(entries),
        "by_action": action_counts,
        "by_entity": entity_counts,
    }
