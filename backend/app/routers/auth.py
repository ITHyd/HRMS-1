from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.models.location import Location
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, MeResponse
from app.services.auth_service import authenticate_user
from app.utils.jwt_handler import create_access_token

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


@router.get("/me", response_model=MeResponse)
async def me(current_user: CurrentUser = Depends(get_current_user)):
    """Return fresh user data from DB and a new JWT token."""
    user = await User.find_one(User.email == current_user.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    branch_code = "UNK"
    if user.branch_location_id and user.branch_location_id != "pending_sync":
        try:
            location = await Location.get(user.branch_location_id)
            if location:
                branch_code = location.code
        except Exception:
            pass

    token_data = {
        "user_id": str(user.id),
        "email": user.email,
        "employee_id": user.employee_id,
        "branch_location_id": user.branch_location_id,
        "name": user.name,
        "role": user.role,
    }
    access_token = create_access_token(token_data)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "employee_id": user.employee_id,
        "branch_location_id": user.branch_location_id,
        "branch_code": branch_code,
        "name": user.name,
        "role": user.role,
    }
