"""
Generate timesheet entries for all employees from HRMS attendance + allocation data.
For each month: fetches attendance summary (total_hours per employee) and
allocation data (which projects, what percentage), then distributes hours
across projects proportionally and creates TimesheetEntry records.
"""
import asyncio
import secrets
import sys, os
from datetime import datetime, date, timezone, timedelta
from collections import defaultdict

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import init_db
from app.models.employee import Employee
from app.models.timesheet_entry import TimesheetEntry
from app.models.project import Project
from app.models.location import Location

HRMS_BASE = "http://149.102.158.71:2342"
MONTHS = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]
HOURS_PER_DAY = 8.0


async def hrms_login(client):
    r = await client.post(f"{HRMS_BASE}/users/login",
        data={"username": "hr@nxzen.com", "password": "123", "grant_type": "password"},
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    r.raise_for_status()
    d = r.json()
    return d["access_token"], d["employeeId"]


def get_working_days_in_month(year: int, month: int) -> list[date]:
    """Return all Mon-Fri dates in the given month."""
    days = []
    d = date(year, month, 1)
    while d.month == month:
        if d.weekday() < 5:  # Mon-Fri
            days.append(d)
        d += timedelta(days=1)
    return days


async def import_month(client, token, month, emp_hrms_map, branch_map, project_hrms_map, internal_project_id):
    h = {"Authorization": f"Bearer {token}"}
    year, mon = int(month[:4]), int(month[5:])
    working_days = get_working_days_in_month(year, mon)

    # Fetch attendance summary
    r_att = await client.get(f"{HRMS_BASE}/attendance/hr-assigned", headers=h,
        params={"hr_id": 1, "year": year, "month": mon})
    r_att.raise_for_status()
    attendance = r_att.json()  # list of {employee_id, name, email, present, wfh, leave, total_hours}

    # Fetch allocations
    r_alloc = await client.get(f"{HRMS_BASE}/allocations/all", headers=h, params={"month": month})
    r_alloc.raise_for_status()
    alloc_data = r_alloc.json()
    alloc_employees = alloc_data.get("employees", [])

    # Build allocation map: hrms_emp_id -> list of {project_id, client_name, pct}
    alloc_map = {}
    for ea in alloc_employees:
        eid = str(ea["employee_id"])
        alloc_map[eid] = ea.get("allocations", [])

    # Build attendance map: hrms_emp_id -> total_hours
    att_map = {}
    for a in attendance:
        eid = str(a["employee_id"])
        total_h = float(a.get("total_hours", 0))
        present = int(a.get("present", 0)) + int(a.get("wfh", 0))
        # Use total_hours if available, else estimate from present days
        if total_h > 0:
            att_map[eid] = total_h
        elif present > 0:
            att_map[eid] = present * HOURS_PER_DAY
        else:
            att_map[eid] = len(working_days) * HOURS_PER_DAY  # assume full month

    # Delete existing entries for this month (clean reimport)
    await TimesheetEntry.find(TimesheetEntry.period == month).delete()

    batch_id = secrets.token_urlsafe(12)
    now = datetime.now(timezone.utc)
    docs = []

    # Process every employee that has an HRMS ID
    for hrms_id, our_id in emp_hrms_map.items():
        branch_location_id = branch_map.get(our_id, "")
        total_hours = att_map.get(hrms_id, len(working_days) * HOURS_PER_DAY)
        allocations = alloc_map.get(hrms_id, [])

        if not allocations:
            # No allocation → internal/bench project, all hours non-billable
            proj_id = internal_project_id
            entries = distribute_hours_across_days(
                our_id, proj_id, total_hours, working_days,
                is_billable=False, branch_location_id=branch_location_id,
                period=month, batch_id=batch_id, now=now
            )
            docs.extend(entries)
        else:
            # Distribute hours proportionally across allocated projects
            total_pct = sum(float(a.get("allocation_percentage", 0)) for a in allocations)
            if total_pct == 0:
                total_pct = 100.0

            for alloc in allocations:
                proj_hrms_id = str(alloc.get("project_id", ""))
                our_proj_id = project_hrms_map.get(proj_hrms_id, internal_project_id)
                pct = float(alloc.get("allocation_percentage", 0)) / total_pct
                proj_hours = round(total_hours * pct, 1)
                client_name = alloc.get("client_name", "")
                is_billable = client_name.lower() not in ("internal", "bench", "") if client_name else True

                entries = distribute_hours_across_days(
                    our_id, our_proj_id, proj_hours, working_days,
                    is_billable=is_billable, branch_location_id=branch_location_id,
                    period=month, batch_id=batch_id, now=now
                )
                docs.extend(entries)

    if docs:
        # Insert in batches of 500
        for i in range(0, len(docs), 500):
            await TimesheetEntry.insert_many(docs[i:i+500])

    print(f"  {month}: {len(docs)} entries for {len(emp_hrms_map)} employees")
    return len(docs)


def distribute_hours_across_days(employee_id, project_id, total_hours, working_days,
                                  is_billable, branch_location_id, period, batch_id, now):
    """Spread total_hours evenly across working days, max 8h/day."""
    if not working_days or total_hours <= 0:
        return []

    hours_per_day = min(HOURS_PER_DAY, round(total_hours / len(working_days), 1))
    remaining = total_hours
    entries = []

    for d in working_days:
        if remaining <= 0:
            break
        day_hours = min(hours_per_day, remaining, HOURS_PER_DAY)
        day_hours = round(day_hours, 1)
        if day_hours <= 0:
            continue

        entries.append(TimesheetEntry(
            employee_id=employee_id,
            project_id=project_id,
            date=d,
            hours=day_hours,
            is_billable=is_billable,
            description=None,
            status="approved",
            source="hrms_sync",
            sync_batch_id=batch_id,
            period=period,
            branch_location_id=branch_location_id,
            created_at=now,
            updated_at=now,
        ))
        remaining -= day_hours

    return entries


async def main():
    await init_db()

    # Build maps
    employees = await Employee.find(Employee.is_active == True).to_list()
    emp_hrms_map = {str(e.hrms_employee_id): str(e.id) for e in employees if e.hrms_employee_id}
    branch_map = {str(e.id): e.location_id or "" for e in employees}
    print(f"Employees with HRMS IDs: {len(emp_hrms_map)}")

    projects = await Project.find_all().to_list()
    project_hrms_map = {str(p.hrms_project_id): str(p.id) for p in projects if p.hrms_project_id}

    # Find or use first internal/general project as fallback
    internal_proj = next((p for p in projects if (p.project_type or "").lower() == "internal"), None)
    if not internal_proj:
        internal_proj = projects[0] if projects else None
    internal_project_id = str(internal_proj.id) if internal_proj else ""
    print(f"Projects mapped: {len(project_hrms_map)}, fallback: {internal_proj.name if internal_proj else 'none'}")

    async with httpx.AsyncClient(timeout=120) as client:
        print("Logging into HRMS...")
        token, hr_id = await hrms_login(client)
        print(f"Logged in, hr_id={hr_id}")

        total = 0
        for month in MONTHS:
            count = await import_month(client, token, month, emp_hrms_map, branch_map, project_hrms_map, internal_project_id)
            total += count

    print(f"\nDone. Total timesheet entries: {total}")


if __name__ == "__main__":
    asyncio.run(main())
