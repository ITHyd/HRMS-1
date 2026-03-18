"""
Assign skills from the Skills Portal catalog to our employees.
Maps designation keywords → relevant skill categories, then picks skills from those categories.
"""
import asyncio
import random
import httpx
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.database import init_db
from app.models.employee import Employee
from app.models.employee_skill import EmployeeSkill
from app.models.skill_catalog import SkillCatalog
from datetime import datetime, timezone

# Designation keyword → preferred skill categories
DESIGNATION_SKILL_MAP = {
    "engineer": ["Technical Foundations", "Software Development", "Solution Design", "Delivery Excellence"],
    "developer": ["Technical Foundations", "Software Development", "Solution Design", "Techincal Skills"],
    "architect": ["Technical Foundations", "Solution Design", "Delivery Excellence", "Leadership & Collaboration"],
    "manager": ["Leadership & Collaboration", "Delivery & Execution", "Communication & Stakeholder Engagement", "Analytical & Problem Solving"],
    "analyst": ["Analytical & Problem Solving", "Domain Knowledge", "Tools & Techniques", "Delivery & Execution"],
    "consultant": ["Domain Knowledge", "Communication & Stakeholder Engagement", "Analytical & Problem Solving", "Delivery & Execution"],
    "lead": ["Leadership & Collaboration", "Technical Foundations", "Software Development", "Delivery Excellence"],
    "scada": ["SCADA Consultant", "OT Consultant", "Technical Foundations"],
    "ot": ["OT Consultant", "SCADA Consultant", "Technical Foundations"],
    "data": ["Techincal Skills", "Technical Foundations", "Analytical & Problem Solving"],
    "hr": ["Communication & Stakeholder Engagement", "Soft Skills", "Mandatory Company Skill"],
    "finance": ["Analytical & Problem Solving", "Tools & Techniques", "Domain Knowledge"],
    "director": ["Leadership & Collaboration", "Communication & Stakeholder Engagement", "Analytical & Problem Solving"],
    "head": ["Leadership & Collaboration", "Communication & Stakeholder Engagement", "Delivery & Execution"],
    "intern": ["Technical Foundations", "Soft Skills", "Mandatory Company Skill"],
    "default": ["Technical Foundations", "Soft Skills", "Mandatory Company Skill", "Delivery & Execution"],
}

PROFICIENCY_BY_LEVEL = {
    "intern": ["beginner", "beginner", "intermediate"],
    "junior": ["beginner", "intermediate", "intermediate"],
    "mid": ["intermediate", "intermediate", "advanced"],
    "senior": ["intermediate", "advanced", "advanced", "expert"],
    "lead": ["advanced", "advanced", "expert"],
    "manager": ["intermediate", "advanced", "expert"],
    "head": ["advanced", "expert"],
    "director": ["advanced", "expert"],
    "vp": ["expert"],
    "c-suite": ["expert"],
}


async def fetch_portal_skills():
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
        r = await c.post(
            f"{settings.SKILLS_BASE_URL}/api/auth/login",
            json={"email": settings.SKILLS_USERNAME, "password": settings.SKILLS_PASSWORD},
        )
        token = r.json().get("access_token", "")
        h = {"Authorization": f"Bearer {token}"}
        r2 = await c.get(f"{settings.SKILLS_BASE_URL}/api/skills", headers=h, params={"limit": 2000})
        return r2.json()


async def main():
    await init_db()

    print("Fetching skills from portal...")
    portal_skills = await fetch_portal_skills()
    print(f"Got {len(portal_skills)} skills from portal")

    # Build category → skills map (deduplicated by name)
    cat_skills: dict[str, list[dict]] = {}
    seen_names: set[str] = set()
    for s in portal_skills:
        name = s.get("name", "").strip()
        cat = s.get("category", "").strip()
        if name and cat and name not in seen_names:
            cat_skills.setdefault(cat, []).append(s)
            seen_names.add(name)

    # Upsert skill catalog
    await SkillCatalog.find_all().delete()
    catalog_docs = [
        SkillCatalog(name=s["name"], display_name=s["name"], category=s.get("category", ""))
        for s in portal_skills
        if s.get("name")
    ]
    if catalog_docs:
        await SkillCatalog.insert_many(catalog_docs)
    print(f"Upserted {len(catalog_docs)} skills into catalog")

    # Load all active employees
    employees = await Employee.find(Employee.is_active == True).to_list()
    print(f"Found {len(employees)} active employees")

    # Clear existing skills
    await EmployeeSkill.find_all().delete()

    now = datetime.now(timezone.utc)
    total_assigned = 0

    for emp in employees:
        desig_lower = (emp.designation or "").lower()
        level = emp.level or "mid"

        # Find matching category keys
        matched_cats: list[str] = []
        for keyword, cats in DESIGNATION_SKILL_MAP.items():
            if keyword != "default" and keyword in desig_lower:
                matched_cats.extend(cats)

        if not matched_cats:
            matched_cats = DESIGNATION_SKILL_MAP["default"]

        # Deduplicate and collect candidate skills
        seen_cats = set()
        candidate_skills: list[dict] = []
        for cat in matched_cats:
            if cat not in seen_cats:
                seen_cats.add(cat)
                candidate_skills.extend(cat_skills.get(cat, []))

        # Always add mandatory skills
        candidate_skills.extend(cat_skills.get("Mandatory Company Skill", []))
        candidate_skills.extend(cat_skills.get("Soft Skills", []))

        # Deduplicate candidates by name
        seen = set()
        unique_candidates = []
        for s in candidate_skills:
            n = s["name"]
            if n not in seen:
                seen.add(n)
                unique_candidates.append(s)

        # Pick 4–8 skills randomly
        num_skills = random.randint(4, 8)
        chosen = random.sample(unique_candidates, min(num_skills, len(unique_candidates)))

        # Proficiency pool based on level
        prof_pool = PROFICIENCY_BY_LEVEL.get(level, ["intermediate", "advanced"])

        skill_docs = []
        for s in chosen:
            proficiency = random.choice(prof_pool)
            skill_docs.append(
                EmployeeSkill(
                    employee_id=str(emp.id),
                    skill_name=s["name"],
                    proficiency=proficiency,
                    added_by="portal_catalog_sync",
                    added_at=now,
                    notes=f"Category: {s.get('category', '')}",
                )
            )

        if skill_docs:
            await EmployeeSkill.insert_many(skill_docs)
            total_assigned += len(skill_docs)

    print(f"Done. Assigned {total_assigned} skill records across {len(employees)} employees.")


if __name__ == "__main__":
    asyncio.run(main())
