from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SkillTagRequest(BaseModel):
    skill_name: str
    proficiency: str = "intermediate"  # beginner | intermediate | advanced | expert
    notes: Optional[str] = None


class SkillTagResponse(BaseModel):
    id: str
    employee_id: str
    skill_name: str
    proficiency: str
    added_by: str
    added_at: datetime
    notes: Optional[str] = None


class SkillCatalogEntry(BaseModel):
    id: str
    name: str
    category: str
    display_name: str


class AvailableEmployee(BaseModel):
    employee_id: str
    employee_name: str
    designation: str
    department: str
    location: str
    skills: list[SkillTagResponse]
    utilisation_percent: float
    classification: str
    available_from: Optional[str] = None
    current_projects: list[dict]


class BenchPoolResponse(BaseModel):
    employees: list[AvailableEmployee]
    total: int
    bench_count: int
    partial_count: int
