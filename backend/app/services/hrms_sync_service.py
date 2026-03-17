"""
HRMS sync service.

- sync_master_data(): Idempotent master-data sync from real HRMS.
- trigger_live_sync(): Manual live sync for attendance/timesheets/allocations.
- trigger_sync() / get_sync_logs(): Legacy demo sync support.
"""

import asyncio
import calendar
import os
import random
import re
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

import bcrypt
from pymongo import UpdateOne

from app.config import settings
from app.models.attendance_summary import AttendanceSummary
from app.models.department import Department
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.hrms_holiday import HrmsHoliday
from app.models.hrms_sync_log import HrmsSyncLog
from app.models.integration_config import IntegrationConfig
from app.models.location import Location
from app.models.project import Project
from app.models.project_allocation import ProjectAllocation
from app.models.reporting_relationship import ReportingRelationship
from app.models.timesheet_entry import TimesheetEntry
from app.models.user import User
from app.services.hrms_client import HrmsClient
from app.services.utilisation_service import compute_utilisation

SOURCE_SYSTEM = "nxzen_hrms"


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# HRMS role -> our level mapping
ROLE_TO_LEVEL = {
    "Employee": "mid",
    "Manager": "manager",
    "HR": "manager",
    "itadmin": "mid",
    "Account Manager": "manager",
}

# HRMS location_id -> (city, country, region, code)
LOCATION_META = {
    1: ("Hyderabad", "India", "APAC", "HYD"),
    5: ("Bangalore", "India", "APAC", "BLR"),
}

# Designated branch heads: HRMS location_id -> HRMS employeeId
BRANCH_HEAD_OVERRIDES = {
    1: 1153,   # Hyderabad -> Vamsi Ramadugu
    5: 1127,   # Bangalore -> Ganapathy Munjandira Thimmaiah
}


def _csv_to_set(value: str) -> set[str]:
    return {v.strip().lower() for v in (value or "").split(",") if v.strip()}


def _normalize_str_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return []


def _to_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def _to_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", (value or "").strip().lower())
    slug = slug.strip("-")
    return slug or "unknown"


def _source_updated_at(raw: Any) -> datetime | None:
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None


def normalize_hrms_config(raw_config: dict | None) -> dict:
    raw_config = raw_config if isinstance(raw_config, dict) else {}

    raw_scope = raw_config.get("sync_scope") if isinstance(raw_config.get("sync_scope"), dict) else {}
    raw_mode = raw_config.get("mode") if isinstance(raw_config.get("mode"), dict) else {}

    demo_users = _normalize_str_list(raw_mode.get("demo_users"))
    if not demo_users:
        demo_users = sorted(_csv_to_set(settings.HRMS_DEMO_USERS))

    live_domains = _normalize_str_list(raw_mode.get("live_domains"))
    if not live_domains:
        live_domains = _normalize_str_list(settings.HRMS_LIVE_DOMAINS)

    live_users = _normalize_str_list(raw_mode.get("live_users"))
    if not live_users:
        live_users = sorted(_csv_to_set(settings.HRMS_LIVE_USERS))

    months_backfill = _to_int(raw_scope.get("months_backfill"), settings.HRMS_SYNC_MONTHS_BACKFILL)
    months_backfill = max(1, months_backfill)

    return {
        "provider": str(raw_config.get("provider") or "nxzen_hrms"),
        "base_url": str(raw_config.get("base_url") or settings.HRMS_BASE_URL),
        "auth_mode": str(raw_config.get("auth_mode") or "password_grant").lower(),
        "secret_ref": str(raw_config.get("secret_ref") or "").strip(),
        "token": str(raw_config.get("token") or "").strip(),
        "hr_id": _to_int(raw_config.get("hr_id"), 1),
        "sync_scope": {
            "months_backfill": months_backfill,
            "manual_only": _to_bool(raw_scope.get("manual_only"), True),
        },
        "mode": {
            "demo_users": [u.lower() for u in demo_users],
            "live_domains": [d.lower() for d in live_domains],
            "live_users": [u.lower() for u in live_users],
        },
    }


async def get_hrms_integration_config(config_id: str | None = None) -> tuple[IntegrationConfig | None, dict]:
    cfg_doc: IntegrationConfig | None = None

    if config_id:
        cfg_doc = await IntegrationConfig.get(config_id)
        if cfg_doc and cfg_doc.integration_type != "hrms":
            raise ValueError("Integration config is not HRMS")
    else:
        cfg_doc = await IntegrationConfig.find_one(
            IntegrationConfig.integration_type == "hrms",
            IntegrationConfig.status == "active",
        )
        if not cfg_doc:
            cfg_doc = await IntegrationConfig.find_one(
                IntegrationConfig.integration_type == "hrms",
            )

    cfg = normalize_hrms_config(cfg_doc.config if cfg_doc else None)
    return cfg_doc, cfg


def is_live_sync_enabled_for_user(user_email: str | None, mode_config: dict | None = None) -> bool:
    """
    Decide whether a user should run real HRMS sync or stay on demo mode.

    Precedence:
    1) demo_users list
    2) live_users list
    3) live_domains list
    4) fallback env flags/credentials
    """
    email = (user_email or "").strip().lower()

    mode = mode_config if isinstance(mode_config, dict) else {}
    demo_users = set(_normalize_str_list(mode.get("demo_users"))) or _csv_to_set(settings.HRMS_DEMO_USERS)
    live_users = set(_normalize_str_list(mode.get("live_users"))) or _csv_to_set(settings.HRMS_LIVE_USERS)
    live_domains = set(_normalize_str_list(mode.get("live_domains"))) or _csv_to_set(settings.HRMS_LIVE_DOMAINS)

    if email and email in demo_users:
        return False

    if email and email in live_users:
        return True

    if email and live_domains and "@" in email:
        domain = email.split("@", 1)[1]
        return domain in live_domains

    return bool(settings.HRMS_AUTH_USERNAME and settings.HRMS_AUTH_PASSWORD) or bool(settings.HRMS_TOKEN)


def _secret_ref_key(secret_ref: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "_", (secret_ref or "").strip().upper()).strip("_")


def _resolve_secret_credentials(secret_ref: str) -> tuple[str | None, str | None]:
    ref = _secret_ref_key(secret_ref)
    if not ref:
        return None, None
    username = os.getenv(f"HRMS_SECRET_{ref}_USERNAME")
    password = os.getenv(f"HRMS_SECRET_{ref}_PASSWORD")
    return username, password


async def _resolve_hrms_auth(
    token: str | None = None,
    integration_config: dict | None = None,
) -> tuple[str, int, str]:
    """
    Resolve an access token for HRMS API calls and return (token, hr_id, base_url).

    Priority:
    1) explicit token argument
    2) auth_mode=static_token with config/env token
    3) auth_mode=password_grant with secret_ref/env credentials
    """
    cfg = normalize_hrms_config(integration_config)
    base_url = cfg.get("base_url") or settings.HRMS_BASE_URL
    hr_id = _to_int(cfg.get("hr_id"), 1)

    if token:
        return token, hr_id, base_url

    auth_mode = str(cfg.get("auth_mode") or "password_grant").lower()
    if auth_mode == "static_token":
        static_token = str(cfg.get("token") or "").strip() or settings.HRMS_TOKEN
        if not static_token:
            raise ValueError("HRMS static token auth is configured but no token is available")
        return static_token, hr_id, base_url

    # password_grant
    username = None
    password = None
    secret_ref = str(cfg.get("secret_ref") or "").strip()
    if secret_ref:
        username, password = _resolve_secret_credentials(secret_ref)

    username = username or settings.HRMS_AUTH_USERNAME
    password = password or settings.HRMS_AUTH_PASSWORD

    if not username or not password:
        raise ValueError(
            "HRMS credentials are not configured. Provide IntegrationConfig secret_ref and set "
            "HRMS_SECRET_<REF>_USERNAME/HRMS_SECRET_<REF>_PASSWORD."
        )

    client = HrmsClient(base_url=base_url)
    login_data = await client.login_with_password(
        username=username,
        password=password,
    )
    access_token = login_data.get("access_token")
    if not access_token:
        raise ValueError("Failed to retrieve HRMS access token from /users/login")

    if not cfg.get("hr_id"):
        hr_id = _to_int(login_data.get("employeeId"), 1)

    return access_token, hr_id, base_url


async def get_auth_token(integration_config_id: str | None = None) -> str:
    """Resolve HRMS auth token (logs in if needed). Reuse to avoid duplicate logins."""
    cfg_doc, hrms_cfg = await get_hrms_integration_config(integration_config_id)
    token, _, _ = await _resolve_hrms_auth(None, hrms_cfg)
    return token


def _recent_periods(anchor_period: str, months: int) -> list[str]:
    """
    Return a chronological list of periods ending at anchor_period.
    Example: anchor=2026-03, months=3 -> [2026-01, 2026-02, 2026-03]
    """
    months = max(1, months)
    year, month = int(anchor_period[:4]), int(anchor_period[5:7])

    periods = []
    for _ in range(months):
        periods.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month < 1:
            month = 12
            year -= 1
    periods.reverse()
    return periods


def _new_entity_counts() -> dict[str, dict[str, int]]:
    return defaultdict(lambda: {
        "processed": 0,
        "imported": 0,
        "updated": 0,
        "failed": 0,
        "deleted": 0,
    })


def _add_error(error_list: list[dict], *, entity: str, key: str, error: str) -> None:
    error_list.append({"entity": entity, "key": key, "error": error})


async def _upsert_by_source(
    model_cls,
    source_id: str,
    payload: dict,
    now: datetime,
    source_updated_at: datetime | None = None,
    fallback_filters: list[dict] | None = None,
):
    doc = await model_cls.find_one(
        model_cls.source_system == SOURCE_SYSTEM,
        model_cls.source_id == source_id,
    )

    if not doc and fallback_filters:
        for f in fallback_filters:
            doc = await model_cls.find_one(f)
            if doc:
                break

    if doc:
        for k, v in payload.items():
            setattr(doc, k, v)
        doc.source_system = SOURCE_SYSTEM
        doc.source_id = source_id
        doc.source_updated_at = source_updated_at
        doc.last_synced_at = now
        doc.is_deleted = False
        await doc.save()
        return doc, False

    new_doc = model_cls(
        **payload,
        source_system=SOURCE_SYSTEM,
        source_id=source_id,
        source_updated_at=source_updated_at,
        last_synced_at=now,
        is_deleted=False,
    )
    await new_doc.insert()
    return new_doc, True


async def _bulk_upsert_by_source(
    model_cls,
    items: list[dict],
    now: datetime,
) -> list[tuple]:
    """
    Batch version of _upsert_by_source.

    Each item in `items` is a dict with keys:
      - source_id: str
      - payload: dict
      - source_updated_at: datetime | None (optional)
      - fallback_filters: list[dict] (optional)

    Returns list of (doc, created_bool) in same order as items.
    """
    if not items:
        return []

    # 1. Bulk fetch ALL existing docs by source_system + source_id (one query)
    all_source_ids = [it["source_id"] for it in items]
    existing = await model_cls.find(
        {"source_system": SOURCE_SYSTEM, "source_id": {"$in": all_source_ids}}
    ).to_list()
    by_source = {doc.source_id: doc for doc in existing}

    # 2. Match each item; fallback for unmatched
    matched: dict[int, Any] = {}  # index -> existing doc
    for i, item in enumerate(items):
        doc = by_source.get(item["source_id"])
        if not doc:
            for f in item.get("fallback_filters") or []:
                doc = await model_cls.find_one(f)
                if doc:
                    break
        if doc:
            matched[i] = doc

    # 3. Bulk update matched docs via pymongo bulk_write
    if matched:
        ops = []
        for i, doc in matched.items():
            item = items[i]
            update_fields = {
                **item["payload"],
                "source_system": SOURCE_SYSTEM,
                "source_id": item["source_id"],
                "last_synced_at": now,
                "is_deleted": False,
            }
            if item.get("source_updated_at"):
                update_fields["source_updated_at"] = item["source_updated_at"]
            ops.append(UpdateOne({"_id": doc.id}, {"$set": update_fields}))
        collection = model_cls.get_pymongo_collection()
        await collection.bulk_write(ops, ordered=False)

    # 4. Bulk insert new docs
    to_insert_indices = [i for i in range(len(items)) if i not in matched]
    new_docs: list[tuple[int, Any]] = []
    for i in to_insert_indices:
        item = items[i]
        doc_kwargs = {
            **item["payload"],
            "source_system": SOURCE_SYSTEM,
            "source_id": item["source_id"],
            "last_synced_at": now,
            "is_deleted": False,
        }
        if item.get("source_updated_at"):
            doc_kwargs["source_updated_at"] = item["source_updated_at"]
        new_doc = model_cls(**doc_kwargs)
        new_docs.append((i, new_doc))

    if new_docs:
        docs_to_insert = [doc for _, doc in new_docs]
        insert_result = await model_cls.insert_many(docs_to_insert)
        # Beanie insert_many does NOT populate IDs on the original objects,
        # so we must set them manually from the result.
        for doc, inserted_id in zip(docs_to_insert, insert_result.inserted_ids):
            doc.id = inserted_id

    # 5. Build results in same order as items
    results: list[tuple] = [None] * len(items)
    for i, doc in matched.items():
        results[i] = (doc, False)
    for i, doc in new_docs:
        results[i] = (doc, True)

    return results


async def _soft_delete_missing(
    model_cls,
    seen_source_ids: set[str],
    now: datetime,
    extra_filter: dict | None = None,
    deactivate_employees: bool = False,
) -> int:
    filters = [{"source_system": SOURCE_SYSTEM}]
    if extra_filter:
        filters.append(extra_filter)

    docs = await model_cls.find(*filters).to_list()
    deleted = 0
    for doc in docs:
        if doc.source_id in seen_source_ids:
            continue
        if getattr(doc, "is_deleted", False):
            continue
        doc.is_deleted = True
        doc.last_synced_at = now
        if deactivate_employees and hasattr(doc, "is_active"):
            doc.is_active = False
        await doc.save()
        deleted += 1
    return deleted


async def _delete_stale_period_docs(
    model_cls,
    period: str,
    seen_source_ids: set[str],
) -> int:
    docs = await model_cls.find(
        {"source_system": SOURCE_SYSTEM, "period": period}
    ).to_list()
    deleted = 0
    for doc in docs:
        if doc.source_id in seen_source_ids:
            continue
        await doc.delete()
        deleted += 1
    return deleted


# ======================================================================
# Master data sync (real HRMS)
# ======================================================================


async def sync_master_data(
    token: str | None,
    user_id: str,
    integration_config_id: str | None = None,
) -> dict:
    return await _sync_master_data_impl(
        token=token,
        user_id=user_id,
        integration_config_id=integration_config_id,
    )

    # Legacy implementation retained below for reference.
    """
    Full replacement sync of master data from HRMS.

    Clears existing data and re-creates:
    - Locations, Departments, Employees, Projects,
      EmployeeProject assignments, ReportingRelationships, Users.

    Returns a summary dict with counts.
    """
    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Create sync log
    sync_log = HrmsSyncLog(
        batch_id=batch_id,
        branch_location_id="ALL",
        period="master-data",
        status="running",
        total_records=0,
        imported_count=0,
        duplicate_count=0,
        error_count=0,
        errors=[],
        started_at=now,
        triggered_by=user_id,
    )
    await sync_log.insert()

    try:
        resolved_token, _ = await _resolve_hrms_auth(token)
        client = HrmsClient(token=resolved_token)

        # ----- Fetch all data from HRMS -----
        hrms_employees = await client.get_employees()
        hrms_projects = await client.get_projects()
        hrms_locations = await client.get_locations()
        hrms_managers = await client.get_managers()
        hrms_hrs = await client.get_hrs()

        sync_log.total_records = (
            len(hrms_employees) + len(hrms_projects)
        )

        # ----- Clear existing collections -----
        await Location.find_all().delete()
        await Department.find_all().delete()
        await Employee.find_all().delete()
        await Project.find_all().delete()
        await EmployeeProject.find_all().delete()
        await ReportingRelationship.find_all().delete()
        await User.find_all().delete()

        imported = 0
        errors = []

        # ----- 1. Locations -----
        # Maps: hrms_location_id (int) -> our MongoDB Location id (str)
        loc_id_map: dict[int, str] = {}
        for hloc in hrms_locations:
            hid = hloc.get("id")
            hname = hloc.get("name", "Unknown")
            meta = LOCATION_META.get(hid)
            if meta:
                city, country, region, code = meta
            else:
                city = hname
                country = "India"
                region = "APAC"
                code = hname[:3].upper()

            loc = Location(
                hrms_location_id=hid,
                city=city,
                country=country,
                region=region,
                code=code,
            )
            await loc.insert()
            loc_id_map[hid] = str(loc.id)
            imported += 1

        # ----- 2. Departments -----
        # HRMS has no department data, so derive from project "account" field
        account_set: set[str] = set()
        for p in hrms_projects:
            acct = p.get("account")
            if acct:
                account_set.add(acct)
        account_set.add("General")  # fallback

        # Create one department per account
        dept_id_map: dict[str, str] = {}  # account_name -> mongo dept id
        default_loc_id = list(loc_id_map.values())[0] if loc_id_map else ""
        for acct in sorted(account_set):
            dept = Department(name=acct, location_id=default_loc_id)
            await dept.insert()
            dept_id_map[acct] = str(dept.id)
            imported += 1

        general_dept_id = dept_id_map["General"]

        # ----- 3. Employees -----
        # Maps: hrms_employeeId (int) -> our MongoDB Employee id (str)
        emp_id_map: dict[int, str] = {}
        # Also map hrms_name -> hrms_employeeId for resolving manager names
        emp_name_to_hid: dict[str, int] = {}

        for hemp in hrms_employees:
            hid = hemp.get("employeeId")
            name = hemp.get("name", "Unknown")
            email = hemp.get("email", "")
            role = hemp.get("role", "Employee")
            hloc_id = hemp.get("location_id")
            doj_raw = hemp.get("doj")

            # Resolve location
            our_loc_id = loc_id_map.get(hloc_id, default_loc_id) if hloc_id else default_loc_id

            # Parse join date — None when HRMS has no doj
            join_date = None
            if doj_raw:
                try:
                    join_date = datetime.fromisoformat(str(doj_raw).replace("Z", "+00:00"))
                except Exception:
                    pass

            level = ROLE_TO_LEVEL.get(role, "mid")

            emp = Employee(
                hrms_employee_id=hid,
                name=name,
                email=email,
                designation=role,
                department_id=general_dept_id,
                level=level,
                location_id=our_loc_id,
                join_date=join_date,
                is_active=True,
            )
            await emp.insert()
            emp_id_map[hid] = str(emp.id)
            emp_name_to_hid[name] = hid
            imported += 1

        # Also map manager/HR names that might not be in the employee list
        for mgr in hrms_managers:
            mid = mgr.get("id")
            mname = mgr.get("name", "")
            if mid not in emp_id_map:
                emp_name_to_hid[mname] = mid
        for hr in hrms_hrs:
            hrid = hr.get("id")
            hrname = hr.get("name", "")
            if hrid not in emp_id_map:
                emp_name_to_hid[hrname] = hrid

        # ----- 4. Projects -----
        # Maps: hrms_project_id (int) -> our MongoDB Project id (str)
        proj_id_map: dict[int, str] = {}
        # Track assignments: (hrms_emp_id, hrms_proj_id, role)
        emp_project_assignments: list[tuple[int, int, str]] = []

        for hproj in hrms_projects:
            hpid = hproj.get("project_id")
            pname = hproj.get("project_name", "Unknown")
            status_raw = hproj.get("status", "Active")
            account = hproj.get("account")
            start_raw = hproj.get("start_date")
            end_raw = hproj.get("end_date")

            status = "ACTIVE" if status_raw == "Active" else status_raw.upper()
            dept_id = dept_id_map.get(account, general_dept_id)

            start_date = now
            end_date = None
            if start_raw:
                try:
                    start_date = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
                except Exception:
                    pass
            if end_raw:
                try:
                    end_date = datetime.fromisoformat(end_raw.replace("Z", "+00:00"))
                except Exception:
                    pass

            proj = Project(
                hrms_project_id=hpid,
                name=pname,
                status=status,
                client_name=account or "General",
                department_id=dept_id,
                start_date=start_date,
                end_date=end_date,
            )
            await proj.insert()
            proj_id_map[hpid] = str(proj.id)
            imported += 1

            # Collect assignments
            for assignment in hproj.get("assignments") or []:
                a_emp_id = assignment.get("employee_id")
                a_role = assignment.get("role", "contributor")
                if a_emp_id:
                    emp_project_assignments.append((a_emp_id, hpid, a_role))

        # ----- 5. Update employee departments from primary project -----
        emp_dept_map: dict[int, str] = {}
        for (hemp_id, hproj_id, _role) in emp_project_assignments:
            if hemp_id not in emp_dept_map:
                for hproj in hrms_projects:
                    if hproj.get("project_id") == hproj_id:
                        acct = hproj.get("account")
                        if acct and acct in dept_id_map:
                            emp_dept_map[hemp_id] = dept_id_map[acct]
                        break

        for hemp_id, dept_id in emp_dept_map.items():
            mongo_emp_id = emp_id_map.get(hemp_id)
            if mongo_emp_id:
                emp = await Employee.get(mongo_emp_id)
                if emp:
                    emp.department_id = dept_id
                    await emp.save()

        # ----- 6. EmployeeProject assignments -----
        for (hemp_id, hproj_id, role) in emp_project_assignments:
            our_emp_id = emp_id_map.get(hemp_id)
            our_proj_id = proj_id_map.get(hproj_id)
            if our_emp_id and our_proj_id:
                ep = EmployeeProject(
                    employee_id=our_emp_id,
                    project_id=our_proj_id,
                    role_in_project=role.lower() if role else "contributor",
                )
                await ep.insert()
                imported += 1

        # ----- 7. Reporting Relationships -----
        for hemp in hrms_employees:
            hid = hemp.get("employeeId")
            our_emp_id = emp_id_map.get(hid)
            if not our_emp_id:
                continue

            # Managers (names list)
            manager_names = hemp.get("managers", [])
            for idx, mname in enumerate(manager_names):
                mgr_hid = emp_name_to_hid.get(mname)
                mgr_mongo_id = emp_id_map.get(mgr_hid) if mgr_hid else None
                # Skip self-referencing relationships
                if mgr_mongo_id and mgr_mongo_id != our_emp_id:
                    rel_type = "PRIMARY" if idx == 0 else "FUNCTIONAL"
                    rel = ReportingRelationship(
                        employee_id=our_emp_id,
                        manager_id=mgr_mongo_id,
                        type=rel_type,
                    )
                    await rel.insert()
                    imported += 1

            # HRs (names list)
            hr_names = hemp.get("hr", [])
            for hrname in hr_names:
                hr_hid = emp_name_to_hid.get(hrname)
                hr_mongo_id = emp_id_map.get(hr_hid) if hr_hid else None
                if hr_mongo_id and hr_mongo_id != our_emp_id:
                    rel = ReportingRelationship(
                        employee_id=our_emp_id,
                        manager_id=hr_mongo_id,
                        type="FUNCTIONAL",
                    )
                    await rel.insert()
                    imported += 1

        # ----- 8. Users (create login accounts) -----
        default_password_hash = _hash_password("password123")

        # Create one branch_head user per location
        for hloc_id, our_loc_id in loc_id_map.items():
            meta = LOCATION_META.get(hloc_id)
            if not meta:
                continue
            city = meta[0]

            # Use designated branch head if configured
            branch_head_emp = None
            override_hid = BRANCH_HEAD_OVERRIDES.get(hloc_id)
            if override_hid and override_hid in emp_id_map:
                for hemp in hrms_employees:
                    if hemp.get("employeeId") == override_hid:
                        branch_head_emp = hemp
                        break

            # Fallback: first Manager in this location
            if not branch_head_emp:
                for hemp in hrms_employees:
                    if hemp.get("location_id") == hloc_id and hemp.get("role") == "Manager":
                        hid = hemp.get("employeeId")
                        if hid in emp_id_map:
                            branch_head_emp = hemp
                            break

            if not branch_head_emp:
                for hemp in hrms_employees:
                    if hemp.get("location_id") == hloc_id:
                        branch_head_emp = hemp
                        break

            if branch_head_emp:
                hid = branch_head_emp.get("employeeId")
                user = User(
                    email=branch_head_emp.get("email", f"admin@{city.lower()}.local"),
                    password_hash=default_password_hash,
                    employee_id=emp_id_map.get(hid, ""),
                    branch_location_id=our_loc_id,
                    name=branch_head_emp.get("name", f"{city} Branch Head"),
                    role="branch_head",
                )
                await user.insert()
                imported += 1

        # ----- Finalize sync log -----
        sync_log.status = "completed"
        sync_log.imported_count = imported
        sync_log.error_count = len(errors)
        sync_log.errors = errors
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()

    except Exception as e:
        sync_log.status = "failed"
        sync_log.errors = [{"message": str(e)}]
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()
        raise

    return {
        "batch_id": batch_id,
        "status": "completed",
        "imported_count": imported,
        "summary": {
            "locations": len(loc_id_map),
            "departments": len(dept_id_map),
            "employees": len(emp_id_map),
            "projects": len(proj_id_map),
            "assignments": len(emp_project_assignments),
        },
    }


# ======================================================================
# Live: real period sync (manual trigger)
# ======================================================================


async def _sync_holidays_from_hrms(client: HrmsClient) -> int:
    """Upsert holidays by HRMS holiday id."""
    holidays_raw = await client.get_holidays()
    if not isinstance(holidays_raw, list):
        return 0

    locations = await Location.find({"hrms_location_id": {"$ne": None}}).to_list()
    loc_map = {l.hrms_location_id: str(l.id) for l in locations if l.hrms_location_id is not None}

    imported = 0
    for h in holidays_raw:
        hrms_id = h.get("id")
        if hrms_id is None:
            continue

        hloc_id = h.get("location_id")
        holiday_date_raw = str(h.get("holiday_date", ""))[:10]
        if not holiday_date_raw:
            continue

        try:
            holiday_date = datetime.fromisoformat(holiday_date_raw).date()
        except ValueError:
            continue

        existing = await HrmsHoliday.find_one(HrmsHoliday.hrms_id == int(hrms_id))
        payload = {
            "location_id": loc_map.get(hloc_id),
            "hrms_location_id": hloc_id,
            "holiday_date": holiday_date,
            "holiday_name": h.get("holiday_name", ""),
            "holiday_type": h.get("holiday_type"),
            "year": holiday_date.year,
        }
        if existing:
            existing.location_id = payload["location_id"]
            existing.hrms_location_id = payload["hrms_location_id"]
            existing.holiday_date = payload["holiday_date"]
            existing.holiday_name = payload["holiday_name"]
            existing.holiday_type = payload["holiday_type"]
            existing.year = payload["year"]
            await existing.save()
        else:
            await HrmsHoliday(
                hrms_id=int(hrms_id),
                **payload,
            ).insert()
        imported += 1

    return imported


async def _sync_single_period(
    client: HrmsClient,
    period: str,
    hr_id: int,
    batch_id: str,
) -> dict:
    """Sync attendance summary, daily timesheets, and allocations for one period."""
    year, month = int(period[:4]), int(period[5:7])
    now = datetime.now(timezone.utc)

    employees = await Employee.find({"hrms_employee_id": {"$ne": None}}).to_list()
    projects = await Project.find({"hrms_project_id": {"$ne": None}}).to_list()
    emp_map = {e.hrms_employee_id: e for e in employees if e.hrms_employee_id is not None}
    proj_map = {p.hrms_project_id: p for p in projects if p.hrms_project_id is not None}
    emp_ids = [str(e.id) for e in employees]
    if not emp_ids:
        raise ValueError("No HRMS-mapped employees found. Master mapping is required before live sync.")

    attendance_raw = await client.get_attendance_summary(hr_id=hr_id, year=year, month=month)
    if not isinstance(attendance_raw, list):
        attendance_raw = []

    # Pull daily attendance only for employees with hours (batched concurrently).
    daily_raw: dict[int, list[dict]] = {}
    active_eids = [
        int(a["employee_id"])
        for a in attendance_raw
        if a.get("employee_id") is not None and (a.get("total_hours", 0) or 0) > 0
    ]
    BATCH_SIZE = 50
    for batch_start in range(0, len(active_eids), BATCH_SIZE):
        batch = active_eids[batch_start : batch_start + BATCH_SIZE]

        async def _fetch(eid: int) -> tuple[int, list[dict]]:
            try:
                data = await client.get_daily_attendance(employee_id=eid, year=year, month=month)
                return eid, data if isinstance(data, list) else []
            except Exception:
                return eid, []

        results = await asyncio.gather(*[_fetch(eid) for eid in batch])
        for eid, data in results:
            if data:
                daily_raw[eid] = data

    allocations_raw = await client.get_allocations(period)
    if not isinstance(allocations_raw, dict):
        allocations_raw = {"employees": [], "total_working_days": 22}

    # Replace period data for HRMS-sourced employees.
    if emp_ids:
        await AttendanceSummary.find(
            AttendanceSummary.period == period,
            {"employee_id": {"$in": emp_ids}},
        ).delete()
        await ProjectAllocation.find(
            ProjectAllocation.period == period,
            {"employee_id": {"$in": emp_ids}},
        ).delete()
        await TimesheetEntry.find(
            TimesheetEntry.period == period,
            TimesheetEntry.source == "hrms_sync",
            {"employee_id": {"$in": emp_ids}},
        ).delete()

    attendance_docs = []
    for a in attendance_raw:
        hrms_eid = a.get("employee_id")
        if hrms_eid is None:
            continue
        emp = emp_map.get(int(hrms_eid))
        if not emp:
            continue
        attendance_docs.append(
            AttendanceSummary(
                period=period,
                employee_id=str(emp.id),
                hrms_employee_id=int(hrms_eid),
                employee_name=a.get("name", ""),
                present_days=int(a.get("present", 0) or 0),
                wfh_days=int(a.get("wfh", 0) or 0),
                leave_days=int(a.get("leave", 0) or 0),
                total_hours=float(a.get("total_hours", 0.0) or 0.0),
                sync_batch_id=batch_id,
                synced_at=now,
            )
        )

    if attendance_docs:
        await AttendanceSummary.insert_many(attendance_docs)

    timesheet_docs = []
    for hrms_eid, days in daily_raw.items():
        emp = emp_map.get(int(hrms_eid))
        if not emp:
            continue
        for day_entry in days or []:
            if not isinstance(day_entry, dict):
                continue
            action = day_entry.get("status") or day_entry.get("action", "")
            if action == "Leave":
                continue

            day_date_raw = str(day_entry.get("date", ""))[:10]
            if not day_date_raw:
                continue
            try:
                day_date = datetime.fromisoformat(day_date_raw).date()
            except ValueError:
                continue

            day_projects = day_entry.get("projects", []) or []
            if not day_projects:
                hours = float(day_entry.get("hours", 0) or 0)
                if hours <= 0:
                    continue
                timesheet_docs.append(
                    TimesheetEntry(
                        employee_id=str(emp.id),
                        project_id="bench",
                        date=day_date,
                        hours=hours,
                        is_billable=False,
                        description=f"{action or 'Work'} - HRMS sync",
                        status="approved",
                        submitted_at=now,
                        approved_by="system",
                        approved_at=now,
                        source="hrms_sync",
                        sync_batch_id=batch_id,
                        period=period,
                        branch_location_id=emp.location_id,
                        created_at=now,
                        updated_at=now,
                    )
                )
                continue

            for pe in day_projects:
                proj_hours = float(pe.get("total_hours", 0) or 0)
                if proj_hours <= 0:
                    continue

                hrms_pid = pe.get("value") or pe.get("project_id")
                try:
                    hrms_pid = int(hrms_pid) if hrms_pid is not None else None
                except (TypeError, ValueError):
                    hrms_pid = None

                proj = proj_map.get(hrms_pid) if hrms_pid is not None else None
                project_id = str(proj.id) if proj else "bench"
                is_billable = bool(proj and proj.project_type == "client")

                timesheet_docs.append(
                    TimesheetEntry(
                        employee_id=str(emp.id),
                        project_id=project_id,
                        date=day_date,
                        hours=proj_hours,
                        is_billable=is_billable,
                        description=f"{action or 'Work'} - {pe.get('label', 'Project')} - HRMS sync",
                        status="approved",
                        submitted_at=now,
                        approved_by="system",
                        approved_at=now,
                        source="hrms_sync",
                        sync_batch_id=batch_id,
                        period=period,
                        branch_location_id=emp.location_id,
                        created_at=now,
                        updated_at=now,
                    )
                )

    if timesheet_docs:
        await TimesheetEntry.insert_many(timesheet_docs)

    allocation_docs = []
    total_working_days = int(allocations_raw.get("total_working_days", 22) or 22)
    for emp_entry in allocations_raw.get("employees", []):
        hrms_eid = emp_entry.get("employee_id")
        try:
            hrms_eid = int(hrms_eid)
        except (TypeError, ValueError):
            continue

        emp = emp_map.get(hrms_eid)
        if not emp:
            continue

        total_alloc = float(emp_entry.get("allocated_days", 0) or 0)
        available_days = float(emp_entry.get("available_days", 0) or 0)
        for alloc in emp_entry.get("allocations", []):
            hrms_pid = alloc.get("project_id")
            try:
                hrms_pid = int(hrms_pid)
            except (TypeError, ValueError):
                continue

            proj = proj_map.get(hrms_pid)
            if not proj:
                continue

            allocation_docs.append(
                ProjectAllocation(
                    period=period,
                    employee_id=str(emp.id),
                    hrms_employee_id=hrms_eid,
                    employee_name=emp_entry.get("employee_name", ""),
                    project_id=str(proj.id),
                    hrms_project_id=hrms_pid,
                    project_name=alloc.get("project_name", proj.name),
                    client_name=alloc.get("client_name"),
                    allocated_days=float(alloc.get("allocated_days", 0) or 0),
                    allocation_percentage=float(alloc.get("allocation_percentage", 0) or 0),
                    total_working_days=total_working_days,
                    total_allocated_days=total_alloc,
                    available_days=available_days,
                    sync_batch_id=batch_id,
                    synced_at=now,
                )
            )

    if allocation_docs:
        await ProjectAllocation.insert_many(allocation_docs)

    return {
        "attendance_count": len(attendance_docs),
        "timesheet_count": len(timesheet_docs),
        "allocation_count": len(allocation_docs),
    }


async def trigger_live_sync(
    period: str,
    user_id: str,
    integration_config_id: str | None = None,
    months_backfill_override: int | None = None,
    token: str | None = None,
) -> dict:
    return await _trigger_live_sync_impl(
        period=period,
        user_id=user_id,
        integration_config_id=integration_config_id,
        months_backfill_override=months_backfill_override,
        token=token,
    )

    # Legacy implementation retained below for reference.
    """
    Real HRMS sync (manual trigger):
    - Authenticates to HRMS using configured credentials.
    - Uses existing HRMS master mappings already stored in this app.
    - Pulls attendance/timesheet/allocation data for rolling N months.
    - Recomputes utilisation snapshots for affected periods.
    """
    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    months_backfill = max(1, settings.HRMS_SYNC_MONTHS_BACKFILL)
    periods = _recent_periods(period, months_backfill)

    sync_log = HrmsSyncLog(
        batch_id=batch_id,
        branch_location_id="ALL",
        period=f"{periods[0]}..{periods[-1]}",
        status="running",
        total_records=0,
        imported_count=0,
        duplicate_count=0,
        error_count=0,
        errors=[],
        started_at=now,
        triggered_by=user_id,
    )
    await sync_log.insert()

    try:
        access_token, hr_id = await _resolve_hrms_auth()
        client = HrmsClient(token=access_token)

        # Guardrail: do not auto-run destructive master sync from manual period sync.
        hrms_mapped_emp = await Employee.find_one({"hrms_employee_id": {"$ne": None}})
        if not hrms_mapped_emp:
            raise ValueError(
                "Live sync requires HRMS master mappings (hrms_employee_id/hrms_project_id). "
                "Run a controlled master-data migration first."
            )

        imported_count = 0
        total_records = 0
        error_list = []

        for p in periods:
            try:
                period_result = await _sync_single_period(
                    client=client,
                    period=p,
                    hr_id=hr_id,
                    batch_id=batch_id,
                )
                period_total = (
                    period_result["attendance_count"]
                    + period_result["timesheet_count"]
                    + period_result["allocation_count"]
                )
                imported_count += period_total
                total_records += period_total
            except Exception as period_err:
                error_list.append({"period": p, "message": str(period_err)})

        # Holidays are period-independent; sync once per run.
        try:
            holiday_count = await _sync_holidays_from_hrms(client)
            imported_count += holiday_count
            total_records += holiday_count
        except Exception as holiday_err:
            error_list.append({"period": "holidays", "message": str(holiday_err)})

        # Recompute utilisation snapshots so current dashboards remain accurate.
        branch_ids = [str(loc.id) for loc in await Location.find_all().to_list()]
        for p in periods:
            for branch_id in branch_ids:
                try:
                    await compute_utilisation(period=p, branch_location_id=branch_id)
                except Exception:
                    # Non-fatal: sync data is still available even if one compute fails.
                    continue

        sync_log.status = "completed"
        sync_log.total_records = total_records
        sync_log.imported_count = imported_count
        sync_log.duplicate_count = 0
        sync_log.error_count = len(error_list)
        sync_log.errors = error_list
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()

    except Exception as e:
        sync_log.status = "failed"
        sync_log.errors = [{"message": str(e)}]
        sync_log.error_count = 1
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()
        raise

    return {
        "batch_id": batch_id,
        "status": sync_log.status,
        "periods_synced": periods,
        "total_records": sync_log.total_records,
        "imported_count": sync_log.imported_count,
        "duplicate_count": sync_log.duplicate_count,
        "error_count": sync_log.error_count,
    }


def _merge_entity_counts(target: dict[str, dict[str, int]], source: dict[str, dict[str, int]]) -> None:
    for entity, stats in source.items():
        if entity not in target:
            target[entity] = {
                "processed": 0,
                "imported": 0,
                "updated": 0,
                "failed": 0,
                "deleted": 0,
            }
        for stat_key, stat_value in stats.items():
            target[entity][stat_key] = int(target[entity].get(stat_key, 0)) + int(stat_value or 0)


async def _sync_master_data_impl(
    token: str | None,
    user_id: str,
    integration_config_id: str | None = None,
) -> dict:
    cfg_doc, hrms_cfg = await get_hrms_integration_config(integration_config_id)
    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    entity_counts = _new_entity_counts()
    errors: list[dict] = []

    sync_log = HrmsSyncLog(
        integration_config_id=str(cfg_doc.id) if cfg_doc else None,
        mode="live",
        batch_id=batch_id,
        branch_location_id="ALL",
        period="master-data",
        status="running",
        total_records=0,
        imported_count=0,
        duplicate_count=0,
        error_count=0,
        errors=[],
        entity_counts={},
        cursor={},
        started_at=now,
        triggered_by=user_id,
    )
    await sync_log.insert()

    loc_id_map: dict[int, str] = {}
    dept_id_map: dict[str, str] = {}
    emp_id_map: dict[int, str] = {}
    proj_id_map: dict[int, str] = {}
    imported = 0

    try:
        access_token, _hr_id, base_url = await _resolve_hrms_auth(token, hrms_cfg)
        client = HrmsClient(base_url=base_url, token=access_token)

        # Fetch all master data in parallel (independent HTTP calls)
        hrms_employees, hrms_projects, hrms_locations, hrms_managers, hrms_hrs = await asyncio.gather(
            client.get_employees(),
            client.get_projects(),
            client.get_locations(),
            client.get_managers(),
            client.get_hrs(),
        )
        sync_log.total_records = len(hrms_employees) + len(hrms_projects) + len(hrms_locations)

        seen_loc_ids: set[str] = set()
        for hloc in hrms_locations:
            entity_counts["locations"]["processed"] += 1
            hid = hloc.get("id")
            if hid is None:
                entity_counts["locations"]["failed"] += 1
                _add_error(errors, entity="locations", key="unknown", error="Missing location id")
                continue
            source_id = f"location:{hid}"
            seen_loc_ids.add(source_id)
            hname = hloc.get("name", "Unknown")
            city, country, region, code = LOCATION_META.get(hid, (hname, "India", "APAC", (hname[:3] if hname else "UNK").upper()))
            loc, created = await _upsert_by_source(
                Location,
                source_id=source_id,
                payload={
                    "hrms_location_id": int(hid),
                    "city": city,
                    "country": country,
                    "region": region,
                    "code": code,
                },
                now=now,
                fallback_filters=[{"hrms_location_id": int(hid)}],
            )
            loc_id_map[int(hid)] = str(loc.id)
            if created:
                entity_counts["locations"]["imported"] += 1
                imported += 1
            else:
                entity_counts["locations"]["updated"] += 1
        entity_counts["locations"]["deleted"] = await _soft_delete_missing(Location, seen_loc_ids, now)

        account_set: set[str] = {
            str(p.get("account")).strip()
            for p in hrms_projects
            if p.get("account") and str(p.get("account")).strip()
        }
        account_set.add("General")
        default_loc_id = next(iter(loc_id_map.values()), "")

        seen_dept_ids: set[str] = set()
        for account in sorted(account_set):
            entity_counts["departments"]["processed"] += 1
            source_id = f"department:{_slugify(account)}"
            seen_dept_ids.add(source_id)
            dept, created = await _upsert_by_source(
                Department,
                source_id=source_id,
                payload={"name": account, "location_id": default_loc_id, "parent_id": None},
                now=now,
                fallback_filters=[{"name": account}],
            )
            dept_id_map[account] = str(dept.id)
            if created:
                entity_counts["departments"]["imported"] += 1
                imported += 1
            else:
                entity_counts["departments"]["updated"] += 1
        entity_counts["departments"]["deleted"] = await _soft_delete_missing(Department, seen_dept_ids, now)

        general_dept_id = dept_id_map.get("General", "")
        emp_name_to_hid: dict[str, int] = {}
        seen_emp_ids: set[str] = set()
        emp_bulk_items: list[dict] = []
        emp_bulk_meta: list[tuple[int, str]] = []  # (hid_int, name_str)
        for hemp in hrms_employees:
            entity_counts["employees"]["processed"] += 1
            hid = hemp.get("employeeId")
            if hid is None:
                entity_counts["employees"]["failed"] += 1
                continue
            source_id = f"employee:{hid}"
            seen_emp_ids.add(source_id)
            emp_bulk_items.append({
                "source_id": source_id,
                "payload": {
                    "hrms_employee_id": _to_int(hid, 0),
                    "name": hemp.get("name", "Unknown"),
                    "email": hemp.get("email", ""),
                    "designation": hemp.get("role", "Employee"),
                    "department_id": general_dept_id,
                    "level": ROLE_TO_LEVEL.get(hemp.get("role", "Employee"), "mid"),
                    "location_id": loc_id_map.get(_to_int(hemp.get("location_id"), -1), default_loc_id),
                    "join_date": _source_updated_at(hemp.get("doj")),
                    "is_active": True,
                },
                "source_updated_at": _source_updated_at(hemp.get("updated_at")),
                "fallback_filters": [{"hrms_employee_id": _to_int(hid, 0)}],
            })
            emp_bulk_meta.append((_to_int(hid, 0), str(hemp.get("name", ""))))
        emp_results = await _bulk_upsert_by_source(Employee, emp_bulk_items, now)
        for (emp, created), (hid_int, name_str) in zip(emp_results, emp_bulk_meta):
            emp_id_map[hid_int] = str(emp.id)
            emp_name_to_hid[name_str] = hid_int
            if created:
                entity_counts["employees"]["imported"] += 1
                imported += 1
            else:
                entity_counts["employees"]["updated"] += 1
        entity_counts["employees"]["deleted"] = await _soft_delete_missing(Employee, seen_emp_ids, now, deactivate_employees=True)

        for mgr in hrms_managers:
            mname = str(mgr.get("name") or "")
            mid = _to_int(mgr.get("id"), -1)
            if mname and mid > 0:
                emp_name_to_hid[mname] = mid
        for hr in hrms_hrs:
            hrname = str(hr.get("name") or "")
            hrid = _to_int(hr.get("id"), -1)
            if hrname and hrid > 0:
                emp_name_to_hid[hrname] = hrid

        seen_proj_ids: set[str] = set()
        assignment_rows: list[tuple[int, int, str]] = []
        proj_bulk_items: list[dict] = []
        proj_bulk_meta: list[int] = []  # hpid_int for each item
        for hproj in hrms_projects:
            entity_counts["projects"]["processed"] += 1
            hpid = hproj.get("project_id")
            if hpid is None:
                entity_counts["projects"]["failed"] += 1
                continue
            source_id = f"project:{hpid}"
            seen_proj_ids.add(source_id)
            proj_bulk_items.append({
                "source_id": source_id,
                "payload": {
                    "hrms_project_id": _to_int(hpid, 0),
                    "name": hproj.get("project_name", "Unknown"),
                    "status": "ACTIVE" if str(hproj.get("status", "Active")).lower() == "active" else str(hproj.get("status")).upper(),
                    "client_name": str(hproj.get("account") or "General").strip() or "General",
                    "department_id": dept_id_map.get(str(hproj.get("account")), general_dept_id),
                    "start_date": _source_updated_at(hproj.get("start_date")) or now,
                    "end_date": _source_updated_at(hproj.get("end_date")),
                },
                "source_updated_at": _source_updated_at(hproj.get("updated_at")),
                "fallback_filters": [{"hrms_project_id": _to_int(hpid, 0)}],
            })
            proj_bulk_meta.append(_to_int(hpid, 0))
            for a in hproj.get("assignments") or []:
                if a.get("employee_id"):
                    assignment_rows.append((_to_int(a.get("employee_id"), 0), _to_int(hpid, 0), str(a.get("role") or "contributor")))
        proj_results = await _bulk_upsert_by_source(Project, proj_bulk_items, now)
        for (project, created), hpid_int in zip(proj_results, proj_bulk_meta):
            proj_id_map[hpid_int] = str(project.id)
            if created:
                entity_counts["projects"]["imported"] += 1
                imported += 1
            else:
                entity_counts["projects"]["updated"] += 1
        entity_counts["projects"]["deleted"] = await _soft_delete_missing(Project, seen_proj_ids, now)

        seen_assignment_ids: set[str] = set()
        assign_bulk_items: list[dict] = []
        for hemp_id, hproj_id, role in assignment_rows:
            entity_counts["assignments"]["processed"] += 1
            emp_id = emp_id_map.get(hemp_id)
            proj_id = proj_id_map.get(hproj_id)
            role_norm = str(role or "contributor").strip().lower()
            source_id = f"assignment:{hemp_id}:{hproj_id}:{role_norm}"
            seen_assignment_ids.add(source_id)
            if not emp_id or not proj_id:
                entity_counts["assignments"]["failed"] += 1
                _add_error(errors, entity="assignments", key=source_id, error="Missing employee/project mapping")
                continue
            assign_bulk_items.append({
                "source_id": source_id,
                "payload": {
                    "employee_id": emp_id,
                    "project_id": proj_id,
                    "role_in_project": role_norm,
                    "assigned_at": now,
                },
                "fallback_filters": [{"employee_id": emp_id, "project_id": proj_id, "role_in_project": role_norm}],
            })
        assign_results = await _bulk_upsert_by_source(EmployeeProject, assign_bulk_items, now)
        for _doc, created in assign_results:
            if created:
                entity_counts["assignments"]["imported"] += 1
                imported += 1
            else:
                entity_counts["assignments"]["updated"] += 1
        entity_counts["assignments"]["deleted"] = await _soft_delete_missing(EmployeeProject, seen_assignment_ids, now)

        seen_rel_ids: set[str] = set()
        rel_bulk_items: list[dict] = []
        for hemp in hrms_employees:
            hid = _to_int(hemp.get("employeeId"), 0)
            emp_id = emp_id_map.get(hid)
            if not emp_id:
                continue
            for idx, name in enumerate(hemp.get("managers", []) or []):
                mgr_hid = emp_name_to_hid.get(str(name))
                mgr_id = emp_id_map.get(mgr_hid) if mgr_hid else None
                if not mgr_id or mgr_id == emp_id:
                    continue
                rel_type = "PRIMARY" if idx == 0 else "FUNCTIONAL"
                source_id = f"reporting:{hid}:{mgr_hid}:{rel_type}"
                seen_rel_ids.add(source_id)
                entity_counts["relationships"]["processed"] += 1
                rel_bulk_items.append({
                    "source_id": source_id,
                    "payload": {"employee_id": emp_id, "manager_id": mgr_id, "type": rel_type},
                    "fallback_filters": [{"employee_id": emp_id, "manager_id": mgr_id, "type": rel_type}],
                })
            for name in hemp.get("hr", []) or []:
                hr_hid = emp_name_to_hid.get(str(name))
                hr_id = emp_id_map.get(hr_hid) if hr_hid else None
                if not hr_id or hr_id == emp_id:
                    continue
                rel_type = "FUNCTIONAL"
                source_id = f"reporting:{hid}:{hr_hid}:{rel_type}"
                seen_rel_ids.add(source_id)
                entity_counts["relationships"]["processed"] += 1
                rel_bulk_items.append({
                    "source_id": source_id,
                    "payload": {"employee_id": emp_id, "manager_id": hr_id, "type": rel_type},
                    "fallback_filters": [{"employee_id": emp_id, "manager_id": hr_id, "type": rel_type}],
                })
        rel_results = await _bulk_upsert_by_source(ReportingRelationship, rel_bulk_items, now)
        for _doc, created in rel_results:
            if created:
                entity_counts["relationships"]["imported"] += 1
                imported += 1
            else:
                entity_counts["relationships"]["updated"] += 1
        entity_counts["relationships"]["deleted"] = await _soft_delete_missing(ReportingRelationship, seen_rel_ids, now)

        # Keep User.branch_location_id (and employee_id) in sync after every master sync.
        # Match by email (stable) so this works even after a full DB wipe + re-sync.
        emp_email_map: dict[int, str] = {}  # hrms_employee_id -> email
        for hemp in hrms_employees:
            hid = _to_int(hemp.get("employeeId"), 0)
            email = str(hemp.get("email") or "").strip().lower()
            if hid and email:
                emp_email_map[hid] = email

        for hloc_id, hemp_id in BRANCH_HEAD_OVERRIDES.items():
            new_loc_id = loc_id_map.get(hloc_id)
            emp_mongo_id = emp_id_map.get(hemp_id)
            emp_email = emp_email_map.get(hemp_id)
            if not new_loc_id or not emp_email:
                continue
            user_doc = await User.find_one(User.email == emp_email)
            if user_doc:
                changed = False
                if user_doc.branch_location_id != new_loc_id:
                    user_doc.branch_location_id = new_loc_id
                    changed = True
                if emp_mongo_id and user_doc.employee_id != emp_mongo_id:
                    user_doc.employee_id = emp_mongo_id
                    changed = True
                if changed:
                    await user_doc.save()

        sync_log.status = "completed"
        sync_log.imported_count = imported
        sync_log.error_count = len(errors)
        sync_log.errors = errors
        sync_log.entity_counts = dict(entity_counts)
        sync_log.cursor = {
            "master_data_synced_at": now.isoformat(),
            "employees_count": len(hrms_employees),
            "projects_count": len(hrms_projects),
            "locations_count": len(hrms_locations),
        }
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()

    except Exception as exc:
        sync_log.status = "failed"
        sync_log.error_count = 1
        sync_log.errors = [{"entity": "master", "key": "master-data", "error": str(exc)}]
        sync_log.entity_counts = dict(entity_counts)
        sync_log.cursor = {"failed_at": datetime.now(timezone.utc).isoformat()}
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()
        raise
    finally:
        if "client" in dir():
            await client.close()

    return {
        "batch_id": batch_id,
        "status": "completed",
        "mode": "live",
        "periods_synced": ["master-data"],
        "imported_count": sync_log.imported_count,
        "total_records": sync_log.total_records,
        "duplicate_count": sync_log.duplicate_count,
        "error_count": sync_log.error_count,
        "entity_counts": sync_log.entity_counts,
        "cursor": sync_log.cursor,
        "summary": {
            "locations": len(loc_id_map),
            "departments": len(dept_id_map),
            "employees": len(emp_id_map),
            "projects": len(proj_id_map),
            "assignments": len(assignment_rows),
        },
    }


async def _sync_holidays_upsert(client: HrmsClient, now: datetime) -> dict[str, int]:
    result = {"processed": 0, "imported": 0, "updated": 0, "failed": 0, "deleted": 0}
    holidays_raw = await client.get_holidays()
    if not isinstance(holidays_raw, list):
        return result

    locations = await Location.find({"hrms_location_id": {"$ne": None}}).to_list()
    loc_map = {l.hrms_location_id: str(l.id) for l in locations if l.hrms_location_id is not None}
    seen_source_ids: set[str] = set()

    for h in holidays_raw:
        result["processed"] += 1
        hrms_id = h.get("id")
        if hrms_id is None:
            result["failed"] += 1
            continue
        source_id = f"holiday:{hrms_id}"
        seen_source_ids.add(source_id)

        holiday_date_raw = str(h.get("holiday_date", ""))[:10]
        try:
            holiday_date = datetime.fromisoformat(holiday_date_raw).date()
        except ValueError:
            result["failed"] += 1
            continue

        _doc, created = await _upsert_by_source(
            HrmsHoliday,
            source_id=source_id,
            payload={
                "hrms_id": int(hrms_id),
                "location_id": loc_map.get(h.get("location_id")),
                "hrms_location_id": h.get("location_id"),
                "holiday_date": holiday_date,
                "holiday_name": h.get("holiday_name", ""),
                "holiday_type": h.get("holiday_type"),
                "year": holiday_date.year,
            },
            now=now,
            source_updated_at=_source_updated_at(h.get("updated_at")),
            fallback_filters=[{"hrms_id": int(hrms_id)}],
        )
        if created:
            result["imported"] += 1
        else:
            result["updated"] += 1

    result["deleted"] = await _soft_delete_missing(HrmsHoliday, seen_source_ids, now)
    return result


async def _sync_single_period_upsert(
    client: HrmsClient,
    period: str,
    hr_id: int,
    batch_id: str,
) -> dict:
    now = datetime.now(timezone.utc)
    year, month = int(period[:4]), int(period[5:7])
    counts = {
        "attendance": {"processed": 0, "imported": 0, "updated": 0, "failed": 0, "deleted": 0},
        "timesheets": {"processed": 0, "imported": 0, "updated": 0, "failed": 0, "deleted": 0},
        "allocations": {"processed": 0, "imported": 0, "updated": 0, "failed": 0, "deleted": 0},
    }

    employees = await Employee.find({"hrms_employee_id": {"$ne": None}, "is_deleted": False}).to_list()
    projects = await Project.find({"hrms_project_id": {"$ne": None}, "is_deleted": False}).to_list()
    emp_map = {e.hrms_employee_id: e for e in employees if e.hrms_employee_id is not None}
    proj_map = {p.hrms_project_id: p for p in projects if p.hrms_project_id is not None}
    emp_ids = [str(e.id) for e in employees]
    if not emp_ids:
        raise ValueError("No HRMS-mapped employees found. Run master-data sync first.")

    attendance_raw = await client.get_attendance_summary(hr_id=hr_id, year=year, month=month)
    if not isinstance(attendance_raw, list):
        attendance_raw = []

    daily_raw: dict[int, list[dict]] = {}
    active_eids = [
        int(a["employee_id"])
        for a in attendance_raw
        if a.get("employee_id") is not None and float(a.get("total_hours", 0) or 0) > 0
    ]

    # Fetch daily attendance concurrently in batches of 50
    BATCH_SIZE = 50
    for batch_start in range(0, len(active_eids), BATCH_SIZE):
        batch = active_eids[batch_start : batch_start + BATCH_SIZE]

        async def _fetch_daily(eid: int) -> tuple[int, list[dict]]:
            try:
                data = await client.get_daily_attendance(employee_id=eid, year=year, month=month)
                return eid, data if isinstance(data, list) else []
            except Exception:
                return eid, []

        results = await asyncio.gather(*[_fetch_daily(eid) for eid in batch])
        for eid, data in results:
            if data:
                daily_raw[eid] = data

    allocations_raw = await client.get_allocations(period)
    if not isinstance(allocations_raw, dict):
        allocations_raw = {"employees": [], "total_working_days": 22}

    seen_attendance_ids: set[str] = set()
    att_bulk_items: list[dict] = []
    for a in attendance_raw:
        counts["attendance"]["processed"] += 1
        hrms_eid = _to_int(a.get("employee_id"), -1)
        emp = emp_map.get(hrms_eid)
        if not emp:
            counts["attendance"]["failed"] += 1
            continue
        source_id = f"attendance:{period}:{hrms_eid}"
        seen_attendance_ids.add(source_id)
        att_bulk_items.append({
            "source_id": source_id,
            "payload": {
                "period": period,
                "employee_id": str(emp.id),
                "hrms_employee_id": hrms_eid,
                "employee_name": a.get("name", ""),
                "present_days": int(a.get("present", 0) or 0),
                "wfh_days": int(a.get("wfh", 0) or 0),
                "leave_days": int(a.get("leave", 0) or 0),
                "total_hours": float(a.get("total_hours", 0.0) or 0.0),
                "sync_batch_id": batch_id,
                "synced_at": now,
            },
            "fallback_filters": [{"period": period, "employee_id": str(emp.id)}],
        })
    att_results = await _bulk_upsert_by_source(AttendanceSummary, att_bulk_items, now)
    for _doc, created in att_results:
        if created:
            counts["attendance"]["imported"] += 1
        else:
            counts["attendance"]["updated"] += 1
    counts["attendance"]["deleted"] = await _delete_stale_period_docs(AttendanceSummary, period, seen_attendance_ids)

    timesheet_rows: dict[str, dict] = {}
    for hrms_eid, day_rows in daily_raw.items():
        emp = emp_map.get(hrms_eid)
        if not emp:
            continue
        for day_row in day_rows or []:
            day_raw = str(day_row.get("date", ""))[:10]
            if not day_raw:
                continue
            try:
                day_date = datetime.fromisoformat(day_raw).date()
            except ValueError:
                continue
            action = day_row.get("status") or day_row.get("action", "")
            if action == "Leave":
                continue
            projects_data = day_row.get("projects", []) or []
            if not projects_data:
                hours = float(day_row.get("hours", 0) or 0)
                if hours <= 0:
                    continue
                source_id = f"timesheet:{emp.id}:{day_date.isoformat()}:bench"
                row = timesheet_rows.setdefault(source_id, {
                    "employee_id": str(emp.id),
                    "project_id": "bench",
                    "date": day_date,
                    "hours": 0.0,
                    "is_billable": False,
                    "description": f"{action or 'Work'} - HRMS sync",
                    "branch_location_id": emp.location_id,
                })
                row["hours"] += hours
                continue
            for pe in projects_data:
                hours = float(pe.get("total_hours", 0) or 0)
                if hours <= 0:
                    continue
                hrms_pid = pe.get("value") or pe.get("project_id")
                hrms_pid = _to_int(hrms_pid, -1)
                project = proj_map.get(hrms_pid)
                project_id = str(project.id) if project else "bench"
                source_id = f"timesheet:{emp.id}:{day_date.isoformat()}:{project_id}"
                row = timesheet_rows.setdefault(source_id, {
                    "employee_id": str(emp.id),
                    "project_id": project_id,
                    "date": day_date,
                    "hours": 0.0,
                    "is_billable": bool(project and project.project_type == "client"),
                    "description": f"{action or 'Work'} - {pe.get('label', 'Project')} - HRMS sync",
                    "branch_location_id": emp.location_id,
                })
                row["hours"] += hours

    seen_timesheet_ids: set[str] = set(timesheet_rows.keys())

    # Pre-fetch existing timesheets for this period in 2 bulk queries (replaces N*2 find_one)
    all_ts_source_ids = list(seen_timesheet_ids)
    existing_by_source: dict[str, Any] = {}
    if all_ts_source_ids:
        ts_existing = await TimesheetEntry.find(
            {"source_system": SOURCE_SYSTEM, "source_id": {"$in": all_ts_source_ids}}
        ).to_list()
        existing_by_source = {doc.source_id: doc for doc in ts_existing}

    # Fallback lookup: timesheets from hrms_sync for this period (for first-time matching)
    existing_by_fallback: dict[str, Any] = {}
    unmatched_source_ids = [sid for sid in all_ts_source_ids if sid not in existing_by_source]
    if unmatched_source_ids:
        fallback_ts = await TimesheetEntry.find(
            {"period": period, "source": "hrms_sync"}
        ).to_list()
        for doc in fallback_ts:
            key = f"{doc.employee_id}:{doc.date}:{doc.project_id}"
            existing_by_fallback[key] = doc

    # Separate into updates and inserts
    ts_update_ops: list[UpdateOne] = []
    ts_inserts: list[Any] = []
    for source_id, row in timesheet_rows.items():
        counts["timesheets"]["processed"] += 1
        existing = existing_by_source.get(source_id)
        if not existing:
            fallback_key = f"{row['employee_id']}:{row['date']}:{row['project_id']}"
            existing = existing_by_fallback.get(fallback_key)

        if existing:
            ts_update_ops.append(UpdateOne({"_id": existing.id}, {"$set": {
                "hours": round(float(row["hours"]), 2),
                "is_billable": bool(row["is_billable"]),
                "description": row["description"],
                "status": "approved",
                "submitted_at": now,
                "approved_by": "system",
                "approved_at": now,
                "source": "hrms_sync",
                "sync_batch_id": batch_id,
                "period": period,
                "branch_location_id": row["branch_location_id"],
                "updated_at": now,
                "source_system": SOURCE_SYSTEM,
                "source_id": source_id,
                "last_synced_at": now,
                "is_deleted": False,
            }}))
            counts["timesheets"]["updated"] += 1
        else:
            ts_inserts.append(TimesheetEntry(
                employee_id=row["employee_id"],
                project_id=row["project_id"],
                date=row["date"],
                hours=round(float(row["hours"]), 2),
                is_billable=bool(row["is_billable"]),
                description=row["description"],
                status="approved",
                submitted_at=now,
                approved_by="system",
                approved_at=now,
                source="hrms_sync",
                sync_batch_id=batch_id,
                period=period,
                branch_location_id=row["branch_location_id"],
                created_at=now,
                updated_at=now,
                source_system=SOURCE_SYSTEM,
                source_id=source_id,
                last_synced_at=now,
                is_deleted=False,
            ))
            counts["timesheets"]["imported"] += 1

    # Bulk write updates and inserts
    if ts_update_ops:
        ts_collection = TimesheetEntry.get_pymongo_collection()
        await ts_collection.bulk_write(ts_update_ops, ordered=False)
    if ts_inserts:
        await TimesheetEntry.insert_many(ts_inserts)

    counts["timesheets"]["deleted"] = await _delete_stale_period_docs(TimesheetEntry, period, seen_timesheet_ids)

    seen_alloc_ids: set[str] = set()
    alloc_bulk_items: list[dict] = []
    total_working_days = int(allocations_raw.get("total_working_days", 22) or 22)
    for emp_entry in allocations_raw.get("employees", []) or []:
        hrms_eid = _to_int(emp_entry.get("employee_id"), -1)
        emp = emp_map.get(hrms_eid)
        if not emp:
            continue
        total_alloc = float(emp_entry.get("allocated_days", 0) or 0)
        available_days = float(emp_entry.get("available_days", 0) or 0)
        for alloc in emp_entry.get("allocations", []) or []:
            counts["allocations"]["processed"] += 1
            hrms_pid = _to_int(alloc.get("project_id"), -1)
            project = proj_map.get(hrms_pid)
            if not project:
                counts["allocations"]["failed"] += 1
                continue
            source_id = f"allocation:{period}:{hrms_eid}:{hrms_pid}"
            seen_alloc_ids.add(source_id)
            alloc_bulk_items.append({
                "source_id": source_id,
                "payload": {
                    "period": period,
                    "employee_id": str(emp.id),
                    "hrms_employee_id": hrms_eid,
                    "employee_name": emp_entry.get("employee_name", ""),
                    "project_id": str(project.id),
                    "hrms_project_id": hrms_pid,
                    "project_name": alloc.get("project_name", project.name),
                    "client_name": alloc.get("client_name"),
                    "allocated_days": float(alloc.get("allocated_days", 0) or 0),
                    "allocation_percentage": float(alloc.get("allocation_percentage", 0) or 0),
                    "total_working_days": total_working_days,
                    "total_allocated_days": total_alloc,
                    "available_days": available_days,
                    "sync_batch_id": batch_id,
                    "synced_at": now,
                },
                "fallback_filters": [{"period": period, "employee_id": str(emp.id), "project_id": str(project.id)}],
            })
    alloc_results = await _bulk_upsert_by_source(ProjectAllocation, alloc_bulk_items, now)
    for _doc, created in alloc_results:
        if created:
            counts["allocations"]["imported"] += 1
        else:
            counts["allocations"]["updated"] += 1
    counts["allocations"]["deleted"] = await _delete_stale_period_docs(ProjectAllocation, period, seen_alloc_ids)

    return {
        "period": period,
        "counts": counts,
        "cursor": {
            "period": period,
            "synced_at": now.isoformat(),
            "attendance_records": len(attendance_raw),
            "timesheet_records": len(timesheet_rows),
            "allocation_records": counts["allocations"]["processed"],
        },
    }


async def _trigger_live_sync_impl(
    period: str,
    user_id: str,
    integration_config_id: str | None = None,
    months_backfill_override: int | None = None,
    token: str | None = None,
) -> dict:
    cfg_doc, hrms_cfg = await get_hrms_integration_config(integration_config_id)

    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    if months_backfill_override is not None:
        months_backfill = months_backfill_override
    else:
        months_backfill = _to_int(
            hrms_cfg.get("sync_scope", {}).get("months_backfill"),
            settings.HRMS_SYNC_MONTHS_BACKFILL,
        )
    periods = _recent_periods(period, max(1, months_backfill))

    sync_log = HrmsSyncLog(
        integration_config_id=str(cfg_doc.id) if cfg_doc else None,
        mode="live",
        batch_id=batch_id,
        branch_location_id="ALL",
        period=f"{periods[0]}..{periods[-1]}",
        status="running",
        total_records=0,
        imported_count=0,
        duplicate_count=0,
        error_count=0,
        errors=[],
        entity_counts={},
        cursor={},
        started_at=now,
        triggered_by=user_id,
    )
    await sync_log.insert()

    errors: list[dict] = []
    entity_counts: dict[str, dict[str, int]] = {}
    cursor: dict = {"periods": periods, "per_period": []}

    try:
        access_token, hr_id, base_url = await _resolve_hrms_auth(token, hrms_cfg)
        client = HrmsClient(base_url=base_url, token=access_token)

        hrms_mapped_emp = await Employee.find_one({"hrms_employee_id": {"$ne": None}, "is_deleted": False})
        if not hrms_mapped_emp:
            raise ValueError(
                "Live sync requires HRMS master mappings (hrms_employee_id/hrms_project_id). "
                "Run /hrms-sync/master-data first."
            )

        total_records = 0
        imported_count = 0

        # Run all period syncs concurrently
        async def _sync_period_safe(p: str) -> dict | None:
            try:
                return await _sync_single_period_upsert(
                    client=client,
                    period=p,
                    hr_id=hr_id,
                    batch_id=batch_id,
                )
            except Exception as period_err:
                _add_error(errors, entity="period_sync", key=p, error=str(period_err))
                return None

        period_results = await asyncio.gather(*[_sync_period_safe(p) for p in periods])

        for period_result in period_results:
            if period_result is None:
                continue
            cursor["per_period"].append(period_result["cursor"])
            _merge_entity_counts(entity_counts, period_result["counts"])

            period_counts = period_result["counts"]
            total_records += (
                period_counts["attendance"]["processed"]
                + period_counts["timesheets"]["processed"]
                + period_counts["allocations"]["processed"]
            )
            imported_count += (
                period_counts["attendance"]["imported"]
                + period_counts["timesheets"]["imported"]
                + period_counts["allocations"]["imported"]
            )

        try:
            holiday_counts = await _sync_holidays_upsert(client, now=now)
            _merge_entity_counts(entity_counts, {"holidays": holiday_counts})
            cursor["holidays"] = {"synced_at": datetime.now(timezone.utc).isoformat(), **holiday_counts}
            total_records += int(holiday_counts["processed"])
            imported_count += int(holiday_counts["imported"])
        except Exception as holiday_err:
            _add_error(errors, entity="holidays", key="calendar", error=str(holiday_err))

        branch_ids = [str(loc.id) for loc in await Location.find({"is_deleted": False}).to_list()]

        async def _safe_compute(p: str, branch_id: str):
            try:
                await compute_utilisation(period=p, branch_location_id=branch_id)
            except Exception as util_err:
                _add_error(errors, entity="utilisation", key=f"{branch_id}:{p}", error=str(util_err))

        await asyncio.gather(*[
            _safe_compute(p, branch_id)
            for p in periods
            for branch_id in branch_ids
        ])

        sync_log.status = "completed"
        sync_log.total_records = total_records
        sync_log.imported_count = imported_count
        sync_log.duplicate_count = 0
        sync_log.error_count = len(errors)
        sync_log.errors = errors
        sync_log.entity_counts = entity_counts
        sync_log.cursor = cursor
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()

    except Exception as exc:
        sync_log.status = "failed"
        sync_log.errors = [{"entity": "live_sync", "key": period, "error": str(exc)}]
        sync_log.error_count = 1
        sync_log.entity_counts = entity_counts
        sync_log.cursor = cursor
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()
        raise
    finally:
        if "client" in dir():
            await client.close()

    return {
        "batch_id": batch_id,
        "status": sync_log.status,
        "mode": "live",
        "periods_synced": periods,
        "total_records": sync_log.total_records,
        "imported_count": sync_log.imported_count,
        "duplicate_count": sync_log.duplicate_count,
        "error_count": sync_log.error_count,
        "entity_counts": sync_log.entity_counts,
        "cursor": sync_log.cursor,
    }


# ======================================================================
# Legacy: mock timesheet sync (period-based)
# ======================================================================


def _get_working_days(year: int, month: int) -> list[date]:
    """Return all weekday dates for a given year/month."""
    num_days = calendar.monthrange(year, month)[1]
    working_days = []
    for day in range(1, num_days + 1):
        d = date(year, month, day)
        if d.weekday() < 5:
            working_days.append(d)
    return working_days


async def trigger_sync(period: str, branch_location_id: str, user_id: str) -> dict:
    """
    Trigger mock HRMS sync that generates simulated timesheet data
    for all active employees in the branch for the given period.
    """
    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    sync_log = HrmsSyncLog(
        batch_id=batch_id,
        branch_location_id=branch_location_id,
        period=period,
        status="running",
        total_records=0,
        imported_count=0,
        duplicate_count=0,
        error_count=0,
        errors=[],
        started_at=now,
        triggered_by=user_id,
    )
    await sync_log.insert()

    try:
        year, month = int(period.split("-")[0]), int(period.split("-")[1])
        working_days = _get_working_days(year, month)

        employees = await Employee.find(
            Employee.location_id == branch_location_id,
            Employee.is_active == True,
        ).to_list()

        total_records = 0
        imported_count = 0
        duplicate_count = 0
        error_count = 0
        error_list = []

        for emp in employees:
            emp_id = str(emp.id)

            assignments = await EmployeeProject.find(
                EmployeeProject.employee_id == emp_id,
            ).to_list()

            project_ids = [a.project_id for a in assignments]
            projects = []
            if project_ids:
                from bson import ObjectId
                projects = await Project.find(
                    {"_id": {"$in": [ObjectId(pid) for pid in project_ids if ObjectId.is_valid(pid)]}},
                    Project.status == "ACTIVE",
                ).to_list()

            is_bench = len(projects) == 0

            for day in working_days:
                total_hours = round(random.uniform(6.0, 9.0), 1)

                if is_bench:
                    total_records += 1
                    existing = await TimesheetEntry.find_one(
                        TimesheetEntry.employee_id == emp_id,
                        TimesheetEntry.date == day,
                        TimesheetEntry.project_id == "bench",
                    )
                    if existing:
                        duplicate_count += 1
                        continue

                    entry = TimesheetEntry(
                        employee_id=emp_id,
                        project_id="bench",
                        date=day,
                        hours=total_hours,
                        is_billable=False,
                        description="Bench - auto generated via HRMS sync",
                        status="approved",
                        submitted_at=now,
                        approved_by="system",
                        approved_at=now,
                        source="hrms_sync",
                        sync_batch_id=batch_id,
                        period=period,
                        branch_location_id=branch_location_id,
                        created_at=now,
                        updated_at=now,
                    )
                    await entry.insert()
                    imported_count += 1
                else:
                    num_projects = len(projects)
                    remaining_hours = total_hours

                    for idx, proj in enumerate(projects):
                        proj_id = str(proj.id)
                        total_records += 1

                        if idx == num_projects - 1:
                            hours = round(remaining_hours, 1)
                        else:
                            share = random.uniform(0.3, 0.7) * remaining_hours
                            hours = round(max(0.5, share), 1)
                            remaining_hours -= hours

                        is_billable = random.random() < 0.70

                        existing = await TimesheetEntry.find_one(
                            TimesheetEntry.employee_id == emp_id,
                            TimesheetEntry.date == day,
                            TimesheetEntry.project_id == proj_id,
                        )
                        if existing:
                            duplicate_count += 1
                            continue

                        entry = TimesheetEntry(
                            employee_id=emp_id,
                            project_id=proj_id,
                            date=day,
                            hours=hours,
                            is_billable=is_billable,
                            description=f"Work on {proj.name} - auto generated via HRMS sync",
                            status="approved",
                            submitted_at=now,
                            approved_by="system",
                            approved_at=now,
                            source="hrms_sync",
                            sync_batch_id=batch_id,
                            period=period,
                            branch_location_id=branch_location_id,
                            created_at=now,
                            updated_at=now,
                        )
                        await entry.insert()
                        imported_count += 1

        sync_log.status = "completed"
        sync_log.total_records = total_records
        sync_log.imported_count = imported_count
        sync_log.duplicate_count = duplicate_count
        sync_log.error_count = error_count
        sync_log.errors = error_list
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()

    except Exception as e:
        sync_log.status = "failed"
        sync_log.errors = [{"entity": "demo_sync", "key": period, "error": str(e)}]
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()
        raise

    return {
        "batch_id": batch_id,
        "status": sync_log.status,
        "mode": "demo",
        "periods_synced": [period],
        "total_records": total_records,
        "imported_count": imported_count,
        "duplicate_count": duplicate_count,
        "error_count": error_count,
        "entity_counts": sync_log.entity_counts or {},
        "cursor": sync_log.cursor or {},
    }


async def _mark_stale_running_logs() -> None:
    """Mark any sync logs stuck in 'running' for more than 10 minutes as 'failed'."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    stale_logs = await HrmsSyncLog.find(
        HrmsSyncLog.status == "running",
        {"started_at": {"$lt": cutoff}},
    ).to_list()
    for log in stale_logs:
        log.status = "failed"
        log.error_count = max(log.error_count, 1)
        if not log.errors:
            log.errors = [{"entity": "system", "key": "timeout", "error": "Sync timed out (exceeded 10 minutes)"}]
        log.completed_at = datetime.now(timezone.utc)
        await log.save()


async def get_sync_logs(
    branch_location_id: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Return paginated list of HRMS sync logs."""
    await _mark_stale_running_logs()
    skip = (page - 1) * page_size

    filters = []
    if branch_location_id:
        filters.append(
            {"$or": [
                {"branch_location_id": branch_location_id},
                {"branch_location_id": "ALL"},
            ]}
        )

    logs = await HrmsSyncLog.find(
        *filters
    ).sort(-HrmsSyncLog.started_at).skip(skip).limit(page_size).to_list()

    total = await HrmsSyncLog.find(*filters).count()

    return {
        "logs": [
            {
                "batch_id": log.batch_id,
                "period": log.period,
                "status": log.status,
                "mode": log.mode,
                "total_records": log.total_records,
                "imported_count": log.imported_count,
                "duplicate_count": log.duplicate_count,
                "error_count": log.error_count,
                "errors": log.errors,
                "entity_counts": log.entity_counts,
                "cursor": log.cursor,
                "started_at": log.started_at,
                "completed_at": log.completed_at,
            }
            for log in logs
        ],
        "total": total,
    }
