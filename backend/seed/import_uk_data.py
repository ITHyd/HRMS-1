"""
Import UK organisation data from Excel spreadsheet into MongoDB.

Usage:
    cd backend
    python -m seed.import_uk_data
"""

import asyncio
import re
import pandas as pd
from datetime import datetime, timezone

from app.database import init_db
from app.models.location import Location
from app.models.department import Department
from app.models.employee import Employee
from app.models.reporting_relationship import ReportingRelationship
from app.models.user import User
from app.services.auth_service import hash_password

EXCEL_PATH = r"C:\Users\sahit\Downloads\Org details for Skills.xlsx"

# Grade -> level mapping
GRADE_MAP = {
    "U": "c-suite",
    "L3": "vp",
    "L2": "director",
    "L1": "manager",
    "C": "senior",
    "B": "mid",
    "A": "junior",
}


def clean_name(first, last):
    """Combine first+last, clean up whitespace, handle NaN."""
    parts = []
    if pd.notna(first):
        parts.append(str(first).strip())
    if pd.notna(last):
        parts.append(str(last).strip())
    name = " ".join(parts)
    # Collapse multiple spaces
    name = re.sub(r"\s+", " ", name).strip()
    return name


def clean_manager_name(mgr_raw):
    """Strip (interim), (COO), etc. and normalize for matching."""
    if pd.isna(mgr_raw):
        return None
    s = str(mgr_raw).strip()
    # Remove parenthetical suffixes
    s = re.sub(r"\s*\(.*?\)", "", s).strip()
    # Remove trailing whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s if s and s.lower() not in ("board", "nan") else None


async def main():
    print("Initializing database...")
    await init_db()

    # Read Excel
    df = pd.read_excel(EXCEL_PATH, sheet_name="Sheet1", header=None)

    # Parse rows (data starts at row index 4 in the DataFrame)
    raw_rows = []
    for i in range(4, len(df)):
        row = df.iloc[i]
        first = row[0]
        last = row[1]
        name = clean_name(first, last)

        # Skip TBA/empty rows
        if not name or name.lower().startswith("tba"):
            continue

        email = str(row[3]).strip() if pd.notna(row[3]) else None
        if email and email.lower() == "nan":
            email = None

        group = str(row[2]).strip() if pd.notna(row[2]) else "UK"
        function_ = str(row[4]).strip() if pd.notna(row[4]) else "General"
        practise = str(row[5]).strip() if pd.notna(row[5]) else None
        sub_practise = str(row[6]).strip() if pd.notna(row[6]) else None
        mgr_raw = row[8]
        role_title = str(row[10]).strip() if pd.notna(row[10]) else "Employee"
        grade = str(row[11]).strip() if pd.notna(row[11]) else "B"

        # Clean up practise/sub NaN
        if practise and practise.lower() == "nan":
            practise = None
        if sub_practise and sub_practise.lower() == "nan":
            sub_practise = None

        raw_rows.append({
            "name": name,
            "email": email,
            "group": group,
            "function": function_ if function_.lower() != "nan" else "General",
            "practise": practise,
            "sub_practise": sub_practise,
            "mgr_name_raw": mgr_raw,
            "mgr_name": clean_manager_name(mgr_raw),
            "role_title": role_title if role_title.lower() != "nan" else "Employee",
            "grade": grade if grade.lower() != "nan" else "B",
        })

    print(f"Parsed {len(raw_rows)} employees from Excel")

    # ---- 1. Create UK Location ----
    existing_uk = await Location.find(Location.code == "LON").to_list()
    if existing_uk:
        uk_loc = existing_uk[0]
        print(f"UK location already exists: id={uk_loc.id}")
    else:
        uk_loc = Location(city="London", country="United Kingdom", region="EMEA", code="LON")
        await uk_loc.insert()
        print(f"Created UK location: id={uk_loc.id}, code=LON")

    uk_loc_id = str(uk_loc.id)

    # ---- 2. Create Departments from functions ----
    functions = set()
    for r in raw_rows:
        f = r["function"]
        if f and f != "General":
            functions.add(f)
    functions.add("General")

    # Check existing departments for UK location
    existing_depts = await Department.find(Department.location_id == uk_loc_id).to_list()
    existing_dept_names = {d.name for d in existing_depts}
    dept_name_to_id = {d.name: str(d.id) for d in existing_depts}

    new_dept_count = 0
    for func in sorted(functions):
        if func not in existing_dept_names:
            dept = Department(name=func, location_id=uk_loc_id)
            await dept.insert()
            dept_name_to_id[func] = str(dept.id)
            new_dept_count += 1
        # else already mapped

    print(f"Departments: {new_dept_count} new, {len(existing_dept_names)} existing -> {len(dept_name_to_id)} total")

    # ---- 3. Create Employees ----
    # First check for existing employees by email to avoid duplicates
    all_existing = await Employee.find_all().to_list()
    existing_email_map = {}
    for e in all_existing:
        if e.email:
            existing_email_map[e.email.lower()] = e

    created_employees = []
    skipped = []
    email_to_employee = {}  # for manager resolution
    name_to_employee = {}   # fallback for manager resolution

    for r in raw_rows:
        # Skip if email already exists in DB
        if r["email"] and r["email"].lower() in existing_email_map:
            existing = existing_email_map[r["email"].lower()]
            skipped.append(f"{r['name']} ({r['email']}) -> already exists as {existing.name}")
            email_to_employee[r["email"].lower()] = existing
            # Also map by name for manager resolution
            name_key = r["name"].lower().strip()
            name_to_employee[name_key] = existing
            continue

        level = GRADE_MAP.get(r["grade"], "mid")
        dept_id = dept_name_to_id.get(r["function"], dept_name_to_id.get("General", ""))

        emp = Employee(
            name=r["name"],
            email=r["email"] or f"{r['name'].lower().replace(' ', '.')}@nxzen.com",
            designation=r["role_title"],
            department_id=dept_id,
            level=level,
            location_id=uk_loc_id,
            join_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
            photo_url=None,
            is_active=True,
        )
        await emp.insert()
        created_employees.append((emp, r))

        if r["email"]:
            email_to_employee[r["email"].lower()] = emp
        name_key = r["name"].lower().strip()
        name_to_employee[name_key] = emp

    print(f"Employees: {len(created_employees)} created, {len(skipped)} skipped (already exist)")
    for s in skipped:
        print(f"  SKIP: {s}")

    # Build comprehensive name lookup for manager resolution
    # Include ALL employees in DB (India + UK) for cross-location reporting
    all_employees = await Employee.find_all().to_list()
    all_name_map = {}
    for e in all_employees:
        key = e.name.lower().strip()
        all_name_map[key] = e
        # Also index by first+last combos
        parts = e.name.lower().split()
        if len(parts) >= 2:
            # first last
            all_name_map[f"{parts[0]} {parts[-1]}"] = e
            # first name only (for single-name managers like "Murshid")
        if len(parts) == 1:
            all_name_map[parts[0]] = e

    # ---- 4. Create Reporting Relationships ----
    rel_created = 0
    rel_failed = []

    for emp, r in created_employees:
        mgr_name = r["mgr_name"]
        if not mgr_name:
            continue

        # Try to find manager
        mgr_key = mgr_name.lower().strip()
        manager = all_name_map.get(mgr_key)

        # Try variations if not found
        if not manager:
            # Try first name + last name
            parts = mgr_key.split()
            if len(parts) >= 2:
                # Try "first last"
                manager = all_name_map.get(f"{parts[0]} {parts[-1]}")
            if not manager and len(parts) == 1:
                # Single name like "Murshid" - search broadly
                for ename, eemp in all_name_map.items():
                    if mgr_key in ename:
                        manager = eemp
                        break

        if not manager:
            # Fuzzy match: try substring matching
            for ename, eemp in all_name_map.items():
                name_parts = mgr_key.split()
                if len(name_parts) >= 2 and name_parts[0] in ename and name_parts[-1] in ename:
                    manager = eemp
                    break

        if manager and str(manager.id) != str(emp.id):
            rel = ReportingRelationship(
                employee_id=str(emp.id),
                manager_id=str(manager.id),
                type="PRIMARY",
            )
            await rel.insert()
            rel_created += 1
        elif not manager:
            rel_failed.append(f"{r['name']} -> manager '{mgr_name}' not found")

    print(f"\nReporting relationships: {rel_created} created, {len(rel_failed)} unresolved")
    for f in rel_failed:
        print(f"  UNRESOLVED: {f}")

    # ---- 5. Create UK Branch Head User ----
    # Martin Wells is UK CEO - make him the branch head
    uk_ceo = None
    for e in all_employees:
        if e.email and e.email.lower() == "martin.wells@nxzen.com":
            uk_ceo = e
            break

    if not uk_ceo:
        # Find from newly created
        for emp, r in created_employees:
            if r["email"] and r["email"].lower() == "martin.wells@nxzen.com":
                uk_ceo = emp
                break

    if uk_ceo:
        # Check if user already exists
        existing_user = await User.find(User.email == uk_ceo.email).to_list()
        if not existing_user:
            user = User(
                email=uk_ceo.email,
                password_hash=hash_password("password123"),
                employee_id=str(uk_ceo.id),
                branch_location_id=uk_loc_id,
                name=uk_ceo.name,
                role="branch_head",
            )
            await user.insert()
            print(f"\nUK branch head user created: {uk_ceo.email} / password123")
        else:
            print(f"\nUK branch head user already exists: {uk_ceo.email}")
    else:
        print("\nWARNING: Could not find Martin Wells to create UK branch head user")

    # ---- Summary ----
    print("\n" + "=" * 50)
    print("UK Data Import Complete!")
    print("=" * 50)
    print(f"  Location:      London (LON)")
    print(f"  Departments:   {len(dept_name_to_id)}")
    print(f"  Employees:     {len(created_employees)} new")
    print(f"  Relationships: {rel_created}")
    print(f"  Branch Head:   {uk_ceo.name if uk_ceo else 'N/A'} ({uk_ceo.email if uk_ceo else 'N/A'})")
    print()
    print("  Login accounts:")
    users = await User.find_all().to_list()
    for u in users:
        loc = await Location.get(u.branch_location_id)
        loc_name = loc.city if loc else "?"
        print(f"    {u.email} ({loc_name} - {u.role})")


if __name__ == "__main__":
    asyncio.run(main())
