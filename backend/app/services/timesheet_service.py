from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from calendar import monthrange

from app.models.employee import Employee
from app.models.hrms_holiday import HrmsHoliday
from app.models.project import Project
from app.models.timesheet_edit_history import TimesheetEditHistory
from app.models.timesheet_entry import TimesheetEntry
from app.models.timesheet_period_lock import TimesheetPeriodLock
from app.models.user import User
from app.services import audit_service


async def create_entry(data: dict, user) -> dict:
    """Create a new timesheet entry. Validates that the period is not locked."""
    period = data["date"].strftime("%Y-%m")
    branch_location_id = user.branch_location_id

    lock = await _get_period_lock(period, branch_location_id)
    if lock and lock.is_locked:
        raise ValueError(f"Period {period} is locked for this branch")

    now = datetime.now(timezone.utc)

    entry = TimesheetEntry(
        employee_id=data["employee_id"],
        project_id=data["project_id"],
        date=data["date"],
        hours=data["hours"],
        is_billable=data.get("is_billable", True),
        description=data.get("description"),
        status="draft",
        source="manual",
        period=period,
        branch_location_id=branch_location_id,
        created_at=now,
        updated_at=now,
    )
    await entry.insert()

    await audit_service.log_change(
        action="CREATE",
        entity_type="TimesheetEntry",
        entity_id=str(entry.id),
        changed_by=user.user_id,
        branch_location_id=branch_location_id,
        new_value={
            "employee_id": entry.employee_id,
            "project_id": entry.project_id,
            "date": str(entry.date),
            "hours": entry.hours,
            "period": period,
        },
    )

    return await _enrich_entry(entry)


async def update_entry(entry_id: str, data: dict, user) -> dict:
    """Update a draft or rejected timesheet entry. Logs field changes to edit history."""
    entry = await TimesheetEntry.get(entry_id)
    if not entry:
        raise ValueError("Timesheet entry not found")

    if entry.branch_location_id != user.branch_location_id:
        raise ValueError("Entry does not belong to your branch")

    if entry.status not in ("draft", "rejected"):
        raise ValueError(f"Cannot edit entry with status '{entry.status}'. Only draft or rejected entries can be edited.")

    now = datetime.now(timezone.utc)
    changes = {}

    for field in ("hours", "is_billable", "description", "project_id"):
        if field in data and data[field] is not None:
            old_value = getattr(entry, field)
            new_value = data[field]
            if old_value != new_value:
                changes[field] = (old_value, new_value)
                setattr(entry, field, new_value)

    if not changes:
        return await _enrich_entry(entry)

    entry.updated_at = now

    # If entry was rejected and is being edited, reset to draft
    if entry.status == "rejected":
        changes["status"] = (entry.status, "draft")
        entry.status = "draft"
        entry.rejection_reason = None

    await entry.save()

    # Log each field change to edit history
    for field_name, (old_val, new_val) in changes.items():
        history = TimesheetEditHistory(
            timesheet_entry_id=str(entry.id),
            changed_by=user.user_id,
            changed_at=now,
            field_changed=field_name,
            old_value=str(old_val) if old_val is not None else None,
            new_value=str(new_val) if new_val is not None else None,
        )
        await history.insert()

    await audit_service.log_change(
        action="UPDATE",
        entity_type="TimesheetEntry",
        entity_id=str(entry.id),
        changed_by=user.user_id,
        branch_location_id=user.branch_location_id,
        old_value={k: str(v[0]) for k, v in changes.items()},
        new_value={k: str(v[1]) for k, v in changes.items()},
    )

    return await _enrich_entry(entry)


async def delete_entry(entry_id: str, user) -> dict:
    """Delete a draft timesheet entry."""
    entry = await TimesheetEntry.get(entry_id)
    if not entry:
        raise ValueError("Timesheet entry not found")

    if entry.branch_location_id != user.branch_location_id:
        raise ValueError("Entry does not belong to your branch")

    if entry.status != "draft":
        raise ValueError(f"Cannot delete entry with status '{entry.status}'. Only draft entries can be deleted.")

    await entry.delete()

    await audit_service.log_change(
        action="DELETE",
        entity_type="TimesheetEntry",
        entity_id=entry_id,
        changed_by=user.user_id,
        branch_location_id=user.branch_location_id,
        old_value={
            "employee_id": entry.employee_id,
            "project_id": entry.project_id,
            "date": str(entry.date),
            "hours": entry.hours,
        },
    )

    return {"deleted": True, "id": entry_id}


async def list_entries(
    employee_id: Optional[str] = None,
    project_id: Optional[str] = None,
    period: Optional[str] = None,
    status: Optional[str] = None,
    is_billable: Optional[bool] = None,
    branch_location_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """Paginated listing of timesheet entries with employee and project name lookups."""
    filters = {}

    if branch_location_id:
        filters["branch_location_id"] = branch_location_id
    if employee_id:
        filters["employee_id"] = employee_id
    if project_id:
        filters["project_id"] = project_id
    if period:
        filters["period"] = period
    if status:
        filters["status"] = status
    if is_billable is not None:
        filters["is_billable"] = is_billable

    skip = (page - 1) * page_size

    entries = await TimesheetEntry.find(
        filters
    ).sort(-TimesheetEntry.date).skip(skip).limit(page_size).to_list()

    total = await TimesheetEntry.find(filters).count()

    # Batch lookup employee and project names
    employee_ids = list({e.employee_id for e in entries})
    project_ids = list({e.project_id for e in entries})

    employees = await Employee.find(
        {"_id": {"$in": [ObjectId(eid) for eid in employee_ids if ObjectId.is_valid(eid)]}}
    ).to_list()
    emp_map = {str(e.id): e.name for e in employees}

    projects = await Project.find(
        {"_id": {"$in": [ObjectId(pid) for pid in project_ids if ObjectId.is_valid(pid)]}}
    ).to_list()
    proj_map = {str(p.id): p.name for p in projects}

    result = []
    for entry in entries:
        result.append({
            "id": str(entry.id),
            "employee_id": entry.employee_id,
            "employee_name": emp_map.get(entry.employee_id, "Unknown"),
            "project_id": entry.project_id,
            "project_name": proj_map.get(entry.project_id, "Unknown"),
            "date": entry.date,
            "hours": entry.hours,
            "is_billable": entry.is_billable,
            "description": entry.description,
            "status": entry.status,
            "source": entry.source,
            "period": entry.period,
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
        })

    # Check period lock status
    is_locked = False
    if period and branch_location_id:
        lock = await _get_period_lock(period, branch_location_id)
        is_locked = lock.is_locked if lock else False

    # If no entries found, find the latest period that has data for this branch
    latest_period = None
    if total == 0 and branch_location_id:
        latest_entry = await TimesheetEntry.find(
            {"branch_location_id": branch_location_id}
        ).sort(-TimesheetEntry.period).limit(1).to_list()
        if latest_entry:
            latest_period = latest_entry[0].period

    # Compute summary stats across ALL matching entries (not just paginated page)
    # Use aggregation pipeline for efficiency
    base_filters = {}
    if branch_location_id:
        base_filters["branch_location_id"] = branch_location_id
    if period:
        base_filters["period"] = period

    all_period_entries = await TimesheetEntry.find(base_filters).to_list()
    total_hours = sum(e.hours for e in all_period_entries)
    billable_hours = sum(e.hours for e in all_period_entries if e.is_billable)
    unique_employees = len({e.employee_id for e in all_period_entries})
    unique_projects = len({e.project_id for e in all_period_entries})

    # Billable vs non-billable employee counts
    billable_emp_ids = {e.employee_id for e in all_period_entries if e.is_billable}
    non_billable_emp_ids = {e.employee_id for e in all_period_entries if not e.is_billable} - billable_emp_ids

    # Build filter options (distinct employees and projects for dropdowns)
    filter_emp_ids = list({e.employee_id for e in all_period_entries})
    filter_proj_ids = list({e.project_id for e in all_period_entries})
    filter_employees = await Employee.find(
        {"_id": {"$in": [ObjectId(eid) for eid in filter_emp_ids if ObjectId.is_valid(eid)]}}
    ).to_list() if filter_emp_ids else []
    filter_projects = await Project.find(
        {"_id": {"$in": [ObjectId(pid) for pid in filter_proj_ids if ObjectId.is_valid(pid)]}}
    ).to_list() if filter_proj_ids else []

    return {
        "entries": result,
        "total": total,
        "period": period or "",
        "is_locked": is_locked,
        "latest_period": latest_period,
        "summary": {
            "total_hours": round(total_hours, 1),
            "billable_hours": round(billable_hours, 1),
            "billable_percent": round((billable_hours / total_hours * 100) if total_hours > 0 else 0, 1),
            "employee_count": unique_employees,
            "project_count": unique_projects,
            "billable_employee_count": len(billable_emp_ids),
            "non_billable_employee_count": len(non_billable_emp_ids),
        },
        "filter_options": {
            "employees": sorted(
                [{"id": str(e.id), "name": e.name} for e in filter_employees],
                key=lambda x: x["name"],
            ),
            "projects": sorted(
                [{"id": str(p.id), "name": p.name} for p in filter_projects],
                key=lambda x: x["name"],
            ),
        },
    }


async def submit_entries(entry_ids: list[str], user) -> dict:
    """Batch move draft entries to submitted status."""
    now = datetime.now(timezone.utc)
    submitted = []
    errors = []

    for entry_id in entry_ids:
        entry = await TimesheetEntry.get(entry_id)
        if not entry:
            errors.append({"id": entry_id, "error": "Entry not found"})
            continue
        if entry.branch_location_id != user.branch_location_id:
            errors.append({"id": entry_id, "error": "Entry does not belong to your branch"})
            continue
        if entry.status != "draft":
            errors.append({"id": entry_id, "error": f"Entry status is '{entry.status}', expected 'draft'"})
            continue

        # Check period lock
        lock = await _get_period_lock(entry.period, entry.branch_location_id)
        if lock and lock.is_locked:
            errors.append({"id": entry_id, "error": f"Period {entry.period} is locked"})
            continue

        entry.status = "submitted"
        entry.submitted_at = now
        entry.updated_at = now
        await entry.save()
        submitted.append(entry_id)

    if submitted:
        await audit_service.log_change(
            action="UPDATE",
            entity_type="TimesheetEntry",
            entity_id=",".join(submitted),
            changed_by=user.user_id,
            branch_location_id=user.branch_location_id,
            new_value={"status": "submitted", "count": len(submitted)},
        )

    return {"submitted": submitted, "errors": errors}


async def approve_reject_entries(
    entry_ids: list[str],
    action: str,
    rejection_reason: Optional[str],
    user,
) -> dict:
    """Batch approve or reject submitted timesheet entries."""
    if action not in ("approve", "reject"):
        raise ValueError("Action must be 'approve' or 'reject'")

    if action == "reject" and not rejection_reason:
        raise ValueError("Rejection reason is required when rejecting entries")

    now = datetime.now(timezone.utc)
    processed = []
    errors = []

    for entry_id in entry_ids:
        entry = await TimesheetEntry.get(entry_id)
        if not entry:
            errors.append({"id": entry_id, "error": "Entry not found"})
            continue
        if entry.branch_location_id != user.branch_location_id:
            errors.append({"id": entry_id, "error": "Entry does not belong to your branch"})
            continue
        if entry.status != "submitted":
            errors.append({"id": entry_id, "error": f"Entry status is '{entry.status}', expected 'submitted'"})
            continue

        if action == "approve":
            entry.status = "approved"
            entry.approved_by = user.user_id
            entry.approved_at = now
        else:
            entry.status = "rejected"
            entry.rejection_reason = rejection_reason

        entry.updated_at = now
        await entry.save()
        processed.append(entry_id)

    if processed:
        new_status = "approved" if action == "approve" else "rejected"
        await audit_service.log_change(
            action="UPDATE",
            entity_type="TimesheetEntry",
            entity_id=",".join(processed),
            changed_by=user.user_id,
            branch_location_id=user.branch_location_id,
            new_value={"status": new_status, "count": len(processed)},
        )

    return {"processed": processed, "action": action, "errors": errors}


async def get_entry_history(entry_id: str) -> list[dict]:
    """Return the edit history for a timesheet entry."""
    records = await TimesheetEditHistory.find(
        TimesheetEditHistory.timesheet_entry_id == entry_id
    ).sort(-TimesheetEditHistory.changed_at).to_list()

    # Resolve user names for changed_by
    user_ids = list({r.changed_by for r in records})
    users = await User.find(
        {"_id": {"$in": [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]}}
    ).to_list()
    user_map = {str(u.id): u.name for u in users}

    result = []
    for record in records:
        result.append({
            "id": str(record.id),
            "field_changed": record.field_changed,
            "old_value": record.old_value,
            "new_value": record.new_value,
            "changed_by_name": user_map.get(record.changed_by, "Unknown"),
            "changed_at": record.changed_at,
        })

    return result


async def check_period_lock(period: str, branch_location_id: str) -> dict:
    """Return the lock status of a period for a branch."""
    lock = await _get_period_lock(period, branch_location_id)
    return {
        "period": period,
        "branch_location_id": branch_location_id,
        "is_locked": lock.is_locked if lock else False,
        "locked_by": lock.locked_by if lock else None,
        "locked_at": lock.locked_at.isoformat() if lock and lock.locked_at else None,
    }


async def toggle_period_lock(
    period: str,
    branch_location_id: str,
    lock: bool,
    user,
) -> dict:
    """Lock or unlock a timesheet period for a branch."""
    now = datetime.now(timezone.utc)

    existing = await _get_period_lock(period, branch_location_id)

    if existing:
        existing.is_locked = lock
        existing.locked_by = user.user_id if lock else None
        existing.locked_at = now if lock else None
        await existing.save()
    else:
        existing = TimesheetPeriodLock(
            period=period,
            branch_location_id=branch_location_id,
            is_locked=lock,
            locked_by=user.user_id if lock else None,
            locked_at=now if lock else None,
        )
        await existing.insert()

    action_label = "LOCK" if lock else "UNLOCK"
    await audit_service.log_change(
        action=action_label,
        entity_type="TimesheetPeriodLock",
        entity_id=f"{period}_{branch_location_id}",
        changed_by=user.user_id,
        branch_location_id=branch_location_id,
        new_value={"period": period, "is_locked": lock},
    )

    return {
        "period": period,
        "branch_location_id": branch_location_id,
        "is_locked": existing.is_locked,
        "locked_by": existing.locked_by,
        "locked_at": existing.locked_at.isoformat() if existing.locked_at else None,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_period_lock(
    period: str, branch_location_id: str
) -> Optional[TimesheetPeriodLock]:
    """Fetch the period lock document for a given period and branch."""
    return await TimesheetPeriodLock.find_one(
        TimesheetPeriodLock.period == period,
        TimesheetPeriodLock.branch_location_id == branch_location_id,
    )


async def get_workload_heatmap(
    period: str,
    branch_location_id: Optional[str] = None,
) -> dict:
    """Return per-employee, per-day hours grid for the workload heatmap."""
    from datetime import date as date_type

    year, month = int(period[:4]), int(period[5:7])
    _, num_days = monthrange(year, month)

    # All dates in the month
    all_dates = [date_type(year, month, d) for d in range(1, num_days + 1)]

    # Fetch entries for this period (exclude soft-deleted)
    filters: dict = {"period": period, "is_deleted": {"$ne": True}}
    if branch_location_id:
        filters["branch_location_id"] = branch_location_id

    entries = await TimesheetEntry.find(filters).to_list()

    # Fetch holidays for the month
    holidays_raw = await HrmsHoliday.find(
        {"year": year, "is_deleted": {"$ne": True}},
    ).to_list()
    holiday_map: dict[str, str] = {}
    for h in holidays_raw:
        if h.holiday_date.month == month and h.holiday_date.year == year:
            holiday_map[h.holiday_date.isoformat()] = h.holiday_name

    # Build employee lookup
    employee_ids = list({e.employee_id for e in entries})
    employees = await Employee.find(
        {"_id": {"$in": [ObjectId(eid) for eid in employee_ids if ObjectId.is_valid(eid)]}}
    ).to_list() if employee_ids else []
    emp_map = {str(e.id): e.name for e in employees}

    # Build project lookup
    project_ids = list({e.project_id for e in entries})
    projects = await Project.find(
        {"_id": {"$in": [ObjectId(pid) for pid in project_ids if ObjectId.is_valid(pid)]}}
    ).to_list() if project_ids else []
    proj_map = {str(p.id): p.name for p in projects}

    # Aggregate: employee -> date -> {total_hours, billable_hours, projects}
    grid: dict[str, dict[str, dict]] = {}
    for entry in entries:
        eid = entry.employee_id
        d = entry.date.isoformat()
        if eid not in grid:
            grid[eid] = {}
        if d not in grid[eid]:
            grid[eid][d] = {"total_hours": 0.0, "billable_hours": 0.0, "projects": {}}
        cell = grid[eid][d]
        cell["total_hours"] += entry.hours
        if entry.is_billable:
            cell["billable_hours"] += entry.hours
        pname = proj_map.get(entry.project_id, "Unknown")
        cell["projects"][pname] = cell["projects"].get(pname, 0.0) + entry.hours

    # Build response rows sorted by employee name
    rows = []
    billable_emp_set: set[str] = set()
    non_billable_only_emp_set: set[str] = set()
    for eid in sorted(employee_ids, key=lambda x: emp_map.get(x, "ZZZ").lower()):
        emp_grid = grid.get(eid, {})
        total = sum(c["total_hours"] for c in emp_grid.values())
        billable = sum(c["billable_hours"] for c in emp_grid.values())
        if billable > 0:
            billable_emp_set.add(eid)
        else:
            non_billable_only_emp_set.add(eid)
        days = {}
        for dt in all_dates:
            ds = dt.isoformat()
            cell = emp_grid.get(ds)
            if cell:
                days[ds] = {
                    "hours": round(cell["total_hours"], 1),
                    "billable_hours": round(cell["billable_hours"], 1),
                    "projects": {k: round(v, 1) for k, v in cell["projects"].items()},
                }
            else:
                days[ds] = None
        rows.append({
            "employee_id": eid,
            "employee_name": emp_map.get(eid, "Unknown"),
            "total_hours": round(total, 1),
            "billable_hours": round(billable, 1),
            "days": days,
        })

    # Build dates metadata
    dates_meta = []
    for dt in all_dates:
        ds = dt.isoformat()
        dates_meta.append({
            "date": ds,
            "day": dt.day,
            "weekday": dt.strftime("%a"),
            "is_weekend": dt.weekday() >= 5,
            "is_holiday": ds in holiday_map,
            "holiday_name": holiday_map.get(ds),
        })

    return {
        "period": period,
        "dates": dates_meta,
        "employees": rows,
        "summary": {
            "total_employees": len(rows),
            "total_hours": round(sum(r["total_hours"] for r in rows), 1),
            "billable_hours": round(sum(r["billable_hours"] for r in rows), 1),
            "billable_employee_count": len(billable_emp_set),
            "non_billable_employee_count": len(non_billable_only_emp_set),
        },
    }


async def _enrich_entry(entry: TimesheetEntry) -> dict:
    """Attach employee_name and project_name to a single entry for responses."""
    emp = await Employee.get(entry.employee_id)
    proj = await Project.get(entry.project_id)

    return {
        "id": str(entry.id),
        "employee_id": entry.employee_id,
        "employee_name": emp.name if emp else "Unknown",
        "project_id": entry.project_id,
        "project_name": proj.name if proj else "Unknown",
        "date": entry.date,
        "hours": entry.hours,
        "is_billable": entry.is_billable,
        "description": entry.description,
        "status": entry.status,
        "source": entry.source,
        "period": entry.period,
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
    }
