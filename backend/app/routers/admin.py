"""
Admin endpoints for switching between DEMO and LIVE modes.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import ALL_MODELS
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["Admin"])


class ModeResponse(BaseModel):
    mode: str  # "demo" | "live" | "empty"


class SwitchModeRequest(BaseModel):
    mode: str  # "demo" | "live"


@router.get("/mode", response_model=ModeResponse)
async def get_mode():
    """Detect current DB mode by checking which user accounts exist."""
    users = await User.find_all().to_list()
    if not users:
        return {"mode": "empty"}

    emails = [u.email for u in users]
    has_live = any(e.endswith("@nxzen.com") for e in emails)
    has_demo = any(e.endswith("@company.com") for e in emails)

    if has_live and not has_demo:
        return {"mode": "live"}
    if has_demo and not has_live:
        return {"mode": "demo"}
    if has_live and has_demo:
        return {"mode": "demo"}  # mixed state, treat as demo
    return {"mode": "empty"}


@router.post("/switch-mode", response_model=ModeResponse)
async def switch_mode(req: SwitchModeRequest):
    """Wipe the database and re-initialise in the requested mode."""
    if req.mode not in ("demo", "live"):
        raise HTTPException(400, "mode must be 'demo' or 'live'")

    # Clear ALL collections
    for model in ALL_MODELS:
        await model.find_all().delete()

    if req.mode == "live":
        await _seed_live()
    else:
        await _seed_demo()

    return {"mode": req.mode}


# ---------------------------------------------------------------------------
# Inline seed helpers (mirrors the seed scripts but runs inside the app)
# ---------------------------------------------------------------------------

async def _seed_live():
    """Minimal live setup — same as init_db.py."""
    import bcrypt
    from datetime import datetime, timezone
    from app.models.integration_config import IntegrationConfig

    def _hash(pw: str) -> str:
        return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

    now = datetime.now(timezone.utc)

    users = [
        {"email": "manager@nxzen.com", "password": "pass123",
         "name": "Vamsi Ramadugu", "role": "branch_head",
         "branch_location_id": "pending_sync", "employee_id": "pending_sync"},
        {"email": "ganapathy.thimmaiah@nxzen.com", "password": "pass123",
         "name": "Ganapathy Munjandira Thimmaiah", "role": "branch_head",
         "branch_location_id": "pending_sync", "employee_id": "pending_sync"},
    ]
    for u in users:
        await User(
            email=u["email"], password_hash=_hash(u["password"]),
            name=u["name"], role=u["role"],
            branch_location_id=u["branch_location_id"],
            employee_id=u["employee_id"],
        ).insert()

    configs = [
        ("hrms", "HRMS Connector", "active", {
            "provider": "nxzen_hrms",
            "base_url": "http://149.102.158.71:2342",
            "auth_mode": "password_grant",
            "secret_ref": "NXZEN_MANAGER",
            "hr_id": 1,
            "sync_scope": {"months_backfill": 6, "manual_only": True},
            "mode": {"demo_users": ["vikram.patel@company.com"],
                     "live_domains": ["nxzen.com"],
                     "live_users": ["manager@nxzen.com"]},
        }),
        ("finance", "Finance Data Feed", "inactive",
         {"endpoint": "https://api.example.com/finance", "version": "1.0"}),
        ("dynamics", "Dynamics 365 Export", "inactive",
         {"endpoint": "https://api.example.com/dynamics", "version": "1.0"}),
        ("skills", "Skills Portal", "active",
         {"provider": "nxzen_skills", "base_url": "http://skills.nxzen.com/",
          "auth_mode": "password_grant"}),
    ]
    for itype, iname, istatus, cfg in configs:
        await IntegrationConfig(
            integration_type=itype, name=iname, status=istatus,
            config=cfg, created_at=now, updated_at=now,
        ).insert()


async def _seed_demo():
    """Run the full demo seeder in-process."""
    # Import and run the seed function directly (skip_init=True since beanie is already set up)
    from seed.seed_data import seed
    await seed(skip_init=True)
