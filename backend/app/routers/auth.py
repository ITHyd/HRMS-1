from fastapi import APIRouter, HTTPException, status, Depends

from app.schemas.auth import LoginRequest, LoginResponse
from app.services.auth_service import authenticate_user
from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.models.employee import Employee
from app.models.location import Location

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    result = await authenticate_user(request.email, request.password)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return result


@router.get("/me")
async def get_current_user_profile(user: CurrentUser = Depends(get_current_user)):
    """Get current user's profile information."""
    # Get employee details
    employee = await Employee.get(user.employee_id)
    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee profile not found"
        )
    
    # Get location details
    location = await Location.get(user.branch_location_id)
    
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "employee_id": user.employee_id,
        "branch_location_id": user.branch_location_id,
        "branch_location": {
            "id": str(location.id) if location else None,
            "city": location.city if location else None,
            "country": location.country if location else None,
            "code": location.code if location else None,
        } if location else None,
        "employee": {
            "id": str(employee.id),
            "name": employee.name,
            "email": employee.email,
            "designation": employee.designation,
            "level": employee.level,
            "department_id": employee.department_id,
            "location_id": employee.location_id,
        }
    }
