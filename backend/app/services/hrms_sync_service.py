import calendar
import random
import uuid
from datetime import date, datetime, timezone

from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.hrms_sync_log import HrmsSyncLog
from app.models.project import Project
from app.models.timesheet_entry import TimesheetEntry


def _get_working_days(year: int, month: int) -> list[date]:
    """Return all weekday dates for a given year/month."""
    num_days = calendar.monthrange(year, month)[1]
    working_days = []
    for day in range(1, num_days + 1):
        d = date(year, month, day)
        if d.weekday() < 5:  # Monday=0 .. Friday=4
            working_days.append(d)
    return working_days


async def trigger_sync(period: str, branch_location_id: str, user_id: str) -> dict:
    """
    Trigger mock HRMS sync that generates simulated timesheet data
    for all active employees in the branch for the given period.
    """
    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    sync_log = HrmsSyncLog(
        batch_id=batch_id,
        branch_location_id=branch_location_id,
        period=period,
        status="running",
        total_records=0,
        imported_count=0,
        duplicate_count=0,
        error_count=0,
        errors=[],
        started_at=now,
        triggered_by=user_id,
    )
    await sync_log.insert()

    try:
        year, month = int(period.split("-")[0]), int(period.split("-")[1])
        working_days = _get_working_days(year, month)

        # Fetch all active employees for this branch
        employees = await Employee.find(
            Employee.location_id == branch_location_id,
            Employee.is_active == True,
        ).to_list()

        total_records = 0
        imported_count = 0
        duplicate_count = 0
        error_count = 0
        errors = []

        for emp in employees:
            emp_id = str(emp.id)

            # Get project assignments for this employee
            assignments = await EmployeeProject.find(
                EmployeeProject.employee_id == emp_id,
            ).to_list()

            # Resolve project details
            project_ids = [a.project_id for a in assignments]
            projects = []
            if project_ids:
                projects = await Project.find(
                    {"_id": {"$in": [__import__("bson").ObjectId(pid) for pid in project_ids if __import__("bson").ObjectId.is_valid(pid)]}},
                    Project.status == "ACTIVE",
                ).to_list()

            is_bench = len(projects) == 0

            for day in working_days:
                total_hours = random.uniform(6.0, 9.0)
                total_hours = round(total_hours, 1)

                if is_bench:
                    # Bench employee: single non-billable entry with a default project
                    total_records += 1

                    # Check for duplicate
                    existing = await TimesheetEntry.find_one(
                        TimesheetEntry.employee_id == emp_id,
                        TimesheetEntry.date == day,
                        TimesheetEntry.project_id == "bench",
                    )
                    if existing:
                        duplicate_count += 1
                        continue

                    entry = TimesheetEntry(
                        employee_id=emp_id,
                        project_id="bench",
                        date=day,
                        hours=total_hours,
                        is_billable=False,
                        description="Bench - auto generated via HRMS sync",
                        status="approved",
                        submitted_at=now,
                        approved_by="system",
                        approved_at=now,
                        source="hrms_sync",
                        sync_batch_id=batch_id,
                        period=period,
                        branch_location_id=branch_location_id,
                        created_at=now,
                        updated_at=now,
                    )
                    await entry.insert()
                    imported_count += 1
                else:
                    # Distribute hours across assigned projects
                    num_projects = len(projects)
                    remaining_hours = total_hours

                    for idx, proj in enumerate(projects):
                        proj_id = str(proj.id)
                        total_records += 1

                        if idx == num_projects - 1:
                            # Last project gets remaining hours
                            hours = round(remaining_hours, 1)
                        else:
                            # Random split
                            share = random.uniform(0.3, 0.7) * remaining_hours
                            hours = round(max(0.5, share), 1)
                            remaining_hours -= hours

                        # 70% chance of billable for project-assigned employees
                        is_billable = random.random() < 0.70

                        # Check for duplicate
                        existing = await TimesheetEntry.find_one(
                            TimesheetEntry.employee_id == emp_id,
                            TimesheetEntry.date == day,
                            TimesheetEntry.project_id == proj_id,
                        )
                        if existing:
                            duplicate_count += 1
                            continue

                        entry = TimesheetEntry(
                            employee_id=emp_id,
                            project_id=proj_id,
                            date=day,
                            hours=hours,
                            is_billable=is_billable,
                            description=f"Work on {proj.name} - auto generated via HRMS sync",
                            status="approved",
                            submitted_at=now,
                            approved_by="system",
                            approved_at=now,
                            source="hrms_sync",
                            sync_batch_id=batch_id,
                            period=period,
                            branch_location_id=branch_location_id,
                            created_at=now,
                            updated_at=now,
                        )
                        await entry.insert()
                        imported_count += 1

        # Update sync log with final counts
        sync_log.status = "completed"
        sync_log.total_records = total_records
        sync_log.imported_count = imported_count
        sync_log.duplicate_count = duplicate_count
        sync_log.error_count = error_count
        sync_log.errors = errors
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()

    except Exception as e:
        sync_log.status = "failed"
        sync_log.errors = [{"message": str(e)}]
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()
        raise

    return {
        "batch_id": batch_id,
        "status": sync_log.status,
        "total_records": total_records,
        "imported_count": imported_count,
        "duplicate_count": duplicate_count,
        "error_count": error_count,
    }


async def get_sync_logs(
    branch_location_id: str,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Return paginated list of HRMS sync logs for a branch."""
    skip = (page - 1) * page_size

    logs = await HrmsSyncLog.find(
        HrmsSyncLog.branch_location_id == branch_location_id,
    ).sort(-HrmsSyncLog.started_at).skip(skip).limit(page_size).to_list()

    total = await HrmsSyncLog.find(
        HrmsSyncLog.branch_location_id == branch_location_id,
    ).count()

    return {
        "logs": [
            {
                "batch_id": log.batch_id,
                "period": log.period,
                "status": log.status,
                "total_records": log.total_records,
                "imported_count": log.imported_count,
                "duplicate_count": log.duplicate_count,
                "error_count": log.error_count,
                "errors": log.errors,
                "started_at": log.started_at,
                "completed_at": log.completed_at,
            }
            for log in logs
        ],
        "total": total,
    }
