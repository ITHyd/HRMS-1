import calendar
from datetime import datetime, timezone
from typing import Optional

from app.models.capacity_config import CapacityConfig
from app.models.employee import Employee
from app.models.employee_capacity_override import EmployeeCapacityOverride
from app.models.finance_billable import FinanceBillable
from app.models.utilisation_snapshot import UtilisationSnapshot
from app.schemas.utilisation import (
    UtilisationSnapshotResponse,
    UtilisationSummary,
)
from app.services import audit_service
from app.services.billable_hours_service import (
    get_effective_timesheet_entries,
    summarise_hours_by_employee,
)


async def get_or_create_capacity_config(branch_location_id: str) -> CapacityConfig:
    """Returns existing CapacityConfig for the branch or creates a default one."""
    config = await CapacityConfig.find_one(
        CapacityConfig.branch_location_id == branch_location_id
    )
    if config:
        return config

    config = CapacityConfig(
        branch_location_id=branch_location_id,
        standard_hours_per_week=40.0,
        standard_hours_per_day=8.0,
        working_days_per_week=5,
        bench_threshold_percent=30.0,
        partial_billing_threshold=70.0,
        effective_from=datetime.now(timezone.utc),
        created_by="system",
        updated_at=datetime.now(timezone.utc),
    )
    await config.insert()
    return config


async def update_capacity_config(
    branch_location_id: str,
    data: dict,
    user,
) -> CapacityConfig:
    """Updates the capacity config for a branch and writes an audit log entry."""
    config = await get_or_create_capacity_config(branch_location_id)

    old_value = {
        "standard_hours_per_week": config.standard_hours_per_week,
        "standard_hours_per_day": config.standard_hours_per_day,
        "working_days_per_week": config.working_days_per_week,
        "bench_threshold_percent": config.bench_threshold_percent,
        "partial_billing_threshold": config.partial_billing_threshold,
    }

    for field, value in data.items():
        if value is not None and hasattr(config, field):
            setattr(config, field, value)

    config.updated_at = datetime.now(timezone.utc)
    await config.save()

    new_value = {
        "standard_hours_per_week": config.standard_hours_per_week,
        "standard_hours_per_day": config.standard_hours_per_day,
        "working_days_per_week": config.working_days_per_week,
        "bench_threshold_percent": config.bench_threshold_percent,
        "partial_billing_threshold": config.partial_billing_threshold,
    }

    await audit_service.log_change(
        action="UPDATE",
        entity_type="capacity_config",
        entity_id=str(config.id),
        changed_by=user.user_id,
        branch_location_id=branch_location_id,
        old_value=old_value,
        new_value=new_value,
    )

    return config


async def create_employee_override(data: dict, user) -> EmployeeCapacityOverride:
    """Creates an EmployeeCapacityOverride record."""
    override = EmployeeCapacityOverride(
        employee_id=data["employee_id"],
        branch_location_id=user.branch_location_id,
        custom_hours_per_week=data["custom_hours_per_week"],
        reason=data.get("reason"),
        effective_from=data["effective_from"],
        effective_to=data.get("effective_to"),
        created_by=user.user_id,
    )
    await override.insert()

    await audit_service.log_change(
        action="CREATE",
        entity_type="employee_capacity_override",
        entity_id=str(override.id),
        changed_by=user.user_id,
        branch_location_id=user.branch_location_id,
        new_value={
            "employee_id": override.employee_id,
            "custom_hours_per_week": override.custom_hours_per_week,
            "reason": override.reason,
        },
    )

    return override


async def get_overrides(branch_location_id: str) -> list[EmployeeCapacityOverride]:
    """List all capacity overrides for a branch."""
    return await EmployeeCapacityOverride.find(
        EmployeeCapacityOverride.branch_location_id == branch_location_id
    ).sort(-EmployeeCapacityOverride.effective_from).to_list()


async def get_employee_capacity(
    employee_id: str,
    period: str,
    branch_location_id: str,
) -> float:
    """
    Returns capacity hours for an employee in a given period (YYYY-MM).

    Checks for an active override first; falls back to the branch config.
    Capacity = hours_per_week * weeks_in_month (from calendar.monthrange).
    """
    year, month = int(period[:4]), int(period[5:7])
    _, days_in_month = calendar.monthrange(year, month)

    # Check for an active override
    override = await EmployeeCapacityOverride.find_one(
        EmployeeCapacityOverride.employee_id == employee_id,
        EmployeeCapacityOverride.branch_location_id == branch_location_id,
        EmployeeCapacityOverride.effective_from <= datetime(year, month, 1, tzinfo=timezone.utc),
        {
            "$or": [
                {"effective_to": None},
                {"effective_to": {"$gte": datetime(year, month, days_in_month, 23, 59, 59, tzinfo=timezone.utc)}},
            ]
        },
    )

    if override:
        hours_per_week = override.custom_hours_per_week
    else:
        config = await get_or_create_capacity_config(branch_location_id)
        hours_per_week = config.standard_hours_per_week

    weeks_in_month = days_in_month / 7.0
    return round(hours_per_week * weeks_in_month, 2)


async def compute_utilisation(
    period: str,
    branch_location_id: str,
) -> UtilisationSummary:
    """
    Core utilisation computation.

    For every active employee in the branch:
    - Aggregate TimesheetEntry records for the period (excluding rejected).
    - Calculate total, billable, and non-billable hours.
    - Derive utilisation and billable percentages from capacity.
    - Classify each employee.
    - Cross-reference FinanceBillable if available.
    - Upsert UtilisationSnapshot (delete old + insert new).
    - Return an aggregated UtilisationSummary.
    """
    config = await get_or_create_capacity_config(branch_location_id)

    # Fetch active employees in this branch (exclude corporate-level roles)
    CORPORATE_LEVELS = {"c-suite", "vp"}
    employees = await Employee.find(
        Employee.location_id == branch_location_id,
        Employee.is_active == True,
        {"level": {"$nin": list(CORPORATE_LEVELS)}},
    ).to_list()

    if not employees:
        return UtilisationSummary(
            period=period,
            total_employees=0,
            fully_billed_count=0,
            partially_billed_count=0,
            bench_count=0,
            average_utilisation=0.0,
            average_billable_percent=0.0,
            snapshots=[],
        )

    employee_ids = [str(e.id) for e in employees]
    emp_map = {str(e.id): e for e in employees}

    # Canonical realised-hours source:
    # SUM(timesheet_entries.hours) for the period where is_billable=True,
    # status != rejected, and the row has not been soft-deleted.
    entries = await get_effective_timesheet_entries(
        period=period,
        branch_location_id=branch_location_id,
        employee_ids=employee_ids,
    )
    hours_by_emp = summarise_hours_by_employee(entries)

    # Fetch finance billable records for cross-reference
    finance_records = await FinanceBillable.find(
        FinanceBillable.branch_location_id == branch_location_id,
        FinanceBillable.period == period,
    ).to_list()
    finance_map: dict[str, str] = {}
    for fr in finance_records:
        finance_map[fr.employee_id] = fr.billable_status

    # Batch-fetch all capacity overrides for these employees in this period
    year, month = int(period[:4]), int(period[5:7])
    _, days_in_month = calendar.monthrange(year, month)
    period_start = datetime(year, month, 1, tzinfo=timezone.utc)
    period_end = datetime(year, month, days_in_month, 23, 59, 59, tzinfo=timezone.utc)

    overrides = await EmployeeCapacityOverride.find(
        {"employee_id": {"$in": employee_ids}},
        EmployeeCapacityOverride.branch_location_id == branch_location_id,
        EmployeeCapacityOverride.effective_from <= period_start,
        {
            "$or": [
                {"effective_to": None},
                {"effective_to": {"$gte": period_end}},
            ]
        },
    ).to_list()
    override_map = {o.employee_id: o.custom_hours_per_week for o in overrides}

    default_hours_per_week = config.standard_hours_per_week
    weeks_in_month = days_in_month / 7.0

    # Build snapshots
    snapshots: list[UtilisationSnapshot] = []
    snapshot_responses: list[UtilisationSnapshotResponse] = []

    fully_billed_count = 0
    partially_billed_count = 0
    bench_count = 0
    total_util = 0.0
    total_billable_pct = 0.0

    now = datetime.now(timezone.utc)

    for eid in employee_ids:
        emp = emp_map[eid]
        emp_hours = hours_by_emp.get(eid, {"total": 0.0, "billable": 0.0, "non_billable": 0.0})
        total_hours = emp_hours["total"]
        billable_hours = emp_hours["billable"]
        non_billable_hours = emp_hours["non_billable"]

        hours_per_week = override_map.get(eid, default_hours_per_week)
        capacity = round(hours_per_week * weeks_in_month, 2)

        utilisation_percent = (total_hours / capacity * 100) if capacity > 0 else 0.0
        billable_percent = (billable_hours / capacity * 100) if capacity > 0 else 0.0

        # Classification is based only on realised billable work for the period.
        # Allocation percentages are display-only and are not used here.
        if billable_hours <= 0:
            classification = "bench"
            bench_count += 1
        elif billable_percent >= config.partial_billing_threshold:
            classification = "fully_billed"
            fully_billed_count += 1
        else:
            classification = "partially_billed"
            partially_billed_count += 1

        total_util += utilisation_percent
        total_billable_pct += billable_percent

        finance_status = finance_map.get(eid)

        snapshot = UtilisationSnapshot(
            employee_id=eid,
            employee_name=emp.name,
            employee_level=emp.level,
            period=period,
            branch_location_id=branch_location_id,
            total_hours_logged=round(total_hours, 2),
            billable_hours=round(billable_hours, 2),
            non_billable_hours=round(non_billable_hours, 2),
            capacity_hours=capacity,
            utilisation_percent=round(utilisation_percent, 2),
            billable_percent=round(billable_percent, 2),
            classification=classification,
            finance_billable_status=finance_status,
            computed_at=now,
        )
        snapshots.append(snapshot)

        snapshot_responses.append(
            UtilisationSnapshotResponse(
                employee_id=eid,
                employee_name=emp.name,
                period=period,
                total_hours_logged=round(total_hours, 2),
                billable_hours=round(billable_hours, 2),
                non_billable_hours=round(non_billable_hours, 2),
                capacity_hours=capacity,
                utilisation_percent=round(utilisation_percent, 2),
                billable_percent=round(billable_percent, 2),
                classification=classification,
                finance_billable_status=finance_status,
            )
        )

    # Upsert: delete old snapshots for this branch+period, then insert new ones
    await UtilisationSnapshot.find(
        UtilisationSnapshot.branch_location_id == branch_location_id,
        UtilisationSnapshot.period == period,
    ).delete()

    if snapshots:
        await UtilisationSnapshot.insert_many(snapshots)

    total_emp = len(employee_ids)
    avg_util = round(total_util / total_emp, 2) if total_emp > 0 else 0.0
    avg_billable = round(total_billable_pct / total_emp, 2) if total_emp > 0 else 0.0

    return UtilisationSummary(
        period=period,
        total_employees=total_emp,
        fully_billed_count=fully_billed_count,
        partially_billed_count=partially_billed_count,
        bench_count=bench_count,
        average_utilisation=avg_util,
        average_billable_percent=avg_billable,
        snapshots=snapshot_responses,
    )


async def get_cached_utilisation(
    period: str,
    branch_location_id: str,
) -> Optional[UtilisationSummary]:
    """Read utilisation data from UtilisationSnapshot without recomputing."""
    snapshots = await UtilisationSnapshot.find(
        UtilisationSnapshot.branch_location_id == branch_location_id,
        UtilisationSnapshot.period == period,
    ).to_list()

    if not snapshots:
        return None

    fully_billed_count = 0
    partially_billed_count = 0
    bench_count = 0
    total_util = 0.0
    total_billable_pct = 0.0

    snapshot_responses: list[UtilisationSnapshotResponse] = []

    for s in snapshots:
        if s.classification == "fully_billed":
            fully_billed_count += 1
        elif s.classification == "partially_billed":
            partially_billed_count += 1
        else:
            bench_count += 1

        total_util += s.utilisation_percent
        total_billable_pct += s.billable_percent

        snapshot_responses.append(
            UtilisationSnapshotResponse(
                employee_id=s.employee_id,
                employee_name=s.employee_name,
                period=s.period,
                total_hours_logged=s.total_hours_logged,
                billable_hours=s.billable_hours,
                non_billable_hours=s.non_billable_hours,
                capacity_hours=s.capacity_hours,
                utilisation_percent=s.utilisation_percent,
                billable_percent=s.billable_percent,
                classification=s.classification,
                finance_billable_status=s.finance_billable_status,
            )
        )

    total_emp = len(snapshots)
    return UtilisationSummary(
        period=period,
        total_employees=total_emp,
        fully_billed_count=fully_billed_count,
        partially_billed_count=partially_billed_count,
        bench_count=bench_count,
        average_utilisation=round(total_util / total_emp, 2) if total_emp > 0 else 0.0,
        average_billable_percent=round(total_billable_pct / total_emp, 2) if total_emp > 0 else 0.0,
        snapshots=snapshot_responses,
    )
