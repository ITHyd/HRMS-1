"""
Pull ALL data from HRMS portal, map to our application models,
and save as static_data.json.  After running this once you never
need the token again — just load via:

    python -m seed.load_static_data

Usage:
    cd backend
    python -m seed.pull_hrms_data --token <HR_TOKEN>
    python -m seed.pull_hrms_data --token <HR_TOKEN> --period 2025-11
"""

import argparse
import asyncio
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import bcrypt
import httpx

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL = "http://149.102.158.71:2342"

ROLE_TO_LEVEL = {
    "Employee": "mid",
    "Manager": "manager",
    "HR": "manager",
    "itadmin": "mid",
    "Account Manager": "manager",
}

LOCATION_META = {
    1: ("Hyderabad", "India", "APAC", "HYD"),
    5: ("Bangalore", "India", "APAC", "BLR"),
}

BRANCH_HEAD_OVERRIDES = {
    1: 1153,  # Hyderabad -> Vamsi Ramadugu
    5: 1127,  # Bangalore -> Ganapathy Munjandira Thimmaiah
}

# Map HRMS project account (client) -> proper department name
ACCOUNT_TO_DEPARTMENT = {
    "ENWL": "SAP Services",
    "DCWW": "Engineering & Design",
    "EirGrid": "Engineering & Design",
    "Cadent": "Engineering & Design",
    "SGN": "Managed Services",
    "UKPN": "Managed Services",
    "NGN": "Managed Services",
    "WWU": "Managed Services",
    "Internal": "Internal Projects",
}

OUTPUT_FILE = Path(__file__).parent / "static_data.json"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_oid_counter = 0


def new_oid() -> str:
    """Generate a unique 24-hex-char string that looks like a MongoDB ObjectId."""
    global _oid_counter
    _oid_counter += 1
    ts = int(datetime.now(timezone.utc).timestamp())
    return f"{ts:08x}{'a0b1c2':6}{_oid_counter:010x}"


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def iso(dt) -> str | None:
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


# ---------------------------------------------------------------------------
# HRMS fetch helpers (plain httpx, no app dependency)
# ---------------------------------------------------------------------------


async def fetch_json(client: httpx.AsyncClient, path: str, headers: dict, **params):
    resp = await client.get(f"{BASE_URL}{path}", headers=headers, params=params)
    resp.raise_for_status()
    return resp.json()


async def fetch_all_hrms(token: str, period: str):
    """Fetch everything from HRMS in one go."""
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=120) as c:
        print("  Fetching locations...")
        loc_data = await fetch_json(c, "/locations/", headers)
        locations_raw = loc_data.get("data", loc_data) if isinstance(loc_data, dict) else loc_data

        print("  Fetching employees...")
        emp_data = await fetch_json(c, "/users/employees", headers)
        employees_raw = emp_data.get("employees", emp_data) if isinstance(emp_data, dict) else emp_data
        if isinstance(employees_raw, list):
            print(f"    Found {len(employees_raw)} employees")

        print("  Fetching managers...")
        mgr_data = await fetch_json(c, "/users/managers", headers)
        managers_raw = mgr_data.get("managers", mgr_data) if isinstance(mgr_data, dict) else mgr_data

        print("  Fetching HRs...")
        hr_data = await fetch_json(c, "/users/hrs", headers)
        hrs_raw = hr_data.get("HRs", hr_data) if isinstance(hr_data, dict) else hr_data

        print("  Fetching projects...")
        projects_raw = await fetch_json(c, "/projects/get_projects", headers)
        if not isinstance(projects_raw, list):
            projects_raw = []

        print("  Fetching holidays...")
        hol_data = await fetch_json(c, "/calendar/", headers)
        holidays_raw = hol_data.get("data", hol_data) if isinstance(hol_data, dict) else hol_data

        # Attendance summary
        year, month = int(period.split("-")[0]), int(period.split("-")[1])
        print(f"  Fetching attendance summary for {period}...")
        attendance_raw = await fetch_json(
            c, "/attendance/hr-assigned", headers, hr_id=1, year=year, month=month
        )
        if not isinstance(attendance_raw, list):
            attendance_raw = []

        # Daily attendance for employees who have hours
        active_emps = [a for a in attendance_raw if a.get("total_hours", 0) > 0]
        daily_raw: dict[int, list[dict]] = {}
        if active_emps:
            print(f"  Fetching daily attendance for {len(active_emps)} active employees...")
            for i, a in enumerate(active_emps):
                eid = a["employee_id"]
                try:
                    daily = await fetch_json(
                        c, "/attendance/daily", headers,
                        employee_id=eid, year=year, month=month,
                    )
                    if daily:
                        daily_raw[eid] = daily
                except Exception:
                    pass
                if (i + 1) % 20 == 0:
                    print(f"    ...{i + 1}/{len(active_emps)}")

        # Allocations
        print(f"  Fetching allocations for {period}...")
        try:
            alloc_data = await fetch_json(c, "/allocations/all", headers, month=period)
            if isinstance(alloc_data, dict) and "employees" in alloc_data:
                allocations_raw = alloc_data
            else:
                print(f"    Allocations: {alloc_data.get('detail', 'no data')}")
                allocations_raw = {"employees": [], "total_working_days": 22}
        except Exception as e:
            print(f"    Allocations failed: {e}")
            allocations_raw = {"employees": [], "total_working_days": 22}

    return {
        "locations": locations_raw,
        "employees": employees_raw,
        "managers": managers_raw,
        "hrs": hrs_raw,
        "projects": projects_raw,
        "holidays": holidays_raw,
        "attendance": attendance_raw,
        "daily_attendance": daily_raw,
        "allocations": allocations_raw,
    }


# ---------------------------------------------------------------------------
# Mapping: HRMS data -> our application models
# ---------------------------------------------------------------------------


def map_all(raw: dict, period: str) -> dict:
    """Transform raw HRMS data into our static_data.json format."""

    now_iso = datetime.now(timezone.utc).isoformat()

    # ---- 1. Locations ----
    loc_id_map: dict[int, str] = {}  # hrms_location_id -> our id
    locations = []
    for hloc in raw["locations"]:
        hid = hloc.get("id")
        meta = LOCATION_META.get(hid)
        if meta:
            city, country, region, code = meta
        else:
            hname = hloc.get("name", "Unknown")
            city, country, region, code = hname, "India", "APAC", hname[:3].upper()
        oid = new_oid()
        loc_id_map[hid] = oid
        locations.append({"id": oid, "city": city, "country": country, "region": region, "code": code})

    default_loc_id = list(loc_id_map.values())[0] if loc_id_map else ""

    # ---- 2. Departments (map client accounts → proper departments) ----
    # First, collect all unique department names from the account mapping
    dept_names: set[str] = {"General"}
    account_to_dept_name: dict[str, str] = {}  # account -> department name
    for p in raw["projects"]:
        acct = p.get("account")
        if acct:
            dept_name = ACCOUNT_TO_DEPARTMENT.get(acct, "General")
            account_to_dept_name[acct] = dept_name
            dept_names.add(dept_name)

    dept_id_map: dict[str, str] = {}  # department_name -> our id
    departments = []
    for dept_name in sorted(dept_names):
        oid = new_oid()
        dept_id_map[dept_name] = oid
        departments.append({"id": oid, "name": dept_name, "location_id": default_loc_id})

    general_dept_id = dept_id_map["General"]

    # Helper: account name -> our department id
    def _dept_for_account(acct: str | None) -> str:
        if not acct:
            return general_dept_id
        dept_name = ACCOUNT_TO_DEPARTMENT.get(acct, "General")
        return dept_id_map.get(dept_name, general_dept_id)

    # ---- 3. Employees ----
    emp_id_map: dict[int, str] = {}
    emp_name_to_hid: dict[str, int] = {}
    employees = []

    for hemp in raw["employees"]:
        hid = hemp.get("employeeId")
        name = hemp.get("name", "Unknown")
        email = hemp.get("email", "")
        role = hemp.get("role", "Employee")
        hloc_id = hemp.get("location_id")
        doj_raw = hemp.get("doj")

        our_loc_id = loc_id_map.get(hloc_id, default_loc_id) if hloc_id else default_loc_id

        join_date = now_iso
        if doj_raw:
            try:
                join_date = datetime.fromisoformat(doj_raw.replace("Z", "+00:00")).isoformat()
            except Exception:
                pass

        level = ROLE_TO_LEVEL.get(role, "mid")
        oid = new_oid()
        emp_id_map[hid] = oid
        emp_name_to_hid[name] = hid

        employees.append({
            "id": oid,
            "name": name,
            "email": email,
            "designation": role,
            "department_id": general_dept_id,
            "level": level,
            "location_id": our_loc_id,
            "join_date": join_date,
            "is_active": True,
        })

    # Manager/HR name maps
    for mgr in raw["managers"]:
        mid = mgr.get("id")
        mname = mgr.get("name", "")
        if mid not in emp_id_map:
            emp_name_to_hid[mname] = mid
    for hr in raw["hrs"]:
        hrid = hr.get("id")
        hrname = hr.get("name", "")
        if hrid not in emp_id_map:
            emp_name_to_hid[hrname] = hrid

    # ---- 4. Projects ----
    proj_id_map: dict[int, str] = {}
    projects = []
    emp_project_assignments: list[tuple[int, int, str]] = []

    for hproj in raw["projects"]:
        hpid = hproj.get("project_id")
        pname = hproj.get("project_name", "Unknown")
        status_raw = hproj.get("status", "Active")
        account = hproj.get("account")
        start_raw = hproj.get("start_date")
        end_raw = hproj.get("end_date")

        status = "ACTIVE" if status_raw == "Active" else status_raw.upper()
        dept_id = _dept_for_account(account)

        oid = new_oid()
        proj_id_map[hpid] = oid

        projects.append({
            "id": oid,
            "name": pname,
            "status": status,
            "department_id": dept_id,
            "start_date": start_raw or now_iso,
            "end_date": end_raw,
        })

        for assignment in hproj.get("assignments") or []:
            a_emp_id = assignment.get("employee_id")
            a_role = assignment.get("role", "contributor")
            if a_emp_id:
                emp_project_assignments.append((a_emp_id, hpid, a_role))

    # ---- 5. Update employee departments from primary project ----
    emp_dept_map: dict[int, str] = {}
    for hemp_id, hproj_id, _role in emp_project_assignments:
        if hemp_id not in emp_dept_map:
            for hproj in raw["projects"]:
                if hproj.get("project_id") == hproj_id:
                    acct = hproj.get("account")
                    mapped_dept = _dept_for_account(acct)
                    emp_dept_map[hemp_id] = mapped_dept
                    break

    for emp in employees:
        hemp_id = next((k for k, v in emp_id_map.items() if v == emp["id"]), None)
        if hemp_id and hemp_id in emp_dept_map:
            emp["department_id"] = emp_dept_map[hemp_id]

    # ---- 6. Employee-Project assignments ----
    employee_projects = []
    for hemp_id, hproj_id, role in emp_project_assignments:
        our_emp_id = emp_id_map.get(hemp_id)
        our_proj_id = proj_id_map.get(hproj_id)
        if our_emp_id and our_proj_id:
            employee_projects.append({
                "id": new_oid(),
                "employee_id": our_emp_id,
                "project_id": our_proj_id,
                "role_in_project": role.lower() if role else "contributor",
            })

    # ---- 7. Reporting Relationships ----
    reporting_relationships = []
    for hemp in raw["employees"]:
        hid = hemp.get("employeeId")
        our_emp_id = emp_id_map.get(hid)
        if not our_emp_id:
            continue

        manager_names = hemp.get("managers", [])
        for idx, mname in enumerate(manager_names):
            mgr_hid = emp_name_to_hid.get(mname)
            mgr_mongo_id = emp_id_map.get(mgr_hid) if mgr_hid else None
            if mgr_mongo_id and mgr_mongo_id != our_emp_id:
                rel_type = "PRIMARY" if idx == 0 else "FUNCTIONAL"
                reporting_relationships.append({
                    "id": new_oid(),
                    "employee_id": our_emp_id,
                    "manager_id": mgr_mongo_id,
                    "type": rel_type,
                })

        hr_names = hemp.get("hr", [])
        for hrname in hr_names:
            hr_hid = emp_name_to_hid.get(hrname)
            hr_mongo_id = emp_id_map.get(hr_hid) if hr_hid else None
            if hr_mongo_id and hr_mongo_id != our_emp_id:
                reporting_relationships.append({
                    "id": new_oid(),
                    "employee_id": our_emp_id,
                    "manager_id": hr_mongo_id,
                    "type": "FUNCTIONAL",
                })

    # ---- 8. Users (branch head accounts) ----
    default_password_hash = _hash_password("password123")
    users = []
    for hloc_id, our_loc_id in loc_id_map.items():
        meta = LOCATION_META.get(hloc_id)
        if not meta:
            continue
        city = meta[0]
        override_hid = BRANCH_HEAD_OVERRIDES.get(hloc_id)
        bh = None
        if override_hid:
            bh = next((e for e in raw["employees"] if e.get("employeeId") == override_hid), None)
        if not bh:
            bh = next(
                (e for e in raw["employees"]
                 if e.get("location_id") == hloc_id and e.get("role") == "Manager"),
                None,
            )
        if not bh:
            bh = next((e for e in raw["employees"] if e.get("location_id") == hloc_id), None)
        if bh:
            hid = bh.get("employeeId")
            users.append({
                "id": new_oid(),
                "email": bh.get("email", f"admin@{city.lower()}.local"),
                "password_hash": default_password_hash,
                "employee_id": emp_id_map.get(hid, ""),
                "branch_location_id": our_loc_id,
                "name": bh.get("name", f"{city} Branch Head"),
                "role": "branch_head",
            })

    # ---- 9. Holidays ----
    holidays = []
    for h in raw["holidays"]:
        hloc_id = h.get("location_id")
        our_loc_id = loc_id_map.get(hloc_id)
        hdate = str(h.get("holiday_date", ""))[:10]
        year = int(hdate[:4]) if len(hdate) >= 4 else 2025
        holidays.append({
            "id": new_oid(),
            "hrms_id": h.get("id", 0),
            "location_id": our_loc_id,
            "hrms_location_id": hloc_id,
            "holiday_date": hdate,
            "holiday_name": h.get("holiday_name", ""),
            "holiday_type": h.get("holiday_type"),
            "year": year,
        })

    # ---- 10. Attendance Summaries ----
    attendance_summaries = []
    for a in raw["attendance"]:
        hrms_eid = a.get("employee_id")
        our_eid = emp_id_map.get(hrms_eid)
        if not our_eid:
            continue
        attendance_summaries.append({
            "id": new_oid(),
            "period": period,
            "employee_id": our_eid,
            "hrms_employee_id": hrms_eid,
            "employee_name": a.get("name", ""),
            "present_days": a.get("present", 0),
            "wfh_days": a.get("wfh", 0),
            "leave_days": a.get("leave", 0),
            "total_hours": a.get("total_hours", 0.0),
            "synced_at": now_iso,
        })

    # ---- 11. Timesheet Entries (from daily attendance) ----
    timesheet_entries = []
    for hrms_eid, days in raw["daily_attendance"].items():
        our_eid = emp_id_map.get(int(hrms_eid))
        if not our_eid:
            continue
        # Find employee's location
        emp_rec = next((e for e in employees if e["id"] == our_eid), None)
        branch_loc = emp_rec["location_id"] if emp_rec else default_loc_id

        for day_entry in days:
            if not isinstance(day_entry, dict):
                continue
            action = day_entry.get("status") or day_entry.get("action", "")
            if action == "Leave":
                continue
            day_date = str(day_entry.get("date", ""))[:10]
            if not day_date:
                continue

            day_projects = day_entry.get("projects", [])
            hours = day_entry.get("hours", 0)

            if not day_projects:
                if hours and hours > 0:
                    timesheet_entries.append({
                        "id": new_oid(),
                        "employee_id": our_eid,
                        "project_id": "bench",
                        "date": day_date,
                        "hours": hours,
                        "is_billable": False,
                        "description": f"{action} - HRMS",
                        "status": "approved",
                        "submitted_at": now_iso,
                        "approved_by": "system",
                        "approved_at": now_iso,
                        "source": "hrms_sync",
                        "period": period,
                        "branch_location_id": branch_loc,
                        "created_at": now_iso,
                        "updated_at": now_iso,
                    })
            else:
                for pe in day_projects:
                    proj_hours = pe.get("total_hours", 0)
                    if not proj_hours or proj_hours <= 0:
                        continue
                    try:
                        hrms_pid = int(pe.get("value"))
                    except (ValueError, TypeError):
                        hrms_pid = None
                    our_pid = proj_id_map.get(hrms_pid, "unknown") if hrms_pid else "unknown"
                    is_billable = our_pid not in ("unknown", "bench")

                    timesheet_entries.append({
                        "id": new_oid(),
                        "employee_id": our_eid,
                        "project_id": our_pid,
                        "date": day_date,
                        "hours": proj_hours,
                        "is_billable": is_billable,
                        "description": f"{action} - {pe.get('label', '')} - HRMS",
                        "status": "approved",
                        "submitted_at": now_iso,
                        "approved_by": "system",
                        "approved_at": now_iso,
                        "source": "hrms_sync",
                        "period": period,
                        "branch_location_id": branch_loc,
                        "created_at": now_iso,
                        "updated_at": now_iso,
                    })

    # ---- 12. Project Allocations ----
    alloc_raw = raw["allocations"]
    total_working_days = alloc_raw.get("total_working_days", 22)
    project_allocations = []
    for emp_entry in alloc_raw.get("employees", []):
        try:
            hrms_eid = int(emp_entry.get("employee_id"))
        except (ValueError, TypeError):
            continue
        our_eid = emp_id_map.get(hrms_eid)
        if not our_eid:
            continue
        total_alloc_days = emp_entry.get("allocated_days", 0)
        available_days = emp_entry.get("available_days", 0)

        for alloc in emp_entry.get("allocations", []):
            try:
                hrms_pid = int(alloc.get("project_id"))
            except (ValueError, TypeError):
                continue
            our_pid = proj_id_map.get(hrms_pid)
            if not our_pid:
                continue
            project_allocations.append({
                "id": new_oid(),
                "period": period,
                "employee_id": our_eid,
                "hrms_employee_id": hrms_eid,
                "employee_name": emp_entry.get("employee_name", ""),
                "project_id": our_pid,
                "hrms_project_id": hrms_pid,
                "project_name": alloc.get("project_name", ""),
                "client_name": alloc.get("client_name"),
                "allocated_days": alloc.get("allocated_days", 0),
                "allocation_percentage": alloc.get("allocation_percentage", 0),
                "total_working_days": total_working_days,
                "total_allocated_days": total_alloc_days,
                "available_days": available_days,
                "synced_at": now_iso,
            })

    return {
        "locations": locations,
        "departments": departments,
        "employees": employees,
        "reporting_relationships": reporting_relationships,
        "projects": projects,
        "employee_projects": employee_projects,
        "users": users,
        "holidays": holidays,
        "attendance_summaries": attendance_summaries,
        "timesheet_entries": timesheet_entries,
        "project_allocations": project_allocations,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main(token: str, period: str):
    print(f"Pulling ALL data from HRMS ({BASE_URL})...")
    raw = await fetch_all_hrms(token, period)

    print("\nMapping HRMS data to application models...")
    static_data = map_all(raw, period)

    print(f"\nWriting {OUTPUT_FILE.name}...")
    with open(OUTPUT_FILE, "w") as f:
        json.dump(static_data, f, indent=2, default=str)

    # Summary
    print()
    print("=" * 55)
    print("  HRMS Data Export Complete!")
    print("=" * 55)
    for key, items in static_data.items():
        print(f"  {key:30s} {len(items):>5} records")
    print()
    print(f"  Output: {OUTPUT_FILE}")
    print()
    print("  Now load into MongoDB with:")
    print("    python -m seed.load_static_data")
    print()
    print("  Login accounts (password: password123):")
    for u in static_data["users"]:
        print(f"    {u['email']} ({u['role']})")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pull ALL data from HRMS → static_data.json")
    parser.add_argument("--token", required=True, help="HRMS JWT token (HR role recommended)")
    parser.add_argument("--period", default="2025-11", help="Period for attendance/allocations (YYYY-MM)")
    args = parser.parse_args()
    asyncio.run(main(args.token, args.period))
