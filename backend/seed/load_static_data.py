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
from datetime import datetime
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

DATA_FILE = Path(__file__).parent / "static_data.json"

# Map JSON key -> (Model class, datetime fields to parse)
COLLECTIONS = [
    ("locations", Location, []),
    ("departments", Department, []),
    ("employees", Employee, ["join_date"]),
    ("reporting_relationships", ReportingRelationship, []),
    ("projects", Project, ["start_date", "end_date"]),
    ("employee_projects", EmployeeProject, ["assigned_at"]),
    ("users", User, []),
]


def parse_dates(doc: dict, date_fields: list[str]) -> dict:
    for field in date_fields:
        val = doc.get(field)
        if val and isinstance(val, str):
            doc[field] = datetime.fromisoformat(val)
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
    for key, model, _ in COLLECTIONS:
        count = await model.count()
        if count > 0:
            await model.find_all().delete()
            print(f"  Cleared {model.Settings.name} ({count} docs)")

    # Insert data
    for key, model, date_fields in COLLECTIONS:
        items = data.get(key, [])
        if not items:
            continue

        docs = []
        for item in items:
            parse_dates(item, date_fields)
            docs.append(model(**item))

        await model.insert_many(docs)
        print(f"  Loaded {len(docs):>4} {model.Settings.name}")

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
    print()
    print("  Login accounts:")
    for u in data.get("users", []):
        print(f"    {u['email']} ({u['role']})")
    print()


if __name__ == "__main__":
    asyncio.run(main())
