"""
Import finance billable data from HRMS portal allocations.

For each available month, fetches allocation data from HRMS and maps it to
FinanceBillable records:
  - allocated_days > 0 on a client project  → fully_billed or partially_billed
  - available_days > 0 / no client project  → non_billable
  - billable_hours = allocated_days * 8
  - billable_status derived from allocation_percentage
"""
import asyncio
import secrets
import sys
import os
from datetime import datetime, timezone

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.database import init_db
from app.models.employee import Employee
from app.models.finance_billable import FinanceBillable
from app.models.finance_upload_log import FinanceUploadLog
from app.models.location import Location

HRMS_BASE = settings.HRMS_BASE_URL.rstrip("/")
HRMS_USER = "hr@nxzen.com"
HRMS_PASS = "123"

# Months to import (skip 2025-10 — no data)
MONTHS = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]

# Hours per working day
HOURS_PER_DAY = 8.0


async def hrms_login(client: httpx.AsyncClient) -> tuple[str, int]:
    r = await client.post(
        f"{HRMS_BASE}/users/login",
        data={"username": HRMS_USER, "password": HRMS_PASS, "grant_type": "password"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    r.raise_for_status()
    d = r.json()
    return d["access_token"], d["employeeId"]


def derive_billable_status(total_pct: float) -> str:
    """Map total allocation percentage to billable status."""
    if total_pct >= 80:
        return "fully_billed"
    elif total_pct > 0:
        return "partially_billed"
    return "non_billable"


async def import_month(
    client: httpx.AsyncClient,
    token: str,
    month: str,
    emp_hrms_map: dict[str, str],   # hrms_employee_id → our employee ObjectId str
    branch_map: dict[str, str],     # our employee ObjectId str → branch_location_id
    project_map: dict[str, str],    # hrms project_id str → our project ObjectId str
) -> dict:
    h = {"Authorization": f"Bearer {token}"}
    r = await client.get(f"{HRMS_BASE}/allocations/all", headers=h, params={"month": month})
    r.raise_for_status()
    data = r.json()

    employees_alloc = data.get("employees", [])
    working_days = data.get("total_working_days", 22)
    capacity_hours = working_days * HOURS_PER_DAY

    if not employees_alloc:
        print(f"  {month}: no allocation data")
        return {"month": month, "inserted": 0}

    # Clear existing records for this month (fresh import)
    deleted = await FinanceBillable.find(FinanceBillable.period == month).delete()

    batch_id = secrets.token_urlsafe(16)
    now = datetime.now(timezone.utc)
    docs = []

    for emp_alloc in employees_alloc:
        hrms_id = str(emp_alloc.get("employee_id", ""))
        our_id = emp_hrms_map.get(hrms_id)
        if not our_id:
            continue

        branch_location_id = branch_map.get(our_id, "")
        allocations = emp_alloc.get("allocations", [])
        allocated_days = float(emp_alloc.get("allocated_days", 0))
        available_days = float(emp_alloc.get("available_days", 0))

        if allocations:
            # One record per project allocation
            for alloc in allocations:
                proj_hrms_id = str(alloc.get("project_id", ""))
                our_proj_id = project_map.get(proj_hrms_id)
                alloc_days = float(alloc.get("allocated_days", 0))
                alloc_pct = float(alloc.get("allocation_percentage", 0))
                billable_hours = alloc_days * HOURS_PER_DAY
                status = derive_billable_status(alloc_pct)

                docs.append(FinanceBillable(
                    employee_id=our_id,
                    period=month,
                    billable_status=status,
                    billable_hours=round(billable_hours, 1),
                    billed_amount=None,
                    project_id=our_proj_id,
                    client_name=alloc.get("client_name") or None,
                    branch_location_id=branch_location_id,
                    upload_batch_id=batch_id,
                    version=1,
                    created_at=now,
                ))
        else:
            # No allocations → non_billable
            docs.append(FinanceBillable(
                employee_id=our_id,
                period=month,
                billable_status="non_billable",
                billable_hours=0.0,
                billed_amount=None,
                project_id=None,
                client_name=None,
                branch_location_id=branch_location_id,
                upload_batch_id=batch_id,
                version=1,
                created_at=now,
            ))

    if docs:
        await FinanceBillable.insert_many(docs)

    # Log the import
    # Group by branch for upload logs
    branch_counts: dict[str, int] = {}
    for d in docs:
        branch_counts[d.branch_location_id] = branch_counts.get(d.branch_location_id, 0) + 1

    for branch_id, count in branch_counts.items():
        await FinanceUploadLog(
            batch_id=batch_id + "_" + branch_id[:8],
            period=month,
            branch_location_id=branch_id,
            uploaded_by="hrms_import_script",
            filename=f"hrms_import_{month}.auto",
            total_rows=count,
            valid_count=count,
            error_count=0,
            duplicate_count=0,
            version=1,
            errors=[],
            uploaded_at=now,
        ).insert()

    print(f"  {month}: inserted {len(docs)} records for {len(employees_alloc)} employees")
    return {"month": month, "inserted": len(docs)}


async def main():
    await init_db()

    # Build hrms_employee_id → our ObjectId map
    our_employees = await Employee.find(Employee.is_active == True).to_list()
    emp_hrms_map: dict[str, str] = {}
    branch_map: dict[str, str] = {}
    for emp in our_employees:
        if emp.hrms_employee_id is not None:
            emp_hrms_map[str(emp.hrms_employee_id)] = str(emp.id)
            branch_map[str(emp.id)] = emp.location_id or ""

    print(f"Loaded {len(emp_hrms_map)} employees with HRMS IDs")

    # Build hrms project_id → our project ObjectId map
    from app.models.project import Project
    our_projects = await Project.find_all().to_list()
    project_map: dict[str, str] = {}
    for proj in our_projects:
        if proj.hrms_project_id is not None:
            project_map[str(proj.hrms_project_id)] = str(proj.id)

    print(f"Loaded {len(project_map)} projects with HRMS IDs")

    async with httpx.AsyncClient(timeout=60) as client:
        print("Logging into HRMS...")
        token, hr_id = await hrms_login(client)
        print(f"Logged in as hr_id={hr_id}")

        total_inserted = 0
        for month in MONTHS:
            result = await import_month(client, token, month, emp_hrms_map, branch_map, project_map)
            total_inserted += result["inserted"]

    print(f"\nDone. Total records inserted: {total_inserted}")


if __name__ == "__main__":
    asyncio.run(main())
