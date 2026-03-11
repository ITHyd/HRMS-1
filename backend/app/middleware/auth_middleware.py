from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.utils.jwt_handler import decode_access_token

security = HTTPBearer()


class CurrentUser:
    def __init__(self, employee_id: str, branch_location_id: str, name: str, user_id: str, email: str = "", role: str = "branch_head"):
        self.employee_id = employee_id
        self.branch_location_id = branch_location_id
        self.name = name
        self.user_id = user_id
        self.email = email
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
    email = payload.get("email", "")

    # Always resolve live values from DB so sync-updated fields are reflected
    # immediately. If the user_id is stale (e.g. DB was wiped and re-seeded),
    # fall back to lookup by email which is stable.
    branch_location_id = payload.get("branch_location_id", "")
    employee_id = payload.get("employee_id", "")
    from app.models.user import User
    db_user = await User.get(user_id) if user_id else None
    if db_user is None and email:
        db_user = await User.find_one(User.email == email)
    if db_user:
        user_id = str(db_user.id)
        branch_location_id = db_user.branch_location_id
        employee_id = db_user.employee_id
        email = db_user.email

    return CurrentUser(
        employee_id=employee_id,
        branch_location_id=branch_location_id,
        name=payload.get("name", ""),
        user_id=user_id,
        email=email,
        role=payload.get("role", "branch_head"),
    )
