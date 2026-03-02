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
    metadata: Optional[dict] = None,
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
        metadata=metadata,
    )
    await entry.insert()
    return entry


async def get_audit_log(
    location_id: str,
    page: int = 1,
    page_size: int = 50,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
):
    filters: list = [AuditLog.branch_location_id == location_id]

    if action:
        filters.append(AuditLog.action == action)
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if date_from:
        filters.append(AuditLog.timestamp >= datetime.fromisoformat(date_from))
    if date_to:
        filters.append(AuditLog.timestamp <= datetime.fromisoformat(date_to + "T23:59:59"))

    skip = (page - 1) * page_size

    query = AuditLog.find(*filters)
    total = await AuditLog.find(*filters).count()
    entries = await query.sort(-AuditLog.timestamp).skip(skip).limit(page_size).to_list()

    # Resolve user names
    user_ids = {e.changed_by for e in entries}
    users = await User.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]}}).to_list()
    user_map = {str(u.id): u.name for u in users}

    result = []
    for entry in entries:
        desc = _build_description(entry)
        item = {
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
        }
        if entry.metadata:
            item["metadata"] = entry.metadata
        result.append(item)

    # Filter by search term (on description or entity_id) post-query
    if search:
        search_lower = search.lower()
        result = [r for r in result if search_lower in r["description"].lower() or search_lower in r["entity_id"].lower() or search_lower in r.get("changed_by_name", "").lower()]
        total = len(result)

    return {
        "entries": result,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_audit_stats(location_id: str):
    """Return action-type counts for the last 7 days."""
    since = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    since = since - timedelta(days=7)

    entries = await AuditLog.find(
        AuditLog.branch_location_id == location_id,
        AuditLog.timestamp >= since,
    ).to_list()

    action_counts: dict[str, int] = {}
    entity_counts: dict[str, int] = {}
    for e in entries:
        action_counts[e.action] = action_counts.get(e.action, 0) + 1
        entity_counts[e.entity_type] = entity_counts.get(e.entity_type, 0) + 1

    return {
        "period": "last_7_days",
        "total_events": len(entries),
        "by_action": action_counts,
        "by_entity": entity_counts,
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
    elif entry.action == "SYNC":
        return f"HRMS sync for {entry.entity_type}"
    elif entry.action == "EXPORT":
        return f"Data exported: {entry.entity_type}"
    elif entry.action == "UPLOAD":
        return f"File uploaded for {entry.entity_type}"
    elif entry.action == "SKILL_TAG":
        return f"Skill tagged on {entry.entity_type}"
    elif entry.action == "APPROVE":
        return f"{entry.entity_type} approved (ID: {entry.entity_id})"
    elif entry.action == "REJECT":
        return f"{entry.entity_type} rejected (ID: {entry.entity_id})"
    elif entry.action == "LOCK":
        return f"Period lock toggled for {entry.entity_type}"
    elif entry.action == "COMPUTE":
        return f"Utilisation computed for {entry.entity_type}"
    return f"{entry.action} on {entry.entity_type}"
