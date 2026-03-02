from pymongo import AsyncMongoClient
from beanie import init_beanie

from app.config import settings
from app.models.employee import Employee
from app.models.reporting_relationship import ReportingRelationship
from app.models.location import Location
from app.models.department import Department
from app.models.project import Project
from app.models.employee_project import EmployeeProject
from app.models.audit_log import AuditLog
from app.models.user import User

ALL_MODELS = [
    Employee,
    ReportingRelationship,
    Location,
    Department,
    Project,
    EmployeeProject,
    AuditLog,
    User,
]


async def init_db():
    client = AsyncMongoClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    await init_beanie(database=db, document_models=ALL_MODELS)


async def close_db():
    pass
