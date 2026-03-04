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

from bson import ObjectId
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
from app.models.timesheet_entry import TimesheetEntry
from app.models.attendance_summary import AttendanceSummary
from app.models.project_allocation import ProjectAllocation
from app.models.hrms_holiday import HrmsHoliday

DATA_FILE = Path(__file__).parent / "static_data.json"

# Map JSON key -> (Model class, datetime fields to parse, date fields to parse)
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


def parse_dates(doc: dict, datetime_fields: list[str], date_fields: list[str]) -> dict:
    for field in datetime_fields:
        val = doc.get(field)
        if val and isinstance(val, str):
            doc[field] = datetime.fromisoformat(val)
    for field in date_fields:
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
        items = data.get(key, [])
        if not items:
            continue
        count = await model.count()
        if count > 0:
            await model.find_all().delete()
            print(f"  Cleared {model.Settings.name} ({count} docs)")

    # Insert data
    for key, model, datetime_fields, date_fields in COLLECTIONS:
        items = data.get(key, [])
        if not items:
            continue

        docs = []
        for item in items:
            item_copy = dict(item)
            # Convert 'id' to '_id' so Beanie preserves our generated ObjectIds
            raw_id = item_copy.pop("id", None)
            if raw_id and ObjectId.is_valid(raw_id):
                item_copy["_id"] = ObjectId(raw_id)
            parse_dates(item_copy, datetime_fields, date_fields)
            docs.append(model(**item_copy))

        await model.insert_many(docs)
        print(f"  Loaded {len(docs):>5} {model.Settings.name}")

    # Summary
    print()
    print("=" * 55)
    print("  Static data loaded successfully!")
    print("=" * 55)
    for key, model, _, _ in COLLECTIONS:
        count = len(data.get(key, []))
        if count:
            print(f"  {key:30s} {count:>5}")
    print()
    print("  Login accounts:")
    for u in data.get("users", []):
        print(f"    {u['email']} ({u['role']})")
    print()


if __name__ == "__main__":
    asyncio.run(main())
