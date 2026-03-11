from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    employee_id: str
    branch_location_id: str
    branch_code: str
    name: str
    role: str = "branch_head"


class MeResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    employee_id: str
    branch_location_id: str
    branch_code: str
    name: str
    role: str
