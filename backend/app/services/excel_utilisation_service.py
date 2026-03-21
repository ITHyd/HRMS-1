"""
Service for parsing and storing the Excel utilisation report.

Sheet layout:
  - Row 4 (index 3): header with datetime month columns
  - Row 5+ (index 4+): data rows
  - Col 2: Name, Col 3: Status, Col 4: Business Unit, Col 5: Function,
    Col 6: Practice, Col 7: Sub-Practice
  - Month columns: header cell is a datetime(YYYY, M, 1) object
  - Cell values: 0.0-1.0 fractions where 0 = fully utilised and 1 = fully available

Classification:
  availability 0-30% -> fully_billed
  availability 31-70% -> partially_billed
  availability 71-100% -> bench
"""

import calendar
import io
import re
import secrets
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Callable, Optional
from urllib.parse import unquote

import openpyxl
from bson import ObjectId

from app.models.department import Department
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.employee_skill import EmployeeSkill
from app.models.excel_upload_log import ExcelUploadLog
from app.models.excel_utilisation import ExcelUtilisationReport
from app.models.location import Location
from app.models.project_allocation import ProjectAllocation
from app.models.project import Project
from app.models.reporting_relationship import ReportingRelationship
from app.services.billable_hours_service import (
    get_effective_timesheet_entries,
    summarise_hours_by_employee,
    summarise_hours_by_employee_project,
)

YTPL_SHEET_NAMES = ["Availability Report - YTPL", "Availability Report - NGL"]
EXCEL_TIMESHEET_PROJECT_ID = "excel-utilisation-report"
EXCEL_TIMESHEET_PROJECT_NAME = "Excel Utilisation Report"
EXCEL_EMPLOYEE_PREFIX = "excel:"


def _classify(availability_pct: float) -> str:
    if availability_pct <= 30:
        return "fully_billed"
    if availability_pct <= 70:
        return "partially_billed"
    return "bench"


def _normalise_text(value) -> str:
    return str(value).strip() if value is not None else ""


def _normalise_name(value: str) -> str:
    cleaned = value.lower().strip()
    cleaned = re.sub(r"\s*[-(]?\s*(onsite|offshore)\s*[)]?\s*$", "", cleaned)
    cleaned = re.sub(r"[^a-z0-9]+", "", cleaned)
    return cleaned


def _normalise_employee_key(employee_name: str, employee_id: Optional[str]) -> str:
    if employee_id:
        return f"id:{employee_id}"
    return f"name:{_normalise_name(employee_name)}"


def _excel_employee_ref(employee_name: str) -> str:
    return f"{EXCEL_EMPLOYEE_PREFIX}{employee_name}"


def _decode_excel_employee_ref(employee_ref: str) -> str:
    return unquote(employee_ref[len(EXCEL_EMPLOYEE_PREFIX):]) if employee_ref.startswith(EXCEL_EMPLOYEE_PREFIX) else employee_ref


def _header_period(cell_value) -> Optional[str]:
    if isinstance(cell_value, datetime):
        return f"{cell_value.year:04d}-{cell_value.month:02d}"
    if isinstance(cell_value, date):
        return f"{cell_value.year:04d}-{cell_value.month:02d}"
    return None


def _dedupe_latest_rows(rows: list[ExcelUtilisationReport]) -> list[ExcelUtilisationReport]:
    latest: dict[str, ExcelUtilisationReport] = {}
    for row in rows:
        key = _normalise_employee_key(row.employee_name, row.employee_id)
        if key not in latest or row.uploaded_at > latest[key].uploaded_at:
            latest[key] = row
    return list(latest.values())


async def _get_latest_excel_period(branch_location_id: str) -> Optional[str]:
    latest_period_doc = await ExcelUtilisationReport.find(
        ExcelUtilisationReport.branch_location_id == branch_location_id,
    ).sort(-ExcelUtilisationReport.period).limit(1).to_list()
    return latest_period_doc[0].period if latest_period_doc else None


def _select_sheet(workbook):
    exact_names = {name.strip().lower(): name for name in workbook.sheetnames}
    for preferred_name in YTPL_SHEET_NAMES:
        actual_name = exact_names.get(preferred_name.strip().lower())
        if actual_name:
            return workbook[actual_name]

    for name in workbook.sheetnames:
        if "ytpl" in name.strip().lower():
            return workbook[name]

    for name in workbook.sheetnames:
        lowered = name.strip().lower()
        if "availability" in lowered and "ngl" not in lowered:
            return workbook[name]

    return workbook.active


def _parse_ytpl_sheet(ws) -> tuple[dict[int, str], int]:
    """Find the header row and build a col_index -> YYYY-MM map for month columns."""
    rows = list(ws.iter_rows(values_only=True))
    for row_index, row in enumerate(rows[:15]):
        month_cols: dict[int, str] = {}
        for col_index, cell in enumerate(row):
            period = _header_period(cell)
            if period:
                month_cols[col_index] = period
        if month_cols:
            return month_cols, row_index
    return {}, -1


def _working_days_in_period(period: str) -> int:
    year = int(period[:4])
    month = int(period[5:7])
    _, days_in_month = calendar.monthrange(year, month)
    return sum(1 for day in range(1, days_in_month + 1) if date(year, month, day).weekday() < 5)


def _capacity_hours_for_period(period: str) -> float:
    return round(_working_days_in_period(period) * 8.0, 2)


def _period_date(period: str) -> str:
    return f"{period}-01"


def _period_end_date(period: str) -> str:
    try:
        year, month = int(period[:4]), int(period[5:7])
        last_day = calendar.monthrange(year, month)[1]
        return f"{year:04d}-{month:02d}-{last_day:02d}"
    except Exception:
        return period


def _derived_total_hours(period: str, utilisation_percent: float) -> float:
    return round(_capacity_hours_for_period(period) * utilisation_percent / 100.0, 1)


def _derived_billable_hours(period: str, utilisation_percent: float, classification: str) -> float:
    if classification == "bench":
        return 0.0
    return _derived_total_hours(period, utilisation_percent)


def _build_employee_maps(employees: list[Employee]) -> tuple[dict[str, Employee], dict[str, Employee]]:
    exact: dict[str, Employee] = {}
    normalised: dict[str, Employee] = {}
    for employee in employees:
        exact.setdefault(employee.name.strip().lower(), employee)
        normalised.setdefault(_normalise_name(employee.name), employee)
    return exact, normalised


def _resolve_employee_from_maps(
    employee_name: str,
    exact_map: dict[str, Employee],
    normalised_map: dict[str, Employee],
) -> Optional[Employee]:
    exact_key = employee_name.strip().lower()
    normalised_key = _normalise_name(employee_name)
    return exact_map.get(exact_key) or normalised_map.get(normalised_key)


async def _build_employee_resolver(branch_location_id: str) -> Callable[[str], Optional[Employee]]:
    branch_employees = await Employee.find(
        Employee.location_id == branch_location_id,
        Employee.is_active == True,
    ).to_list()
    branch_exact, branch_normalised = _build_employee_maps(branch_employees)

    def resolve(employee_name: str) -> Optional[Employee]:
        return _resolve_employee_from_maps(
            employee_name,
            branch_exact,
            branch_normalised,
        )

    return resolve


def _build_excel_timesheet_entry(
    row: ExcelUtilisationReport,
    resolved_employee_id: Optional[str],
) -> dict:
    employee_ref = resolved_employee_id or _excel_employee_ref(row.employee_name)
    total_hours = _derived_total_hours(row.period, row.utilisation_percent)
    billable_hours = _derived_billable_hours(row.period, row.utilisation_percent, row.classification)
    return {
        "id": f"excel:{row.period}:{_normalise_employee_key(row.employee_name, resolved_employee_id)}",
        "employee_id": employee_ref,
        "employee_name": row.employee_name,
        "project_id": EXCEL_TIMESHEET_PROJECT_ID,
        "project_name": EXCEL_TIMESHEET_PROJECT_NAME,
        "date": _period_date(row.period),
        "hours": total_hours,
        "is_billable": billable_hours > 0,
        "description": f"Imported monthly utilisation snapshot ({row.utilisation_percent:.1f}% utilised, {row.availability_percent:.1f}% available)",
        "status": "approved",
        "source": "excel_upload",
        "period": row.period,
        "created_at": row.uploaded_at.isoformat(),
        "updated_at": row.uploaded_at.isoformat(),
    }


async def parse_and_store_excel(
    file_content: bytes,
    filename: str,
    branch_location_id: str,
    user_id: str,
) -> dict:
    workbook = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
    sheet = _select_sheet(workbook)
    resolve_employee = await _build_employee_resolver(branch_location_id)

    all_rows = list(sheet.iter_rows(values_only=True))
    month_col_map, header_row_idx = _parse_ytpl_sheet(sheet)

    if not month_col_map:
        return {"error": "No month columns found. Expected datetime headers in the sheet.", "total_rows": 0}

    header = all_rows[header_row_idx]

    name_col = None
    practice_col = None
    function_col = None
    status_col = None

    for col_index, cell in enumerate(header):
        if col_index in month_col_map:
            continue
        value = _normalise_text(cell).lower()
        if value == "name":
            name_col = col_index
        elif value == "practice":
            practice_col = col_index
        elif value == "function":
            function_col = col_index
        elif value == "status":
            status_col = col_index

    if name_col is None:
        name_col = 2
    if practice_col is None:
        practice_col = 6
    if function_col is None:
        function_col = 5
    if status_col is None:
        status_col = 3

    batch_id = secrets.token_hex(8)
    now = datetime.now(timezone.utc)
    periods_found: set[str] = set()
    docs: list[ExcelUtilisationReport] = []
    total_rows = 0
    matched_rows = 0

    for row in all_rows[header_row_idx + 1 :]:
        if not row or len(row) <= name_col:
            continue

        employee_name = _normalise_text(row[name_col])
        if not employee_name or employee_name.lower() in {"name", "total", "grand total"}:
            continue

        if status_col is not None and len(row) > status_col:
            status_value = _normalise_text(row[status_col]).lower()
            if status_value in {"left", "inactive", "resigned", "terminated"}:
                continue

        practice = (
            _normalise_text(row[practice_col])
            if practice_col is not None and len(row) > practice_col and row[practice_col]
            else None
        )
        function_name = (
            _normalise_text(row[function_col])
            if function_col is not None and len(row) > function_col and row[function_col]
            else None
        )
        department = practice or function_name

        resolved_employee = resolve_employee(employee_name)
        employee_id = str(resolved_employee.id) if resolved_employee else None
        total_rows += 1
        if not employee_id:
            continue
        matched_rows += 1

        for col_index, period in month_col_map.items():
            if col_index >= len(row):
                continue
            cell_value = row[col_index]
            if cell_value is None:
                continue

            try:
                availability_fraction = float(cell_value)
            except (TypeError, ValueError):
                continue

            availability_percent = round(max(0.0, min(100.0, availability_fraction * 100)), 2)
            utilisation_percent = round(100.0 - availability_percent, 2)
            periods_found.add(period)

            docs.append(
                ExcelUtilisationReport(
                    branch_location_id=branch_location_id,
                    upload_batch_id=batch_id,
                    uploaded_at=now,
                    uploaded_by=user_id,
                    filename=filename,
                    employee_name=employee_name,
                    employee_email=resolved_employee.email if resolved_employee else None,
                    employee_id=employee_id,
                    department=department,
                    period=period,
                    availability_percent=availability_percent,
                    utilisation_percent=utilisation_percent,
                    classification=_classify(availability_percent),
                )
            )

    periods = sorted(periods_found)
    if docs and periods:
        await ExcelUtilisationReport.find(
            ExcelUtilisationReport.branch_location_id == branch_location_id,
            {"period": {"$in": periods}},
        ).delete()
        await ExcelUtilisationReport.insert_many(docs)

    upload_log = ExcelUploadLog(
        batch_id=batch_id,
        branch_location_id=branch_location_id,
        uploaded_by=user_id,
        filename=filename,
        total_rows=total_rows,
        matched_rows=matched_rows,
        periods=periods,
        uploaded_at=now,
    )
    await upload_log.insert()

    return {
        "batch_id": batch_id,
        "total_rows": total_rows,
        "matched_rows": matched_rows,
        "periods": periods,
        "rows_stored": len(docs),
    }


async def get_excel_dashboard(
    period: str,
    branch_location_id: str,
) -> Optional[dict]:
    rows = await ExcelUtilisationReport.find(
        ExcelUtilisationReport.branch_location_id == branch_location_id,
        ExcelUtilisationReport.period == period,
    ).to_list()

    if not rows:
        return None

    rows = _dedupe_latest_rows(rows)

    total = len(rows)
    fully_billed = sum(1 for row in rows if row.classification == "fully_billed")
    partially_billed = sum(1 for row in rows if row.classification == "partially_billed")
    bench_count = sum(1 for row in rows if row.classification == "bench")
    billable_count = fully_billed + partially_billed

    avg_util = round(sum(row.utilisation_percent for row in rows) / total, 2) if total else 0.0
    avg_avail = round(sum(row.availability_percent for row in rows) / total, 2) if total else 0.0

    classification_breakdown = [
        {
            "classification": "fully_billed",
            "count": fully_billed,
            "percent": round(fully_billed / total * 100, 2) if total else 0,
        },
        {
            "classification": "partially_billed",
            "count": partially_billed,
            "percent": round(partially_billed / total * 100, 2) if total else 0,
        },
        {
            "classification": "bench",
            "count": bench_count,
            "percent": round(bench_count / total * 100, 2) if total else 0,
        },
    ]

    resource_availability = {
        "available": bench_count,
        "fully_allocated": billable_count,
        "over_allocated": 0,
    }

    from app.services.dashboard_service import _previous_periods

    trend_periods = _previous_periods(period, 6)
    trend_rows = await ExcelUtilisationReport.find(
        ExcelUtilisationReport.branch_location_id == branch_location_id,
        {"period": {"$in": trend_periods}},
    ).to_list()

    grouped_rows: dict[str, list[ExcelUtilisationReport]] = defaultdict(list)
    for trend_period in trend_periods:
        grouped_rows[trend_period] = _dedupe_latest_rows(
            [row for row in trend_rows if row.period == trend_period]
        )

    trend = []
    for trend_period in trend_periods:
        group = grouped_rows.get(trend_period, [])
        count = len(group)
        avg_period_util = round(sum(row.utilisation_percent for row in group) / count, 2) if count else 0.0
        trend.append(
            {
                "period": trend_period,
                "headcount": count,
                "utilisation_percent": avg_period_util,
                "billable_percent": avg_period_util,
            }
        )

    return {
        "period": period,
        "data_source": "excel",
        "total_active_employees": total,
        "billable_count": billable_count,
        "non_billable_count": 0,
        "bench_count": bench_count,
        "overall_utilisation_percent": avg_util,
        "overall_billable_percent": round(100 - avg_avail, 2),
        "top_consuming_projects": [],
        "resource_availability": resource_availability,
        "classification_breakdown": classification_breakdown,
        "trend": trend,
    }


async def get_excel_resource_rows(
    period: str,
    branch_location_id: str,
    search: Optional[str] = None,
    classification: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    rows = await ExcelUtilisationReport.find(
        ExcelUtilisationReport.branch_location_id == branch_location_id,
        ExcelUtilisationReport.period == period,
    ).to_list()

    if not rows:
        return {"period": period, "data_source": "excel", "entries": [], "total": 0}

    rows = _dedupe_latest_rows(rows)

    resolve_employee = await _build_employee_resolver(branch_location_id)
    enriched_people = []
    for row in rows:
        resolved_employee = resolve_employee(row.employee_name)
        resolved_employee_id = row.employee_id or (str(resolved_employee.id) if resolved_employee else None)
        enriched_people.append({
            "row": row,
            "resolved_employee": resolved_employee,
            "resolved_employee_id": resolved_employee_id,
            "display_name": resolved_employee.name if resolved_employee else row.employee_name,
            "derived_available_days": round(_working_days_in_period(period) * row.availability_percent / 100, 1),
            "derived_total_hours": _derived_total_hours(period, row.utilisation_percent),
            "derived_billable_hours": _derived_billable_hours(period, row.utilisation_percent, row.classification),
        })

    if classification:
        enriched_people = [person for person in enriched_people if person["row"].classification == classification]

    resolved_employee_ids = [person["resolved_employee_id"] for person in enriched_people if person["resolved_employee_id"]]

    allocations = (
        await ProjectAllocation.find(
            ProjectAllocation.period == period,
            {"employee_id": {"$in": resolved_employee_ids}},
            ProjectAllocation.is_deleted != True,
        ).to_list()
        if resolved_employee_ids
        else []
    )
    allocations_by_employee: dict[str, list[ProjectAllocation]] = defaultdict(list)
    for allocation in allocations:
        allocations_by_employee[allocation.employee_id].append(allocation)

    reporting_relationships = (
        await ReportingRelationship.find(
            {"employee_id": {"$in": resolved_employee_ids}},
            ReportingRelationship.type == "PRIMARY",
            ReportingRelationship.is_deleted != True,
        ).to_list()
        if resolved_employee_ids
        else []
    )
    manager_ids = [relationship.manager_id for relationship in reporting_relationships]
    managers = (
        await Employee.find(
            {"_id": {"$in": [ObjectId(manager_id) for manager_id in manager_ids if ObjectId.is_valid(manager_id)]}}
        ).to_list()
        if manager_ids
        else []
    )
    manager_name_by_id = {str(manager.id): manager.name for manager in managers}
    line_manager_by_employee: dict[str, str] = {}
    for relationship in reporting_relationships:
        line_manager_by_employee[relationship.employee_id] = manager_name_by_id.get(relationship.manager_id, "No Manager")

    effective_timesheet_entries = await get_effective_timesheet_entries(
        period=period,
        employee_ids=resolved_employee_ids if resolved_employee_ids else [],
    )
    employee_project_hours = summarise_hours_by_employee_project(effective_timesheet_entries)
    employee_total_hours = summarise_hours_by_employee(effective_timesheet_entries)

    merged_rows: list[dict] = []
    for person in enriched_people:
        row = person["row"]
        resolved_employee_id = person["resolved_employee_id"]
        employee_ref = resolved_employee_id or _excel_employee_ref(row.employee_name)
        line_manager = line_manager_by_employee.get(resolved_employee_id, "No Manager") if resolved_employee_id else "No Manager"
        row_allocations = allocations_by_employee.get(resolved_employee_id, []) if resolved_employee_id else []

        if row_allocations:
            for allocation in row_allocations:
                project_hours = employee_project_hours.get(resolved_employee_id, {}).get(
                    allocation.project_id,
                    {"billable": 0.0, "non_billable": 0.0},
                )
                merged_rows.append(
                    {
                        "employee_id": employee_ref,
                        "employee_name": person["display_name"],
                        "line_manager": line_manager,
                        "project_name": allocation.project_name,
                        "client_name": allocation.client_name,
                        "department": row.department,
                        "allocation_percentage": allocation.allocation_percentage,
                        "availability_percent": row.availability_percent,
                        "utilisation_percent": row.utilisation_percent,
                        "billable_hours": round(project_hours["billable"], 1),
                        "non_billable_hours": round(project_hours["non_billable"], 1),
                        "classification": row.classification,
                        "available_days": allocation.available_days,
                    }
                )
        else:
            employee_hours = employee_total_hours.get(
                resolved_employee_id,
                {"billable": person["derived_billable_hours"], "non_billable": round(person["derived_total_hours"] - person["derived_billable_hours"], 1)},
            )
            merged_rows.append(
                {
                    "employee_id": employee_ref,
                    "employee_name": person["display_name"],
                    "line_manager": line_manager,
                    "project_name": None,
                    "client_name": None,
                    "department": row.department,
                    "allocation_percentage": round(row.utilisation_percent, 1),
                    "availability_percent": row.availability_percent,
                    "utilisation_percent": row.utilisation_percent,
                    "billable_hours": round(employee_hours["billable"], 1),
                    "non_billable_hours": round(employee_hours["non_billable"], 1),
                    "classification": row.classification,
                    "available_days": person["derived_available_days"],
                }
            )

    if search:
        search_lower = search.lower()
        merged_rows = [
            merged_row
            for merged_row in merged_rows
            if search_lower in merged_row["employee_name"].lower()
            or search_lower in (merged_row["line_manager"] or "").lower()
            or search_lower in (merged_row["project_name"] or "").lower()
            or search_lower in (merged_row["client_name"] or "").lower()
            or search_lower in (merged_row["department"] or "").lower()
        ]

    total = len(merged_rows)
    start = (page - 1) * page_size
    page_rows = merged_rows[start : start + page_size]

    return {"period": period, "data_source": "excel", "entries": page_rows, "total": total}


async def get_excel_timesheets(
    period: str,
    branch_location_id: str,
    employee_id: Optional[str] = None,
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    is_billable: Optional[bool] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    rows = await ExcelUtilisationReport.find(
        ExcelUtilisationReport.branch_location_id == branch_location_id,
        ExcelUtilisationReport.period == period,
    ).to_list()

    deduped_rows = _dedupe_latest_rows(rows)

    resolve_employee = await _build_employee_resolver(branch_location_id)
    all_entries = []
    for row in deduped_rows:
        resolved_employee = resolve_employee(row.employee_name)
        resolved_employee_id = row.employee_id or (str(resolved_employee.id) if resolved_employee else None)
        all_entries.append(_build_excel_timesheet_entry(row, resolved_employee_id))

    if employee_id:
        all_entries = [entry for entry in all_entries if entry["employee_id"] == employee_id]
    if project_id:
        all_entries = [entry for entry in all_entries if entry["project_id"] == project_id]
    if status:
        all_entries = [entry for entry in all_entries if entry["status"] == status]
    if is_billable is not None:
        all_entries = [entry for entry in all_entries if entry["is_billable"] == is_billable]

    all_entries.sort(key=lambda entry: (entry["date"], entry["employee_name"]), reverse=True)
    total = len(all_entries)
    start = (page - 1) * page_size
    page_entries = all_entries[start : start + page_size]

    total_hours = round(sum(entry["hours"] for entry in deduped_rows_to_entries(deduped_rows, resolve_employee, period)), 1)
    billable_hours = round(sum(entry["billable_hours"] for entry in deduped_rows_to_entries(deduped_rows, resolve_employee, period)), 1)
    billable_entries = [entry for entry in deduped_rows_to_entries(deduped_rows, resolve_employee, period) if entry["is_billable"]]
    non_billable_entries = [entry for entry in deduped_rows_to_entries(deduped_rows, resolve_employee, period) if not entry["is_billable"]]

    employee_options = sorted(
        [{"id": entry["employee_id"], "name": entry["employee_name"]} for entry in deduped_rows_to_entries(deduped_rows, resolve_employee, period)],
        key=lambda item: item["name"].lower(),
    )

    latest_period = await _get_latest_excel_period(branch_location_id)

    return {
        "entries": page_entries,
        "total": total,
        "period": period,
        "is_locked": False,
        "latest_period": latest_period if total == 0 else None,
        "summary": {
            "total_hours": total_hours,
            "billable_hours": billable_hours,
            "billable_percent": round((billable_hours / total_hours * 100) if total_hours > 0 else 0, 1),
            "employee_count": len({entry["employee_id"] for entry in deduped_rows_to_entries(deduped_rows, resolve_employee, period)}),
            "project_count": 1 if deduped_rows else 0,
            "billable_employee_count": len({entry["employee_id"] for entry in billable_entries}),
            "non_billable_employee_count": len({entry["employee_id"] for entry in non_billable_entries}),
        },
        "filter_options": {
            "employees": employee_options,
            "projects": [{"id": EXCEL_TIMESHEET_PROJECT_ID, "name": EXCEL_TIMESHEET_PROJECT_NAME}] if deduped_rows else [],
        },
        "data_source": "excel",
    }


def deduped_rows_to_entries(
    rows: list[ExcelUtilisationReport],
    resolve_employee: Callable[[str], Optional[Employee]],
    period: str,
) -> list[dict]:
    entries = []
    for row in rows:
        resolved_employee = resolve_employee(row.employee_name)
        resolved_employee_id = row.employee_id or (str(resolved_employee.id) if resolved_employee else None)
        entry = _build_excel_timesheet_entry(row, resolved_employee_id)
        entry["billable_hours"] = _derived_billable_hours(period, row.utilisation_percent, row.classification)
        entries.append(entry)
    return entries


async def get_excel_analytics(
    branch_location_id: str,
    period: Optional[str] = None,
) -> Optional[dict]:
    target_period = period or await _get_latest_excel_period(branch_location_id)
    if not target_period:
        return None

    rows = await ExcelUtilisationReport.find(
        ExcelUtilisationReport.branch_location_id == branch_location_id,
        ExcelUtilisationReport.period == target_period,
    ).to_list()
    rows = _dedupe_latest_rows(rows)
    if not rows:
        return None

    employee_ids = [row.employee_id for row in rows if row.employee_id]
    employees = (
        await Employee.find(
            {"_id": {"$in": [ObjectId(employee_id) for employee_id in employee_ids if ObjectId.is_valid(employee_id)]}},
            Employee.is_active == True,
        ).to_list()
        if employee_ids
        else []
    )
    employee_map = {str(employee.id): employee for employee in employees}
    employee_ids = [employee_id for employee_id in employee_ids if employee_id in employee_map]

    all_employees = await Employee.find(Employee.is_active == True).to_list()
    all_emp_map = {str(employee.id): employee for employee in all_employees}

    departments = await Department.find_all().to_list()
    dept_map = {str(department.id): department for department in departments}
    locations = await Location.find_all().to_list()
    loc_map = {str(location.id): location for location in locations}

    level_order = ["intern", "junior", "mid", "senior", "lead", "manager", "head", "director", "vp", "c-suite"]

    level_counts = defaultdict(int)
    department_ids = set()
    for employee_id in employee_ids:
        employee = employee_map.get(employee_id)
        if not employee:
            continue
        level_counts[employee.level] += 1
        if employee.department_id:
            department_ids.add(employee.department_id)

    level_breakdown = [
        {"level": level, "count": level_counts.get(level, 0)}
        for level in level_order
        if level_counts.get(level, 0) > 0
    ]

    reporting_relationships = (
        await ReportingRelationship.find(
            {"employee_id": {"$in": employee_ids}},
            ReportingRelationship.is_deleted != True,
        ).to_list()
        if employee_ids
        else []
    )
    primary_rels = [relationship for relationship in reporting_relationships if relationship.type == "PRIMARY"]
    manager_reports: dict[str, list[str]] = defaultdict(list)
    parent_of: dict[str, str] = {}
    for relationship in primary_rels:
        manager_reports[relationship.manager_id].append(relationship.employee_id)
        parent_of[relationship.employee_id] = relationship.manager_id

    span_data = []
    for manager_id, reports in manager_reports.items():
        if manager_id not in employee_ids:
            continue
        manager = all_emp_map.get(manager_id)
        if not manager:
            continue
        count = len(reports)
        span_data.append(
            {
                "manager_id": manager_id,
                "manager_name": manager.name,
                "designation": manager.designation,
                "direct_report_count": count,
                "is_outlier": count < 2 or count > 10,
            }
        )

    def get_depth(employee_id: str, visited: Optional[set[str]] = None) -> int:
        if visited is None:
            visited = set()
        if employee_id in visited:
            return 0
        visited.add(employee_id)
        parent = parent_of.get(employee_id)
        if not parent or parent not in employee_ids:
            return 0
        return 1 + get_depth(parent, visited)

    hierarchy_depth = 0
    for employee_id in employee_ids:
        hierarchy_depth = max(hierarchy_depth, get_depth(employee_id))

    dept_has_manager = set()
    for employee_id in employee_ids:
        employee = employee_map.get(employee_id)
        if not employee:
            continue
        if employee.level in ("manager", "head", "director", "vp", "c-suite") and employee.department_id:
            dept_has_manager.add(employee.department_id)

    departments_without_manager = sorted(
        dept_map[department_id].name
        for department_id in (department_ids - dept_has_manager)
        if department_id in dept_map
    )

    cross_reports = []
    for relationship in reporting_relationships:
        if relationship.employee_id not in employee_ids:
            continue
        employee = all_emp_map.get(relationship.employee_id)
        manager = all_emp_map.get(relationship.manager_id)
        if not employee or not manager or manager.location_id == branch_location_id:
            continue
        manager_location = loc_map.get(manager.location_id)
        cross_reports.append(
            {
                "employee_id": relationship.employee_id,
                "employee_name": employee.name,
                "employee_designation": employee.designation,
                "external_manager_id": relationship.manager_id,
                "external_manager_name": manager.name,
                "external_manager_location": manager_location.city if manager_location else "Unknown",
                "relationship_type": relationship.type,
            }
        )

    allocations = (
        await ProjectAllocation.find(
            ProjectAllocation.period == target_period,
            {"employee_id": {"$in": employee_ids}},
            ProjectAllocation.is_deleted != True,
        ).to_list()
        if employee_ids
        else []
    )

    client_counts: dict[str, set[str]] = defaultdict(set)
    project_member_count: dict[str, set[str]] = defaultdict(set)
    project_snapshot: dict[str, dict] = {}
    for allocation in allocations:
        client_name = allocation.client_name or "General"
        client_counts[client_name].add(allocation.employee_id)
        project_member_count[allocation.project_id].add(allocation.employee_id)
        project_snapshot.setdefault(
            allocation.project_id,
            {
                "id": allocation.project_id,
                "name": allocation.project_name,
                "status": "ACTIVE",
                "member_count": 0,
                "client_name": client_name,
            },
        )

    client_breakdown = sorted(
        [{"client": client_name, "count": len(employee_set)} for client_name, employee_set in client_counts.items()],
        key=lambda item: item["count"],
        reverse=True,
    )

    project_summaries = sorted(
        [
            {
                **summary,
                "member_count": len(project_member_count[project_id]),
            }
            for project_id, summary in project_snapshot.items()
        ],
        key=lambda item: item["member_count"],
        reverse=True,
    )

    trend_periods = sorted(
        {
            row.period
            for row in await ExcelUtilisationReport.find(
                ExcelUtilisationReport.branch_location_id == branch_location_id,
            ).to_list()
        }
    )[-12:]
    monthly_trend = []
    previous_count = 0
    for trend_period in trend_periods:
        trend_rows = await ExcelUtilisationReport.find(
            ExcelUtilisationReport.branch_location_id == branch_location_id,
            ExcelUtilisationReport.period == trend_period,
        ).to_list()
        count = len(_dedupe_latest_rows(trend_rows))
        monthly_trend.append(
            {
                "month": trend_period,
                "new_hires": max(count - previous_count, 0),
                "cumulative": count,
            }
        )
        previous_count = count

    return {
        "period": target_period,
        "data_source": "excel",
        "total_headcount": len(rows),
        "active_count": len(rows),
        "client_breakdown": client_breakdown,
        "level_breakdown": level_breakdown,
        "monthly_trend": monthly_trend,
        "span_of_control": span_data,
        "hierarchy_depth": hierarchy_depth,
        "departments_without_manager": departments_without_manager,
        "cross_reports": cross_reports,
        "projects": project_summaries,
        "orphaned_projects": [],
    }


async def get_excel_bench_pool(
    branch_location_id: str,
    period: Optional[str] = None,
    skill_filter: Optional[str] = None,
    location_filter: Optional[str] = None,
    classification_filter: Optional[str] = None,
    designation_filter: Optional[str] = None,
    utilisation_min: Optional[float] = None,
    utilisation_max: Optional[float] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    target_period = period or await _get_latest_excel_period(branch_location_id)
    if not target_period:
        return {
            "period": None,
            "data_source": "excel",
            "employees": [],
            "total": 0,
            "bench_count": 0,
            "partial_count": 0,
            "avg_bench_days": None,
        }

    rows = await ExcelUtilisationReport.find(
        ExcelUtilisationReport.branch_location_id == branch_location_id,
        ExcelUtilisationReport.period == target_period,
    ).to_list()
    rows = _dedupe_latest_rows(rows)
    rows = [row for row in rows if row.classification in {"bench", "partially_billed"}]

    if classification_filter in {"bench", "partially_billed"}:
        rows = [row for row in rows if row.classification == classification_filter]

    employee_ids = [row.employee_id for row in rows if row.employee_id]
    if not employee_ids:
        return {
            "period": target_period,
            "data_source": "excel",
            "employees": [],
            "total": 0,
            "bench_count": 0,
            "partial_count": 0,
            "avg_bench_days": None,
        }

    employees = await Employee.find(
        {"_id": {"$in": [ObjectId(employee_id) for employee_id in employee_ids if ObjectId.is_valid(employee_id)]}}
    ).to_list()
    employee_map = {str(employee.id): employee for employee in employees}
    row_map = {row.employee_id: row for row in rows if row.employee_id in employee_map}
    employee_ids = list(row_map.keys())

    dept_ids = list({employee.department_id for employee in employees if employee.department_id})
    loc_ids = list({employee.location_id for employee in employees if employee.location_id})

    departments = (
        await Department.find(
            {"_id": {"$in": [ObjectId(department_id) for department_id in dept_ids if ObjectId.is_valid(department_id)]}}
        ).to_list()
        if dept_ids
        else []
    )
    dept_map = {str(department.id): department.name for department in departments}

    locations = (
        await Location.find(
            {"_id": {"$in": [ObjectId(location_id) for location_id in loc_ids if ObjectId.is_valid(location_id)]}}
        ).to_list()
        if loc_ids
        else []
    )
    loc_map = {str(location.id): f"{location.city}, {location.country}" for location in locations}
    loc_code_map = {str(location.id): location.code for location in locations}

    all_skills = await EmployeeSkill.find({"employee_id": {"$in": employee_ids}}).to_list()
    skills_by_emp: dict[str, list[EmployeeSkill]] = defaultdict(list)
    for skill in all_skills:
        skills_by_emp[skill.employee_id].append(skill)

    assignments = await EmployeeProject.find({"employee_id": {"$in": employee_ids}}).to_list()
    project_ids = list({assignment.project_id for assignment in assignments if assignment.project_id})
    projects = (
        await Project.find(
            {"_id": {"$in": [ObjectId(project_id) for project_id in project_ids if ObjectId.is_valid(project_id)]}}
        ).to_list()
        if project_ids
        else []
    )
    project_map = {str(project.id): project for project in projects}

    assignments_by_emp: dict[str, list[dict]] = defaultdict(list)
    employee_project_role: dict[tuple[str, str], str] = {}
    available_from_map: dict[str, Optional[str]] = {}
    for assignment in assignments:
        project = project_map.get(assignment.project_id)
        if not project:
            continue
        end_date_str = project.end_date.strftime("%Y-%m-%d") if project.end_date else None
        assignment_is_deleted = getattr(assignment, "is_deleted", False)
        assignments_by_emp[assignment.employee_id].append(
            {
                "project_id": assignment.project_id,
                "project_name": project.name,
                "status": "COMPLETED" if assignment_is_deleted else project.status,
                "role": assignment.role_in_project,
                "end_date": end_date_str,
                "client_name": project.client_name,
                "is_deleted": assignment_is_deleted,
            }
        )
        if assignment.role_in_project:
            employee_project_role[(assignment.employee_id, assignment.project_id)] = assignment.role_in_project
        if not assignment_is_deleted and project.status == "ACTIVE" and project.end_date:
            end_str = project.end_date.strftime("%Y-%m-%d")
            current = available_from_map.get(assignment.employee_id)
            if current is None or end_str > current:
                available_from_map[assignment.employee_id] = end_str

    allocations = await ProjectAllocation.find(
        {
            "employee_id": {"$in": employee_ids},
            "allocated_days": {"$gt": 0},
        }
    ).sort(-ProjectAllocation.period).to_list()

    alloc_last_by_emp: dict[str, list[dict]] = defaultdict(list)
    for allocation in allocations:
        employee_allocations = alloc_last_by_emp[allocation.employee_id]
        if any(existing["project_id"] == allocation.project_id for existing in employee_allocations):
            continue
        employee_allocations.append(
            {
                "project_id": allocation.project_id,
                "project_name": allocation.project_name,
                "client_name": allocation.client_name,
                "period": allocation.period,
                "end_date": _period_end_date(allocation.period),
            }
        )

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    results = []
    bench_count = 0
    partial_count = 0

    for employee_id in employee_ids:
        employee = employee_map.get(employee_id)
        row = row_map.get(employee_id)
        if not employee or not row:
            continue

        if location_filter and loc_code_map.get(employee.location_id, "") != location_filter:
            continue
        if designation_filter and employee.designation.lower() != designation_filter.lower():
            continue
        if utilisation_min is not None and row.utilisation_percent < utilisation_min:
            continue
        if utilisation_max is not None and row.utilisation_percent > utilisation_max:
            continue

        employee_skills = skills_by_emp.get(employee_id, [])
        if skill_filter:
            skill_names = [skill.skill_name.lower() for skill in employee_skills]
            if skill_filter.lower() not in skill_names:
                continue

        if search:
            search_lower = search.lower()
            if search_lower not in employee.name.lower() and search_lower not in employee.designation.lower():
                continue

        if row.classification == "bench":
            bench_count += 1
        elif row.classification == "partially_billed":
            partial_count += 1

        skill_responses = [
            {
                "id": str(skill.id),
                "employee_id": skill.employee_id,
                "skill_name": skill.skill_name,
                "proficiency": skill.proficiency,
                "added_by": skill.added_by,
                "added_at": skill.added_at,
                "notes": skill.notes,
            }
            for skill in employee_skills
        ]

        employee_assignments = assignments_by_emp.get(employee_id, [])
        active_projects = [
            assignment
            for assignment in employee_assignments
            if assignment["status"] in ("ACTIVE", "ON_HOLD") and not assignment.get("is_deleted")
        ]

        alloc_history = alloc_last_by_emp.get(employee_id, [])
        if alloc_history:
            last_projects = []
            for alloc_record in alloc_history[:3]:
                last_projects.append(
                    {
                        "project_id": alloc_record["project_id"],
                        "project_name": alloc_record["project_name"],
                        "status": "COMPLETED",
                        "role": employee_project_role.get((employee_id, alloc_record["project_id"]), ""),
                        "end_date": alloc_record["end_date"],
                        "client_name": alloc_record["client_name"],
                        "period": alloc_record["period"],
                    }
                )
            bench_since = last_projects[0]["end_date"] if last_projects else None
        else:
            last_projects = sorted(
                [assignment for assignment in employee_assignments if assignment["status"] == "COMPLETED" or assignment.get("is_deleted")],
                key=lambda assignment: assignment.get("end_date") or "",
                reverse=True,
            )[:3]
            completed_with_dates = [assignment for assignment in last_projects if assignment.get("end_date")]
            bench_since = completed_with_dates[0]["end_date"] if completed_with_dates else None

        bench_duration_days: Optional[int] = None
        if bench_since:
            try:
                bench_duration_days = (date.today() - date.fromisoformat(bench_since)).days
            except Exception:
                bench_duration_days = None

        available_from = available_from_map.get(employee_id)
        if row.classification == "bench" and not active_projects:
            available_from = today_str
        elif available_from is None:
            available_from = today_str

        results.append(
            {
                "employee_id": employee_id,
                "employee_name": employee.name,
                "designation": employee.designation,
                "department": dept_map.get(employee.department_id, row.department or "Unknown"),
                "location": loc_map.get(employee.location_id, "Unknown"),
                "skills": skill_responses,
                "utilisation_percent": row.utilisation_percent,
                "classification": row.classification,
                "available_from": available_from,
                "current_projects": [{k: v for k, v in project.items() if k != "is_deleted"} for project in active_projects],
                "active_projects": [{k: v for k, v in project.items() if k != "is_deleted"} for project in active_projects],
                "last_projects": [{k: v for k, v in project.items() if k != "is_deleted"} for project in last_projects],
                "bench_since": bench_since,
                "bench_duration_days": bench_duration_days,
            }
        )

    total = len(results)
    bench_durations = [
        result["bench_duration_days"]
        for result in results
        if result["classification"] == "bench" and result["bench_duration_days"] is not None
    ]
    avg_bench_days = round(sum(bench_durations) / len(bench_durations)) if bench_durations else None

    skip = (page - 1) * page_size
    paginated = results[skip : skip + page_size]

    return {
        "period": target_period,
        "data_source": "excel",
        "employees": paginated,
        "total": total,
        "bench_count": bench_count,
        "partial_count": partial_count,
        "avg_bench_days": avg_bench_days,
    }


async def get_excel_designations(
    branch_location_id: str,
    period: Optional[str] = None,
) -> list[str]:
    bench_pool = await get_excel_bench_pool(
        branch_location_id=branch_location_id,
        period=period,
        page=1,
        page_size=5000,
    )
    return sorted({employee["designation"] for employee in bench_pool["employees"] if employee.get("designation")})


async def get_excel_finance_billable(
    period: str,
    branch_location_id: str,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    rows = await ExcelUtilisationReport.find(
        ExcelUtilisationReport.branch_location_id == branch_location_id,
        ExcelUtilisationReport.period == period,
    ).to_list()
    rows = _dedupe_latest_rows(rows)

    if not rows:
        return {
            "entries": [],
            "total": 0,
            "period": period,
            "latest_version": 1,
            "data_source": "excel",
        }

    employee_ids = [row.employee_id for row in rows if row.employee_id]
    allocations = (
        await ProjectAllocation.find(
            ProjectAllocation.period == period,
            {"employee_id": {"$in": employee_ids}},
            ProjectAllocation.is_deleted != True,
        ).to_list()
        if employee_ids
        else []
    )
    allocations_by_employee: dict[str, list[ProjectAllocation]] = defaultdict(list)
    for allocation in allocations:
        allocations_by_employee[allocation.employee_id].append(allocation)
    for employee_allocations in allocations_by_employee.values():
        employee_allocations.sort(key=lambda allocation: allocation.allocation_percentage, reverse=True)

    effective_timesheet_entries = await get_effective_timesheet_entries(
        period=period,
        employee_ids=employee_ids,
    )
    employee_total_hours = summarise_hours_by_employee(effective_timesheet_entries)

    entries = []
    for row in rows:
        employee_id = row.employee_id or _excel_employee_ref(row.employee_name)
        top_allocation = allocations_by_employee.get(row.employee_id, [None])[0]
        derived_billable_hours = _derived_billable_hours(period, row.utilisation_percent, row.classification)
        timesheet_hours = employee_total_hours.get(row.employee_id, {}) if row.employee_id else {}
        billable_hours = round(timesheet_hours.get("billable", derived_billable_hours), 1)
        if row.classification == "bench":
            billable_status = "non_billable"
            billable_hours = 0.0
        else:
            billable_status = row.classification

        entries.append(
            {
                "id": f"excel-finance:{period}:{_normalise_employee_key(row.employee_name, row.employee_id)}",
                "employee_id": employee_id,
                "employee_name": row.employee_name,
                "period": period,
                "billable_status": billable_status,
                "billable_hours": billable_hours,
                "billed_amount": None,
                "project_name": top_allocation.project_name if top_allocation else None,
                "client_name": top_allocation.client_name if top_allocation else None,
                "version": 1,
            }
        )

    total = len(entries)
    skip = (page - 1) * page_size
    return {
        "entries": entries[skip : skip + page_size],
        "total": total,
        "period": period,
        "latest_version": 1,
        "data_source": "excel",
    }


async def get_excel_finance_upload_history(branch_location_id: str) -> list[dict]:
    logs = await ExcelUploadLog.find(
        ExcelUploadLog.branch_location_id == branch_location_id,
    ).sort(-ExcelUploadLog.uploaded_at).limit(20).to_list()

    history = []
    for log in logs:
        periods = log.periods or [None]
        for period in periods:
            history.append(
                {
                    "batch_id": f"{log.batch_id}:{period or 'all'}",
                    "period": period or "Unknown",
                    "uploaded_by": log.uploaded_by,
                    "filename": log.filename,
                    "total_rows": log.total_rows,
                    "valid_count": log.matched_rows,
                    "error_count": max(log.total_rows - log.matched_rows, 0),
                    "duplicate_count": 0,
                    "version": 1,
                    "errors": [],
                    "uploaded_at": log.uploaded_at.isoformat(),
                }
            )

    history.sort(key=lambda item: (item["uploaded_at"], item["period"]), reverse=True)
    return history


async def get_excel_employee_detail(
    employee_ref: str,
    requester_branch_location_id: str,
    period: Optional[str] = None,
) -> Optional[dict]:
    employee_name = _decode_excel_employee_ref(employee_ref)

    query_filters = [ExcelUtilisationReport.branch_location_id == requester_branch_location_id]
    if period:
        query_filters.append(ExcelUtilisationReport.period == period)
    query_filters.append(ExcelUtilisationReport.employee_name == employee_name)

    rows = await ExcelUtilisationReport.find(*query_filters).sort(-ExcelUtilisationReport.uploaded_at).to_list()
    if not rows and period:
        rows = await ExcelUtilisationReport.find(
            ExcelUtilisationReport.branch_location_id == requester_branch_location_id,
            ExcelUtilisationReport.employee_name == employee_name,
        ).sort(-ExcelUtilisationReport.period, -ExcelUtilisationReport.uploaded_at).to_list()

    if not rows:
        return None

    latest_row = rows[0]
    periods = sorted({row.period for row in rows})
    capacity_hours = _capacity_hours_for_period(latest_row.period)
    total_hours = _derived_total_hours(latest_row.period, latest_row.utilisation_percent)
    billable_hours = _derived_billable_hours(latest_row.period, latest_row.utilisation_percent, latest_row.classification)

    return {
        "id": employee_ref,
        "name": latest_row.employee_name,
        "email": latest_row.employee_email,
        "designation": "Imported From Excel Report",
        "department": latest_row.department or "Unknown",
        "department_id": "",
        "level": "unknown",
        "location_id": requester_branch_location_id,
        "location_code": "XLS",
        "location_city": "Excel Import",
        "photo_url": None,
        "is_active": True,
        "join_date": None,
        "tenure_months": None,
        "managers": [],
        "reporting_chain": [],
        "direct_reports": [],
        "projects": [],
        "skills": [],
        "utilisation": {
            "period": latest_row.period,
            "utilisation_percent": latest_row.utilisation_percent,
            "billable_percent": latest_row.utilisation_percent if latest_row.classification != "bench" else 0.0,
            "total_hours": total_hours,
            "billable_hours": billable_hours,
            "non_billable_hours": round(total_hours - billable_hours, 1),
            "capacity_hours": capacity_hours,
            "classification": latest_row.classification,
        },
        "timesheet_summary": {
            "period": latest_row.period,
            "total_hours": total_hours,
            "billable_hours": billable_hours,
            "entry_count": 1,
        },
        "is_own_branch": True,
        "excel_periods": periods,
        "data_source": "excel",
    }


async def get_excel_overlay_for_employee(
    *,
    employee_id: Optional[str],
    employee_name: Optional[str],
    branch_location_id: str,
    period: Optional[str],
) -> Optional[dict]:
    filters: list = [ExcelUtilisationReport.branch_location_id == branch_location_id]
    if period:
        filters.append(ExcelUtilisationReport.period == period)
    if employee_id:
        filters.append(ExcelUtilisationReport.employee_id == employee_id)
    elif employee_name:
        filters.append(ExcelUtilisationReport.employee_name == employee_name)
    else:
        return None

    rows = await ExcelUtilisationReport.find(*filters).sort(-ExcelUtilisationReport.uploaded_at).to_list()
    if not rows and period and employee_name:
        rows = await ExcelUtilisationReport.find(
            ExcelUtilisationReport.branch_location_id == branch_location_id,
            ExcelUtilisationReport.employee_name == employee_name,
        ).sort(-ExcelUtilisationReport.period, -ExcelUtilisationReport.uploaded_at).to_list()

    if not rows:
        return None

    latest_row = rows[0]
    total_hours = _derived_total_hours(latest_row.period, latest_row.utilisation_percent)
    billable_hours = _derived_billable_hours(latest_row.period, latest_row.utilisation_percent, latest_row.classification)

    return {
        "period": latest_row.period,
        "utilisation_percent": latest_row.utilisation_percent,
        "billable_percent": latest_row.utilisation_percent if latest_row.classification != "bench" else 0.0,
        "total_hours": total_hours,
        "billable_hours": billable_hours,
        "non_billable_hours": round(total_hours - billable_hours, 1),
        "capacity_hours": _capacity_hours_for_period(latest_row.period),
        "classification": latest_row.classification,
        "timesheet_summary": {
            "period": latest_row.period,
            "total_hours": total_hours,
            "billable_hours": billable_hours,
            "entry_count": 1,
        },
    }


async def get_upload_history(branch_location_id: str) -> list[dict]:
    logs = await ExcelUploadLog.find(
        ExcelUploadLog.branch_location_id == branch_location_id,
    ).sort(-ExcelUploadLog.uploaded_at).limit(20).to_list()

    return [
        {
            "batch_id": log.batch_id,
            "filename": log.filename,
            "total_rows": log.total_rows,
            "matched_rows": log.matched_rows,
            "periods": log.periods,
            "uploaded_at": log.uploaded_at.isoformat(),
        }
        for log in logs
    ]
