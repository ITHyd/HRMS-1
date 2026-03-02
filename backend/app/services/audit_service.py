from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from app.models.audit_log import AuditLog
from app.models.user import User


async def log_change(
    action: str,
    entity_type: str,
    entity_id: str,
    changed_by: str,
    branch_location_id: str,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
):
    entry = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        changed_by=changed_by,
        timestamp=datetime.now(timezone.utc),
        old_value=old_value,
        new_value=new_value,
        branch_location_id=branch_location_id,
    )
    await entry.insert()
    return entry


async def get_audit_log(location_id: str, page: int = 1, page_size: int = 50):
    skip = (page - 1) * page_size

    entries = await AuditLog.find(
        AuditLog.branch_location_id == location_id
    ).sort(-AuditLog.timestamp).skip(skip).limit(page_size).to_list()

    total = await AuditLog.find(
        AuditLog.branch_location_id == location_id
    ).count()

    # Resolve user names
    user_ids = {e.changed_by for e in entries}
    users = await User.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]}}).to_list()
    user_map = {str(u.id): u.name for u in users}

    result = []
    for entry in entries:
        desc = _build_description(entry)
        result.append({
            "id": str(entry.id),
            "action": entry.action,
            "entity_type": entry.entity_type,
            "entity_id": entry.entity_id,
            "changed_by": entry.changed_by,
            "changed_by_name": user_map.get(entry.changed_by, "System"),
            "timestamp": entry.timestamp.isoformat(),
            "old_value": entry.old_value,
            "new_value": entry.new_value,
            "description": desc,
        })

    return {
        "entries": result,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def _build_description(entry: AuditLog) -> str:
    if entry.action == "CREATE":
        name = entry.new_value.get("name", "Unknown") if entry.new_value else "Unknown"
        return f"New {entry.entity_type} added: {name}"
    elif entry.action == "UPDATE":
        return f"{entry.entity_type} updated (ID: {entry.entity_id})"
    elif entry.action == "DELETE":
        return f"{entry.entity_type} removed (ID: {entry.entity_id})"
    elif entry.action == "IMPORT":
        return f"Bulk import of {entry.entity_type} data"
    return f"{entry.action} on {entry.entity_type}"
