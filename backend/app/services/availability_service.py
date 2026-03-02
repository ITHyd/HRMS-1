from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from app.models.employee import Employee
from app.models.employee_skill import EmployeeSkill
from app.models.skill_catalog import SkillCatalog
from app.models.employee_project import EmployeeProject
from app.models.project import Project
from app.models.department import Department
from app.models.location import Location
from app.models.utilisation_snapshot import UtilisationSnapshot
from app.services import audit_service


async def get_bench_pool(
    branch_location_id: str,
    skill_filter: Optional[str] = None,
    location_filter: Optional[str] = None,
    classification_filter: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """
    Query UtilisationSnapshot for bench/partially_billed employees.

    Joins with Employee (designation, department, location), EmployeeSkill,
    and EmployeeProject. Optionally filters by skill, location, classification,
    and search term. Returns a BenchPoolResponse-shaped dict.
    """
    # Step 1: Find snapshots where classification is bench or partially_billed
    snapshot_filters: list = [
        UtilisationSnapshot.branch_location_id == branch_location_id,
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

    # Step 5: Fetch project assignments for all employees
    all_assignments = await EmployeeProject.find(
        {"employee_id": {"$in": employee_ids}}
    ).to_list()
    project_ids = list({a.project_id for a in all_assignments})
    projects = await Project.find(
        {"_id": {"$in": [ObjectId(pid) for pid in project_ids if ObjectId.is_valid(pid)]}}
    ).to_list()
    proj_map = {str(p.id): p for p in projects}

    assignments_by_emp: dict[str, list] = {}
    for a in all_assignments:
        proj = proj_map.get(a.project_id)
        if proj:
            assignments_by_emp.setdefault(a.employee_id, []).append({
                "project_id": a.project_id,
                "project_name": proj.name,
                "status": proj.status,
                "role": a.role_in_project,
            })

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

        results.append({
            "employee_id": eid,
            "employee_name": emp.name,
            "designation": emp.designation,
            "department": dept_map.get(emp.department_id, "Unknown"),
            "location": loc_map.get(emp.location_id, "Unknown"),
            "skills": skill_responses,
            "utilisation_percent": snapshot.utilisation_percent,
            "classification": snapshot.classification,
            "available_from": None,
            "current_projects": assignments_by_emp.get(eid, []),
        })

    total = len(results)

    # Paginate
    skip = (page - 1) * page_size
    paginated = results[skip : skip + page_size]

    return {
        "employees": paginated,
        "total": total,
        "bench_count": bench_count,
        "partial_count": partial_count,
    }


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
    """Search SkillCatalog by name (case-insensitive contains)."""
    entries = await SkillCatalog.find(
        {"name": {"$regex": query, "$options": "i"}}
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
