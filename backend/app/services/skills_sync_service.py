"""
Skills sync service.

Syncs employee skills, certifications, and training data from the Skills Portal.
"""

import uuid
from datetime import datetime, timezone

from app.models.employee import Employee
from app.models.employee_skill import EmployeeSkill
from app.models.skill_catalog import SkillCatalog
from app.models.sync_log import SyncLog
from app.services.skills_client import SkillsClient


async def sync_skill_catalog(token: str, user_id: str) -> dict:
    """
    Sync skill catalog from Skills Portal.
    
    Fetches all available skills and updates the local skill catalog.
    """
    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    sync_log = SyncLog(
        integration_type="skills",
        direction="inbound",
        status="running",
        records_processed=0,
        records_succeeded=0,
        records_failed=0,
        error_details=[],
        started_at=now,
        triggered_by="manual",
        user_id=user_id,
        retry_count=0,
    )
    await sync_log.insert()

    try:
        client = SkillsClient(token=token)

        # Fetch skill catalog
        skills_data = await client.get_skill_catalog()

        total_records = len(skills_data)
        imported = 0
        updated = 0
        errors = []

        # Sync skills - API returns: {name, description, category, pathway, id}
        for skill_data in skills_data:
            try:
                skill_name = skill_data.get("name", "").lower()
                if not skill_name:
                    print(f"Skipping skill with no name: {skill_data}")
                    continue

                category = skill_data.get("category", "other")
                pathway = skill_data.get("pathway", "")

                print(f"Processing skill: {skill_name} (category: {category})")

                # Check if skill exists
                existing = await SkillCatalog.find_one(
                    SkillCatalog.name == skill_name
                )

                if existing:
                    # Update existing skill
                    existing.display_name = skill_data.get("name", skill_name.title())
                    existing.category = category
                    existing.description = skill_data.get("description")
                    existing.pathway = pathway
                    await existing.save()
                    updated += 1
                    print(f"Updated skill: {skill_name}")
                else:
                    # Create new skill
                    skill = SkillCatalog(
                        name=skill_name,
                        display_name=skill_data.get("name", skill_name.title()),
                        category=category,
                        description=skill_data.get("description"),
                        pathway=pathway,
                    )
                    await skill.insert()
                    imported += 1
                    print(f"Imported skill: {skill_name}")

            except Exception as e:
                error_msg = str(e)
                print(f"ERROR processing skill {skill_data.get('name')}: {error_msg}")
                errors.append({
                    "skill": skill_data.get("name"),
                    "error": error_msg
                })

        sync_log.status = "completed"
        sync_log.records_processed = total_records
        sync_log.records_succeeded = imported + updated
        sync_log.records_failed = len(errors)
        sync_log.error_details = errors
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()

        return {
            "batch_id": batch_id,
            "status": "completed",
            "imported_count": imported,
            "updated_count": updated,
            "error_count": len(errors),
        }

    except Exception as e:
        sync_log.status = "failed"
        sync_log.error_details = [{"message": str(e)}]
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()
        raise


async def get_skills_sync_logs(page: int = 1, page_size: int = 20) -> dict:
    """Return paginated list of Skills sync logs."""
    skip = (page - 1) * page_size

    logs = await SyncLog.find(
        SyncLog.integration_type == "skills"
    ).sort(-SyncLog.started_at).skip(skip).limit(page_size).to_list()

    total = await SyncLog.find(SyncLog.integration_type == "skills").count()

    return {
        "logs": [
            {
                "id": str(log.id),
                "integration_type": log.integration_type,
                "direction": log.direction,
                "status": log.status,
                "records_processed": log.records_processed,
                "records_succeeded": log.records_succeeded,
                "records_failed": log.records_failed,
                "error_details": log.error_details,
                "started_at": log.started_at,
                "completed_at": log.completed_at,
                "triggered_by": log.triggered_by,
                "retry_count": log.retry_count,
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
