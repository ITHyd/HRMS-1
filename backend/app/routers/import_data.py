from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.schemas.import_export import ImportConfirmRequest
from app.services.import_service import confirm_import, get_csv_template, validate_csv

router = APIRouter(prefix="/import", tags=["Import"])


@router.get("/template", response_class=PlainTextResponse)
async def download_template(user: CurrentUser = Depends(get_current_user)):
    return PlainTextResponse(
        content=get_csv_template(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=import_template.csv"},
    )


@router.post("/employees")
async def upload_csv(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    result = await validate_csv(content, user.branch_location_id)
    return result


@router.post("/employees/confirm")
async def confirm(
    request: ImportConfirmRequest,
    user: CurrentUser = Depends(get_current_user),
):
    result = await confirm_import(request.import_token, user.user_id, user.branch_location_id)
    if not result:
        raise HTTPException(status_code=400, detail="Invalid or expired import token")
    return result
