"""
init_db.py — First-time setup for a fresh MongoDB instance.

Creates:
  1. Login user accounts (branch heads)
  2. HRMS integration config

Run once on any new machine before starting the app:
    cd backend
    python -m seed.init_db

After this, log in and use Integration Hub → HRMS → Sync Now to pull all data.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bcrypt

from app.database import init_db
from app.models.integration_config import IntegrationConfig
from app.models.user import User


# ---------------------------------------------------------------------------
# Configuration — edit these for each deployment
# ---------------------------------------------------------------------------

USERS = [
    {
        "email": "vamsi.krishna@nxzen.com",
        "password": "password123",
        "name": "Vamsi Ramadugu",
        "role": "branch_head",
        # branch_location_id will be set automatically during the first HRMS sync
        "branch_location_id": "pending_sync",
        "employee_id": "pending_sync",
    },
    {
        "email": "ganapathy.thimmaiah@nxzen.com",
        "password": "password123",
        "name": "Ganapathy Munjandira Thimmaiah",
        "role": "branch_head",
        "branch_location_id": "pending_sync",
        "employee_id": "pending_sync",
    },
]

INTEGRATION_CONFIGS = [
    {
        "integration_type": "hrms",
        "name": "HRMS Connector",
        "status": "active",
        "config": {
            "provider": "nxzen_hrms",
            "base_url": "http://149.102.158.71:2342",
            "auth_mode": "password_grant",
            "secret_ref": "NXZEN_MANAGER",
            "hr_id": 1,
            "sync_scope": {
                "months_backfill": 6,
                "manual_only": True,
            },
            "mode": {
                "demo_users": ["vikram.patel@company.com"],
                "live_domains": ["nxzen.com"],
                "live_users": ["vamsi.krishna@nxzen.com"],
            },
        },
    },
    {
        "integration_type": "finance",
        "name": "Finance Data Feed",
        "status": "inactive",
        "config": {"endpoint": "https://api.example.com/finance", "version": "1.0"},
    },
    {
        "integration_type": "dynamics",
        "name": "Dynamics 365 Export",
        "status": "inactive",
        "config": {"endpoint": "https://api.example.com/dynamics", "version": "1.0"},
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


async def _ensure_users() -> int:
    created = 0
    for u in USERS:
        existing = await User.find_one(User.email == u["email"])
        if existing:
            print(f"  [skip] user already exists: {u['email']}")
            continue
        doc = User(
            email=u["email"],
            password_hash=_hash(u["password"]),
            name=u["name"],
            role=u["role"],
            branch_location_id=u["branch_location_id"],
            employee_id=u["employee_id"],
        )
        await doc.insert()
        print(f"  [ok]   created user: {u['email']}  (password: {u['password']})")
        created += 1
    return created


async def _ensure_integration_configs() -> int:
    created = 0
    for cfg in INTEGRATION_CONFIGS:
        existing = await IntegrationConfig.find_one(
            IntegrationConfig.integration_type == cfg["integration_type"]
        )
        if existing:
            print(f"  [skip] integration config already exists: {cfg['integration_type']}")
            continue
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        doc = IntegrationConfig(
            integration_type=cfg["integration_type"],
            name=cfg["name"],
            status=cfg["status"],
            config=cfg["config"],
            created_at=now,
            updated_at=now,
        )
        await doc.insert()
        print(f"  [ok]   created integration config: {cfg['name']}")
        created += 1
    return created


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    print("Connecting to MongoDB...")
    await init_db()

    print("\nUsers:")
    u = await _ensure_users()

    print("\nIntegration configs:")
    c = await _ensure_integration_configs()

    print(f"\nDone. Created {u} user(s), {c} integration config(s).")
    if u > 0:
        print("\nNext step: Log in and go to Integration Hub > HRMS > Sync Now")
        print("           This will import all employees, projects, and timesheets.")


if __name__ == "__main__":
    asyncio.run(main())
