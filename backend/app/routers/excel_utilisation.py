from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.excel_utilisation_service import (
    get_excel_dashboard,
    get_excel_timesheets,
    get_excel_resource_rows,
    get_upload_history,
    parse_and_store_excel,
)

router = APIRouter(prefix="/excel-utilisation", tags=["Excel Utilisation"])

ALLOWED_EXTENSIONS = {".xlsx", ".xls"}


@router.post("/upload")
async def upload_excel_report(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Upload an Excel utilisation report (.xlsx). Parses and stores per-employee monthly data."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File must be .xlsx or .xls")

    content = await file.read()
    result = await parse_and_store_excel(
        file_content=content,
        filename=file.filename,
        branch_location_id=user.branch_location_id,
        user_id=user.user_id,
    )
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])
    return result


@router.get("/dashboard")
async def excel_dashboard(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    user: CurrentUser = Depends(get_current_user),
):
    """Return executive dashboard data from the uploaded Excel report."""
    data = await get_excel_dashboard(period, user.branch_location_id)
    if not data:
        raise HTTPException(status_code=404, detail="No Excel data for this period. Upload a report first.")
    return data


@router.get("/resources")
async def excel_resources(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    search: str = Query(None),
    classification: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    """Return per-employee rows from Excel data."""
    return await get_excel_resource_rows(
        period=period,
        branch_location_id=user.branch_location_id,
        search=search,
        classification=classification,
        page=page,
        page_size=page_size,
    )


@router.get("/timesheets")
async def excel_timesheets(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    employee_id: str = Query(None),
    project_id: str = Query(None),
    status: str = Query(None),
    is_billable: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    """Return Excel data in the same shape as the timesheets page expects."""
    return await get_excel_timesheets(
        period=period,
        branch_location_id=user.branch_location_id,
        employee_id=employee_id,
        project_id=project_id,
        status=status,
        is_billable=None if is_billable is None else (is_billable.lower() == "true"),
        page=page,
        page_size=page_size,
    )


@router.get("/uploads")
async def list_uploads(user: CurrentUser = Depends(get_current_user)):
    """List Excel upload history for this branch."""
    return await get_upload_history(user.branch_location_id)
