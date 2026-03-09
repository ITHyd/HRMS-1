"""
Generate timesheet entries for static data employees.
Creates timesheet entries for the past 3 months.

Usage: cd backend && python -m seed.generate_timesheets
"""

import asyncio
import calendar
import random
import sys
from datetime import datetime, timezone, date as date_type
from pathlib import Path

from pymongo import AsyncMongoClient
from beanie import init_beanie

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.models.employee import Employee
from app.models.project import Project
from app.models.employee_project import EmployeeProject
from app.models.timesheet_entry import TimesheetEntry
from app.models.timesheet_period_lock import TimesheetPeriodLock

ALL_MODELS = [Employee, Project, EmployeeProject, TimesheetEntry, TimesheetPeriodLock]


def get_working_days(year, month):
    """Return list of date objects for weekdays (Mon-Fri) in the given month."""
    num_days = calendar.monthrange(year, month)[1]
    days = []
    for day in range(1, num_days + 1):
        d = date_type(year, month, day)
        if d.weekday() < 5:  # Mon=0 .. Fri=4
            days.append(d)
    return days


async def generate():
    client = AsyncMongoClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    await init_beanie(database=db, document_models=ALL_MODELS)

    print("Generating timesheet entries...")

    # Clear existing timesheet entries and period locks
    await TimesheetEntry.find_all().delete()
    await TimesheetPeriodLock.find_all().delete()
    print("Cleared existing timesheet entries and period locks.")

    # Get all employees and projects
    all_employees = await Employee.find_all().to_list()
    all_projects = await Project.find_all().to_list()
    all_assignments = await EmployeeProject.find_all().to_list()

    print(f"Found {len(all_employees)} employees, {len(all_projects)} projects, {len(all_assignments)} assignments")

    # Build employee -> projects mapping
    emp_projects = {}
    for assignment in all_assignments:
        emp_id = str(assignment.employee_id)
        proj_id = str(assignment.project_id)
        role = assignment.role_in_project
        if emp_id not in emp_projects:
            emp_projects[emp_id] = []
        emp_projects[emp_id].append((proj_id, role))

    # Corporate levels to skip
    CORPORATE_LEVELS = {"c-suite", "vp"}

    # Determine past 3 months (Dec 2025, Jan 2026, Feb 2026)
    now = datetime.now(timezone.utc)
    today = now.date() if hasattr(now, 'date') else now
    past_months_3 = []
    ref = today.replace(day=1)
    for i in range(3, 0, -1):
        m = ref.month - i
        y = ref.year
        while m <= 0:
            m += 12
            y -= 1
        past_months_3.append((y, m))

    print(f"Generating timesheets for periods: {past_months_3}")

    # Generate timesheet entries
    random.seed(42)
    timesheet_entries = []

    for year, month in past_months_3:
        period = f"{year:04d}-{month:02d}"
        working_days = get_working_days(year, month)

        for emp in all_employees:
            emp_id = str(emp.id)
            level = emp.level
            loc_id = emp.location_id

            # Skip corporate-level employees
            if level in CORPORATE_LEVELS:
                continue

            proj_list = emp_projects.get(emp_id, [])

            if proj_list:
                # Employee has project assignments - distribute 7-8 hours across projects
                for wd in working_days:
                    total_day_hours = random.choice([7.0, 7.5, 8.0])
                    n_projects = len(proj_list)

                    if n_projects == 1:
                        hours_split = [total_day_hours]
                    else:
                        # Distribute hours across projects
                        base = total_day_hours / n_projects
                        hours_split = []
                        remaining = total_day_hours
                        for j in range(n_projects - 1):
                            h = round(random.uniform(base * 0.5, base * 1.5), 1)
                            h = min(h, remaining - 0.5 * (n_projects - j - 1))
                            hours_split.append(h)
                            remaining -= h
                        hours_split.append(round(remaining, 1))

                    for idx, (pid, role) in enumerate(proj_list):
                        is_billable = random.random() < 0.70
                        entry = TimesheetEntry(
                            employee_id=emp_id,
                            project_id=pid,
                            date=wd,
                            hours=hours_split[idx],
                            is_billable=is_billable,
                            description=f"Work on {role} tasks",
                            status="approved",
                            submitted_at=datetime(year, month, min(wd.day + 1, working_days[-1].day), tzinfo=timezone.utc),
                            approved_by="system",
                            approved_at=datetime(year, month, min(wd.day + 2, working_days[-1].day), tzinfo=timezone.utc),
                            source="hrms_sync",
                            sync_batch_id=f"seed-sync-{period}",
                            period=period,
                            branch_location_id=loc_id,
                            created_at=now,
                            updated_at=now,
                        )
                        timesheet_entries.append(entry)
            else:
                # Bench employee - minimal hours, non-billable
                if all_projects:
                    first_proj_id = str(all_projects[0].id)
                    for wd in working_days:
                        bench_hours = round(random.uniform(4.0, 6.0), 1)
                        entry = TimesheetEntry(
                            employee_id=emp_id,
                            project_id=first_proj_id,
                            date=wd,
                            hours=bench_hours,
                            is_billable=False,
                            description="Internal / Admin tasks",
                            status="approved",
                            submitted_at=datetime(year, month, min(wd.day + 1, working_days[-1].day), tzinfo=timezone.utc),
                            approved_by="system",
                            approved_at=datetime(year, month, min(wd.day + 2, working_days[-1].day), tzinfo=timezone.utc),
                            source="hrms_sync",
                            sync_batch_id=f"seed-sync-{period}",
                            period=period,
                            branch_location_id=loc_id,
                            created_at=now,
                            updated_at=now,
                        )
                        timesheet_entries.append(entry)

    # Bulk insert timesheet entries
    BATCH_SIZE = 500
    for i in range(0, len(timesheet_entries), BATCH_SIZE):
        batch = timesheet_entries[i : i + BATCH_SIZE]
        await TimesheetEntry.insert_many(batch)
    print(f"Created {len(timesheet_entries)} timesheet entries across {len(past_months_3)} months.")

    # Create period locks (lock the oldest month)
    locations = set(emp.location_id for emp in all_employees)
    oldest_period = f"{past_months_3[0][0]:04d}-{past_months_3[0][1]:02d}"
    
    period_locks = []
    for loc_id in locations:
        # Lock the oldest month
        lock = TimesheetPeriodLock(
            period=oldest_period,
            branch_location_id=loc_id,
            is_locked=True,
            locked_by="system",
            locked_at=now,
        )
        await lock.insert()
        period_locks.append(lock)

    # Create unlocked entries for remaining months
    for year, month in past_months_3[1:]:
        period = f"{year:04d}-{month:02d}"
        for loc_id in locations:
            lock = TimesheetPeriodLock(
                period=period,
                branch_location_id=loc_id,
                is_locked=False,
            )
            await lock.insert()
            period_locks.append(lock)

    print(f"Created {len(period_locks)} period locks ({oldest_period} locked, others unlocked).")

    print("\n=============================================")
    print("  Timesheet generation complete!")
    print("=============================================")
    print(f"  Timesheet entries: {len(timesheet_entries)}")
    print(f"  Period locks: {len(period_locks)}")
    print(f"  Periods: {', '.join(f'{y:04d}-{m:02d}' for y, m in past_months_3)}")


if __name__ == "__main__":
    asyncio.run(generate())
