"""
Skills Portal sync service for syncing skills data from skills.nxzen.com

Sync flow:
1. Fetch all skills → upsert into skill_catalog
2. Fetch all portal employees → match to our employees by hrms_employee_id
3. For each matched employee, fetch their skills and upsert into employee_skills
"""

import asyncio
from datetime import datetime, timezone
from typing import Dict, Any

from app.services.skills_client import skills_client
from app.models.skill_catalog import SkillCatalog
from app.models.employee_skill import EmployeeSkill
from app.models.employee import Employee
from app.models.sync_log import SyncLog


async def sync_skills_from_portal() -> Dict[str, Any]:
    """
    Full sync from Skills Portal:
    - Syncs skill catalog
    - Syncs per-employee skills matched by hrms_employee_id

    NOTE: SyncLog is created by the caller (integration_service.trigger_manual_sync).
    """
    try:
        # ── Step 1: Sync skill catalog ──────────────────────────────────────
        skills_data = await skills_client.get_skills()

        if not skills_data:
            return {
                "success": False,
                "message": "No skills data received from API",
                "synced_count": 0,
                "total_count": 0,
                "employees_synced": 0,
                "employee_skills_synced": 0,
            }

        await SkillCatalog.find_all().delete()
        skill_docs = [
            SkillCatalog(
                name=s.get("name", ""),
                display_name=s.get("name", ""),
                category=s.get("category", ""),
            )
            for s in skills_data
        ]
        if skill_docs:
            await SkillCatalog.insert_many(skill_docs)

        # Build a quick lookup: skill name → category
        skill_category_map: Dict[str, str] = {
            s.get("name", ""): s.get("category", "") for s in skills_data
        }

        # ── Step 2: Fetch portal employees ─────────────────────────────────
        portal_employees = await skills_client.get_all_portal_employees()

        if not portal_employees:
            return {
                "success": True,
                "message": f"Synced {len(skill_docs)} skills. No portal employees found.",
                "synced_count": len(skill_docs),
                "total_count": len(skills_data),
                "employees_synced": 0,
                "employee_skills_synced": 0,
            }

        # Build lookup: portal employee_id → portal employee record
        portal_emp_map: Dict[str, Dict] = {
            str(e["employee_id"]): e for e in portal_employees if e.get("employee_id")
        }

        # ── Step 3: Load our employees and match by hrms_employee_id or name ─
        our_employees = await Employee.find(Employee.is_active == True).to_list()

        # Build name-based lookup for portal employees (normalized lowercase)
        def _norm_name(n: str) -> str:
            return " ".join(sorted(n.lower().split()))

        portal_name_map: Dict[str, str] = {
            _norm_name(e["name"]): str(e["employee_id"])
            for e in portal_employees
            if e.get("name") and e.get("employee_id")
        }

        # Match: prefer hrms_employee_id, fall back to name matching
        matched: list[tuple[Employee, str]] = []
        seen_portal_ids: set[str] = set()
        for emp in our_employees:
            portal_id: str | None = None

            # Primary: match by hrms_employee_id
            if emp.hrms_employee_id is not None:
                candidate = str(emp.hrms_employee_id)
                if candidate in portal_emp_map:
                    portal_id = candidate

            # Fallback: match by normalized name
            if portal_id is None:
                norm = _norm_name(emp.name)
                portal_id = portal_name_map.get(norm)

            if portal_id and portal_id not in seen_portal_ids:
                matched.append((emp, portal_id))
                seen_portal_ids.add(portal_id)

        # ── Step 4: For each matched employee, fetch & upsert skills ───────
        total_employee_skills = 0
        employees_with_skills = 0
        now = datetime.now(timezone.utc)

        # Process in small batches to respect rate limit (100 req/s)
        BATCH_SIZE = 10
        BATCH_DELAY = 0.15  # seconds between batches

        for i in range(0, len(matched), BATCH_SIZE):
            batch = matched[i : i + BATCH_SIZE]

            for emp, portal_id in batch:
                emp_id_str = str(emp.id)
                portal_skills = await skills_client.get_employee_skills(portal_id)

                if not portal_skills:
                    continue

                # Remove existing skills for this employee before re-inserting
                await EmployeeSkill.find(
                    EmployeeSkill.employee_id == emp_id_str
                ).delete()

                new_skill_docs = []
                for ps in portal_skills:
                    skill_name = ps.get("name") or ps.get("skill_name") or ""
                    if not skill_name:
                        continue

                    # Map portal proficiency levels to our schema
                    raw_prof = (
                        ps.get("proficiency")
                        or ps.get("rating")
                        or ps.get("level")
                        or "intermediate"
                    )
                    proficiency = _normalize_proficiency(str(raw_prof))

                    new_skill_docs.append(
                        EmployeeSkill(
                            employee_id=emp_id_str,
                            skill_name=skill_name,
                            proficiency=proficiency,
                            added_by="skills_portal_sync",
                            added_at=now,
                            notes=f"Synced from Skills Portal (portal_id={portal_id})",
                        )
                    )

                if new_skill_docs:
                    await EmployeeSkill.insert_many(new_skill_docs)
                    total_employee_skills += len(new_skill_docs)
                    employees_with_skills += 1

            if i + BATCH_SIZE < len(matched):
                await asyncio.sleep(BATCH_DELAY)

        return {
            "success": True,
            "message": (
                f"Synced {len(skill_docs)} skills. "
                f"Updated skills for {employees_with_skills}/{len(matched)} matched employees "
                f"({total_employee_skills} skill records)."
            ),
            "synced_count": len(skill_docs),
            "total_count": len(skills_data),
            "categories": len(set(s.get("category", "") for s in skills_data)),
            "pathways": len(set(s.get("pathway", "") for s in skills_data)),
            "portal_employees": len(portal_employees),
            "matched_employees": len(matched),
            "employees_synced": employees_with_skills,
            "employee_skills_synced": total_employee_skills,
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Sync failed: {str(e)}",
            "synced_count": 0,
            "total_count": 0,
            "employees_synced": 0,
            "employee_skills_synced": 0,
        }


def _normalize_proficiency(raw: str) -> str:
    """Map various proficiency strings to our schema values."""
    mapping = {
        "beginner": "beginner",
        "developing": "beginner",
        "basic": "beginner",
        "1": "beginner",
        "intermediate": "intermediate",
        "2": "intermediate",
        "advanced": "advanced",
        "3": "advanced",
        "expert": "expert",
        "4": "expert",
        "5": "expert",
    }
    return mapping.get(raw.lower().strip(), "intermediate")


async def get_skills_sync_status() -> Dict[str, Any]:
    """Get the status of the last skills sync."""
    try:
        last_sync = await SyncLog.find(
            SyncLog.integration_type == "skills"
        ).sort(-SyncLog.completed_at).first()

        if not last_sync:
            return {
                "last_sync": None,
                "status": "never_synced",
                "skills_count": 0,
                "employee_skills_count": 0,
            }

        skills_count = await SkillCatalog.count()
        employee_skills_count = await EmployeeSkill.count()

        return {
            "last_sync": last_sync.completed_at.isoformat() if last_sync.completed_at else None,
            "status": last_sync.status,
            "skills_count": skills_count,
            "employee_skills_count": employee_skills_count,
            "message": last_sync.details.get("message", "") if hasattr(last_sync, "details") and last_sync.details else "",
            "records_processed": last_sync.records_processed,
            "records_successful": last_sync.records_succeeded,
            "error_message": last_sync.error_message if hasattr(last_sync, "error_message") else None,
        }
    except Exception as e:
        return {
            "last_sync": None,
            "status": "error",
            "skills_count": 0,
            "employee_skills_count": 0,
            "error_message": str(e),
        }
