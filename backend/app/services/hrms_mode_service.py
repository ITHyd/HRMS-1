from typing import Any

from app.config import settings
from app.models.integration_config import IntegrationConfig
from app.models.user import User

LIVE_SOURCE_SYSTEM = "nxzen_hrms"
DEMO_SOURCE_SYSTEM = "nxzen_hrms_demo"


def normalize_sync_mode(sync_mode: str | None) -> str:
    mode = (sync_mode or "live").strip().lower()
    return "demo" if mode == "demo" else "live"


def _csv_to_set(value: str) -> set[str]:
    return {v.strip().lower() for v in (value or "").split(",") if v.strip()}


def _normalize_str_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return []


def _extract_mode_config(mode_config: dict | None) -> dict:
    if not isinstance(mode_config, dict):
        return {}
    raw_mode = mode_config.get("mode")
    if isinstance(raw_mode, dict):
        return raw_mode
    return mode_config


def is_live_sync_enabled_for_user(user_email: str | None, mode_config: dict | None = None) -> bool:
    """
    Decide whether a user should run real HRMS sync or stay on demo mode.

    Precedence:
    1) demo_users list
    2) live_users list
    3) live_domains list
    4) fallback env credentials/token
    """
    email = (user_email or "").strip().lower()
    mode = _extract_mode_config(mode_config)

    demo_users = set(_normalize_str_list(mode.get("demo_users"))) or _csv_to_set(settings.HRMS_DEMO_USERS)
    live_users = set(_normalize_str_list(mode.get("live_users"))) or _csv_to_set(settings.HRMS_LIVE_USERS)
    live_domains = set(_normalize_str_list(mode.get("live_domains"))) or _csv_to_set(settings.HRMS_LIVE_DOMAINS)

    if email and email in demo_users:
        return False

    if email and live_users and email in live_users:
        return True

    if email and live_domains and "@" in email:
        domain = email.split("@", 1)[1]
        if domain in live_domains:
            return True

    return bool(settings.HRMS_AUTH_USERNAME and settings.HRMS_AUTH_PASSWORD) or bool(settings.HRMS_TOKEN)


def get_user_sync_mode(user_email: str | None, mode_config: dict | None = None) -> str:
    return "live" if is_live_sync_enabled_for_user(user_email, mode_config) else "demo"


async def _get_default_mode_config() -> dict:
    cfg_doc = await IntegrationConfig.find_one(
        IntegrationConfig.integration_type == "hrms",
        IntegrationConfig.status == "active",
    )
    if not cfg_doc:
        cfg_doc = await IntegrationConfig.find_one(
            IntegrationConfig.integration_type == "hrms",
        )
    raw_cfg = cfg_doc.config if cfg_doc and isinstance(cfg_doc.config, dict) else {}
    return _extract_mode_config(raw_cfg)


async def resolve_user_sync_mode(
    user_id: str,
    user_email: str | None = None,
    mode_config: dict | None = None,
) -> str:
    email = (user_email or "").strip().lower()
    if not email and user_id:
        db_user = await User.get(user_id)
        email = db_user.email.lower() if db_user else ""

    effective_mode_cfg = mode_config if isinstance(mode_config, dict) else await _get_default_mode_config()
    return get_user_sync_mode(email, effective_mode_cfg)


def get_timesheet_visibility_filter(sync_mode: str | None) -> dict[str, Any]:
    mode = normalize_sync_mode(sync_mode)
    if mode == "live":
        # Live users see manual entries + live HRMS rows only.
        return {
            "$or": [
                {"source": {"$ne": "hrms_sync"}},
                {"source_system": LIVE_SOURCE_SYSTEM},
            ]
        }

    # Demo users see manual entries + non-live HRMS rows.
    return {
        "$or": [
            {"source": {"$ne": "hrms_sync"}},
            {"source_system": {"$ne": LIVE_SOURCE_SYSTEM}},
        ]
    }


def get_allocation_visibility_filter(sync_mode: str | None) -> dict[str, Any]:
    mode = normalize_sync_mode(sync_mode)
    if mode == "live":
        return {"source_system": LIVE_SOURCE_SYSTEM}
    return {"source_system": {"$ne": LIVE_SOURCE_SYSTEM}}


def get_attendance_visibility_filter(sync_mode: str | None) -> dict[str, Any]:
    mode = normalize_sync_mode(sync_mode)
    if mode == "live":
        return {"source_system": LIVE_SOURCE_SYSTEM}
    return {"source_system": {"$ne": LIVE_SOURCE_SYSTEM}}


def get_snapshot_visibility_filter(sync_mode: str | None) -> dict[str, Any]:
    mode = normalize_sync_mode(sync_mode)
    if mode == "live":
        # Backward-compatible: include legacy snapshots without sync_mode.
        return {
            "$or": [
                {"sync_mode": "live"},
                {"sync_mode": {"$exists": False}},
            ]
        }
    return {"sync_mode": "demo"}
