import asyncio
from typing import Optional

from bson import ObjectId

from app.models.department import Department
from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.employee_skill import EmployeeSkill
from app.models.location import Location
from app.models.project import Project
from app.models.skill_catalog import SkillCatalog

CORPORATE_LEVELS = {"c-suite", "vp"}


async def global_search(
    query: str,
    branch_location_id: str,
    employee_limit: int = 5,
    project_limit: int = 5,
    skill_limit: int = 5,
    department_limit: int = 3,
) -> dict:
    """Search across employees, projects, skills, and departments. Branch-scoped."""
    employees, projects, skills, departments = await asyncio.gather(
        _search_employees(query, branch_location_id, employee_limit),
        _search_projects(query, branch_location_id, project_limit),
        _search_skills(query, branch_location_id, skill_limit),
        _search_departments(query, branch_location_id, department_limit),
    )

    return {
        "query": query,
        "employees": employees,
        "projects": projects,
        "skills": skills,
        "departments": departments,
    }


async def _search_employees(query: str, branch_location_id: str, limit: int) -> dict:
    filters = {
        "location_id": branch_location_id,
        "is_active": True,
        "level": {"$nin": list(CORPORATE_LEVELS)},
    }

    # Find employees matching by name/email/designation
    name_cond = {
        "$and": [
            filters,
            {"$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}},
                {"designation": {"$regex": query, "$options": "i"}},
            ]},
        ]
    }
    name_matches = await Employee.find(name_cond).to_list()

    # Also find employees matching by skill name
    skill_records = await EmployeeSkill.find(
        {"skill_name": {"$regex": query, "$options": "i"}}
    ).to_list()
    skill_emp_ids = list({es.employee_id for es in skill_records})

    if skill_emp_ids:
        skill_matches = await Employee.find(
            {"_id": {"$in": [ObjectId(eid) for eid in skill_emp_ids if ObjectId.is_valid(eid)]},
             **filters}
        ).to_list()
    else:
        skill_matches = []

    # Merge and deduplicate
    seen_ids: set[str] = set()
    employees: list = []
    for emp in name_matches + skill_matches:
        eid = str(emp.id)
        if eid not in seen_ids:
            seen_ids.add(eid)
            employees.append(emp)

    total = len(employees)
    employees = employees[:limit]

    dept_ids = list({e.department_id for e in employees if e.department_id})
    depts = await Department.find(
        {"_id": {"$in": [ObjectId(d) for d in dept_ids if ObjectId.is_valid(d)]}}
    ).to_list() if dept_ids else []
    dept_map = {str(d.id): d.name for d in depts}

    loc_ids = list({e.location_id for e in employees if e.location_id})
    locs = await Location.find(
        {"_id": {"$in": [ObjectId(l) for l in loc_ids if ObjectId.is_valid(l)]}}
    ).to_list() if loc_ids else []
    loc_map = {str(l.id): l for l in locs}

    items = []
    for emp in employees:
        loc = loc_map.get(emp.location_id)
        items.append({
            "id": str(emp.id),
            "name": emp.name,
            "designation": emp.designation,
            "department": dept_map.get(emp.department_id, "Unknown"),
            "department_id": emp.department_id,
            "level": emp.level,
            "location_code": loc.code if loc else "UNK",
            "photo_url": emp.photo_url,
            "is_active": emp.is_active,
        })

    return {"items": items, "total": total}


async def _search_projects(query: str, branch_location_id: str, limit: int) -> dict:
    branch_emps = await Employee.find(
        Employee.location_id == branch_location_id,
    ).to_list()
    branch_emp_ids = [str(e.id) for e in branch_emps]

    assignments = await EmployeeProject.find(
        {"employee_id": {"$in": branch_emp_ids}}
    ).to_list()
    proj_ids = list({a.project_id for a in assignments})

    if not proj_ids:
        return {"items": [], "total": 0}

    projects = await Project.find(
        {"_id": {"$in": [ObjectId(pid) for pid in proj_ids if ObjectId.is_valid(pid)]}}
    ).to_list()

    query_lower = query.lower()
    matched = [p for p in projects if query_lower in p.name.lower()]
    total = len(matched)
    matched = matched[:limit]

    member_counts: dict[str, int] = {}
    for a in assignments:
        member_counts[a.project_id] = member_counts.get(a.project_id, 0) + 1

    dept_ids = list({p.department_id for p in matched if p.department_id})
    depts = await Department.find(
        {"_id": {"$in": [ObjectId(d) for d in dept_ids if ObjectId.is_valid(d)]}}
    ).to_list() if dept_ids else []
    dept_map = {str(d.id): d.name for d in depts}

    items = []
    for p in matched:
        items.append({
            "id": str(p.id),
            "name": p.name,
            "status": p.status,
            "project_type": p.project_type,
            "department_name": dept_map.get(p.department_id, "Unknown"),
            "member_count": member_counts.get(str(p.id), 0),
        })

    return {"items": items, "total": total}


async def _search_skills(query: str, branch_location_id: str, limit: int) -> dict:
    catalog_entries = await SkillCatalog.find(
        {"$or": [
            {"name": {"$regex": query, "$options": "i"}},
            {"display_name": {"$regex": query, "$options": "i"}},
        ]}
    ).sort(SkillCatalog.name).to_list()

    total = len(catalog_entries)
    catalog_entries = catalog_entries[:limit]

    if not catalog_entries:
        return {"items": [], "total": 0}

    branch_emps = await Employee.find(
        {"location_id": branch_location_id, "is_active": True,
         "level": {"$nin": list(CORPORATE_LEVELS)}}
    ).to_list()
    branch_emp_ids = {str(e.id) for e in branch_emps}

    skill_names = [entry.name for entry in catalog_entries]
    all_emp_skills = await EmployeeSkill.find(
        {"skill_name": {"$in": skill_names}}
    ).to_list()

    skill_count_map: dict[str, int] = {}
    for es in all_emp_skills:
        if es.employee_id in branch_emp_ids:
            skill_count_map[es.skill_name] = skill_count_map.get(es.skill_name, 0) + 1

    items = []
    for entry in catalog_entries:
        items.append({
            "id": str(entry.id),
            "name": entry.name,
            "display_name": entry.display_name,
            "category": entry.category,
            "employee_count": skill_count_map.get(entry.name, 0),
        })

    return {"items": items, "total": total}


async def _search_departments(query: str, branch_location_id: str, limit: int) -> dict:
    departments = await Department.find(
        {"name": {"$regex": query, "$options": "i"},
         "location_id": branch_location_id}
    ).sort(Department.name).to_list()

    total = len(departments)
    departments = departments[:limit]

    if not departments:
        return {"items": [], "total": 0}

    dept_ids = [str(d.id) for d in departments]
    employees = await Employee.find(
        {"department_id": {"$in": dept_ids},
         "location_id": branch_location_id,
         "is_active": True,
         "level": {"$nin": list(CORPORATE_LEVELS)}}
    ).to_list()

    count_map: dict[str, int] = {}
    for emp in employees:
        count_map[emp.department_id] = count_map.get(emp.department_id, 0) + 1

    items = []
    for dept in departments:
        items.append({
            "id": str(dept.id),
            "name": dept.name,
            "employee_count": count_map.get(str(dept.id), 0),
        })

    return {"items": items, "total": total}


async def get_employees_by_skill(
    skill_name: str,
    branch_location_id: str,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Get all branch employees who have a specific skill, with proficiency info."""
    emp_skills = await EmployeeSkill.find(
        {"skill_name": {"$regex": f"^{skill_name}$", "$options": "i"}}
    ).to_list()

    employee_ids = [es.employee_id for es in emp_skills]
    proficiency_map = {es.employee_id: es.proficiency for es in emp_skills}

    if not employee_ids:
        return {"employees": [], "total": 0, "skill_name": skill_name}

    employees = await Employee.find(
        {"_id": {"$in": [ObjectId(eid) for eid in employee_ids if ObjectId.is_valid(eid)]},
         "location_id": branch_location_id,
         "is_active": True,
         "level": {"$nin": list(CORPORATE_LEVELS)}}
    ).to_list()

    dept_ids = list({e.department_id for e in employees if e.department_id})
    depts = await Department.find(
        {"_id": {"$in": [ObjectId(d) for d in dept_ids if ObjectId.is_valid(d)]}}
    ).to_list() if dept_ids else []
    dept_map = {str(d.id): d.name for d in depts}

    loc_ids = list({e.location_id for e in employees if e.location_id})
    locs = await Location.find(
        {"_id": {"$in": [ObjectId(l) for l in loc_ids if ObjectId.is_valid(l)]}}
    ).to_list() if loc_ids else []
    loc_map = {str(l.id): l for l in locs}

    results = []
    for emp in employees:
        eid = str(emp.id)
        loc = loc_map.get(emp.location_id)
        results.append({
            "id": eid,
            "name": emp.name,
            "email": emp.email,
            "designation": emp.designation,
            "department": dept_map.get(emp.department_id, "Unknown"),
            "level": emp.level,
            "location": f"{loc.city}, {loc.country}" if loc else "Unknown",
            "location_code": loc.code if loc else "UNK",
            "proficiency": proficiency_map.get(eid, "unknown"),
        })

    total = len(results)
    skip = (page - 1) * page_size
    paginated = results[skip: skip + page_size]

    return {"employees": paginated, "total": total, "skill_name": skill_name}
