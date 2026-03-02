from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.utils.jwt_handler import decode_access_token

security = HTTPBearer()


class CurrentUser:
    def __init__(self, employee_id: str, branch_location_id: str, name: str, user_id: str):
        self.employee_id = employee_id
        self.branch_location_id = branch_location_id
        self.name = name
        self.user_id = user_id


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
    return CurrentUser(
        employee_id=payload.get("employee_id", ""),
        branch_location_id=payload.get("branch_location_id", ""),
        name=payload.get("name", ""),
        user_id=payload.get("user_id", ""),
    )
