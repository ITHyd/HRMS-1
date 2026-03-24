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
from app.models.attendance_summary import AttendanceSummary
from app.models.project_allocation import ProjectAllocation
from app.models.hrms_holiday import HrmsHoliday
from app.models.excel_utilisation import ExcelUtilisationReport
from app.models.excel_upload_log import ExcelUploadLog
from app.models.employee_planned_worked import EmployeePlannedWorked

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
    AttendanceSummary,
    ProjectAllocation,
    HrmsHoliday,
    ExcelUtilisationReport,
    ExcelUploadLog,
    EmployeePlannedWorked,
]


async def init_db():
    client = AsyncMongoClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    await init_beanie(database=db, document_models=ALL_MODELS)

    # Ensure finance integration config is active (was seeded as inactive in older versions)
    finance_cfg = await IntegrationConfig.find_one(
        IntegrationConfig.integration_type == "finance",
        IntegrationConfig.status == "inactive",
    )
    if finance_cfg:
        finance_cfg.status = "active"
        await finance_cfg.save()

    # Patch HRMS base_url to always match settings (fixes stale DB values after URL changes)
    hrms_cfg = await IntegrationConfig.find_one(
        IntegrationConfig.integration_type == "hrms",
    )
    if hrms_cfg and isinstance(hrms_cfg.config, dict):
        changed = False
        if hrms_cfg.config.get("base_url") != settings.HRMS_BASE_URL:
            hrms_cfg.config["base_url"] = settings.HRMS_BASE_URL
            changed = True
        # Ensure auth fields are present (may be missing from older seed)
        if not hrms_cfg.config.get("auth_mode"):
            hrms_cfg.config["auth_mode"] = "password_grant"
            changed = True
        if not hrms_cfg.config.get("secret_ref"):
            hrms_cfg.config["secret_ref"] = "NXZEN_MANAGER"
            changed = True
        if not hrms_cfg.config.get("hr_id"):
            hrms_cfg.config["hr_id"] = 1
            changed = True
        if changed:
            await hrms_cfg.save()


async def close_db():
    pass
