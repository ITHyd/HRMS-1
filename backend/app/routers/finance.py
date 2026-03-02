from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import PlainTextResponse

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.schemas.finance import FinanceUploadConfirmRequest
from app.services.finance_service import (
    confirm_finance_upload,
    get_finance_billable,
    get_finance_template,
    get_upload_history,
    validate_finance_csv,
)

router = APIRouter(prefix="/finance", tags=["Finance"])


@router.get("/template", response_class=PlainTextResponse)
async def download_template(user: CurrentUser = Depends(get_current_user)):
    """Download the CSV template for finance billable uploads."""
    return PlainTextResponse(
        content=get_finance_template(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=finance_billable_template.csv"},
    )


@router.post("/billable/upload")
async def upload_finance_csv(
    file: UploadFile = File(...),
    period: str = Query(..., description="Period in YYYY-MM format"),
    user: CurrentUser = Depends(get_current_user),
):
    """Upload and validate a finance billable CSV file."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    result = await validate_finance_csv(content, period, user.branch_location_id)
    return result


@router.post("/billable/confirm")
async def confirm_upload(
    request: FinanceUploadConfirmRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Confirm a previously validated finance billable upload."""
    result = await confirm_finance_upload(
        request.upload_token,
        user.user_id,
        user.branch_location_id,
    )
    if not result:
        raise HTTPException(status_code=400, detail="Invalid or expired upload token")
    return result


@router.get("/billable")
async def list_finance_billable(
    period: str = Query(..., description="Period in YYYY-MM format"),
    version: int | None = Query(None, description="Version number (defaults to latest)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    """List finance billable entries for a period, with optional version filter."""
    return await get_finance_billable(
        period=period,
        branch_location_id=user.branch_location_id,
        version=version,
        page=page,
        page_size=page_size,
    )


@router.get("/uploads")
async def list_upload_history(
    user: CurrentUser = Depends(get_current_user),
):
    """List all finance upload history for the branch."""
    return await get_upload_history(user.branch_location_id)
