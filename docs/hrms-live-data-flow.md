# HRMS Live Data Flow and Dashboard Calculation Guide

## Purpose

This document explains how live HRMS data is pulled into this system, how it is stored, how key metrics are calculated, and how that data is rendered in the UI.

It covers:

- HRMS authentication and sync entry points
- Master-data sync and monthly live-data sync
- Mongo collections populated by HRMS
- Utilisation and dashboard calculations
- Frontend screens that display the synced data


## 1. High-level architecture

The live HRMS pipeline is split into two stages:

1. Master-data sync
   - Pulls relatively stable reference data from HRMS
   - Creates or updates locations, departments, employees, projects, employee-project assignments, and reporting relationships

2. Live period sync
   - Pulls month-based operational data from HRMS
   - Imports attendance summaries, daily attendance-derived timesheet rows, project allocations, and holidays
   - Recomputes utilisation snapshots for each affected branch and period

The dashboards do not calculate directly from HRMS API responses.
They calculate from local MongoDB collections created by sync jobs.


## 2. Main backend components

### HRMS configuration

The HRMS connection is configured in:

- `backend/app/config.py`

Important settings:

- `HRMS_BASE_URL`
- `HRMS_TOKEN`
- `HRMS_AUTH_USERNAME`
- `HRMS_AUTH_PASSWORD`
- `HRMS_SYNC_MONTHS_BACKFILL`
- `HRMS_LIVE_USERS`
- `HRMS_LIVE_DOMAINS`
- `HRMS_DEMO_USERS`

There is also dynamic HRMS config stored in MongoDB via `IntegrationConfig`.
That config is normalized by `normalize_hrms_config()` in:

- `backend/app/services/hrms_sync_service.py`


### HRMS API client

The external HRMS API wrapper lives in:

- `backend/app/services/hrms_client.py`

Main methods:

- `login_with_password()`
- `get_locations()`
- `get_projects()`
- `get_employees()`
- `get_managers()`
- `get_hrs()`
- `get_attendance_summary()`
- `get_daily_attendance()`
- `get_allocations()`
- `get_holidays()`

This client uses `httpx.AsyncClient`, connection pooling, and retry logic for transient failures.


### Sync orchestration

Main orchestration logic lives in:

- `backend/app/services/hrms_sync_service.py`
- `backend/app/services/integration_service.py`

Public routers:

- `backend/app/routers/hrms_sync.py`
- `backend/app/routers/integration.py`


## 3. How live HRMS sync is triggered

There are two ways sync can be triggered.

### Option A: Integration Hub flow

From the frontend `IntegrationPage`, the user clicks `Sync Now`.

Frontend:

- `frontend/src/pages/IntegrationPage.tsx`
- `frontend/src/api/integration.ts`

Backend endpoint:

- `POST /integrations/sync/{config_id}`

Backend service:

- `integration_service.trigger_manual_sync()`

For HRMS integrations in live mode, this function does:

1. Resolve the active HRMS integration config
2. Authenticate once and reuse the token
3. Run master-data sync
4. Run live period sync for the current month
5. Save a generic `SyncLog`
6. Update `IntegrationConfig.last_sync_at` and `last_sync_status`

This is the most complete "real" sync path in the app.


### Option B: Direct HRMS sync endpoints

These are used by the older HRMS sync panel flow.

Endpoints:

- `POST /hrms-sync/master-data`
- `POST /hrms-sync/trigger`
- `GET /hrms-sync/logs`

Router:

- `backend/app/routers/hrms_sync.py`

Frontend API:

- `frontend/src/api/timesheets.ts`

UI component:

- `frontend/src/components/timesheet/HrmsSyncPanel.tsx`

Behavior:

- `/hrms-sync/master-data` runs master-data sync only
- `/hrms-sync/trigger` runs live period sync if the user is allowed to use live mode
- if the user is not allowed to use live mode, it falls back to demo/mock sync


## 4. How the system decides live mode vs demo mode

Live-vs-demo logic is handled by:

- `is_live_sync_enabled_for_user()` in `backend/app/services/hrms_sync_service.py`

Decision order:

1. If user email is in `demo_users`, use demo mode
2. If user email is in `live_users`, use live mode
3. If user domain is in `live_domains`, use live mode
4. Otherwise fall back to whether credentials or token exist in environment/config

This means a user can see the same UI but either run:

- real HRMS sync, or
- mock/demo sync


## 5. HRMS authentication flow

Authentication is resolved by:

- `_resolve_hrms_auth()` in `backend/app/services/hrms_sync_service.py`

Priority:

1. Explicit token passed into the sync function
2. Static token mode using config or env
3. Password grant mode using:
   - `secret_ref` from `IntegrationConfig`, or
   - `HRMS_AUTH_USERNAME` and `HRMS_AUTH_PASSWORD`

When password grant is used:

1. `HrmsClient.login_with_password()` calls `POST /users/login`
2. The response must include `access_token`
3. The token is reused for further HRMS API calls


## 6. Master-data sync: what is pulled and how it is stored

Master-data sync is implemented in:

- `sync_master_data()`
- `_sync_master_data_impl()`

File:

- `backend/app/services/hrms_sync_service.py`

### HRMS endpoints used during master-data sync

These calls run in parallel:

- `get_employees()`
- `get_projects()`
- `get_locations()`
- `get_managers()`
- `get_hrs()`

### Local collections updated by master-data sync

#### Locations

Collection:

- `locations`

Model:

- `backend/app/models/location.py`

Logic:

- HRMS `location_id` becomes `hrms_location_id`
- additional metadata like `city`, `region`, and `code` is enriched using `LOCATION_META`
- records are upserted by `source_system/source_id`


#### Departments

Collection:

- `departments`

Model:

- `backend/app/models/department.py`

Logic:

- HRMS does not provide departments directly
- departments are derived from project `account`
- a fallback `General` department is always created


#### Employees

Collection:

- `employees`

Model:

- `backend/app/models/employee.py`

Mapped fields include:

- `hrms_employee_id`
- `name`
- `email`
- `designation`
- `department_id`
- `level`
- `location_id`
- `join_date`
- `is_active`

Notes:

- `ROLE_TO_LEVEL` maps HRMS roles to internal levels
- employees are soft-deleted if missing from later master syncs
- missing HRMS employees are marked `is_deleted=True`
- when employee soft-delete is used, `is_active` is also turned off


#### Projects

Collection:

- `projects`

Model:

- `backend/app/models/project.py`

Mapped fields include:

- `hrms_project_id`
- `name`
- `status`
- `client_name`
- `department_id`
- `start_date`
- `end_date`

Notes:

- HRMS `account` maps to local `client_name`
- project status is normalized to values like `ACTIVE`
- projects are also soft-deleted if missing from later syncs


#### Employee-project assignments

Collection:

- `employee_projects`

Model:

- `backend/app/models/employee_project.py`

Logic:

- HRMS project assignment rows are stored here
- each row links one employee to one project with `role_in_project`


#### Reporting relationships

Collection:

- `reporting_relationships`

Model:

- `backend/app/models/reporting_relationship.py`

Logic:

- employee `managers` and `hr` arrays from HRMS are translated into internal relationships
- relationship type is usually `PRIMARY` for main manager and `FUNCTIONAL` for others


#### User branch mapping refresh

During master sync, branch-head user records are updated so that:

- `User.branch_location_id`
- `User.employee_id`

stay aligned with the latest synced employee and location records.

This is important because branch scoping across the app depends on `branch_location_id`.


## 7. Live monthly sync: what is pulled and how it is stored

Live period sync is implemented in:

- `trigger_live_sync()`
- `_trigger_live_sync_impl()`
- `_sync_single_period_upsert()`
- `_sync_holidays_upsert()`

File:

- `backend/app/services/hrms_sync_service.py`

### Period selection

The system does not sync only one month.
It syncs a rolling set of periods using `_recent_periods()`.

Default backfill:

- `HRMS_SYNC_MONTHS_BACKFILL`

Example:

- if selected period is `2026-03` and backfill is `6`
- periods synced are `2025-10` through `2026-03`


### Guardrail

Live period sync requires existing HRMS mappings.

If there are no HRMS-mapped employees, sync fails with a message telling the user to run:

- master-data sync first


### 7.1 Attendance summary import

HRMS endpoint:

- `GET /attendance/hr-assigned`

Client method:

- `get_attendance_summary(hr_id, year, month)`

Stored in:

- `attendance_summaries`

Model:

- `backend/app/models/attendance_summary.py`

Mapped fields:

- `period`
- `employee_id`
- `hrms_employee_id`
- `employee_name`
- `present_days`
- `wfh_days`
- `leave_days`
- `total_hours`

Source IDs look like:

- `attendance:{period}:{hrms_employee_id}`


### 7.2 Daily attendance to timesheet conversion

HRMS endpoint:

- `GET /attendance/daily`

Client method:

- `get_daily_attendance(employee_id, year, month)`

This is the most important transformation in the system.
The app does not store HRMS daily attendance as-is.
It converts daily attendance rows into local `TimesheetEntry` rows.

Stored in:

- `timesheet_entries`

Model:

- `backend/app/models/timesheet_entry.py`

Conversion rules:

- employees with `total_hours > 0` in the attendance summary are selected
- daily attendance is fetched in batches of 50 employees concurrently
- rows with `action/status == "Leave"` are skipped
- if a day has no project breakdown, the row becomes a `bench` timesheet entry
- if a day has project breakdowns, one timesheet row is created per project
- if the project does not map to a local HRMS project, it falls back to `bench`

Timesheet fields set by HRMS sync:

- `source = "hrms_sync"`
- `status = "approved"`
- `approved_by = "system"`
- `is_billable = true` only if mapped project has `project_type == "client"`

Source IDs look like:

- `timesheet:{employee_id}:{date}:bench`
- `timesheet:{employee_id}:{date}:{project_id}`

Important consequence:

- dashboards and timesheet pages are driven by these local `TimesheetEntry` documents
- not by calling HRMS attendance APIs directly at render time


### 7.3 Project allocation import

HRMS endpoint:

- `GET /allocations/all?month=YYYY-MM`

Client method:

- `get_allocations(period)`

Stored in:

- `project_allocations`

Model:

- `backend/app/models/project_allocation.py`

Mapped fields:

- `period`
- `employee_id`
- `project_id`
- `allocated_days`
- `allocation_percentage`
- `total_working_days`
- `total_allocated_days`
- `available_days`
- `client_name`

Source IDs look like:

- `allocation:{period}:{hrms_employee_id}:{hrms_project_id}`


### 7.4 Holiday import

HRMS endpoint:

- `GET /calendar/`

Client method:

- `get_holidays()`

Stored in:

- `hrms_holidays`

Model:

- `backend/app/models/hrms_holiday.py`

Holiday data is later used by the workload heatmap.


### 7.5 Cleanup behavior

The upsert-based sync also removes stale period data.

Behavior:

- old attendance rows not seen in the current sync are deleted for that period
- old HRMS-sourced timesheet rows not seen in the current sync are deleted for that period
- old allocation rows not seen in the current sync are deleted for that period

Master-data collections use soft delete.
Period-based operational collections use hard delete of stale synced rows.


## 8. Collections populated by HRMS sync

Main MongoDB collections impacted by live HRMS:

- `locations`
- `departments`
- `employees`
- `projects`
- `employee_projects`
- `reporting_relationships`
- `attendance_summaries`
- `project_allocations`
- `timesheet_entries`
- `hrms_holidays`
- `utilisation_snapshots`
- `hrms_sync_logs`
- `sync_logs`


## 9. How utilisation is calculated

Utilisation is not read from HRMS directly.
It is computed locally after sync by:

- `compute_utilisation()` in `backend/app/services/utilisation_service.py`

### Inputs used

For a given `period` and `branch_location_id`, it reads:

- active branch employees from `employees`
- employee-project assignments from `employee_projects`
- projects from `projects`
- timesheet entries from `timesheet_entries`
- finance billable overrides from `finance_billable`
- branch capacity config from `capacity_config`
- employee capacity overrides from `employee_capacity_override`

### Capacity calculation

Default capacity comes from branch config:

- `standard_hours_per_week`

Monthly capacity is:

- `hours_per_week * (days_in_month / 7)`

If an employee-specific override exists for the period, that override replaces the default weekly capacity.


### Hours calculation

For each employee:

- `total_hours_logged` = sum of all non-rejected timesheet hours in the period
- `billable_hours` = sum where `is_billable == true`
- `non_billable_hours` = sum where `is_billable == false`


### Percent formulas

- `utilisation_percent = total_hours_logged / capacity_hours * 100`
- `billable_percent = billable_hours / capacity_hours * 100`


### Classification rules

The system uses branch config thresholds:

- `partial_billing_threshold`
- `bench_threshold_percent`

Current logic:

1. Derive `billable_hours` from local `timesheet_entries` where `is_billable = true`
2. Exclude rejected rows from the aggregation
3. If `billable_hours == 0`, classify `bench`
4. Else if `billable_percent >= partial_billing_threshold`, classify `fully_billed`
5. Else classify `partially_billed`

Guardrail:

- `project_allocations` are not used in the bench/partial/fully_billed decision
- allocation is display-only for allocation-oriented screens
- once billable work exists, the employee is no longer `bench`

The computed result is stored in:

- `utilisation_snapshots`

Model:

- `backend/app/models/utilisation_snapshot.py`


## 10. How dashboard values are calculated

Dashboard logic lives in:

- `backend/app/services/dashboard_service.py`

The dashboard reads mostly from:

- `utilisation_snapshots`
- `timesheet_entries`
- `project_allocations`
- `projects`
- `employees`
- `reporting_relationships`


### Executive dashboard

Backend endpoint:

- `GET /dashboard/executive`

Frontend caller:

- `getExecutiveDashboard()` in `frontend/src/api/dashboard.ts`

Page:

- `frontend/src/pages/DashboardPage.tsx`

Calculations:

- `total_active_employees` = count of branch snapshots for that period
- `billable_count` = snapshots classified as `fully_billed`
- `non_billable_count` = snapshots classified as `partially_billed`
- `bench_count` = snapshots classified as `bench`
- `overall_utilisation_percent` = average `utilisation_percent`
- `overall_billable_percent` = average `billable_percent`

Top consuming projects:

- built from `timesheet_entries`
- grouped by `project_id`
- summed by `hours`
- top 10 returned

Resource availability:

- `available` = bench + partially billed
- `fully_allocated` = fully billed and not over 100 percent utilisation
- `over_allocated` = utilisation percent above 100

Trend:

- reads last 6 periods from `utilisation_snapshots`
- computes per-period average utilisation and billable percentages


### Resource allocation dashboard

Backend endpoint:

- `GET /dashboard/resource-allocations`

Frontend caller:

- `getResourceAllocationDashboard()` in `frontend/src/api/dashboard.ts`

Page:

- `frontend/src/pages/DashboardPage.tsx`

Component:

- `frontend/src/components/dashboard/ResourceAllocationTable.tsx`

This view combines:

- employee classification from `utilisation_snapshots`
- allocation percentages from `project_allocations`
- billable vs non-billable hours from `timesheet_entries`
- line manager names from `reporting_relationships`

Row behavior:

- one row per employee-project allocation
- unallocated employees still get one row with `project_name = null`
- those rows represent bench or unallocated state


### Project dashboard

There is still backend support for a project dashboard:

- `GET /dashboard/projects`

It aggregates project totals from timesheet entries and member data from snapshots and assignments.
Even though the dashboard tab was removed from the UI, the backend calculation still exists.


## 11. How the Timesheets page shows HRMS data

Main page:

- `frontend/src/pages/TimesheetPage.tsx`

Backend endpoint:

- `GET /timesheets`

Service:

- `list_entries()` in `backend/app/services/timesheet_service.py`

What the page shows:

- paginated `timesheet_entries`
- period lock state
- summary cards
- employee/project filter dropdowns
- approval workflow for submitted rows

Important detail:

- HRMS-imported rows are stored in the same `timesheet_entries` collection as manual rows
- the source is distinguished by `source = "hrms_sync"` vs `source = "manual"`

Summary cards on the page are computed from all matching period entries:

- total hours
- billable hours
- billable percent
- employee count
- project count
- billable employee count
- non-billable employee count


### Workload heatmap

Backend endpoint:

- `GET /timesheets/heatmap`

Service:

- `get_workload_heatmap()` in `backend/app/services/timesheet_service.py`

Inputs:

- `timesheet_entries`
- `hrms_holidays`

Output:

- one row per employee
- one cell per date in the month
- each cell includes hours, billable hours, and project breakdown
- holiday markers come from HRMS holiday data


## 12. How employee detail drawer shows HRMS-derived data

Service:

- `get_employee_detail()` in `backend/app/services/employee_service.py`

Frontend:

- `frontend/src/components/employee-detail/EmployeeDrawer.tsx`

HRMS-derived sections shown there:

- employee core record from `employees`
- department and location from synced master data
- managers and direct reports from `reporting_relationships`
- projects from `employee_projects` plus `projects`
- utilisation snapshot from `utilisation_snapshots`
- timesheet summary from `timesheet_entries`

This is why the drawer updates after successful HRMS sync.


## 13. Branch scoping: why different users see different data

Most pages are branch-scoped using `branch_location_id`.

That value comes from the authenticated user and is refreshed from MongoDB in:

- `backend/app/middleware/auth_middleware.py`

This is important because HRMS master sync can update user-to-employee and user-to-branch mappings.

Branch scoping is used heavily in:

- dashboard queries
- timesheet listing
- employee detail visibility
- project and allocation screens


## 14. Important operational notes

### Master-data sync must happen first

Live monthly sync depends on existing mappings:

- employee `hrms_employee_id`
- project `hrms_project_id`

Without those mappings, attendance and allocation rows cannot be linked to local records.


### Dashboards use local snapshots, not live HRMS APIs

The dashboard is only as fresh as the latest sync plus utilisation recompute.

So if HRMS changed but sync has not run yet:

- dashboard numbers will still show old local data


### Timesheet data is materialized

Daily HRMS attendance is converted into local timesheet rows.
That means:

- approvals
- heatmaps
- dashboard project hours
- employee timesheet summaries

all operate on the local `timesheet_entries` collection.


### Period sync is incremental by source ID

The upsert implementation tries to be idempotent:

- existing rows are updated
- missing rows are inserted
- stale synced rows for the period are deleted


## 15. End-to-end live data flow summary

### Full live sync path

1. User clicks `Sync Now` in `IntegrationPage`
2. Frontend calls `POST /integrations/sync/{config_id}`
3. `integration_service.trigger_manual_sync()` starts a sync log
4. HRMS auth token is resolved
5. Master-data sync runs
6. Employees, projects, departments, locations, assignments, and reporting relationships are upserted
7. Live period sync runs for current period plus backfill periods
8. Attendance summary is imported
9. Daily attendance is converted into local timesheet rows
10. Allocations are imported
11. Holidays are imported
12. Utilisation snapshots are recomputed for each branch and period
13. Dashboard pages and timesheet pages read the refreshed local Mongo data


### Dashboard rendering path

1. `DashboardPage.tsx` selects a period
2. Frontend calls:
   - `/dashboard/executive`
   - `/dashboard/resource-allocations`
3. Backend reads local snapshots, timesheets, allocations, projects, and relationships
4. Backend returns aggregated JSON
5. React components render cards, charts, tables, and employee drilldowns


### Timesheet rendering path

1. `TimesheetPage.tsx` selects a period
2. Frontend calls:
   - `/timesheets`
   - `/timesheets/period-lock`
   - `/timesheets/heatmap` when needed
3. Backend reads local `timesheet_entries` and `hrms_holidays`
4. React renders table rows, filters, summaries, and the heatmap


## 16. Recommended files to read first when debugging

If you want to debug or extend this flow, start here:

- `backend/app/services/hrms_sync_service.py`
- `backend/app/services/hrms_client.py`
- `backend/app/services/utilisation_service.py`
- `backend/app/services/dashboard_service.py`
- `backend/app/services/timesheet_service.py`
- `backend/app/services/employee_service.py`
- `backend/app/services/integration_service.py`
- `frontend/src/pages/IntegrationPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/TimesheetPage.tsx`
- `frontend/src/components/employee-detail/EmployeeDrawer.tsx`
