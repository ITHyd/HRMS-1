"""
Load static seed data from JSON into MongoDB.
Drops existing data and loads a clean snapshot.

Usage:
    cd backend
    python -m seed.load_static_data
"""

import asyncio
import bcrypt
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

DEFAULT_DEMO_PASSWORD = "demo123"
NXZEN_PASSWORD = "password123"
DEMO_LOGIN_ACCOUNTS = [
    {"email": "vikram.patel@company.com", "name": "Vikram Patel", "branch_code": "HYD"},
    {"email": "vamsi.krishna@nxzen.com", "name": "Vamsi Krishna", "branch_code": "HYD"},
    {"email": "kavitha.rao@company.com", "name": "Kavitha Rao", "branch_code": "BLR"},
    {"email": "james.mitchell@company.com", "name": "James Mitchell", "branch_code": "LON"},
    {"email": "michael.torres@company.com", "name": "Michael Torres", "branch_code": "SYD"},
]


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _password_for_email(email: str) -> str:
    return NXZEN_PASSWORD if (email or "").lower().endswith("@nxzen.com") else DEFAULT_DEMO_PASSWORD


def _password_hash_matches(password_hash: str, plain: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


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


async def ensure_demo_login_accounts() -> tuple[int, int]:
    """Create missing demo login accounts and fill missing user fields."""
    created = 0
    fixed = 0

    users = await User.find_all().to_list()
    for u in users:
        changed = False
        expected_password = _password_for_email(u.email)
        if not (u.name or "").strip():
            u.name = u.email.split("@", 1)[0].replace(".", " ").title()
            changed = True
        if not (u.role or "").strip():
            u.role = "branch_head"
            changed = True
        if not (u.password_hash or "").strip() or not _password_hash_matches(u.password_hash, expected_password):
            u.password_hash = _hash_password(expected_password)
            changed = True
        if changed:
            await u.save()
            fixed += 1

    existing_emails = {u.email.lower() for u in await User.find_all().to_list()}
    locations = await Location.find_all().to_list()
    loc_by_code = {l.code.upper(): l for l in locations if l.code}

    for account in DEMO_LOGIN_ACCOUNTS:
        email = account["email"].lower()
        if email in existing_emails:
            continue

        loc = loc_by_code.get(account["branch_code"].upper())
        if not loc:
            continue

        employee = await Employee.find_one(Employee.email == email)
        if not employee:
            employee = await Employee.find_one(
                Employee.location_id == str(loc.id),
                Employee.is_active == True,
            )
        if not employee:
            continue

        user = User(
            email=email,
            password_hash=_hash_password(_password_for_email(email)),
            employee_id=str(employee.id),
            branch_location_id=str(loc.id),
            name=account["name"],
            role="branch_head",
        )
        await user.insert()
        existing_emails.add(email)
        created += 1

    return created, fixed


async def ensure_hrms_mode_config(first_user_id: str) -> None:
    """Ensure HRMS integration config has meaningful demo/live mode defaults."""
    now = datetime.utcnow()
    cfg = await IntegrationConfig.find_one(IntegrationConfig.integration_type == "hrms")

    if not cfg:
        cfg = IntegrationConfig(
            integration_type="hrms",
            name="HRMS Integration",
            status="active",
            config={},
            created_by=first_user_id,
            created_at=now,
            updated_at=now,
        )

    raw = cfg.config if isinstance(cfg.config, dict) else {}
    mode = raw.get("mode") if isinstance(raw.get("mode"), dict) else {}

    demo_users = mode.get("demo_users") if isinstance(mode.get("demo_users"), list) else []
    live_domains = mode.get("live_domains") if isinstance(mode.get("live_domains"), list) else []
    live_users = mode.get("live_users") if isinstance(mode.get("live_users"), list) else []

    if not demo_users:
        demo_users = [
            "vikram.patel@company.com",
            "kavitha.rao@company.com",
            "james.mitchell@company.com",
            "michael.torres@company.com",
        ]
    if not live_domains:
        live_domains = ["nxzen.com"]
    if not live_users:
        live_users = ["vamsi.krishna@nxzen.com"]

    raw.update({
        "provider": raw.get("provider") or "nxzen_hrms",
        "base_url": raw.get("base_url") or "http://149.102.158.71:2342",
        "auth_mode": raw.get("auth_mode") or "password_grant",
        "secret_ref": raw.get("secret_ref") or "NXZEN_MANAGER",
        "hr_id": int(raw.get("hr_id") or 1),
        "sync_scope": raw.get("sync_scope") or {"months_backfill": 6, "manual_only": True},
        "mode": {
            "demo_users": demo_users,
            "live_domains": live_domains,
            "live_users": live_users,
        },
    })

    cfg.config = raw
    cfg.status = cfg.status or "active"
    cfg.updated_at = now
    if not cfg.created_at:
        cfg.created_at = now
    if not cfg.created_by:
        cfg.created_by = first_user_id

    if cfg.id:
        await cfg.save()
    else:
        await cfg.insert()


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
            if key == "users":
                if not item.get("email"):
                    continue
                if not item.get("name"):
                    item["name"] = str(item["email"]).split("@", 1)[0].replace(".", " ").title()
                if not item.get("role"):
                    item["role"] = "branch_head"
                # Always regenerate the password hash from the canonical email-based rule
                item["password_hash"] = _hash_password(_password_for_email(str(item.get("email", ""))))
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
                    "demo_users": [
                        "vikram.patel@company.com",
                        "kavitha.rao@company.com",
                        "james.mitchell@company.com",
                        "michael.torres@company.com",
                    ],
                    "live_domains": ["nxzen.com"],
                    "live_users": ["vamsi.krishna@nxzen.com"],
                },
            }),
            ("finance", "Finance System", {
                "provider": "finance_feed",
                "endpoint": "https://api.example.com/finance",
                "sync_frequency": "daily",
            }),
            ("dynamics", "Dynamics 365", {
                "provider": "dynamics_365",
                "endpoint": "https://api.example.com/dynamics",
                "sync_frequency": "manual",
            }),
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

    first_user_id = ""
    first_user = await User.find_all().limit(1).to_list()
    if first_user:
        first_user_id = str(first_user[0].id)
    await ensure_hrms_mode_config(first_user_id)
    created_users, fixed_users = await ensure_demo_login_accounts()
    if fixed_users:
        print(f"  Fixed {fixed_users} user records with empty fields")
    if created_users:
        print(f"  Created {created_users} missing demo login accounts")

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
    db_users = await User.find_all().to_list()
    print(f"  Users:          {len(db_users)}")
    print(f"  Holidays:       {len(data.get('holidays', []))}")
    print(f"  Timesheets:     {len(data.get('timesheet_entries', []))}")
    print(f"  Allocations:    {len(data.get('project_allocations', []))}")
    print()
    print("  Login accounts:")
    for u in sorted(db_users, key=lambda x: x.email.lower()):
        print(f"    {u.email} ({u.role})")
    print()


if __name__ == "__main__":
    asyncio.run(main())
 
