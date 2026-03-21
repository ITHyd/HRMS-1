from collections import defaultdict
from typing import Iterable, Optional

from app.models.timesheet_entry import TimesheetEntry


async def get_effective_timesheet_entries(
    *,
    period: str,
    branch_location_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    employee_ids: Optional[Iterable[str]] = None,
    project_id: Optional[str] = None,
    project_ids: Optional[Iterable[str]] = None,
) -> list[TimesheetEntry]:
    """
    Canonical source for realised billable work.

    Billable hours must always be derived from local timesheet rows for the
    period, excluding rejected and soft-deleted entries.
    """
    filters: list = [
        TimesheetEntry.period == period,
        TimesheetEntry.status != "rejected",
        TimesheetEntry.is_deleted != True,
    ]

    if branch_location_id:
        filters.append(TimesheetEntry.branch_location_id == branch_location_id)
    if employee_id:
        filters.append(TimesheetEntry.employee_id == employee_id)

    employee_ids_list = list(employee_ids or [])
    if employee_ids is not None and not employee_ids_list:
        return []
    if employee_ids_list:
        filters.append({"employee_id": {"$in": employee_ids_list}})

    if project_id:
        filters.append(TimesheetEntry.project_id == project_id)

    project_ids_list = list(project_ids or [])
    if project_ids is not None and not project_ids_list:
        return []
    if project_ids_list:
        filters.append({"project_id": {"$in": project_ids_list}})

    return await TimesheetEntry.find(*filters).to_list()


def summarise_hours(entries: Iterable[TimesheetEntry]) -> dict[str, float]:
    total = 0.0
    billable = 0.0
    non_billable = 0.0

    for entry in entries:
        hours = float(entry.hours or 0.0)
        total += hours
        if entry.is_billable:
            billable += hours
        else:
            non_billable += hours

    return {
        "total": total,
        "billable": billable,
        "non_billable": non_billable,
    }


def summarise_hours_by_employee(
    entries: Iterable[TimesheetEntry],
) -> dict[str, dict[str, float]]:
    totals: dict[str, dict[str, float]] = defaultdict(
        lambda: {"total": 0.0, "billable": 0.0, "non_billable": 0.0}
    )

    for entry in entries:
        employee_totals = totals[entry.employee_id]
        hours = float(entry.hours or 0.0)
        employee_totals["total"] += hours
        if entry.is_billable:
            employee_totals["billable"] += hours
        else:
            employee_totals["non_billable"] += hours

    return dict(totals)


def summarise_hours_by_employee_project(
    entries: Iterable[TimesheetEntry],
) -> dict[str, dict[str, dict[str, float]]]:
    totals: dict[str, dict[str, dict[str, float]]] = defaultdict(
        lambda: defaultdict(lambda: {"total": 0.0, "billable": 0.0, "non_billable": 0.0})
    )

    for entry in entries:
        project_totals = totals[entry.employee_id][entry.project_id]
        hours = float(entry.hours or 0.0)
        project_totals["total"] += hours
        if entry.is_billable:
            project_totals["billable"] += hours
        else:
            project_totals["non_billable"] += hours

    return {
        employee_id: dict(projects)
        for employee_id, projects in totals.items()
    }
