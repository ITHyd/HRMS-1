"""
HRMS sync service.

- sync_master_data(): Full replacement sync of employees, projects,
  locations, departments, assignments, reporting relationships from real HRMS.
- trigger_sync() / get_sync_logs(): Legacy timesheet mock sync (kept for
  backward compatibility).
"""

import calendar
import random
import uuid
from datetime import date, datetime, timezone

import bcrypt

from app.models.department import Department
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.hrms_sync_log import HrmsSyncLog
from app.models.location import Location
from app.models.project import Project
from app.models.reporting_relationship import ReportingRelationship
from app.models.timesheet_entry import TimesheetEntry
from app.models.user import User
from app.services.hrms_client import HrmsClient

def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# HRMS role -> our level mapping
ROLE_TO_LEVEL = {
    "Employee": "mid",
    "Manager": "manager",
    "HR": "manager",
    "itadmin": "mid",
    "Account Manager": "manager",
}

# HRMS location_id -> (city, country, region, code)
LOCATION_META = {
    1: ("Hyderabad", "India", "APAC", "HYD"),
    5: ("Bangalore", "India", "APAC", "BLR"),
}

# Designated branch heads: HRMS location_id -> HRMS employeeId
BRANCH_HEAD_OVERRIDES = {
    1: 1153,   # Hyderabad -> Vamsi Ramadugu
    5: 1127,   # Bangalore -> Ganapathy Munjandira Thimmaiah
}


# ======================================================================
# Master data sync (real HRMS)
# ======================================================================


async def sync_master_data(token: str, user_id: str) -> dict:
    """
    Full replacement sync of master data from HRMS.

    Clears existing data and re-creates:
    - Locations, Departments, Employees, Projects,
      EmployeeProject assignments, ReportingRelationships, Users.

    Returns a summary dict with counts.
    """
    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Create sync log
    sync_log = HrmsSyncLog(
        batch_id=batch_id,
        branch_location_id="ALL",
        period="master-data",
        status="running",
        total_records=0,
        imported_count=0,
        duplicate_count=0,
        error_count=0,
        errors=[],
        started_at=now,
        triggered_by=user_id,
    )
    await sync_log.insert()

    try:
        client = HrmsClient(token=token)

        # ----- Fetch all data from HRMS -----
        hrms_employees = await client.get_employees()
        hrms_projects = await client.get_projects()
        hrms_locations = await client.get_locations()
        hrms_managers = await client.get_managers()
        hrms_hrs = await client.get_hrs()

        sync_log.total_records = (
            len(hrms_employees) + len(hrms_projects)
        )

        # ----- Clear existing collections -----
        await Location.find_all().delete()
        await Department.find_all().delete()
        await Employee.find_all().delete()
        await Project.find_all().delete()
        await EmployeeProject.find_all().delete()
        await ReportingRelationship.find_all().delete()
        await User.find_all().delete()

        imported = 0
        errors = []

        # ----- 1. Locations -----
        # Maps: hrms_location_id (int) -> our MongoDB Location id (str)
        loc_id_map: dict[int, str] = {}
        for hloc in hrms_locations:
            hid = hloc.get("id")
            hname = hloc.get("name", "Unknown")
            meta = LOCATION_META.get(hid)
            if meta:
                city, country, region, code = meta
            else:
                city = hname
                country = "India"
                region = "APAC"
                code = hname[:3].upper()

            loc = Location(city=city, country=country, region=region, code=code)
            await loc.insert()
            loc_id_map[hid] = str(loc.id)
            imported += 1

        # ----- 2. Departments -----
        # HRMS has no department data, so derive from project "account" field
        account_set: set[str] = set()
        for p in hrms_projects:
            acct = p.get("account")
            if acct:
                account_set.add(acct)
        account_set.add("General")  # fallback

        # Create one department per account
        dept_id_map: dict[str, str] = {}  # account_name -> mongo dept id
        default_loc_id = list(loc_id_map.values())[0] if loc_id_map else ""
        for acct in sorted(account_set):
            dept = Department(name=acct, location_id=default_loc_id)
            await dept.insert()
            dept_id_map[acct] = str(dept.id)
            imported += 1

        general_dept_id = dept_id_map["General"]

        # ----- 3. Employees -----
        # Maps: hrms_employeeId (int) -> our MongoDB Employee id (str)
        emp_id_map: dict[int, str] = {}
        # Also map hrms_name -> hrms_employeeId for resolving manager names
        emp_name_to_hid: dict[str, int] = {}

        for hemp in hrms_employees:
            hid = hemp.get("employeeId")
            name = hemp.get("name", "Unknown")
            email = hemp.get("email", "")
            role = hemp.get("role", "Employee")
            hloc_id = hemp.get("location_id")
            doj_raw = hemp.get("doj")

            # Resolve location
            our_loc_id = loc_id_map.get(hloc_id, default_loc_id) if hloc_id else default_loc_id

            # Parse join date
            join_date = now
            if doj_raw:
                try:
                    join_date = datetime.fromisoformat(doj_raw.replace("Z", "+00:00"))
                except Exception:
                    pass

            level = ROLE_TO_LEVEL.get(role, "mid")

            emp = Employee(
                name=name,
                email=email,
                designation=role,
                department_id=general_dept_id,
                level=level,
                location_id=our_loc_id,
                join_date=join_date,
                is_active=True,
            )
            await emp.insert()
            emp_id_map[hid] = str(emp.id)
            emp_name_to_hid[name] = hid
            imported += 1

        # Also map manager/HR names that might not be in the employee list
        for mgr in hrms_managers:
            mid = mgr.get("id")
            mname = mgr.get("name", "")
            if mid not in emp_id_map:
                emp_name_to_hid[mname] = mid
        for hr in hrms_hrs:
            hrid = hr.get("id")
            hrname = hr.get("name", "")
            if hrid not in emp_id_map:
                emp_name_to_hid[hrname] = hrid

        # ----- 4. Projects -----
        # Maps: hrms_project_id (int) -> our MongoDB Project id (str)
        proj_id_map: dict[int, str] = {}
        # Track assignments: (hrms_emp_id, hrms_proj_id, role)
        emp_project_assignments: list[tuple[int, int, str]] = []

        for hproj in hrms_projects:
            hpid = hproj.get("project_id")
            pname = hproj.get("project_name", "Unknown")
            status_raw = hproj.get("status", "Active")
            account = hproj.get("account")
            start_raw = hproj.get("start_date")
            end_raw = hproj.get("end_date")

            status = "ACTIVE" if status_raw == "Active" else status_raw.upper()
            dept_id = dept_id_map.get(account, general_dept_id)

            start_date = now
            end_date = None
            if start_raw:
                try:
                    start_date = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
                except Exception:
                    pass
            if end_raw:
                try:
                    end_date = datetime.fromisoformat(end_raw.replace("Z", "+00:00"))
                except Exception:
                    pass

            proj = Project(
                name=pname,
                status=status,
                department_id=dept_id,
                start_date=start_date,
                end_date=end_date,
            )
            await proj.insert()
            proj_id_map[hpid] = str(proj.id)
            imported += 1

            # Collect assignments
            for assignment in hproj.get("assignments") or []:
                a_emp_id = assignment.get("employee_id")
                a_role = assignment.get("role", "contributor")
                if a_emp_id:
                    emp_project_assignments.append((a_emp_id, hpid, a_role))

        # ----- 5. Update employee departments from primary project -----
        emp_dept_map: dict[int, str] = {}
        for (hemp_id, hproj_id, _role) in emp_project_assignments:
            if hemp_id not in emp_dept_map:
                for hproj in hrms_projects:
                    if hproj.get("project_id") == hproj_id:
                        acct = hproj.get("account")
                        if acct and acct in dept_id_map:
                            emp_dept_map[hemp_id] = dept_id_map[acct]
                        break

        for hemp_id, dept_id in emp_dept_map.items():
            mongo_emp_id = emp_id_map.get(hemp_id)
            if mongo_emp_id:
                emp = await Employee.get(mongo_emp_id)
                if emp:
                    emp.department_id = dept_id
                    await emp.save()

        # ----- 6. EmployeeProject assignments -----
        for (hemp_id, hproj_id, role) in emp_project_assignments:
            our_emp_id = emp_id_map.get(hemp_id)
            our_proj_id = proj_id_map.get(hproj_id)
            if our_emp_id and our_proj_id:
                ep = EmployeeProject(
                    employee_id=our_emp_id,
                    project_id=our_proj_id,
                    role_in_project=role.lower() if role else "contributor",
                )
                await ep.insert()
                imported += 1

        # ----- 7. Reporting Relationships -----
        for hemp in hrms_employees:
            hid = hemp.get("employeeId")
            our_emp_id = emp_id_map.get(hid)
            if not our_emp_id:
                continue

            # Managers (names list)
            manager_names = hemp.get("managers", [])
            for idx, mname in enumerate(manager_names):
                mgr_hid = emp_name_to_hid.get(mname)
                mgr_mongo_id = emp_id_map.get(mgr_hid) if mgr_hid else None
                # Skip self-referencing relationships
                if mgr_mongo_id and mgr_mongo_id != our_emp_id:
                    rel_type = "PRIMARY" if idx == 0 else "FUNCTIONAL"
                    rel = ReportingRelationship(
                        employee_id=our_emp_id,
                        manager_id=mgr_mongo_id,
                        type=rel_type,
                    )
                    await rel.insert()
                    imported += 1

            # HRs (names list)
            hr_names = hemp.get("hr", [])
            for hrname in hr_names:
                hr_hid = emp_name_to_hid.get(hrname)
                hr_mongo_id = emp_id_map.get(hr_hid) if hr_hid else None
                if hr_mongo_id and hr_mongo_id != our_emp_id:
                    rel = ReportingRelationship(
                        employee_id=our_emp_id,
                        manager_id=hr_mongo_id,
                        type="FUNCTIONAL",
                    )
                    await rel.insert()
                    imported += 1

        # ----- 8. Users (create login accounts) -----
        default_password_hash = _hash_password("password123")

        # Create one branch_head user per location
        for hloc_id, our_loc_id in loc_id_map.items():
            meta = LOCATION_META.get(hloc_id)
            if not meta:
                continue
            city = meta[0]

            # Use designated branch head if configured
            branch_head_emp = None
            override_hid = BRANCH_HEAD_OVERRIDES.get(hloc_id)
            if override_hid and override_hid in emp_id_map:
                for hemp in hrms_employees:
                    if hemp.get("employeeId") == override_hid:
                        branch_head_emp = hemp
                        break

            # Fallback: first Manager in this location
            if not branch_head_emp:
                for hemp in hrms_employees:
                    if hemp.get("location_id") == hloc_id and hemp.get("role") == "Manager":
                        hid = hemp.get("employeeId")
                        if hid in emp_id_map:
                            branch_head_emp = hemp
                            break

            if not branch_head_emp:
                for hemp in hrms_employees:
                    if hemp.get("location_id") == hloc_id:
                        branch_head_emp = hemp
                        break

            if branch_head_emp:
                hid = branch_head_emp.get("employeeId")
                user = User(
                    email=branch_head_emp.get("email", f"admin@{city.lower()}.local"),
                    password_hash=default_password_hash,
                    employee_id=emp_id_map.get(hid, ""),
                    branch_location_id=our_loc_id,
                    name=branch_head_emp.get("name", f"{city} Branch Head"),
                    role="branch_head",
                )
                await user.insert()
                imported += 1

        # ----- Finalize sync log -----
        sync_log.status = "completed"
        sync_log.imported_count = imported
        sync_log.error_count = len(errors)
        sync_log.errors = errors
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()

    except Exception as e:
        sync_log.status = "failed"
        sync_log.errors = [{"message": str(e)}]
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()
        raise

    return {
        "batch_id": batch_id,
        "status": "completed",
        "imported_count": imported,
        "summary": {
            "locations": len(loc_id_map),
            "departments": len(dept_id_map),
            "employees": len(emp_id_map),
            "projects": len(proj_id_map),
            "assignments": len(emp_project_assignments),
        },
    }


# ======================================================================
# Legacy: mock timesheet sync (period-based)
# ======================================================================


def _get_working_days(year: int, month: int) -> list[date]:
    """Return all weekday dates for a given year/month."""
    num_days = calendar.monthrange(year, month)[1]
    working_days = []
    for day in range(1, num_days + 1):
        d = date(year, month, day)
        if d.weekday() < 5:
            working_days.append(d)
    return working_days


async def trigger_sync(period: str, branch_location_id: str, user_id: str) -> dict:
    """
    Trigger mock HRMS sync that generates simulated timesheet data
    for all active employees in the branch for the given period.
    """
    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    sync_log = HrmsSyncLog(
        batch_id=batch_id,
        branch_location_id=branch_location_id,
        period=period,
        status="running",
        total_records=0,
        imported_count=0,
        duplicate_count=0,
        error_count=0,
        errors=[],
        started_at=now,
        triggered_by=user_id,
    )
    await sync_log.insert()

    try:
        year, month = int(period.split("-")[0]), int(period.split("-")[1])
        working_days = _get_working_days(year, month)

        employees = await Employee.find(
            Employee.location_id == branch_location_id,
            Employee.is_active == True,
        ).to_list()

        total_records = 0
        imported_count = 0
        duplicate_count = 0
        error_count = 0
        error_list = []

        for emp in employees:
            emp_id = str(emp.id)

            assignments = await EmployeeProject.find(
                EmployeeProject.employee_id == emp_id,
            ).to_list()

            project_ids = [a.project_id for a in assignments]
            projects = []
            if project_ids:
                from bson import ObjectId
                projects = await Project.find(
                    {"_id": {"$in": [ObjectId(pid) for pid in project_ids if ObjectId.is_valid(pid)]}},
                    Project.status == "ACTIVE",
                ).to_list()

            is_bench = len(projects) == 0

            for day in working_days:
                total_hours = round(random.uniform(6.0, 9.0), 1)

                if is_bench:
                    total_records += 1
                    existing = await TimesheetEntry.find_one(
                        TimesheetEntry.employee_id == emp_id,
                        TimesheetEntry.date == day,
                        TimesheetEntry.project_id == "bench",
                    )
                    if existing:
                        duplicate_count += 1
                        continue

                    entry = TimesheetEntry(
                        employee_id=emp_id,
                        project_id="bench",
                        date=day,
                        hours=total_hours,
                        is_billable=False,
                        description="Bench - auto generated via HRMS sync",
                        status="approved",
                        submitted_at=now,
                        approved_by="system",
                        approved_at=now,
                        source="hrms_sync",
                        sync_batch_id=batch_id,
                        period=period,
                        branch_location_id=branch_location_id,
                        created_at=now,
                        updated_at=now,
                    )
                    await entry.insert()
                    imported_count += 1
                else:
                    num_projects = len(projects)
                    remaining_hours = total_hours

                    for idx, proj in enumerate(projects):
                        proj_id = str(proj.id)
                        total_records += 1

                        if idx == num_projects - 1:
                            hours = round(remaining_hours, 1)
                        else:
                            share = random.uniform(0.3, 0.7) * remaining_hours
                            hours = round(max(0.5, share), 1)
                            remaining_hours -= hours

                        is_billable = random.random() < 0.70

                        existing = await TimesheetEntry.find_one(
                            TimesheetEntry.employee_id == emp_id,
                            TimesheetEntry.date == day,
                            TimesheetEntry.project_id == proj_id,
                        )
                        if existing:
                            duplicate_count += 1
                            continue

                        entry = TimesheetEntry(
                            employee_id=emp_id,
                            project_id=proj_id,
                            date=day,
                            hours=hours,
                            is_billable=is_billable,
                            description=f"Work on {proj.name} - auto generated via HRMS sync",
                            status="approved",
                            submitted_at=now,
                            approved_by="system",
                            approved_at=now,
                            source="hrms_sync",
                            sync_batch_id=batch_id,
                            period=period,
                            branch_location_id=branch_location_id,
                            created_at=now,
                            updated_at=now,
                        )
                        await entry.insert()
                        imported_count += 1

        sync_log.status = "completed"
        sync_log.total_records = total_records
        sync_log.imported_count = imported_count
        sync_log.duplicate_count = duplicate_count
        sync_log.error_count = error_count
        sync_log.errors = error_list
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()

    except Exception as e:
        sync_log.status = "failed"
        sync_log.errors = [{"message": str(e)}]
        sync_log.completed_at = datetime.now(timezone.utc)
        await sync_log.save()
        raise

    return {
        "batch_id": batch_id,
        "status": sync_log.status,
        "total_records": total_records,
        "imported_count": imported_count,
        "duplicate_count": duplicate_count,
        "error_count": error_count,
    }


async def get_sync_logs(
    branch_location_id: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Return paginated list of HRMS sync logs."""
    skip = (page - 1) * page_size

    filters = []
    if branch_location_id:
        filters.append(
            {"$or": [
                {"branch_location_id": branch_location_id},
                {"branch_location_id": "ALL"},
            ]}
        )

    logs = await HrmsSyncLog.find(
        *filters
    ).sort(-HrmsSyncLog.started_at).skip(skip).limit(page_size).to_list()

    total = await HrmsSyncLog.find(*filters).count()

    return {
        "logs": [
            {
                "batch_id": log.batch_id,
                "period": log.period,
                "status": log.status,
                "total_records": log.total_records,
                "imported_count": log.imported_count,
                "duplicate_count": log.duplicate_count,
                "error_count": log.error_count,
                "errors": log.errors,
                "started_at": log.started_at,
                "completed_at": log.completed_at,
            }
            for log in logs
        ],
        "total": total,
    }
