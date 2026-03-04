"""
Generate finance billable data for existing employees in the database.
Usage: cd backend && python -m seed.generate_finance_data
"""

import asyncio
import random
from datetime import datetime, timezone, date as date_type
from pathlib import Path
import sys
import calendar

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pymongo import AsyncMongoClient
from beanie import init_beanie
from app.config import settings
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.finance_billable import FinanceBillable
from app.models.finance_upload_log import FinanceUploadLog

BATCH_SIZE = 100
CORPORATE_LEVELS = {"c-suite", "vp"}


async def generate_finance_data():
    client = AsyncMongoClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    await init_beanie(database=db, document_models=[Employee, EmployeeProject, FinanceBillable, FinanceUploadLog])

    print("Fetching employees and projects...")
    employees = await Employee.find(Employee.is_active == True).to_list()
    employee_projects = await EmployeeProject.find_all().to_list()

    # Build employee -> projects mapping
    emp_projects = {}
    for ep in employee_projects:
        if ep.employee_id not in emp_projects:
            emp_projects[ep.employee_id] = []
        emp_projects[ep.employee_id].append((ep.project_id, ep.role_in_project))

    # Group employees by location
    branch_employees = {}
    emp_id_to_level = {}
    for emp in employees:
        eid = str(emp.id)
        loc_id = emp.location_id
        if loc_id not in branch_employees:
            branch_employees[loc_id] = []
        branch_employees[loc_id].append(eid)
        emp_id_to_level[eid] = emp.level

    # Determine past 2 months for finance data
    now = datetime.now(timezone.utc)
    today = now.date()
    past_months_2 = []
    ref = today.replace(day=1)
    for i in range(2, 0, -1):
        m = ref.month - i
        y = ref.year
        while m <= 0:
            m += 12
            y -= 1
        past_months_2.append((y, m))

    # Clear existing finance data
    await FinanceBillable.find_all().delete()
    await FinanceUploadLog.find_all().delete()
    print("Cleared existing finance data.")

    # Generate finance records
    random.seed(42)
    finance_records = []

    for year, month in past_months_2:
        period = f"{year:04d}-{month:02d}"
        print(f"Generating finance data for {period}...")

        for loc_id, emp_list in branch_employees.items():
            for eid in emp_list:
                # Skip corporate-level employees
                level = emp_id_to_level.get(eid, "")
                if level in CORPORATE_LEVELS:
                    continue

                proj_list = emp_projects.get(eid, [])

                if proj_list:
                    # Has projects: 60% fully_billed, 30% partially_billed, 10% non_billable
                    roll = random.random()
                    if roll < 0.60:
                        billable_status = "fully_billed"
                    elif roll < 0.90:
                        billable_status = "partially_billed"
                    else:
                        billable_status = "non_billable"

                    # Approximate billable hours
                    if billable_status == "fully_billed":
                        billable_hours = round(random.uniform(140, 170), 1)
                    elif billable_status == "partially_billed":
                        billable_hours = round(random.uniform(80, 139), 1)
                    else:
                        billable_hours = 0.0

                    primary_pid = proj_list[0][0]
                else:
                    billable_status = "non_billable"
                    billable_hours = 0.0
                    primary_pid = None

                fb = FinanceBillable(
                    employee_id=eid,
                    period=period,
                    billable_status=billable_status,
                    billable_hours=billable_hours,
                    project_id=primary_pid,
                    branch_location_id=loc_id,
                    upload_batch_id="seed-batch-001",
                    notes="",
                    created_at=now,
                )
                finance_records.append(fb)

    # Insert in batches
    for i in range(0, len(finance_records), BATCH_SIZE):
        batch = finance_records[i : i + BATCH_SIZE]
        await FinanceBillable.insert_many(batch)

    print(f"Created {len(finance_records)} finance billable records across {len(past_months_2)} months.")

    # Create upload log
    last_period = f"{past_months_2[-1][0]:04d}-{past_months_2[-1][1]:02d}"
    last_period_count = len([r for r in finance_records if r.period == last_period])
    
    upload_log = FinanceUploadLog(
        batch_id="seed-batch-001",
        period=last_period,
        branch_location_id=list(branch_employees.keys())[0],  # Use first location
        filename="seed_generated_data.csv",
        uploaded_by="system",
        uploaded_at=now,
        total_rows=last_period_count,
        valid_count=last_period_count,
        error_count=0,
        duplicate_count=0,
        record_count=last_period_count,
        status="completed",
        version=1,
    )
    await upload_log.insert()
    print("Created finance upload log.")

    print("\n✅ Finance data generation complete!")


if __name__ == "__main__":
    asyncio.run(generate_finance_data())
