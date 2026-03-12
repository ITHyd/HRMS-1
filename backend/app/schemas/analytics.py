from pydantic import BaseModel


class ClientCount(BaseModel):
    client: str
    count: int


class LevelCount(BaseModel):
    level: str
    count: int


class MonthlyTrend(BaseModel):
    month: str  # "2025-01"
    new_hires: int
    cumulative: int


class SpanOfControl(BaseModel):
    manager_id: str
    manager_name: str
    designation: str
    direct_report_count: int
    is_outlier: bool = False  # flagged if < 2 or > 10


class CrossReport(BaseModel):
    employee_id: str
    employee_name: str
    employee_designation: str
    external_manager_id: str
    external_manager_name: str
    external_manager_location: str
    relationship_type: str


class ProjectSummary(BaseModel):
    id: str
    name: str
    status: str
    member_count: int
    client_name: str


class BranchAnalytics(BaseModel):
    total_headcount: int
    active_count: int
    client_breakdown: list[ClientCount]
    level_breakdown: list[LevelCount]
    monthly_trend: list[MonthlyTrend]
    span_of_control: list[SpanOfControl]
    hierarchy_depth: int
    departments_without_manager: list[str]
    cross_reports: list[CrossReport]
    projects: list[ProjectSummary]
    orphaned_projects: list[ProjectSummary]
