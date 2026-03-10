from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.utils.jwt_handler import decode_access_token

security = HTTPBearer()


class CurrentUser:
    def __init__(self, employee_id: str, branch_location_id: str, name: str, user_id: str, role: str = "branch_head"):
        self.employee_id = employee_id
        self.branch_location_id = branch_location_id
        self.name = name
        self.user_id = user_id
        self.role = role


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("user_id", "")

    # Always resolve branch_location_id and employee_id from DB so that
    # changes made by a sync (e.g. after HRMS re-sync updates location IDs)
    # are reflected immediately without requiring a re-login.
    branch_location_id = payload.get("branch_location_id", "")
    employee_id = payload.get("employee_id", "")
    if user_id:
        from app.models.user import User
        db_user = await User.get(user_id)
        if db_user:
            branch_location_id = db_user.branch_location_id
            employee_id = db_user.employee_id

    return CurrentUser(
        employee_id=employee_id,
        branch_location_id=branch_location_id,
        name=payload.get("name", ""),
        user_id=user_id,
        role=payload.get("role", "branch_head"),
    )
