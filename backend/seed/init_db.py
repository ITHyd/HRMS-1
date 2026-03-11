"""
init_db.py — LIVE mode database setup.

Drops ALL collections and creates:
  1. Login user accounts (branch heads) with pending_sync placeholders
  2. Integration configs (HRMS, Finance, Dynamics, Skills)

After this, log in and use Integration Hub > HRMS > Sync Now to pull all
employees, projects, timesheets, and resolve branch head location/employee IDs.

Usage:
    cd backend
    python -m seed.init_db
"""

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bcrypt

from app.database import ALL_MODELS, init_db
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
    {
        "integration_type": "skills",
        "name": "Skills Portal",
        "status": "active",
        "config": {
            "provider": "nxzen_skills",
            "base_url": "http://skills.nxzen.com/",
            "auth_mode": "password_grant",
        },
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    print("Connecting to MongoDB...")
    await init_db()

    # ── Drop ALL collections for a clean slate ──
    print("\nClearing database (switching to LIVE mode)...")
    for model in ALL_MODELS:
        await model.find_all().delete()
    print("All collections cleared.")

    # ── Users ──
    now = datetime.now(timezone.utc)
    print("\nUsers:")
    for u in USERS:
        doc = User(
            email=u["email"],
            password_hash=_hash(u["password"]),
            name=u["name"],
            role=u["role"],
            branch_location_id=u["branch_location_id"],
            employee_id=u["employee_id"],
        )
        await doc.insert()
        print(f"  [ok] created user: {u['email']}  (password: {u['password']})")

    # ── Integration configs ──
    print("\nIntegration configs:")
    for cfg in INTEGRATION_CONFIGS:
        doc = IntegrationConfig(
            integration_type=cfg["integration_type"],
            name=cfg["name"],
            status=cfg["status"],
            config=cfg["config"],
            created_at=now,
            updated_at=now,
        )
        await doc.insert()
        print(f"  [ok] created: {cfg['name']}")

    print(f"\n{'='*55}")
    print(f"  LIVE MODE — {len(USERS)} user(s), {len(INTEGRATION_CONFIGS)} config(s)")
    print(f"{'='*55}")
    print("\nNext step: Log in and go to Integration Hub > HRMS > Sync Now")
    print("           This will import all employees, projects, and timesheets.")


if __name__ == "__main__":
    asyncio.run(main())
