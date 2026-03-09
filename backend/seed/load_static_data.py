"""
Load static seed data from JSON into MongoDB.
Drops existing data and loads a clean snapshot.

Usage:
    cd backend
    python -m seed.load_static_data
"""

import asyncio
import json
import sys
from datetime import date, datetime
from pathlib import Path

from pymongo import AsyncMongoClient
from beanie import init_beanie

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.database import ALL_MODELS
from app.models.location import Location
from app.models.department import Department
from app.models.employee import Employee
from app.models.reporting_relationship import ReportingRelationship
from app.models.project import Project
from app.models.employee_project import EmployeeProject
from app.models.user import User
from app.models.hrms_holiday import HrmsHoliday
from app.models.attendance_summary import AttendanceSummary
from app.models.timesheet_entry import TimesheetEntry
from app.models.project_allocation import ProjectAllocation
from app.models.integration_config import IntegrationConfig

DATA_FILE = Path(__file__).parent / "static_data.json"

# Map JSON key -> (Model class, datetime fields, date-only fields)
COLLECTIONS = [
    ("locations", Location, [], []),
    ("departments", Department, [], []),
    ("employees", Employee, ["join_date"], []),
    ("reporting_relationships", ReportingRelationship, [], []),
    ("projects", Project, ["start_date", "end_date"], []),
    ("employee_projects", EmployeeProject, ["assigned_at"], []),
    ("users", User, [], []),
    ("holidays", HrmsHoliday, [], ["holiday_date"]),
    ("attendance_summaries", AttendanceSummary, ["synced_at"], []),
    ("timesheet_entries", TimesheetEntry, ["submitted_at", "approved_at", "created_at", "updated_at"], ["date"]),
    ("project_allocations", ProjectAllocation, ["synced_at"], []),
]


def parse_dates(doc: dict, datetime_fields: list[str], date_fields: list[str] | None = None) -> dict:
    for field in datetime_fields:
        val = doc.get(field)
        if val and isinstance(val, str):
            doc[field] = datetime.fromisoformat(val)
    for field in (date_fields or []):
        val = doc.get(field)
        if val and isinstance(val, str):
            doc[field] = date.fromisoformat(val[:10])
    return doc


async def main():
    print("Connecting to MongoDB...")
    client = AsyncMongoClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    await init_beanie(database=db, document_models=ALL_MODELS)

    print(f"Loading data from {DATA_FILE.name}...")
    with open(DATA_FILE, "r") as f:
        data = json.load(f)

    # Drop existing collections
    for key, model, _, _ in COLLECTIONS:
        count = await model.count()
        if count > 0:
            await model.find_all().delete()
            print(f"  Cleared {model.Settings.name} ({count} docs)")

    # Insert data
    for key, model, datetime_fields, date_only_fields in COLLECTIONS:
        items = data.get(key, [])
        if not items:
            continue

        docs = []
        for item in items:
            parse_dates(item, datetime_fields, date_only_fields)
            docs.append(model(**item))

        await model.insert_many(docs)
        print(f"  Loaded {len(docs):>4} {model.Settings.name}")

    # Create integration configs if not present
    existing_configs = await IntegrationConfig.count()
    if existing_configs == 0:
        now = datetime.utcnow()
        first_user_id = data["users"][0]["id"] if data.get("users") else ""
        integration_configs = [
            ("hrms", "HRMS Integration", {
                "provider": "nxzen_hrms",
                "base_url": "http://149.102.158.71:2342",
                "auth_mode": "password_grant",
                "secret_ref": "NXZEN_MANAGER",
                "hr_id": 1,
                "sync_scope": {"months_backfill": 6, "manual_only": True},
                "mode": {
                    "demo_users": [],
                    "live_domains": ["nxzen.com"],
                },
            }),
            ("finance", "Finance System", {}),
            ("dynamics", "Dynamics 365", {}),
        ]
        for itype, iname, cfg in integration_configs:
            await IntegrationConfig(
                integration_type=itype,
                name=iname,
                status="active",
                config=cfg,
                created_by=first_user_id,
                created_at=now,
                updated_at=now,
            ).insert()
        print(f"  Created {len(integration_configs)} integration configs")

    # Summary
    print()
    print("=" * 45)
    print("  Static data loaded successfully!")
    print("=" * 45)
    print(f"  Locations:      {len(data.get('locations', []))}")
    print(f"  Departments:    {len(data.get('departments', []))}")
    print(f"  Employees:      {len(data.get('employees', []))}")
    print(f"  Relationships:  {len(data.get('reporting_relationships', []))}")
    print(f"  Projects:       {len(data.get('projects', []))}")
    print(f"  Assignments:    {len(data.get('employee_projects', []))}")
    print(f"  Users:          {len(data.get('users', []))}")
    print(f"  Holidays:       {len(data.get('holidays', []))}")
    print(f"  Timesheets:     {len(data.get('timesheet_entries', []))}")
    print(f"  Allocations:    {len(data.get('project_allocations', []))}")
    print()
    print("  Login accounts:")
    for u in data.get("users", []):
        print(f"    {u['email']} ({u['role']})")
    print()


if __name__ == "__main__":
    asyncio.run(main())
 