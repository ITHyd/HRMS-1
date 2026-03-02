from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class EmployeeBrief(BaseModel):
    id: str
    name: str
    designation: str
    department: str
    department_id: str
    level: str
    location_id: str
    location_code: str
    location_city: str
    photo_url: Optional[str] = None
    is_active: bool = True


class ManagerInfo(BaseModel):
    id: str
    name: str
    designation: str
    location_code: str
    relationship_type: str  # "PRIMARY" | "FUNCTIONAL" | "PROJECT"


class ProjectInfo(BaseModel):
    id: str
    name: str
    status: str
    role_in_project: str
    start_date: datetime
    end_date: Optional[datetime] = None
    progress_percent: float = 0.0


class EmployeeDetail(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    designation: str
    department: str
    department_id: str
    level: str
    location_id: str
    location_code: str
    location_city: str
    photo_url: Optional[str] = None
    is_active: bool = True
    join_date: Optional[datetime] = None
    tenure_months: Optional[int] = None
    managers: list[ManagerInfo] = []
    reporting_chain: list[EmployeeBrief] = []
    direct_reports: list[EmployeeBrief] = []
    projects: list[ProjectInfo] = []
    is_own_branch: bool = False


class SearchResult(BaseModel):
    employees: list[EmployeeBrief]
    total: int
