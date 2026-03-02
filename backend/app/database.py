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
from app.models.timesheet_entry import TimesheetEntry
from app.models.timesheet_period_lock import TimesheetPeriodLock
from app.models.timesheet_edit_history import TimesheetEditHistory
from app.models.hrms_sync_log import HrmsSyncLog
from app.models.finance_billable import FinanceBillable
from app.models.finance_upload_log import FinanceUploadLog
from app.models.capacity_config import CapacityConfig
from app.models.employee_capacity_override import EmployeeCapacityOverride
from app.models.utilisation_snapshot import UtilisationSnapshot
from app.models.employee_skill import EmployeeSkill
from app.models.skill_catalog import SkillCatalog
from app.models.integration_config import IntegrationConfig
from app.models.sync_log import SyncLog
from app.models.dynamics_export import DynamicsExport

ALL_MODELS = [
    Employee,
    ReportingRelationship,
    Location,
    Department,
    Project,
    EmployeeProject,
    AuditLog,
    User,
    TimesheetEntry,
    TimesheetPeriodLock,
    TimesheetEditHistory,
    HrmsSyncLog,
    FinanceBillable,
    FinanceUploadLog,
    CapacityConfig,
    EmployeeCapacityOverride,
    UtilisationSnapshot,
    EmployeeSkill,
    SkillCatalog,
    IntegrationConfig,
    SyncLog,
    DynamicsExport,
]


async def init_db():
    client = AsyncMongoClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    await init_beanie(database=db, document_models=ALL_MODELS)


async def close_db():
    pass
