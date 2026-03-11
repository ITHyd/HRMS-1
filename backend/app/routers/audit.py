from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.audit_service import get_audit_log, get_audit_stats

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/branch/{location_id}")
async def get_branch_audit(
    location_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    return await get_audit_log(
        location_id, page, page_size,
        action=action,
        entity_type=entity_type,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )


@router.get("/branch/{location_id}/stats")
async def get_branch_audit_stats(
    location_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    return await get_audit_stats(location_id)


@router.get("/branch/{location_id}/export")
async def export_audit_log(
    location_id: str,
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    import csv
    import io

    data = await get_audit_log(
        location_id, page=1, page_size=5000,
        action=action,
        entity_type=entity_type,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Action", "Entity Type", "Entity ID", "Changed By", "Description"])
    for entry in data["entries"]:
        writer.writerow([
            entry["timestamp"],
            entry["action"],
            entry["entity_type"],
            entry["entity_id"],
            entry["changed_by_name"],
            entry["description"],
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
    )
