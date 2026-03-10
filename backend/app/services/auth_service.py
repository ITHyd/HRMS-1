import bcrypt

from app.models.location import Location
from app.models.user import User
from app.utils.jwt_handler import create_access_token


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


async def authenticate_user(email: str, password: str) -> dict | None:
    user = await User.find_one(User.email == email)
    if not user or not verify_password(password, user.password_hash):
        return None

    location = await Location.get(user.branch_location_id)
    branch_code = location.code if location else "UNK"

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
