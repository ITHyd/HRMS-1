# Project Documentation

Generated: 2026-03-12 19:47:25

## Scope

- This document inventories the application file-by-file across backend and frontend source/config scripts.
- Dependency/vendor trees (for example `node_modules`) and generated artifacts are intentionally excluded.
- `.env` values are not documented to avoid exposing secrets.

## System Overview

- Backend: FastAPI + Beanie (MongoDB), organized into `routers -> services -> models/schemas` layers.
- Frontend: React + TypeScript + Vite, organized into `pages`, `components`, `api`, `store`, and `types` modules.
- Data/ops: seed utilities under `backend/seed` and helper Windows scripts at repo root.

## Inventory Summary

- Total documented files: 218
- Root files: 4
- Backend files: 92
- Frontend files: 122

## Root

### `README.md`

- Role: Primary project readme with setup and architecture overview.
- Size: 100 lines
- Document headings: Branch Command Center, Tech Stack, Prerequisites, Getting Started, Backend, HRMS Connector Notes, Frontend, Project Structure

### `seed-data.bat`

- Role: Windows helper script for local development tasks.
- Size: 4 lines
- Script commands: @echo off | cd /d "%~dp0backend" | python -m seed.seed_data | pause

### `start-backend.bat`

- Role: Windows helper script for local development tasks.
- Size: 8 lines
- Script commands: @echo off | cd /d "%~dp0backend" | echo Initializing database... | python -m seed.init_db | echo. | echo Starting backend server...

### `start-frontend.bat`

- Role: Windows helper script for local development tasks.
- Size: 4 lines
- Script commands: @echo off | cd /d "%~dp0frontend" | npm run dev | pause

## backend/app

### `backend/app/__init__.py`

- Role: Python module in backend application.
- Size: 0 lines

### `backend/app/config.py`

- Role: Application configuration model (pydantic settings) and environment loading.
- Size: 39 lines
- Classes: Settings

### `backend/app/database.py`

- Role: MongoDB/Beanie initialization and model registration.
- Size: 67 lines
- Functions: close_db, init_db
- Key constants: ALL_MODELS
- Key imports: app.config, app.models.attendance_summary, app.models.audit_log, app.models.capacity_config, app.models.department, app.models.dynamics_export, app.models.employee, app.models.employee_capacity_override

### `backend/app/main.py`

- Role: FastAPI application entrypoint, middleware setup, router registration, and health endpoint.
- Size: 55 lines
- Functions: health, lifespan
- Key imports: app.config, app.database, app.routers, fastapi, fastapi.middleware.cors

## backend/app/middleware

### `backend/app/middleware/__init__.py`

- Role: Middleware component for   init   behavior.
- Size: 0 lines

### `backend/app/middleware/auth_middleware.py`

- Role: Middleware component for auth middleware behavior.
- Size: 55 lines
- Classes: CurrentUser
- Functions: get_current_user
- Key imports: app.utils.jwt_handler, fastapi, fastapi.security

## backend/app/models

### `backend/app/models/__init__.py`

- Role: Beanie document model for   init   data.
- Size: 47 lines
- Key imports: app.models.audit_log, app.models.capacity_config, app.models.department, app.models.dynamics_export, app.models.employee, app.models.employee_capacity_override, app.models.employee_project, app.models.employee_skill

### `backend/app/models/attendance_summary.py`

- Role: Beanie document model for attendance summary data.
- Size: 41 lines
- Classes: AttendanceSummary
- Key imports: beanie

### `backend/app/models/audit_log.py`

- Role: Beanie document model for audit log data.
- Size: 24 lines
- Classes: AuditLog
- Key imports: beanie

### `backend/app/models/capacity_config.py`

- Role: Beanie document model for capacity config data.
- Size: 21 lines
- Classes: CapacityConfig
- Key imports: beanie

### `backend/app/models/department.py`

- Role: Beanie document model for department data.
- Size: 32 lines
- Classes: Department
- Key imports: beanie

### `backend/app/models/dynamics_export.py`

- Role: Beanie document model for dynamics export data.
- Size: 22 lines
- Classes: DynamicsExport
- Key imports: beanie

### `backend/app/models/employee.py`

- Role: Beanie document model for employee data.
- Size: 44 lines
- Classes: Employee
- Key imports: beanie

### `backend/app/models/employee_capacity_override.py`

- Role: Beanie document model for employee capacity override data.
- Size: 21 lines
- Classes: EmployeeCapacityOverride
- Key imports: beanie

### `backend/app/models/employee_project.py`

- Role: Beanie document model for employee project data.
- Size: 36 lines
- Classes: EmployeeProject
- Key imports: beanie

### `backend/app/models/employee_skill.py`

- Role: Beanie document model for employee skill data.
- Size: 21 lines
- Classes: EmployeeSkill
- Key imports: beanie

### `backend/app/models/finance_billable.py`

- Role: Beanie document model for finance billable data.
- Size: 27 lines
- Classes: FinanceBillable
- Key imports: beanie

### `backend/app/models/finance_upload_log.py`

- Role: Beanie document model for finance upload log data.
- Size: 25 lines
- Classes: FinanceUploadLog
- Key imports: beanie

### `backend/app/models/hrms_holiday.py`

- Role: Beanie document model for hrms holiday data.
- Size: 40 lines
- Classes: HrmsHoliday
- Key imports: beanie

### `backend/app/models/hrms_sync_log.py`

- Role: Beanie document model for hrms sync log data.
- Size: 31 lines
- Classes: HrmsSyncLog
- Key imports: beanie

### `backend/app/models/integration_config.py`

- Role: Beanie document model for integration config data.
- Size: 23 lines
- Classes: IntegrationConfig
- Key imports: beanie

### `backend/app/models/location.py`

- Role: Beanie document model for location data.
- Size: 33 lines
- Classes: Location
- Key imports: beanie

### `backend/app/models/project.py`

- Role: Beanie document model for project data.
- Size: 40 lines
- Classes: Project
- Key imports: beanie

### `backend/app/models/project_allocation.py`

- Role: Beanie document model for project allocation data.
- Size: 47 lines
- Classes: ProjectAllocation
- Key imports: beanie

### `backend/app/models/reporting_relationship.py`

- Role: Beanie document model for reporting relationship data.
- Size: 34 lines
- Classes: ReportingRelationship
- Key imports: beanie

### `backend/app/models/skill_catalog.py`

- Role: Beanie document model for skill catalog data.
- Size: 14 lines
- Classes: SkillCatalog
- Key imports: beanie

### `backend/app/models/sync_log.py`

- Role: Beanie document model for sync log data.
- Size: 28 lines
- Classes: SyncLog
- Key imports: beanie

### `backend/app/models/timesheet_edit_history.py`

- Role: Beanie document model for timesheet edit history data.
- Size: 20 lines
- Classes: TimesheetEditHistory
- Key imports: beanie

### `backend/app/models/timesheet_entry.py`

- Role: Beanie document model for timesheet entry data.
- Size: 49 lines
- Classes: TimesheetEntry
- Key imports: beanie

### `backend/app/models/timesheet_period_lock.py`

- Role: Beanie document model for timesheet period lock data.
- Size: 18 lines
- Classes: TimesheetPeriodLock
- Key imports: beanie

### `backend/app/models/user.py`

- Role: Beanie document model for user data.
- Size: 18 lines
- Classes: User
- Key imports: beanie

### `backend/app/models/utilisation_snapshot.py`

- Role: Beanie document model for utilisation snapshot data.
- Size: 29 lines
- Classes: UtilisationSnapshot
- Key imports: beanie

## backend/app/routers

### `backend/app/routers/__init__.py`

- Role: FastAPI router for   init   domain endpoints.
- Size: 0 lines

### `backend/app/routers/admin.py`

- Role: FastAPI router for admin domain endpoints.
- Size: 120 lines
- Classes: ModeResponse, SwitchModeRequest
- Functions: _seed_demo, _seed_live, get_mode, switch_mode
- Routes: GET /mode, POST /switch-mode
- Key imports: app.database, app.models.user, fastapi

### `backend/app/routers/analytics.py`

- Role: FastAPI router for analytics domain endpoints.
- Size: 14 lines
- Functions: branch_analytics
- Routes: GET /branch/{location_id}
- Key imports: app.middleware.auth_middleware, app.services.analytics_service, fastapi

### `backend/app/routers/audit.py`

- Role: FastAPI router for audit domain endpoints.
- Size: 81 lines
- Functions: export_audit_log, get_branch_audit, get_branch_audit_stats
- Routes: GET /branch/{location_id}, GET /branch/{location_id}/export, GET /branch/{location_id}/stats
- Key imports: app.middleware.auth_middleware, app.services.audit_service, fastapi, fastapi.responses

### `backend/app/routers/auth.py`

- Role: FastAPI router for auth domain endpoints.
- Size: 58 lines
- Functions: login, me
- Routes: GET /me, POST /login
- Key imports: app.middleware.auth_middleware, app.models.location, app.models.user, app.schemas.auth, app.services.auth_service, app.utils.jwt_handler, fastapi

### `backend/app/routers/availability.py`

- Role: FastAPI router for availability domain endpoints.
- Size: 108 lines
- Functions: add_employee_skill, get_bench_pool, get_designations, get_employee_skills, get_locations, get_skill_catalog, remove_employee_skill, search_skill_catalog
- Routes: DELETE /skills/{employee_id}/{skill_name}, GET /bench, GET /designations, GET /locations, GET /skill-catalog, GET /skill-catalog/search, GET /skills/{employee_id}, POST /skills/{employee_id}
- Key imports: app.middleware.auth_middleware, app.schemas.availability, app.services, fastapi

### `backend/app/routers/dashboard.py`

- Role: FastAPI router for dashboard domain endpoints.
- Size: 98 lines
- Functions: allocation_dashboard, executive_dashboard, project_dashboard, resource_allocation_dashboard, resource_dashboard
- Routes: GET /allocations, GET /executive, GET /projects, GET /resource-allocations, GET /resources
- Key imports: app.middleware.auth_middleware, app.services.dashboard_service, fastapi

### `backend/app/routers/employees.py`

- Role: FastAPI router for employees domain endpoints.
- Size: 75 lines
- Functions: get_departments, get_employee, get_employees, get_hrms_status, search
- Routes: GET /, GET /departments, GET /search, GET /status, GET /{employee_id}
- Key imports: app.middleware.auth_middleware, app.models.employee, app.services.employee_service, fastapi

### `backend/app/routers/export_data.py`

- Role: FastAPI router for export data domain endpoints.
- Size: 77 lines
- Functions: export_bench, export_billable, export_branch_report, export_emp_allocation, export_project_util
- Routes: GET /bench, GET /billable, GET /branch/report, GET /employee-allocation, GET /project-utilisation
- Key imports: app.middleware.auth_middleware, app.services.export_service, fastapi, fastapi.responses

### `backend/app/routers/finance.py`

- Role: FastAPI router for finance domain endpoints.
- Size: 81 lines
- Functions: confirm_upload, download_template, list_finance_billable, list_upload_history, upload_finance_csv
- Routes: GET /billable, GET /template, GET /uploads, POST /billable/confirm, POST /billable/upload
- Key imports: app.middleware.auth_middleware, app.schemas.finance, app.services.finance_service, fastapi, fastapi.responses

### `backend/app/routers/hrms_sync.py`

- Role: FastAPI router for hrms sync domain endpoints.
- Size: 110 lines
- Functions: get_sync_log, list_sync_logs, trigger_hrms_sync, trigger_master_data_sync
- Routes: GET /logs, GET /logs/{batch_id}, POST /master-data, POST /trigger
- Key imports: app.middleware.auth_middleware, app.models.user, app.schemas.hrms_sync, app.services.hrms_sync_service, fastapi

### `backend/app/routers/integration.py`

- Role: FastAPI router for integration domain endpoints.
- Size: 165 lines
- Functions: create_config, create_dynamics_export, download_dynamics_export, get_dynamics_export, list_configs, list_dynamics_exports, list_sync_logs, retry_sync, trigger_sync, update_config
- Routes: GET /configs, GET /dynamics/exports, GET /dynamics/exports/{export_id}, GET /dynamics/exports/{export_id}/download, GET /sync-logs, POST /configs, POST /dynamics/export, POST /sync/{config_id}, POST /sync/{sync_id}/retry, PUT /configs/{config_id}
- Key imports: app.middleware.auth_middleware, app.schemas.integration, app.services, fastapi, fastapi.responses

### `backend/app/routers/org.py`

- Role: FastAPI router for org domain endpoints.
- Size: 81 lines
- Functions: get_branch_tree, get_chain, get_full_tree, get_trace, list_employees, list_projects
- Routes: GET /branch/{location_id}/tree, GET /chain/{employee_id}, GET /employees, GET /projects, GET /trace, GET /tree
- Key imports: app.middleware.auth_middleware, app.models.department, app.models.employee, app.models.employee_project, app.models.project, app.services.org_tree_service, fastapi

### `backend/app/routers/projects.py`

- Role: FastAPI router for projects domain endpoints.
- Size: 160 lines
- Classes: AssignRequest, ProjectCreateRequest
- Functions: assign_to_project, create_new_project, employee_timeline, get_project, get_projects, list_clients, project_timeline
- Routes: GET /, GET /clients, GET /employees/{employee_id}/timeline, GET /timeline, GET /{project_id}, POST /, POST /assign
- Key imports: app.middleware.auth_middleware, app.services.project_service, fastapi

### `backend/app/routers/search.py`

- Role: FastAPI router for search domain endpoints.
- Size: 40 lines
- Functions: search_employees_by_skill, search_global
- Routes: GET /employees-by-skill, GET /global
- Key imports: app.middleware.auth_middleware, app.services.global_search_service, fastapi

### `backend/app/routers/timesheets.py`

- Role: FastAPI router for timesheets domain endpoints.
- Size: 134 lines
- Functions: approve_reject_entries, check_period_lock, create_entry, delete_entry, get_entry_history, get_workload_heatmap, list_entries, submit_entries, toggle_period_lock, update_entry
- Routes: DELETE /{entry_id}, GET /, GET /heatmap, GET /period-lock, GET /{entry_id}/history, POST /, POST /approve, POST /period-lock, POST /submit, PUT /{entry_id}
- Key imports: app.middleware.auth_middleware, app.schemas.timesheet, app.services, fastapi

### `backend/app/routers/utilisation.py`

- Role: FastAPI router for utilisation domain endpoints.
- Size: 140 lines
- Functions: create_override, get_capacity_config, get_employee_utilisation, get_summary, list_overrides, update_config
- Routes: GET /config, GET /employee/{employee_id}, GET /overrides, GET /summary, POST /overrides, PUT /config
- Key imports: app.middleware.auth_middleware, app.schemas.utilisation, app.services.utilisation_service, fastapi

## backend/app/schemas

### `backend/app/schemas/__init__.py`

- Role: Pydantic request/response schemas for   init   domain.
- Size: 0 lines

### `backend/app/schemas/analytics.py`

- Role: Pydantic request/response schemas for analytics domain.
- Size: 57 lines
- Classes: BranchAnalytics, ClientCount, CrossReport, LevelCount, MonthlyTrend, ProjectSummary, SpanOfControl

### `backend/app/schemas/audit.py`

- Role: Pydantic request/response schemas for audit domain.
- Size: 24 lines
- Classes: AuditEntry, AuditLogResponse

### `backend/app/schemas/auth.py`

- Role: Pydantic request/response schemas for auth domain.
- Size: 26 lines
- Classes: LoginRequest, LoginResponse, MeResponse

### `backend/app/schemas/availability.py`

- Role: Pydantic request/response schemas for availability domain.
- Size: 47 lines
- Classes: AvailableEmployee, BenchPoolResponse, SkillCatalogEntry, SkillTagRequest, SkillTagResponse

### `backend/app/schemas/dashboard.py`

- Role: Pydantic request/response schemas for dashboard domain.
- Size: 58 lines
- Classes: ExecutiveDashboardResponse, ProjectDashboardEntry, ProjectDashboardResponse, ResourceDashboardEntry, ResourceDashboardResponse

### `backend/app/schemas/employee.py`

- Role: Pydantic request/response schemas for employee domain.
- Size: 63 lines
- Classes: EmployeeBrief, EmployeeDetail, ManagerInfo, ProjectInfo, SearchResult

### `backend/app/schemas/finance.py`

- Role: Pydantic request/response schemas for finance domain.
- Size: 54 lines
- Classes: FinanceBillableListResponse, FinanceBillableResponse, FinanceUploadConfirmRequest, FinanceUploadConfirmResponse, FinanceUploadValidationResponse, FinanceValidationRow

### `backend/app/schemas/hrms_sync.py`

- Role: Pydantic request/response schemas for hrms sync domain.
- Size: 29 lines
- Classes: HrmsSyncLogResponse, HrmsSyncLogsListResponse, HrmsSyncTriggerRequest

### `backend/app/schemas/integration.py`

- Role: Pydantic request/response schemas for integration domain.
- Size: 62 lines
- Classes: DynamicsExportRequest, DynamicsExportResponse, IntegrationConfigCreate, IntegrationConfigResponse, IntegrationConfigUpdate, SyncLogResponse, SyncLogsListResponse

### `backend/app/schemas/org_tree.py`

- Role: Pydantic request/response schemas for org tree domain.
- Size: 41 lines
- Classes: OrgTreeNode, OrgTreeResponse, ReportingChainResponse, SecondaryEdge, TracePathResponse

### `backend/app/schemas/timesheet.py`

- Role: Pydantic request/response schemas for timesheet domain.
- Size: 68 lines
- Classes: PeriodLockRequest, TimesheetApprovalRequest, TimesheetEditHistoryResponse, TimesheetEntryCreate, TimesheetEntryResponse, TimesheetEntryUpdate, TimesheetListResponse, TimesheetSubmitRequest

### `backend/app/schemas/utilisation.py`

- Role: Pydantic request/response schemas for utilisation domain.
- Size: 55 lines
- Classes: CapacityConfigResponse, CapacityConfigUpdate, EmployeeCapacityOverrideCreate, UtilisationSnapshotResponse, UtilisationSummary

## backend/app/services

### `backend/app/services/__init__.py`

- Role: Service-layer business logic for   init   domain.
- Size: 0 lines

### `backend/app/services/analytics_service.py`

- Role: Service-layer business logic for analytics service domain.
- Size: 215 lines
- Functions: get_branch_analytics
- Key imports: app.models.department, app.models.employee, app.models.employee_project, app.models.location, app.models.project, app.models.reporting_relationship

### `backend/app/services/audit_service.py`

- Role: Service-layer business logic for audit service domain.
- Size: 334 lines
- Functions: _build_description, _build_name_maps, _enrich_entries, _humanize_value, _search_audit_log, get_audit_log, get_audit_stats, log_change
- Key imports: app.models.audit_log, app.models.employee, app.models.project, app.models.user

### `backend/app/services/auth_service.py`

- Role: Service-layer business logic for auth service domain.
- Size: 48 lines
- Functions: authenticate_user, hash_password, verify_password
- Key imports: app.models.location, app.models.user, app.utils.jwt_handler

### `backend/app/services/availability_service.py`

- Role: Service-layer business logic for availability service domain.
- Size: 407 lines
- Functions: add_employee_skill, get_bench_designations, get_bench_pool, get_employee_skills, get_locations, get_skill_catalog, remove_employee_skill, search_skill_catalog
- Key imports: app.models.department, app.models.employee, app.models.employee_project, app.models.employee_skill, app.models.location, app.models.project, app.models.skill_catalog, app.models.utilisation_snapshot

### `backend/app/services/dashboard_service.py`

- Role: Service-layer business logic for dashboard service domain.
- Size: 671 lines
- Functions: _previous_periods, get_allocation_dashboard, get_executive_dashboard, get_project_dashboard, get_resource_allocation_dashboard, get_resource_dashboard
- Key constants: CORPORATE_LEVELS
- Key imports: app.models.department, app.models.employee, app.models.employee_project, app.models.project, app.models.project_allocation, app.models.timesheet_entry, app.models.utilisation_snapshot

### `backend/app/services/dynamics_service.py`

- Role: Service-layer business logic for dynamics service domain.
- Size: 260 lines
- Functions: _export_employees, _export_projects, _export_timesheets, _records_to_csv, create_dynamics_export, get_dynamics_export, get_export_download, list_dynamics_exports
- Key imports: app.models.department, app.models.dynamics_export, app.models.employee, app.models.project, app.models.timesheet_entry, app.services

### `backend/app/services/employee_service.py`

- Role: Service-layer business logic for employee service domain.
- Size: 362 lines
- Functions: get_employee_departments, get_employee_detail, list_employees, search_employees
- Key constants: CORPORATE_LEVELS
- Key imports: app.models.department, app.models.employee, app.models.employee_project, app.models.employee_skill, app.models.location, app.models.project, app.models.reporting_relationship, app.models.timesheet_entry

### `backend/app/services/export_service.py`

- Role: Service-layer business logic for export service domain.
- Size: 339 lines
- Functions: _build_csv, export_bench_list, export_billable_list, export_employee_allocation, export_project_utilisation, export_team_report
- Key imports: app.models.department, app.models.employee, app.models.employee_project, app.models.employee_skill, app.models.finance_billable, app.models.location, app.models.project, app.models.reporting_relationship

### `backend/app/services/finance_service.py`

- Role: Service-layer business logic for finance service domain.
- Size: 373 lines
- Functions: confirm_finance_upload, get_finance_billable, get_finance_template, get_upload_history, validate_finance_csv
- Key constants: VALID_BILLABLE_STATUSES
- Key imports: app.models.employee, app.models.finance_billable, app.models.finance_upload_log, app.models.project, app.services.audit_service

### `backend/app/services/global_search_service.py`

- Role: Service-layer business logic for global search service domain.
- Size: 293 lines
- Functions: _search_departments, _search_employees, _search_projects, _search_skills, get_employees_by_skill, global_search
- Key constants: CORPORATE_LEVELS
- Key imports: app.models.department, app.models.employee, app.models.employee_project, app.models.employee_skill, app.models.location, app.models.project, app.models.skill_catalog

### `backend/app/services/hrms_client.py`

- Role: Service-layer business logic for hrms client domain.
- Size: 263 lines
- Classes: HrmsClient
- Key imports: app.config

### `backend/app/services/hrms_sync_service.py`

- Role: Service-layer business logic for hrms sync service domain.
- Size: 2229 lines
- Functions: _add_error, _csv_to_set, _delete_stale_period_docs, _get_working_days, _hash_password, _mark_stale_running_logs, _merge_entity_counts, _new_entity_counts, _normalize_str_list, _recent_periods, _resolve_hrms_auth, _resolve_secret_credentials, _secret_ref_key, _slugify, _soft_delete_missing, _source_updated_at, _sync_holidays_from_hrms, _sync_holidays_upsert, _sync_master_data_impl, _sync_single_period, _sync_single_period_upsert, _to_bool, _to_int, _trigger_live_sync_impl, _upsert_by_source, get_hrms_integration_config, get_sync_logs, is_live_sync_enabled_for_user, normalize_hrms_config, sync_master_data, trigger_live_sync, trigger_sync
- Key constants: BRANCH_HEAD_OVERRIDES, LOCATION_META, ROLE_TO_LEVEL, SOURCE_SYSTEM
- Key imports: app.config, app.models.attendance_summary, app.models.department, app.models.employee, app.models.employee_project, app.models.hrms_holiday, app.models.hrms_sync_log, app.models.integration_config

### `backend/app/services/integration_service.py`

- Role: Service-layer business logic for integration service domain.
- Size: 399 lines
- Functions: create_integration_config, get_integration_config, get_sync_logs, list_integration_configs, retry_sync, trigger_manual_sync, update_integration_config
- Key imports: app.models.integration_config, app.models.sync_log, app.services

### `backend/app/services/org_tree_service.py`

- Role: Service-layer business logic for org tree service domain.
- Size: 284 lines
- Functions: _build_lookup_maps, _employee_to_dict, build_full_org_tree, get_branch_subtree, get_reporting_chain, trace_path
- Key imports: app.models.department, app.models.employee, app.models.location, app.models.reporting_relationship

### `backend/app/services/project_service.py`

- Role: Service-layer business logic for project service domain.
- Size: 574 lines
- Functions: assign_employees, create_project, get_distinct_clients, get_employee_timeline, get_project_detail, get_project_timeline, list_projects
- Key imports: app.models.department, app.models.employee, app.models.employee_project, app.models.location, app.models.project, app.models.project_allocation, app.models.timesheet_entry, app.services.audit_service

### `backend/app/services/skills_client.py`

- Role: Service-layer business logic for skills client domain.
- Size: 140 lines
- Classes: SkillsClient
- Key imports: app.config

### `backend/app/services/skills_sync_service.py`

- Role: Service-layer business logic for skills sync service domain.
- Size: 127 lines
- Functions: get_skills_sync_status, sync_skills_from_portal
- Key imports: app.models.skill_catalog, app.models.sync_log, app.services.skills_client

### `backend/app/services/timesheet_service.py`

- Role: Service-layer business logic for timesheet service domain.
- Size: 611 lines
- Functions: _enrich_entry, _get_period_lock, approve_reject_entries, check_period_lock, create_entry, delete_entry, get_entry_history, get_workload_heatmap, list_entries, submit_entries, toggle_period_lock, update_entry
- Key imports: app.models.employee, app.models.hrms_holiday, app.models.project, app.models.timesheet_edit_history, app.models.timesheet_entry, app.models.timesheet_period_lock, app.models.user, app.services

### `backend/app/services/utilisation_service.py`

- Role: Service-layer business logic for utilisation service domain.
- Size: 441 lines
- Functions: compute_utilisation, create_employee_override, get_cached_utilisation, get_employee_capacity, get_or_create_capacity_config, get_overrides, update_capacity_config
- Key imports: app.models.capacity_config, app.models.employee, app.models.employee_capacity_override, app.models.employee_project, app.models.finance_billable, app.models.project, app.models.timesheet_entry, app.models.utilisation_snapshot

## backend/app/utils

### `backend/app/utils/__init__.py`

- Role: Utility helpers for   init   features.
- Size: 0 lines

### `backend/app/utils/jwt_handler.py`

- Role: Utility helpers for jwt handler features.
- Size: 20 lines
- Functions: create_access_token, decode_access_token
- Key imports: app.config

## backend/package-lock.json

### `backend/package-lock.json`

- Role: NPM lockfile for deterministic dependency versions.
- Size: 6 lines
- Top-level keys: lockfileVersion, name, packages, requires

## backend/requirements.txt

### `backend/requirements.txt`

- Role: Python dependency manifest for backend runtime.
- Size: 16 lines

## backend/seed

### `backend/seed/__init__.py`

- Role: Seed/data utility for   init   workflows.
- Size: 0 lines

### `backend/seed/generate_finance_data.py`

- Role: Seed/data utility for generate finance data workflows.
- Size: 159 lines
- Functions: generate_finance_data
- Key constants: BATCH_SIZE, CORPORATE_LEVELS
- Key imports: app.config, app.models.employee, app.models.employee_project, app.models.finance_billable, app.models.finance_upload_log, beanie

### `backend/seed/generators/__init__.py`

- Role: Seed/data utility for   init   workflows.
- Size: 0 lines

### `backend/seed/import_uk_data.py`

- Role: Seed/data utility for import uk data workflows.
- Size: 318 lines
- Functions: clean_manager_name, clean_name, main
- Key constants: EXCEL_PATH, GRADE_MAP
- Key imports: app.database, app.models.department, app.models.employee, app.models.location, app.models.reporting_relationship, app.models.user, app.services.auth_service

### `backend/seed/init_db.py`

- Role: Seed/data utility for init db workflows.
- Size: 160 lines
- Functions: _hash, main
- Key constants: INTEGRATION_CONFIGS, USERS
- Key imports: app.database, app.models.integration_config, app.models.user

### `backend/seed/seed_data.py`

- Role: Seed/data utility for seed data workflows.
- Size: 1025 lines
- Functions: date, seed
- Key imports: app.config, app.database, app.models.audit_log, app.models.capacity_config, app.models.department, app.models.employee, app.models.employee_project, app.models.employee_skill

## frontend/README.md

### `frontend/README.md`

- Role: Markdown documentation file.
- Size: 73 lines
- Document headings: React + TypeScript + Vite, React Compiler, Expanding the ESLint configuration

## frontend/eslint.config.js

### `frontend/eslint.config.js`

- Role: ESLint flat configuration for frontend linting rules.
- Size: 23 lines

## frontend/index.html

### `frontend/index.html`

- Role: Vite HTML entry template.
- Size: 13 lines
- Notes: Static frontend asset/template.

## frontend/package-lock.json

### `frontend/package-lock.json`

- Role: NPM lockfile for deterministic dependency versions.
- Size: 5119 lines
- Top-level keys: lockfileVersion, name, packages, requires, version

## frontend/package.json

### `frontend/package.json`

- Role: NPM package manifest with scripts and dependencies.
- Size: 44 lines
- Top-level keys: dependencies, devDependencies, name, private, scripts, type, version

## frontend/public

### `frontend/public/vite.svg`

- Role: Project file.
- Size: 1 lines

## frontend/src

### `frontend/src/App.tsx`

- Role: Frontend route map and top-level app composition.
- Size: 46 lines

### `frontend/src/index.css`

- Role: Stylesheet for frontend presentation.
- Size: 109 lines
- Notes: Static frontend asset/template.

### `frontend/src/main.tsx`

- Role: Frontend bootstrap: mounts React app and root providers.
- Size: 10 lines

## frontend/src/api

### `frontend/src/api/admin.ts`

- Role: HTTP client wrapper functions for admin API endpoints.
- Size: 19 lines

### `frontend/src/api/analytics.ts`

- Role: HTTP client wrapper functions for analytics API endpoints.
- Size: 7 lines

### `frontend/src/api/audit.ts`

- Role: HTTP client wrapper functions for audit API endpoints.
- Size: 53 lines
- Exports: AuditFilterParams, AuditStatsResponse

### `frontend/src/api/auth.ts`

- Role: HTTP client wrapper functions for auth API endpoints.
- Size: 12 lines

### `frontend/src/api/availability.ts`

- Role: HTTP client wrapper functions for availability API endpoints.
- Size: 96 lines
- API calls: GET /export/bench

### `frontend/src/api/client.ts`

- Role: HTTP client wrapper functions for client API endpoints.
- Size: 30 lines

### `frontend/src/api/dashboard.ts`

- Role: HTTP client wrapper functions for dashboard API endpoints.
- Size: 68 lines

### `frontend/src/api/employees.ts`

- Role: HTTP client wrapper functions for employees API endpoints.
- Size: 50 lines
- API calls: GET /employees/, GET /employees/departments

### `frontend/src/api/finance.ts`

- Role: HTTP client wrapper functions for finance API endpoints.
- Size: 56 lines
- API calls: GET /finance/template

### `frontend/src/api/importExport.ts`

- Role: HTTP client wrapper functions for importExport API endpoints.
- Size: 6 lines
- API calls: GET /export/branch/report

### `frontend/src/api/integration.ts`

- Role: HTTP client wrapper functions for integration API endpoints.
- Size: 95 lines

### `frontend/src/api/org.ts`

- Role: HTTP client wrapper functions for org API endpoints.
- Size: 24 lines

### `frontend/src/api/projects.ts`

- Role: HTTP client wrapper functions for projects API endpoints.
- Size: 61 lines

### `frontend/src/api/search.ts`

- Role: HTTP client wrapper functions for search API endpoints.
- Size: 22 lines

### `frontend/src/api/timesheets.ts`

- Role: HTTP client wrapper functions for timesheets API endpoints.
- Size: 158 lines

### `frontend/src/api/utilisation.ts`

- Role: HTTP client wrapper functions for utilisation API endpoints.
- Size: 56 lines

## frontend/src/components

### `frontend/src/components/analytics/CrossReportingView.tsx`

- Role: Reusable UI/component module for CrossReportingView.
- Size: 59 lines
- Exports: CrossReportingView
- Store hooks: useOrgChartStore

### `frontend/src/components/analytics/DeptBreakdownChart.tsx`

- Role: Reusable UI/component module for DeptBreakdownChart.
- Size: 41 lines
- Exports: ClientBreakdownChart

### `frontend/src/components/analytics/LevelPyramid.tsx`

- Role: Reusable UI/component module for LevelPyramid.
- Size: 82 lines
- Exports: LevelPyramid

### `frontend/src/components/analytics/ProjectOverview.tsx`

- Role: Reusable UI/component module for ProjectOverview.
- Size: 89 lines
- Exports: ProjectOverview

### `frontend/src/components/analytics/SpanOfControl.tsx`

- Role: Reusable UI/component module for SpanOfControl.
- Size: 44 lines
- Exports: SpanOfControl
- Store hooks: useOrgChartStore

### `frontend/src/components/analytics/TrendLineChart.tsx`

- Role: Reusable UI/component module for TrendLineChart.
- Size: 41 lines
- Exports: TrendLineChart

### `frontend/src/components/analytics/WorkforceOverview.tsx`

- Role: Reusable UI/component module for WorkforceOverview.
- Size: 30 lines
- Exports: WorkforceOverview

### `frontend/src/components/audit/AuditLogTable.tsx`

- Role: Reusable UI/component module for AuditLogTable.
- Size: 151 lines
- Exports: AuditLogTable
- React hooks used: useState

### `frontend/src/components/audit/AuditStats.tsx`

- Role: Reusable UI/component module for AuditStats.
- Size: 146 lines
- Exports: AuditStats
- React hooks used: useEffect, useState

### `frontend/src/components/availability/AssignProjectModal.tsx`

- Role: Reusable UI/component module for AssignProjectModal.
- Size: 313 lines
- Exports: AssignProjectModal
- React hooks used: useEffect, useState

### `frontend/src/components/availability/BenchFilters.tsx`

- Role: Reusable UI/component module for BenchFilters.
- Size: 332 lines
- Exports: BenchFilters
- React hooks used: useEffect, useRef, useState

### `frontend/src/components/availability/BenchPoolTable.tsx`

- Role: Reusable UI/component module for BenchPoolTable.
- Size: 182 lines
- Exports: BenchPoolTable
- Store hooks: useOrgChartStore
- React hooks used: useState

### `frontend/src/components/availability/SkillBadge.tsx`

- Role: Reusable UI/component module for SkillBadge.
- Size: 41 lines
- Exports: SkillBadge

### `frontend/src/components/availability/SkillTagManager.tsx`

- Role: Reusable UI/component module for SkillTagManager.
- Size: 180 lines
- Exports: SkillTagManager
- React hooks used: useState

### `frontend/src/components/dashboard/AllocationsTable.tsx`

- Role: Reusable UI/component module for AllocationsTable.
- Size: 134 lines
- Exports: AllocationsTable
- Store hooks: useOrgChartStore
- React hooks used: useState

### `frontend/src/components/dashboard/ClassificationDonut.tsx`

- Role: Reusable UI/component module for ClassificationDonut.
- Size: 96 lines
- Exports: ClassificationDonut

### `frontend/src/components/dashboard/ExecutiveOverview.tsx`

- Role: Reusable UI/component module for ExecutiveOverview.
- Size: 74 lines
- Exports: ExecutiveOverview

### `frontend/src/components/dashboard/ProjectHealthTable.tsx`

- Role: Reusable UI/component module for ProjectHealthTable.
- Size: 233 lines
- Exports: ProjectHealthTable
- Store hooks: useOrgChartStore
- React hooks used: useState

### `frontend/src/components/dashboard/ResourceAllocationTable.tsx`

- Role: Reusable UI/component module for ResourceAllocationTable.
- Size: 117 lines
- Exports: ResourceAllocationTable
- Store hooks: useOrgChartStore

### `frontend/src/components/dashboard/ResourceTable.tsx`

- Role: Reusable UI/component module for ResourceTable.
- Size: 180 lines
- Exports: ResourceTable
- Store hooks: useOrgChartStore
- React hooks used: useState

### `frontend/src/components/dashboard/TopProjectsChart.tsx`

- Role: Reusable UI/component module for TopProjectsChart.
- Size: 131 lines
- Exports: TopProjectsChart

### `frontend/src/components/dashboard/UtilisationTrendChart.tsx`

- Role: Reusable UI/component module for UtilisationTrendChart.
- Size: 77 lines
- Exports: UtilisationTrendChart

### `frontend/src/components/employee-detail/EmployeeDrawer.tsx`

- Role: Reusable UI/component module for EmployeeDrawer.
- Size: 472 lines
- Exports: EmployeeDrawer
- Store hooks: useAuthStore, useOrgChartStore
- React hooks used: useEffect, useState

### `frontend/src/components/finance/FinanceBillableTable.tsx`

- Role: Reusable UI/component module for FinanceBillableTable.
- Size: 69 lines
- Exports: FinanceBillableTable

### `frontend/src/components/finance/FinanceCsvUploader.tsx`

- Role: Reusable UI/component module for FinanceCsvUploader.
- Size: 235 lines
- Exports: FinanceCsvUploader
- React hooks used: useRef, useState

### `frontend/src/components/finance/FinanceUploadHistory.tsx`

- Role: Reusable UI/component module for FinanceUploadHistory.
- Size: 79 lines
- Exports: FinanceUploadHistory

### `frontend/src/components/integration/DynamicsExportPanel.tsx`

- Role: Reusable UI/component module for DynamicsExportPanel.
- Size: 150 lines
- Exports: DynamicsExportPanel

### `frontend/src/components/integration/IntegrationConfigList.tsx`

- Role: Reusable UI/component module for IntegrationConfigList.
- Size: 139 lines
- Exports: IntegrationConfigList

### `frontend/src/components/integration/SyncLogTimeline.tsx`

- Role: Reusable UI/component module for SyncLogTimeline.
- Size: 144 lines
- Exports: SyncLogTimeline

### `frontend/src/components/layout/AppLayout.tsx`

- Role: Reusable UI/component module for AppLayout.
- Size: 31 lines
- Exports: AppLayout
- Store hooks: useAuthStore
- React hooks used: useState

### `frontend/src/components/layout/Header.tsx`

- Role: Reusable UI/component module for Header.
- Size: 59 lines
- Exports: Header
- Store hooks: useOrgChartStore

### `frontend/src/components/layout/SearchBar.tsx`

- Role: Reusable UI/component module for SearchBar.
- Size: 309 lines
- Exports: SearchBar
- Store hooks: useOrgChartStore
- React hooks used: useEffect, useRef, useState

### `frontend/src/components/layout/Sidebar.tsx`

- Role: Reusable UI/component module for Sidebar.
- Size: 217 lines
- Exports: Sidebar
- Store hooks: useAuthStore
- React hooks used: useEffect, useState

### `frontend/src/components/layout/UserProfileModal.tsx`

- Role: Reusable UI/component module for UserProfileModal.
- Size: 259 lines
- Exports: UserProfileModal
- React hooks used: useEffect, useState

### `frontend/src/components/org-chart/DepartmentGroupNode.tsx`

- Role: Reusable UI/component module for DepartmentGroupNode.
- Size: 74 lines
- Exports: DepartmentGroupNode
- Store hooks: useOrgChartStore

### `frontend/src/components/org-chart/EmployeeNode.tsx`

- Role: Reusable UI/component module for EmployeeNode.
- Size: 119 lines
- Exports: EmployeeNode
- Store hooks: useOrgChartStore

### `frontend/src/components/org-chart/OrgChartCanvas.tsx`

- Role: Reusable UI/component module for OrgChartCanvas.
- Size: 579 lines
- Exports: OrgChartCanvas
- Store hooks: useAuthStore, useOrgChartStore
- React hooks used: useCallback, useEffect, useMemo, useRef, useState

### `frontend/src/components/org-chart/ReportingEdge.tsx`

- Role: Reusable UI/component module for ReportingEdge.
- Size: 89 lines
- Exports: ReportingEdge
- Store hooks: useOrgChartStore

### `frontend/src/components/shared/ExportButton.tsx`

- Role: Reusable UI/component module for ExportButton.
- Size: 54 lines
- Exports: ExportButton
- React hooks used: useState

### `frontend/src/components/shared/Pagination.tsx`

- Role: Reusable UI/component module for Pagination.
- Size: 121 lines
- Exports: Pagination

### `frontend/src/components/shared/PeriodSelector.tsx`

- Role: Reusable UI/component module for PeriodSelector.
- Size: 45 lines
- Exports: PeriodSelector

### `frontend/src/components/shared/SelectDropdown.tsx`

- Role: Reusable UI/component module for SelectDropdown.
- Size: 89 lines
- Exports: SelectDropdown
- React hooks used: useCallback, useEffect, useRef, useState

### `frontend/src/components/shared/StatusBadge.tsx`

- Role: Reusable UI/component module for StatusBadge.
- Size: 46 lines
- Exports: StatusBadge

### `frontend/src/components/shared/ToastContainer.tsx`

- Role: Reusable UI/component module for ToastContainer.
- Size: 94 lines
- Exports: ToastContainer
- Store hooks: useToastStore

### `frontend/src/components/timesheet/HrmsSyncPanel.tsx`

- Role: Reusable UI/component module for HrmsSyncPanel.
- Size: 436 lines
- Exports: HrmsSyncPanel
- Store hooks: useAuthStore
- React hooks used: useCallback, useEffect, useState

### `frontend/src/components/timesheet/PeriodLockBanner.tsx`

- Role: Reusable UI/component module for PeriodLockBanner.
- Size: 35 lines
- Exports: PeriodLockBanner

### `frontend/src/components/timesheet/TimesheetApprovalPanel.tsx`

- Role: Reusable UI/component module for TimesheetApprovalPanel.
- Size: 89 lines
- Exports: TimesheetApprovalPanel
- React hooks used: useState

### `frontend/src/components/timesheet/TimesheetEntryForm.tsx`

- Role: Reusable UI/component module for TimesheetEntryForm.
- Size: 169 lines
- Exports: TimesheetEntryForm
- Store hooks: useAuthStore
- React hooks used: useState

### `frontend/src/components/timesheet/TimesheetStatusBadge.tsx`

- Role: Reusable UI/component module for TimesheetStatusBadge.
- Size: 39 lines
- Exports: TimesheetStatusBadge

### `frontend/src/components/timesheet/TimesheetTable.tsx`

- Role: Reusable UI/component module for TimesheetTable.
- Size: 115 lines
- Exports: TimesheetTable
- Store hooks: useOrgChartStore

### `frontend/src/components/timesheet/WorkloadHeatmap.tsx`

- Role: Reusable UI/component module for WorkloadHeatmap.
- Size: 473 lines
- Exports: WorkloadHeatmap
- React hooks used: useCallback, useEffect, useMemo, useRef, useState

### `frontend/src/components/ui/badge.tsx`

- Role: Reusable UI/component module for badge.
- Size: 28 lines
- Exports: Badge, BadgeProps

### `frontend/src/components/ui/button.tsx`

- Role: Reusable UI/component module for button.
- Size: 43 lines
- Exports: Button, ButtonProps

### `frontend/src/components/ui/card.tsx`

- Role: Reusable UI/component module for card.
- Size: 43 lines
- Exports: Card, CardContent, CardDescription, CardHeader, CardTitle

### `frontend/src/components/ui/input.tsx`

- Role: Reusable UI/component module for input.
- Size: 19 lines
- Exports: Input

### `frontend/src/components/ui/progress.tsx`

- Role: Reusable UI/component module for progress.
- Size: 24 lines
- Exports: Progress

### `frontend/src/components/ui/select.tsx`

- Role: Reusable UI/component module for select.
- Size: 202 lines
- Exports: Select
- React hooks used: useEffect, useRef, useState

### `frontend/src/components/ui/sheet.tsx`

- Role: Reusable UI/component module for sheet.
- Size: 43 lines
- Exports: Sheet, SheetContent, SheetHeader, SheetTitle

## frontend/src/lib

### `frontend/src/lib/constants.ts`

- Role: Shared frontend utilities/constants for constants.
- Size: 70 lines
- Exports: DEPARTMENT_COLORS, LEVEL_LABELS, LEVEL_ORDER, LOCATION_COLORS

### `frontend/src/lib/orgTreeTransform.ts`

- Role: Shared frontend utilities/constants for orgTreeTransform.
- Size: 544 lines
- Exports: DEPT_GROUP_THRESHOLD, DepartmentGroupNodeData, EmployeeNodeData, collectAncestorIds, collectIdsUpToDepth, collectOwnBranchIds, computeFocusedNodeIds, findNodeById, transformOrgTree

### `frontend/src/lib/utils.ts`

- Role: Shared frontend utilities/constants for utils.
- Size: 6 lines
- Exports: cn

## frontend/src/pages

### `frontend/src/pages/AnalyticsPage.tsx`

- Role: Route-level page component for Analytics.
- Size: 101 lines
- Exports: AnalyticsPage
- Store hooks: useAuthStore
- React hooks used: useEffect, useState

### `frontend/src/pages/AuditPage.tsx`

- Role: Route-level page component for Audit.
- Size: 228 lines
- Exports: AuditPage
- Store hooks: useAuthStore
- React hooks used: useCallback, useEffect, useState

### `frontend/src/pages/AvailabilityPage.tsx`

- Role: Route-level page component for Availability.
- Size: 249 lines
- Exports: AvailabilityPage
- React hooks used: useCallback, useEffect, useState

### `frontend/src/pages/DashboardPage.tsx`

- Role: Route-level page component for Dashboard.
- Size: 431 lines
- Exports: DashboardPage
- Store hooks: useOrgChartStore
- React hooks used: useCallback, useEffect, useRef, useState

### `frontend/src/pages/EmployeeMasterPage.tsx`

- Role: Route-level page component for EmployeeMaster.
- Size: 328 lines
- Exports: EmployeeMasterPage
- Store hooks: useOrgChartStore
- React hooks used: useCallback, useEffect, useRef, useState

### `frontend/src/pages/FinancePage.tsx`

- Role: Route-level page component for Finance.
- Size: 100 lines
- Exports: FinancePage
- React hooks used: useCallback, useEffect, useState

### `frontend/src/pages/IntegrationPage.tsx`

- Role: Route-level page component for Integration.
- Size: 370 lines
- Exports: IntegrationPage
- Store hooks: useAuthStore, useToastStore
- React hooks used: useCallback, useEffect, useState

### `frontend/src/pages/LoginPage.tsx`

- Role: Route-level page component for Login.
- Size: 212 lines
- Exports: LoginPage
- Store hooks: useAuthStore
- React hooks used: useEffect, useState

### `frontend/src/pages/OrgChartPage.tsx`

- Role: Route-level page component for OrgChart.
- Size: 12 lines
- Exports: OrgChartPage

### `frontend/src/pages/ProjectDetailPage.tsx`

- Role: Route-level page component for ProjectDetail.
- Size: 328 lines
- Exports: ProjectDetailPage
- Store hooks: useOrgChartStore
- React hooks used: useCallback, useEffect, useState

### `frontend/src/pages/ProjectListPage.tsx`

- Role: Route-level page component for ProjectList.
- Size: 370 lines
- Exports: ProjectListPage
- React hooks used: useCallback, useEffect, useRef, useState

### `frontend/src/pages/ProjectTimelinePage.tsx`

- Role: Route-level page component for ProjectTimeline.
- Size: 1241 lines
- Exports: ProjectTimelinePage
- Store hooks: useOrgChartStore
- React hooks used: useCallback, useEffect, useRef, useState

### `frontend/src/pages/SearchResultsPage.tsx`

- Role: Route-level page component for SearchResults.
- Size: 623 lines
- Exports: SearchResultsPage
- Store hooks: useOrgChartStore
- React hooks used: useCallback, useEffect, useState

### `frontend/src/pages/TimesheetPage.tsx`

- Role: Route-level page component for Timesheet.
- Size: 428 lines
- Exports: TimesheetPage
- Store hooks: useAuthStore, useOrgChartStore, useToastStore
- React hooks used: useCallback, useEffect, useState

## frontend/src/store

### `frontend/src/store/authStore.ts`

- Role: Zustand state store for auth state.
- Size: 36 lines
- Exports: useAuthStore
- Store hooks: useAuthStore

### `frontend/src/store/dashboardStore.ts`

- Role: Zustand state store for dashboard state.
- Size: 24 lines
- Exports: useDashboardStore
- Store hooks: useDashboardStore

### `frontend/src/store/filterStore.ts`

- Role: Zustand state store for filter state.
- Size: 31 lines
- Exports: useFilterStore
- Store hooks: useFilterStore

### `frontend/src/store/orgChartStore.ts`

- Role: Zustand state store for orgChart state.
- Size: 138 lines
- Exports: useOrgChartStore
- Store hooks: useOrgChartStore

### `frontend/src/store/timesheetStore.ts`

- Role: Zustand state store for timesheet state.
- Size: 26 lines
- Exports: useTimesheetStore
- Store hooks: useTimesheetStore

### `frontend/src/store/toastStore.ts`

- Role: Zustand state store for toast state.
- Size: 38 lines
- Exports: Toast, useToastStore
- Store hooks: useToastStore

## frontend/src/types

### `frontend/src/types/analytics.ts`

- Role: TypeScript type definitions for analytics.
- Size: 55 lines
- Exports: BranchAnalytics, ClientCount, CrossReport, LevelCount, MonthlyTrend, ProjectSummary, SpanOfControl

### `frontend/src/types/api.ts`

- Role: TypeScript type definitions for api.
- Size: 40 lines
- Exports: AuditEntry, AuditLogResponse, LoginRequest, LoginResponse, SearchResult

### `frontend/src/types/availability.ts`

- Role: TypeScript type definitions for availability.
- Size: 40 lines
- Exports: AvailableEmployee, BenchPoolResponse, SkillCatalogEntry, SkillTag

### `frontend/src/types/dashboard.ts`

- Role: TypeScript type definitions for dashboard.
- Size: 123 lines
- Exports: AllocationDashboardResponse, AllocationEntry, ExecutiveDashboard, ProjectDashboardEntry, ProjectDashboardResponse, ResourceAllocationEntry, ResourceAllocationResponse, ResourceDashboardEntry, ResourceDashboardResponse

### `frontend/src/types/employee.ts`

- Role: TypeScript type definitions for employee.
- Size: 93 lines
- Exports: EmployeeBrief, EmployeeDetail, EmployeeMasterEntry, ManagerInfo, ProjectInfo, SkillInfo, TimesheetSummary, UtilisationInfo

### `frontend/src/types/finance.ts`

- Role: TypeScript type definitions for finance.
- Size: 53 lines
- Exports: FinanceBillableEntry, FinanceBillableListResponse, FinanceUploadHistoryEntry, FinanceUploadValidationResponse, FinanceValidationRow

### `frontend/src/types/integration.ts`

- Role: TypeScript type definitions for integration.
- Size: 46 lines
- Exports: DynamicsExport, DynamicsExportsResponse, IntegrationConfig, SyncLogEntry, SyncLogsResponse

### `frontend/src/types/org.ts`

- Role: TypeScript type definitions for org.
- Size: 35 lines
- Exports: OrgTreeNode, OrgTreeResponse, SecondaryEdge, TracePathResponse

### `frontend/src/types/project.ts`

- Role: TypeScript type definitions for project.
- Size: 137 lines
- Exports: AssignToProjectRequest, AssignmentResponse, ClientOpportunity, EmployeeTimeline, EmployeeTimelineEntry, FreeingUpEmployee, ProjectBrief, ProjectDetail, ProjectListResponse, ProjectTimelineResponse, TimelineProject

### `frontend/src/types/search.ts`

- Role: TypeScript type definitions for search.
- Size: 74 lines
- Exports: EmployeeBySkillResult, EmployeesBySkillResponse, GlobalSearchDepartmentResult, GlobalSearchEmployeeResult, GlobalSearchProjectResult, GlobalSearchResponse, GlobalSearchSkillResult, SearchTab

### `frontend/src/types/timesheet.ts`

- Role: TypeScript type definitions for timesheet.
- Size: 119 lines
- Exports: HeatmapDateMeta, HeatmapDayCell, HeatmapEmployeeRow, HrmsSyncLog, HrmsSyncLogsResponse, TimesheetEditHistory, TimesheetEntry, TimesheetEntryCreate, TimesheetEntryUpdate, TimesheetFilterOptions, TimesheetListResponse, TimesheetSummary, WorkloadHeatmapResponse

### `frontend/src/types/utilisation.ts`

- Role: TypeScript type definitions for utilisation.
- Size: 59 lines
- Exports: CapacityConfig, CapacityConfigUpdate, EmployeeCapacityOverride, EmployeeCapacityOverrideCreate, UtilisationSnapshot, UtilisationSummary

## frontend/tsconfig.app.json

### `frontend/tsconfig.app.json`

- Role: JSON configuration/metadata file.
- Size: 34 lines

## frontend/tsconfig.json

### `frontend/tsconfig.json`

- Role: JSON configuration/metadata file.
- Size: 7 lines
- Top-level keys: files, references

## frontend/tsconfig.node.json

### `frontend/tsconfig.node.json`

- Role: JSON configuration/metadata file.
- Size: 26 lines

## frontend/vite.config.ts

### `frontend/vite.config.ts`

- Role: Vite build/dev server configuration.
- Size: 22 lines
