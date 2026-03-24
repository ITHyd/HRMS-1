from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile

from app.config import settings
from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.models.user import User
from app.services.excel_utilisation_service import (
    get_excel_dashboard,
    get_excel_timesheets,
    get_excel_resource_rows,
    get_excel_projects,
    get_excel_project_detail,
    get_upload_history,
    get_employee_planned_worked_timeline,
    get_branch_planned_vs_actual,
    parse_and_store_excel,
    list_excel_employees,
    run_configured_excel_reimport,
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


@router.get("/planned-vs-actual")
async def planned_vs_actual(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    user: CurrentUser = Depends(get_current_user),
):
    """Return branch-level planned vs actual utilisation from Excel planned/worked sheets."""
    data = await get_branch_planned_vs_actual(period, user.branch_location_id)
    if not data:
        raise HTTPException(status_code=404, detail="No planned/worked data for this period")
    return data


@router.get("/employee/{employee_id}/timeline")
async def employee_planned_worked_timeline(
    employee_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Return month-by-month planned vs worked days for an employee from Excel sheets."""
    return await get_employee_planned_worked_timeline(employee_id)


@router.get("/projects/{project_id}")
async def excel_project_detail(
    project_id: str,
    period: str = Query(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Return project detail from inter-company Excel data for the selected month."""
    detail = await get_excel_project_detail(project_id, period, user.branch_location_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Project not found")
    return detail


@router.get("/projects")
async def excel_projects(
    period: str = Query(...),
    search: str = Query(None),
    client_name: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    """Return project list from inter-company Excel data for the selected month."""
    return await get_excel_projects(
        branch_location_id=user.branch_location_id,
        period=period,
        search=search,
        client_name=client_name,
        page=page,
        page_size=page_size,
    )


async def _run_reimport(branch_location_id: str, user_id: str):
    """Background task: re-run unified Excel seed from the configured file path."""
    await run_configured_excel_reimport(branch_location_id, user_id)


@router.get("/employees")
async def excel_employees(
    period: str = Query("2026-03", pattern=r"^\d{4}-\d{2}$"),
    search: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    """Return unmatched Excel employees (not in HRMS) for the Employee Master page."""
    return await list_excel_employees(
        branch_location_id=user.branch_location_id,
        period=period,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.post("/reimport")
async def reimport_excel(
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
):
    """Trigger re-import of the Excel file from the configured server path."""
    file_path = Path(settings.EXCEL_FILE_PATH)
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Excel file not found at configured path: {settings.EXCEL_FILE_PATH}",
        )
    background_tasks.add_task(_run_reimport, user.branch_location_id, user.user_id)
    return {"status": "reimport_started", "file": str(file_path)}
