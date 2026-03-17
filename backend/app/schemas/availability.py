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
    # Active/on-hold project assignments (same as current_projects for backward compat)
    current_projects: list[dict]
    active_projects: list[dict] = []
    # Last completed projects (for bench context)
    last_projects: list[dict] = []
    # When the employee became bench (end date of their last completed project)
    bench_since: Optional[str] = None
    # Days on bench since bench_since
    bench_duration_days: Optional[int] = None


class BenchPoolResponse(BaseModel):
    employees: list[AvailableEmployee]
    total: int
    bench_count: int
    partial_count: int
    avg_bench_days: Optional[int] = None
