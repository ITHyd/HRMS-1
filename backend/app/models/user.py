from beanie import Document
from pydantic import EmailStr


class User(Document):
    email: EmailStr
    password_hash: str
    employee_id: str
    branch_location_id: str
    name: str

    class Settings:
        name = "users"
        indexes = [
            "email",
            "employee_id",
        ]
