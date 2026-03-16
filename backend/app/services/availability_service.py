import calendar as _calendar_mod
from datetime import datetime, date as date_type, timezone
from typing import Optional

from bson import ObjectId

from app.models.employee import Employee
from app.models.employee_skill import EmployeeSkill
from app.models.skill_catalog import SkillCatalog
from app.models.employee_project import EmployeeProject
from app.models.project import Project
from app.models.project_allocation import ProjectAllocation
from app.models.department import Department
from app.models.location import Location
from app.models.utilisation_snapshot import UtilisationSnapshot
from app.services import audit_service


def _period_end_date(period: str) -> str:
    """Return last day of YYYY-MM period as a YYYY-MM-DD string."""
    try:
        year, month = int(period[:4]), int(period[5:7])
        last_day = _calendar_mod.monthrange(year, month)[1]
        return f"{year:04d}-{month:02d}-{last_day:02d}"
    except Exception:
        return period


async def get_bench_pool(
    branch_location_id: str,
    skill_filter: Optional[str] = None,
    location_filter: Optional[str] = None,
    classification_filter: Optional[str] = None,
    designation_filter: Optional[str] = None,
    utilisation_min: Optional[float] = None,
    utilisation_max: Optional[float] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """
    Query UtilisationSnapshot for bench/partially_billed employees.

    Joins with Employee (designation, department, location), EmployeeSkill,
    and EmployeeProject. Filters by skill, location, classification,
    designation, utilisation range, and search term.
    """
    # Step 0: Find the latest period for this branch to avoid mixing months
    latest_snap = await UtilisationSnapshot.find(
        UtilisationSnapshot.branch_location_id == branch_location_id,
    ).sort(-UtilisationSnapshot.period).limit(1).to_list()

    if not latest_snap:
        return {
            "employees": [],
            "total": 0,
            "bench_count": 0,
            "partial_count": 0,
        }

    latest_period = latest_snap[0].period

    # Step 1: Find snapshots where classification is bench or partially_billed
    # Exclude corporate-level employees (c-suite, vp)
    CORPORATE_LEVELS = {"c-suite", "vp"}
    snapshot_filters: list = [
        UtilisationSnapshot.branch_location_id == branch_location_id,
        UtilisationSnapshot.period == latest_period,
        {"employee_level": {"$nin": list(CORPORATE_LEVELS)}},
    ]

    if classification_filter and classification_filter in ("bench", "partially_billed"):
        snapshot_filters.append(UtilisationSnapshot.classification == classification_filter)
    else:
        snapshot_filters.append(
            {"classification": {"$in": ["bench", "partially_billed"]}}
        )

    snapshots = await UtilisationSnapshot.find(*snapshot_filters).to_list()

    if not snapshots:
        return {
            "employees": [],
            "total": 0,
            "bench_count": 0,
            "partial_count": 0,
        }

    employee_ids = [s.employee_id for s in snapshots]
    snapshot_map = {s.employee_id: s for s in snapshots}

    # Step 2: Fetch employees
    employees = await Employee.find(
        {"_id": {"$in": [ObjectId(eid) for eid in employee_ids if ObjectId.is_valid(eid)]}}
    ).to_list()
    emp_map = {str(e.id): e for e in employees}

    # Step 3: Fetch departments and locations for lookups
    dept_ids = list({e.department_id for e in employees if e.department_id})
    loc_ids = list({e.location_id for e in employees if e.location_id})

    departments = await Department.find(
        {"_id": {"$in": [ObjectId(did) for did in dept_ids if ObjectId.is_valid(did)]}}
    ).to_list()
    dept_map = {str(d.id): d.name for d in departments}

    locations = await Location.find(
        {"_id": {"$in": [ObjectId(lid) for lid in loc_ids if ObjectId.is_valid(lid)]}}
    ).to_list()
    loc_map = {str(l.id): f"{l.city}, {l.country}" for l in locations}
    loc_code_map = {str(l.id): l.code for l in locations}

    # Step 4: Fetch skills for all employees in one query
    all_skills = await EmployeeSkill.find(
        {"employee_id": {"$in": employee_ids}}
    ).to_list()
    skills_by_emp: dict[str, list] = {}
    for skill in all_skills:
        skills_by_emp.setdefault(skill.employee_id, []).append(skill)

    # Step 5: Fetch project assignments and compute available_from dates
    all_assignments = await EmployeeProject.find(
        {"employee_id": {"$in": employee_ids}}
    ).to_list()
    project_ids = list({a.project_id for a in all_assignments})
    projects = await Project.find(
        {"_id": {"$in": [ObjectId(pid) for pid in project_ids if ObjectId.is_valid(pid)]}}
    ).to_list()
    proj_map = {str(p.id): p for p in projects}

    assignments_by_emp: dict[str, list] = {}
    # (employee_id, project_id) -> role — for enriching allocation-based last_projects
    ep_role_map: dict[tuple[str, str], str] = {}
    # Track earliest available_from per employee based on project end dates
    available_from_map: dict[str, Optional[str]] = {}

    for a in all_assignments:
        proj = proj_map.get(a.project_id)
        if proj:
            end_date_str = proj.end_date.strftime("%Y-%m-%d") if proj.end_date else None
            # is_deleted on the assignment means it was removed from HRMS (treat as historical)
            assignment_is_deleted = getattr(a, "is_deleted", False)
            assignments_by_emp.setdefault(a.employee_id, []).append({
                "project_id": a.project_id,
                "project_name": proj.name,
                # If the assignment was soft-deleted by HRMS sync, treat as completed/historical
                "status": "COMPLETED" if assignment_is_deleted else proj.status,
                "role": a.role_in_project,
                "end_date": end_date_str,
                "client_name": proj.client_name,
                "is_deleted": assignment_is_deleted,
            })
            if a.role_in_project:
                ep_role_map[(a.employee_id, a.project_id)] = a.role_in_project
            # For active (non-deleted) projects, track the latest end_date as available_from
            if not assignment_is_deleted and proj.status == "ACTIVE" and proj.end_date:
                end_str = proj.end_date.strftime("%Y-%m-%d")
                current = available_from_map.get(a.employee_id)
                if current is None or end_str > current:
                    available_from_map[a.employee_id] = end_str

    # Step 5.5: Fetch ProjectAllocation history for "last project" context.
    #
    # HRMS probe finding: all live projects have status="Active" with no end dates —
    # there are NO completed projects in HRMS. ProjectAllocation is the only reliable
    # source that tells us *when* an employee was last working on a project.
    #
    # Strategy:
    #   - Primary: use most recent ProjectAllocation records (works for live & demo)
    #   - Fallback: use EmployeeProject completed assignments (demo historical data)
    all_allocs = await ProjectAllocation.find(
        {
            "employee_id": {"$in": employee_ids},
            "allocated_days": {"$gt": 0},
        }
    ).sort(-ProjectAllocation.period).to_list()

    # Build per-employee allocation history: list of records sorted newest-first,
    # de-duplicated per project (keep most recent period for each project).
    alloc_last_by_emp: dict[str, list[dict]] = {}
    for alloc in all_allocs:
        eid_a = alloc.employee_id
        pid_a = alloc.project_id
        emp_allocs = alloc_last_by_emp.setdefault(eid_a, [])
        # Only keep the most recent entry per project (DB already sorted desc by period)
        if not any(a["project_id"] == pid_a for a in emp_allocs):
            emp_allocs.append({
                "project_id": pid_a,
                "project_name": alloc.project_name,
                "client_name": alloc.client_name,
                "period": alloc.period,  # YYYY-MM — most recent month this employee was on this project
                "end_date": _period_end_date(alloc.period),  # last day of that month
            })

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Step 6: Build result list with filters applied
    results = []
    bench_count = 0
    partial_count = 0

    for eid in employee_ids:
        emp = emp_map.get(eid)
        snapshot = snapshot_map.get(eid)
        if not emp or not snapshot:
            continue

        # Location filter
        if location_filter and loc_code_map.get(emp.location_id, "") != location_filter:
            continue

        # Designation filter
        if designation_filter and emp.designation.lower() != designation_filter.lower():
            continue

        # Utilisation range filter
        if utilisation_min is not None and snapshot.utilisation_percent < utilisation_min:
            continue
        if utilisation_max is not None and snapshot.utilisation_percent > utilisation_max:
            continue

        # Skill filter
        emp_skills = skills_by_emp.get(eid, [])
        if skill_filter:
            skill_names = [s.skill_name.lower() for s in emp_skills]
            if skill_filter.lower() not in skill_names:
                continue

        # Search filter (matches employee name or designation)
        if search:
            search_lower = search.lower()
            if (
                search_lower not in emp.name.lower()
                and search_lower not in emp.designation.lower()
            ):
                continue

        # Count classifications
        if snapshot.classification == "bench":
            bench_count += 1
        elif snapshot.classification == "partially_billed":
            partial_count += 1

        skill_responses = [
            {
                "id": str(s.id),
                "employee_id": s.employee_id,
                "skill_name": s.skill_name,
                "proficiency": s.proficiency,
                "added_by": s.added_by,
                "added_at": s.added_at,
                "notes": s.notes,
            }
            for s in emp_skills
        ]

        # Split assignments into active vs historical (completed or HRMS-removed)
        all_emp_assignments = assignments_by_emp.get(eid, [])
        active_projects = [
            a for a in all_emp_assignments
            if a["status"] in ("ACTIVE", "ON_HOLD") and not a.get("is_deleted")
        ]

        # --- Last projects: PRIMARY = ProjectAllocation history ---
        # HRMS has all projects as "Active" — allocation records are the only
        # reliable signal that tells us when an employee last worked on a project.
        alloc_history = alloc_last_by_emp.get(eid, [])

        if alloc_history:
            # Build last_projects from allocation data (newest first, max 3 projects)
            last_projects = []
            for alloc_rec in alloc_history[:3]:
                role = ep_role_map.get((eid, alloc_rec["project_id"]), "")
                last_projects.append({
                    "project_id": alloc_rec["project_id"],
                    "project_name": alloc_rec["project_name"],
                    "status": "COMPLETED",
                    "role": role,
                    "end_date": alloc_rec["end_date"],    # last day of most-recent allocation period
                    "client_name": alloc_rec["client_name"],
                    "period": alloc_rec["period"],         # "2026-01" — human-readable context
                })
            bench_since = last_projects[0]["end_date"] if last_projects else None
        else:
            # FALLBACK: use EmployeeProject completed assignments (demo seeded data)
            last_projects = sorted(
                [a for a in all_emp_assignments if a["status"] == "COMPLETED" or a.get("is_deleted")],
                key=lambda a: a.get("end_date") or "",
                reverse=True,
            )[:3]
            completed_with_dates = [a for a in last_projects if a.get("end_date")]
            bench_since = completed_with_dates[0]["end_date"] if completed_with_dates else None

        # Bench duration in days
        bench_duration_days: Optional[int] = None
        if bench_since:
            try:
                since = date_type.fromisoformat(bench_since)
                bench_duration_days = (date_type.today() - since).days
            except Exception:
                pass

        # Compute available_from: if bench with no active projects, available now
        # If partially_billed with active projects, use latest project end_date
        avail_from = available_from_map.get(eid)
        if snapshot.classification == "bench" and not active_projects:
            avail_from = now_str  # Available immediately
        elif avail_from is None:
            avail_from = now_str  # No active project end date known = available now

        def _strip_internal(projects: list) -> list:
            """Remove internal-only keys before returning to API."""
            return [
                {k: v for k, v in p.items() if k != "is_deleted"}
                for p in projects
            ]

        results.append({
            "employee_id": eid,
            "employee_name": emp.name,
            "designation": emp.designation,
            "department": dept_map.get(emp.department_id, "Unknown"),
            "location": loc_map.get(emp.location_id, "Unknown"),
            "skills": skill_responses,
            "utilisation_percent": snapshot.utilisation_percent,
            "classification": snapshot.classification,
            "available_from": avail_from,
            "current_projects": _strip_internal(active_projects),
            "active_projects": _strip_internal(active_projects),
            "last_projects": _strip_internal(last_projects),
            "bench_since": bench_since,
            "bench_duration_days": bench_duration_days,
        })

    total = len(results)

    # Compute avg bench duration across all bench employees with known bench_since
    bench_durations = [
        r["bench_duration_days"]
        for r in results
        if r["classification"] == "bench" and r["bench_duration_days"] is not None
    ]
    avg_bench_days = round(sum(bench_durations) / len(bench_durations)) if bench_durations else None

    # Paginate
    skip = (page - 1) * page_size
    paginated = results[skip : skip + page_size]

    return {
        "employees": paginated,
        "total": total,
        "bench_count": bench_count,
        "partial_count": partial_count,
        "avg_bench_days": avg_bench_days,
    }


async def get_locations() -> list[dict]:
    """Return all locations for filter dropdowns."""
    locs = await Location.find_all().sort(Location.code).to_list()
    return [
        {"code": l.code, "label": f"{l.city}, {l.country}"}
        for l in locs
    ]


async def get_bench_designations(branch_location_id: str) -> list[str]:
    """Return distinct designations among bench/partially_billed employees."""
    latest_snap = await UtilisationSnapshot.find(
        UtilisationSnapshot.branch_location_id == branch_location_id,
    ).sort(-UtilisationSnapshot.period).limit(1).to_list()

    if not latest_snap:
        return []

    snapshots = await UtilisationSnapshot.find(
        UtilisationSnapshot.branch_location_id == branch_location_id,
        UtilisationSnapshot.period == latest_snap[0].period,
        {"classification": {"$in": ["bench", "partially_billed"]}},
    ).to_list()

    employee_ids = [s.employee_id for s in snapshots]
    if not employee_ids:
        return []

    employees = await Employee.find(
        {"_id": {"$in": [ObjectId(eid) for eid in employee_ids if ObjectId.is_valid(eid)]}}
    ).to_list()

    designations = sorted({e.designation for e in employees})
    return designations


async def get_employee_skills(employee_id: str) -> list[dict]:
    """Return list of EmployeeSkill records for an employee."""
    skills = await EmployeeSkill.find(
        EmployeeSkill.employee_id == employee_id
    ).to_list()

    return [
        {
            "id": str(s.id),
            "employee_id": s.employee_id,
            "skill_name": s.skill_name,
            "proficiency": s.proficiency,
            "added_by": s.added_by,
            "added_at": s.added_at,
            "notes": s.notes,
        }
        for s in skills
    ]


async def add_employee_skill(employee_id: str, skill_data: dict, user) -> dict:
    """Create an EmployeeSkill record and log the change."""
    now = datetime.now(timezone.utc)

    # Check if skill already exists for this employee
    existing = await EmployeeSkill.find_one(
        EmployeeSkill.employee_id == employee_id,
        EmployeeSkill.skill_name == skill_data["skill_name"],
    )
    if existing:
        raise ValueError(
            f"Skill '{skill_data['skill_name']}' already exists for employee {employee_id}"
        )

    skill = EmployeeSkill(
        employee_id=employee_id,
        skill_name=skill_data["skill_name"],
        proficiency=skill_data.get("proficiency", "intermediate"),
        added_by=user.user_id,
        added_at=now,
        notes=skill_data.get("notes"),
    )
    await skill.insert()

    await audit_service.log_change(
        action="SKILL_TAG",
        entity_type="EmployeeSkill",
        entity_id=str(skill.id),
        changed_by=user.user_id,
        branch_location_id=user.branch_location_id,
        new_value={
            "employee_id": employee_id,
            "skill_name": skill.skill_name,
            "proficiency": skill.proficiency,
        },
    )

    return {
        "id": str(skill.id),
        "employee_id": skill.employee_id,
        "skill_name": skill.skill_name,
        "proficiency": skill.proficiency,
        "added_by": skill.added_by,
        "added_at": skill.added_at,
        "notes": skill.notes,
    }


async def remove_employee_skill(employee_id: str, skill_name: str, user) -> dict:
    """Delete an EmployeeSkill record and log the change."""
    skill = await EmployeeSkill.find_one(
        EmployeeSkill.employee_id == employee_id,
        EmployeeSkill.skill_name == skill_name,
    )
    if not skill:
        raise ValueError(
            f"Skill '{skill_name}' not found for employee {employee_id}"
        )

    skill_id = str(skill.id)
    await skill.delete()

    await audit_service.log_change(
        action="DELETE",
        entity_type="EmployeeSkill",
        entity_id=skill_id,
        changed_by=user.user_id,
        branch_location_id=user.branch_location_id,
        old_value={
            "employee_id": employee_id,
            "skill_name": skill_name,
            "proficiency": skill.proficiency,
        },
    )

    return {"deleted": True, "employee_id": employee_id, "skill_name": skill_name}


async def get_skill_catalog(category: Optional[str] = None) -> list[dict]:
    """List SkillCatalog entries, optionally filtered by category."""
    if category:
        entries = await SkillCatalog.find(
            SkillCatalog.category == category
        ).sort(SkillCatalog.name).to_list()
    else:
        entries = await SkillCatalog.find_all().sort(SkillCatalog.name).to_list()

    return [
        {
            "id": str(e.id),
            "name": e.name,
            "category": e.category,
            "display_name": e.display_name,
        }
        for e in entries
    ]


async def search_skill_catalog(query: str) -> list[dict]:
    """Search SkillCatalog by name or display_name (case-insensitive contains)."""
    entries = await SkillCatalog.find(
        {"$or": [
            {"name": {"$regex": query, "$options": "i"}},
            {"display_name": {"$regex": query, "$options": "i"}},
        ]}
    ).sort(SkillCatalog.name).to_list()

    return [
        {
            "id": str(e.id),
            "name": e.name,
            "category": e.category,
            "display_name": e.display_name,
        }
        for e in entries
    ]
