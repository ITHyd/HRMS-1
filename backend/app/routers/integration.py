from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.schemas.integration import (
    DynamicsExportRequest,
    IntegrationConfigCreate,
    IntegrationConfigUpdate,
)
from app.services import integration_service
from app.services import dynamics_service
from app.services import skills_sync_service

router = APIRouter(prefix="/integrations", tags=["Integrations"])


# ---------------------------------------------------------------------------
# Integration Configs
# ---------------------------------------------------------------------------


@router.get("/configs")
async def list_configs(user: CurrentUser = Depends(get_current_user)):
    """List all integration configurations."""
    return await integration_service.list_integration_configs()


@router.post("/configs")
async def create_config(
    body: IntegrationConfigCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a new integration configuration."""
    return await integration_service.create_integration_config(body.model_dump(), user)


@router.put("/configs/{config_id}")
async def update_config(
    config_id: str,
    body: IntegrationConfigUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    """Update an existing integration configuration."""
    try:
        return await integration_service.update_integration_config(
            config_id, body.model_dump(exclude_unset=True), user
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Sync operations
# ---------------------------------------------------------------------------


@router.post("/sync/{config_id}")
async def trigger_sync(
    config_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Trigger a manual sync for the given integration configuration."""
    try:
        return await integration_service.trigger_manual_sync(config_id, user)
    except ValueError as e:
        msg = str(e)
        status = 404 if "not found" in msg.lower() else 400
        raise HTTPException(status_code=status, detail=msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.post("/sync/{sync_id}/retry")
async def retry_sync(
    sync_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Retry a previously failed sync operation."""
    try:
        return await integration_service.retry_sync(sync_id, user)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/sync-logs")
async def list_sync_logs(
    integration_type: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    """List sync logs with optional integration_type filter."""
    return await integration_service.get_sync_logs(
        integration_type=integration_type,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Dynamics 365 Exports
# ---------------------------------------------------------------------------


@router.post("/dynamics/export")
async def create_dynamics_export(
    body: DynamicsExportRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a new Dynamics 365 export."""
    try:
        return await dynamics_service.create_dynamics_export(
            export_type=body.export_type,
            branch_location_id=user.branch_location_id,
            user=user,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dynamics/exports")
async def list_dynamics_exports(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    """List all Dynamics 365 exports."""
    return await dynamics_service.list_dynamics_exports(page=page, page_size=page_size)


@router.get("/dynamics/exports/{export_id}")
async def get_dynamics_export(
    export_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single Dynamics 365 export by ID."""
    try:
        return await dynamics_service.get_dynamics_export(export_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/dynamics/exports/{export_id}/download")
async def download_dynamics_export(
    export_id: str,
    format: str = Query("json", pattern="^(json|csv)$"),
    user: CurrentUser = Depends(get_current_user),
):
    """Download a Dynamics 365 export as JSON or CSV."""
    try:
        data = await dynamics_service.get_export_download(export_id, format=format)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if format == "csv":
        return Response(
            content=data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=dynamics_export_{export_id}.csv"},
        )

    return Response(
        content=data,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=dynamics_export_{export_id}.json"},
    )


# ---------------------------------------------------------------------------
# Skills Portal Integration
# ---------------------------------------------------------------------------


@router.post("/skills/sync/catalog")
async def sync_skills_catalog(
    user: CurrentUser = Depends(get_current_user),
):
    """Sync skill catalog from Skills Portal."""
    try:
        # Get Skills integration config to retrieve token
        config = await integration_service.get_integration_config_by_type("skills")
        if not config:
            raise HTTPException(
                status_code=404,
                detail="Skills integration not configured. Please configure it first."
            )
        
        token = config.get("config", {}).get("token", "")
        if not token:
            raise HTTPException(
                status_code=400,
                detail="Skills API token not configured"
            )
        
        return await skills_sync_service.sync_skill_catalog(token, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/skills/sync/employee-skills")
async def sync_employee_skills(
    user: CurrentUser = Depends(get_current_user),
):
    """Sync employee skills from Skills Portal."""
    try:
        # Get Skills integration config to retrieve token
        config = await integration_service.get_integration_config_by_type("skills")
        if not config:
            raise HTTPException(
                status_code=404,
                detail="Skills integration not configured. Please configure it first."
            )
        
        token = config.get("config", {}).get("token", "")
        if not token:
            raise HTTPException(
                status_code=400,
                detail="Skills API token not configured"
            )
        
        return await skills_sync_service.sync_employee_skills(token, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/skills/sync-logs")
async def list_skills_sync_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    """List Skills sync logs."""
    return await skills_sync_service.get_skills_sync_logs(page=page, page_size=page_size)

