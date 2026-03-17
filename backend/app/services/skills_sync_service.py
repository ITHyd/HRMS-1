"""
Skills Portal sync service for syncing skills data from skills.nxzen.com
"""

from datetime import datetime
from typing import Dict, Any
from app.services.skills_client import skills_client
from app.models.skill_catalog import SkillCatalog
from app.models.sync_log import SyncLog


async def sync_skills_from_portal() -> Dict[str, Any]:
    """
    Sync skills from Skills Portal API to local skill_catalog collection.
    Returns sync result with success status and details.
    NOTE: SyncLog is created by the caller (integration_service.trigger_manual_sync),
    so this function must NOT create its own SyncLog to avoid duplicates.
    """

    try:
        # Fetch skills from API
        skills_data = await skills_client.get_skills()

        if not skills_data:
            return {
                "success": False,
                "message": "No skills data received from API",
                "synced_count": 0,
                "total_count": 0
            }

        # Clear existing skills
        await SkillCatalog.find_all().delete()

        # Insert new skills
        skill_docs = []
        for skill in skills_data:
            skill_doc = SkillCatalog(
                name=skill.get("name", ""),
                display_name=skill.get("name", ""),  # Use name as display_name
                category=skill.get("category", ""),
            )
            skill_docs.append(skill_doc)

        if skill_docs:
            await SkillCatalog.insert_many(skill_docs)

        return {
            "success": True,
            "message": f"Successfully synced {len(skill_docs)} skills",
            "synced_count": len(skill_docs),
            "total_count": len(skills_data),
            "categories": len(set(skill.get("category", "") for skill in skills_data)),
            "pathways": len(set(skill.get("pathway", "") for skill in skills_data))
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Sync failed: {str(e)}",
            "synced_count": 0,
            "total_count": 0
        }


async def get_skills_sync_status() -> Dict[str, Any]:
    """Get the status of the last skills sync"""
    try:
        last_sync = await SyncLog.find(
            SyncLog.integration_type == "skills"
        ).sort(-SyncLog.completed_at).first()
        
        if not last_sync:
            return {
                "last_sync": None,
                "status": "never_synced",
                "skills_count": 0
            }
        
        skills_count = await SkillCatalog.count()
        
        return {
            "last_sync": last_sync.completed_at.isoformat() if last_sync.completed_at else None,
            "status": last_sync.status,
            "skills_count": skills_count,
            "message": last_sync.details.get("message", ""),
            "records_processed": last_sync.records_processed,
            "records_successful": last_sync.records_successful,
            "error_message": last_sync.error_message
        }
    except Exception as e:
        return {
            "last_sync": None,
            "status": "error",
            "skills_count": 0,
            "error_message": str(e)
        }