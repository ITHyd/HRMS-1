"""
Seed data generator for Branch Command Center.
Creates ~80 employees across 4 locations with realistic org hierarchy.

Usage: cd backend && python -m seed.seed_data
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pymongo import AsyncMongoClient
from beanie import init_beanie
import bcrypt

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.models.employee import Employee
from app.models.reporting_relationship import ReportingRelationship
from app.models.location import Location
from app.models.department import Department
from app.models.project import Project
from app.models.employee_project import EmployeeProject
from app.models.audit_log import AuditLog
from app.models.user import User

ALL_MODELS = [Employee, ReportingRelationship, Location, Department, Project, EmployeeProject, AuditLog, User]


def date(y, m, d):
    return datetime(y, m, d, tzinfo=timezone.utc)


async def seed():
    client = AsyncMongoClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    await init_beanie(database=db, document_models=ALL_MODELS)

    # Drop all collections
    for model in ALL_MODELS:
        await model.find_all().delete()

    print("Cleared all collections.")

    # ── Locations ──
    loc_hyd = Location(city="Hyderabad", country="India", region="APAC", code="HYD")
    loc_blr = Location(city="Bangalore", country="India", region="APAC", code="BLR")
    loc_lon = Location(city="London", country="UK", region="EMEA", code="LON")
    loc_syd = Location(city="Sydney", country="Australia", region="APAC", code="SYD")

    for loc in [loc_hyd, loc_blr, loc_lon, loc_syd]:
        await loc.insert()
    print(f"Created {4} locations.")

    HYD = str(loc_hyd.id)
    BLR = str(loc_blr.id)
    LON = str(loc_lon.id)
    SYD = str(loc_syd.id)

    # ── Departments ──
    depts = {}
    dept_data = [
        ("Engineering", HYD), ("Engineering", BLR), ("Engineering", LON), ("Engineering", SYD),
        ("Product", HYD), ("Product", LON),
        ("Design", HYD), ("Design", BLR),
        ("Operations", HYD), ("Operations", LON), ("Operations", SYD),
        ("HR", HYD), ("HR", LON),
        ("Finance", HYD),
        ("Sales", LON), ("Sales", SYD),
    ]
    for name, loc_id in dept_data:
        d = Department(name=name, location_id=loc_id)
        await d.insert()
        depts[(name, loc_id)] = str(d.id)
    print(f"Created {len(depts)} departments.")

    # ── Helper to create employee ──
    employees = {}

    async def emp(name, email, designation, dept_key, level, loc_id, join_date):
        dept_id = depts[dept_key]
        e = Employee(
            name=name, email=email, designation=designation,
            department_id=dept_id, level=level, location_id=loc_id,
            join_date=join_date,
        )
        await e.insert()
        employees[email] = str(e.id)
        return str(e.id)

    # ── CEO & C-Suite ──
    ceo = await emp("Rajesh Kumar", "rajesh.kumar@company.com", "Chief Executive Officer", ("Operations", HYD), "c-suite", HYD, date(2015, 1, 10))
    cto = await emp("Sahith Reddy", "sahith.reddy@company.com", "Chief Technology Officer", ("Engineering", HYD), "c-suite", HYD, date(2016, 3, 15))
    cpo = await emp("Anita Sharma", "anita.sharma@company.com", "Chief Product Officer", ("Product", HYD), "c-suite", HYD, date(2016, 6, 1))
    coo = await emp("James Mitchell", "james.mitchell@company.com", "Chief Operating Officer", ("Operations", LON), "c-suite", LON, date(2016, 9, 20))
    chro = await emp("Priya Nair", "priya.nair@company.com", "Chief HR Officer", ("HR", HYD), "c-suite", HYD, date(2017, 1, 5))
    cfo = await emp("David Chen", "david.chen@company.com", "Chief Financial Officer", ("Finance", HYD), "c-suite", HYD, date(2017, 4, 12))

    # ── VPs ──
    vp_eng_india = await emp("Vikram Patel", "vikram.patel@company.com", "VP Engineering India", ("Engineering", HYD), "vp", HYD, date(2017, 7, 1))
    vp_eng_emea = await emp("Sophie Williams", "sophie.williams@company.com", "VP Engineering EMEA", ("Engineering", LON), "vp", LON, date(2018, 1, 15))
    vp_eng_apac = await emp("Michael Torres", "michael.torres@company.com", "VP Engineering APAC", ("Engineering", SYD), "vp", SYD, date(2018, 3, 10))
    vp_product = await emp("Neha Gupta", "neha.gupta@company.com", "VP Product", ("Product", HYD), "vp", HYD, date(2018, 5, 1))
    vp_ops = await emp("Robert Brown", "robert.brown@company.com", "VP Operations", ("Operations", LON), "vp", LON, date(2018, 8, 20))

    # ── Directors ──
    dir_eng_hyd = await emp("Arjun Mehta", "arjun.mehta@company.com", "Director of Engineering", ("Engineering", HYD), "director", HYD, date(2019, 1, 10))
    dir_eng_blr = await emp("Kavitha Rao", "kavitha.rao@company.com", "Director of Engineering", ("Engineering", BLR), "director", BLR, date(2019, 3, 5))
    dir_design = await emp("Deepa Krishnan", "deepa.krishnan@company.com", "Director of Design", ("Design", HYD), "director", HYD, date(2019, 6, 15))
    dir_sales_lon = await emp("Emma Thompson", "emma.thompson@company.com", "Director of Sales", ("Sales", LON), "director", LON, date(2019, 4, 1))
    dir_sales_syd = await emp("Liam O'Brien", "liam.obrien@company.com", "Director of Sales", ("Sales", SYD), "director", SYD, date(2019, 7, 20))

    # ── Engineering Managers ──
    mgr_backend_hyd = await emp("Ravi Shankar", "ravi.shankar@company.com", "Engineering Manager - Backend", ("Engineering", HYD), "manager", HYD, date(2019, 9, 1))
    mgr_frontend_hyd = await emp("Sneha Verma", "sneha.verma@company.com", "Engineering Manager - Frontend", ("Engineering", HYD), "manager", HYD, date(2019, 10, 15))
    mgr_mobile_hyd = await emp("Karthik Reddy", "karthik.reddy@company.com", "Engineering Manager - Mobile", ("Engineering", HYD), "manager", HYD, date(2020, 1, 10))
    mgr_eng_blr = await emp("Arun Kumar", "arun.kumar@company.com", "Engineering Manager", ("Engineering", BLR), "manager", BLR, date(2020, 2, 1))
    mgr_devops_blr = await emp("Suresh Babu", "suresh.babu@company.com", "DevOps Manager", ("Engineering", BLR), "manager", BLR, date(2020, 4, 15))
    mgr_eng_lon = await emp("Oliver Clark", "oliver.clark@company.com", "Engineering Manager", ("Engineering", LON), "manager", LON, date(2020, 3, 1))
    mgr_eng_syd = await emp("Sarah Connor", "sarah.connor@company.com", "Engineering Manager", ("Engineering", SYD), "manager", SYD, date(2020, 5, 10))

    # ── Product Managers ──
    pm_hyd = await emp("Meera Joshi", "meera.joshi@company.com", "Product Manager", ("Product", HYD), "manager", HYD, date(2020, 6, 1))
    pm_lon = await emp("Charlotte Davis", "charlotte.davis@company.com", "Product Manager", ("Product", LON), "manager", LON, date(2020, 7, 15))

    # ── Design Leads ──
    lead_design_hyd = await emp("Pranav Sinha", "pranav.sinha@company.com", "Design Lead", ("Design", HYD), "lead", HYD, date(2020, 8, 1))
    lead_design_blr = await emp("Divya Agarwal", "divya.agarwal@company.com", "Design Lead", ("Design", BLR), "lead", BLR, date(2020, 9, 10))

    # ── Operations Managers ──
    mgr_ops_hyd = await emp("Ramesh Iyer", "ramesh.iyer@company.com", "Operations Manager", ("Operations", HYD), "manager", HYD, date(2020, 10, 1))
    mgr_ops_lon = await emp("George Wilson", "george.wilson@company.com", "Operations Manager", ("Operations", LON), "manager", LON, date(2020, 11, 15))
    mgr_ops_syd = await emp("Daniel Kim", "daniel.kim@company.com", "Operations Manager", ("Operations", SYD), "manager", SYD, date(2021, 1, 5))

    # ── HR Managers ──
    mgr_hr_hyd = await emp("Lakshmi Menon", "lakshmi.menon@company.com", "HR Manager", ("HR", HYD), "manager", HYD, date(2021, 2, 10))
    mgr_hr_lon = await emp("Alice Johnson", "alice.johnson@company.com", "HR Manager", ("HR", LON), "manager", LON, date(2021, 3, 1))

    # ── Senior Engineers (HYD) ──
    se1_hyd = await emp("Ganesh Yadav", "ganesh.yadav@company.com", "Senior Backend Engineer", ("Engineering", HYD), "senior", HYD, date(2021, 4, 1))
    se2_hyd = await emp("Pooja Deshmukh", "pooja.deshmukh@company.com", "Senior Frontend Engineer", ("Engineering", HYD), "senior", HYD, date(2021, 5, 15))
    se3_hyd = await emp("Nikhil Sharma", "nikhil.sharma@company.com", "Senior Mobile Engineer", ("Engineering", HYD), "senior", HYD, date(2021, 6, 1))
    se4_hyd = await emp("Anjali Reddy", "anjali.reddy@company.com", "Senior Backend Engineer", ("Engineering", HYD), "senior", HYD, date(2021, 7, 10))

    # ── Mid Engineers (HYD) ──
    me1_hyd = await emp("Rohit Kapoor", "rohit.kapoor@company.com", "Backend Engineer", ("Engineering", HYD), "mid", HYD, date(2022, 1, 10))
    me2_hyd = await emp("Swati Mishra", "swati.mishra@company.com", "Frontend Engineer", ("Engineering", HYD), "mid", HYD, date(2022, 2, 15))
    me3_hyd = await emp("Aditya Naik", "aditya.naik@company.com", "Mobile Engineer", ("Engineering", HYD), "mid", HYD, date(2022, 3, 1))
    me4_hyd = await emp("Priyanka Singh", "priyanka.singh@company.com", "Backend Engineer", ("Engineering", HYD), "mid", HYD, date(2022, 4, 20))

    # ── Junior Engineers (HYD) ──
    je1_hyd = await emp("Varun Tiwari", "varun.tiwari@company.com", "Junior Backend Engineer", ("Engineering", HYD), "junior", HYD, date(2023, 1, 5))
    je2_hyd = await emp("Shruti Patel", "shruti.patel@company.com", "Junior Frontend Engineer", ("Engineering", HYD), "junior", HYD, date(2023, 6, 10))

    # ── Interns (HYD) ──
    int1_hyd = await emp("Aarav Mehta", "aarav.mehta@company.com", "Engineering Intern", ("Engineering", HYD), "intern", HYD, date(2025, 6, 1))
    int2_hyd = await emp("Diya Sharma", "diya.sharma@company.com", "Engineering Intern", ("Engineering", HYD), "intern", HYD, date(2025, 7, 1))

    # ── Engineers (BLR) ──
    se1_blr = await emp("Manoj Kumar", "manoj.kumar@company.com", "Senior Engineer", ("Engineering", BLR), "senior", BLR, date(2021, 8, 1))
    se2_blr = await emp("Rashmi Hegde", "rashmi.hegde@company.com", "Senior DevOps Engineer", ("Engineering", BLR), "senior", BLR, date(2021, 9, 15))
    me1_blr = await emp("Vishal Patil", "vishal.patil@company.com", "Software Engineer", ("Engineering", BLR), "mid", BLR, date(2022, 5, 10))
    me2_blr = await emp("Nandini Rao", "nandini.rao@company.com", "Software Engineer", ("Engineering", BLR), "mid", BLR, date(2022, 7, 20))
    je1_blr = await emp("Abhishek Gowda", "abhishek.gowda@company.com", "Junior Engineer", ("Engineering", BLR), "junior", BLR, date(2023, 8, 1))
    je2_blr = await emp("Tanvi Shetty", "tanvi.shetty@company.com", "Junior DevOps Engineer", ("Engineering", BLR), "junior", BLR, date(2024, 1, 15))

    # ── Engineers (LON) ──
    se1_lon = await emp("William Hart", "william.hart@company.com", "Senior Engineer", ("Engineering", LON), "senior", LON, date(2021, 10, 1))
    me1_lon = await emp("Emily Rose", "emily.rose@company.com", "Software Engineer", ("Engineering", LON), "mid", LON, date(2022, 8, 15))
    me2_lon = await emp("Harry Palmer", "harry.palmer@company.com", "Software Engineer", ("Engineering", LON), "mid", LON, date(2022, 11, 1))
    je1_lon = await emp("Lucy Chen", "lucy.chen@company.com", "Junior Engineer", ("Engineering", LON), "junior", LON, date(2024, 3, 1))

    # ── Engineers (SYD) ──
    se1_syd = await emp("Chris Evans", "chris.evans@company.com", "Senior Engineer", ("Engineering", SYD), "senior", SYD, date(2021, 11, 10))
    me1_syd = await emp("Jessica Wong", "jessica.wong@company.com", "Software Engineer", ("Engineering", SYD), "mid", SYD, date(2023, 2, 15))
    je1_syd = await emp("Ryan Lee", "ryan.lee@company.com", "Junior Engineer", ("Engineering", SYD), "junior", SYD, date(2024, 5, 1))

    # ── Product Analysts ──
    pa1_hyd = await emp("Shweta Kapoor", "shweta.kapoor@company.com", "Product Analyst", ("Product", HYD), "mid", HYD, date(2022, 9, 1))
    pa2_hyd = await emp("Raghav Pillai", "raghav.pillai@company.com", "Product Analyst", ("Product", HYD), "mid", HYD, date(2023, 3, 15))
    pa1_lon = await emp("Thomas White", "thomas.white@company.com", "Product Analyst", ("Product", LON), "mid", LON, date(2023, 4, 1))

    # ── Designers ──
    d1_hyd = await emp("Sakshi Jain", "sakshi.jain@company.com", "UI Designer", ("Design", HYD), "mid", HYD, date(2022, 10, 10))
    d2_hyd = await emp("Manish Gupta", "manish.gupta@company.com", "UX Researcher", ("Design", HYD), "mid", HYD, date(2023, 5, 20))
    d1_blr = await emp("Preeti Nair", "preeti.nair@company.com", "UI Designer", ("Design", BLR), "mid", BLR, date(2023, 7, 1))
    d2_blr = await emp("Siddharth Das", "siddharth.das@company.com", "UX Designer", ("Design", BLR), "mid", BLR, date(2023, 9, 10))

    # ── Operations Staff ──
    ops1_hyd = await emp("Kishore Mohan", "kishore.mohan@company.com", "Operations Analyst", ("Operations", HYD), "mid", HYD, date(2022, 12, 1))
    ops2_hyd = await emp("Bharathi Devi", "bharathi.devi@company.com", "Operations Coordinator", ("Operations", HYD), "junior", HYD, date(2023, 10, 15))
    ops1_lon = await emp("Mark Taylor", "mark.taylor@company.com", "Operations Analyst", ("Operations", LON), "mid", LON, date(2023, 1, 10))
    ops2_lon = await emp("Sarah Adams", "sarah.adams@company.com", "Operations Coordinator", ("Operations", LON), "junior", LON, date(2023, 11, 1))
    ops1_syd = await emp("Amy Liu", "amy.liu@company.com", "Operations Analyst", ("Operations", SYD), "mid", SYD, date(2023, 6, 20))

    # ── HR Staff ──
    hr1_hyd = await emp("Sunitha Reddy", "sunitha.reddy@company.com", "HR Executive", ("HR", HYD), "mid", HYD, date(2023, 2, 1))
    hr2_hyd = await emp("Vamsi Krishna", "vamsi.krishna@company.com", "HR Coordinator", ("HR", HYD), "junior", HYD, date(2024, 4, 10))
    hr1_lon = await emp("Rachel Green", "rachel.green@company.com", "HR Executive", ("HR", LON), "mid", LON, date(2023, 8, 15))

    # ── Sales Staff ──
    sales1_lon = await emp("Jack Roberts", "jack.roberts@company.com", "Sales Manager", ("Sales", LON), "manager", LON, date(2021, 5, 1))
    sales2_lon = await emp("Olivia Martin", "olivia.martin@company.com", "Sales Executive", ("Sales", LON), "mid", LON, date(2023, 4, 20))
    sales1_syd = await emp("Nathan Hill", "nathan.hill@company.com", "Sales Executive", ("Sales", SYD), "mid", SYD, date(2023, 12, 1))

    # ── Finance Staff ──
    fin1_hyd = await emp("Sunil Verma", "sunil.verma@company.com", "Finance Manager", ("Finance", HYD), "manager", HYD, date(2021, 6, 10))
    fin2_hyd = await emp("Kavya Rajan", "kavya.rajan@company.com", "Financial Analyst", ("Finance", HYD), "mid", HYD, date(2023, 3, 5))

    print(f"Created {len(employees)} employees.")

    # ── PRIMARY Reporting Relationships ──
    primary = [
        # C-Suite -> CEO
        (cto, ceo), (cpo, ceo), (coo, ceo), (chro, ceo), (cfo, ceo),
        # VPs -> C-Suite
        (vp_eng_india, cto), (vp_eng_emea, cto), (vp_eng_apac, cto),
        (vp_product, cpo), (vp_ops, coo),
        # Directors -> VPs
        (dir_eng_hyd, vp_eng_india), (dir_eng_blr, vp_eng_india),
        (dir_design, vp_product), (dir_sales_lon, vp_ops), (dir_sales_syd, vp_ops),
        # Engineering Managers -> Directors
        (mgr_backend_hyd, dir_eng_hyd), (mgr_frontend_hyd, dir_eng_hyd), (mgr_mobile_hyd, dir_eng_hyd),
        (mgr_eng_blr, dir_eng_blr), (mgr_devops_blr, dir_eng_blr),
        (mgr_eng_lon, vp_eng_emea), (mgr_eng_syd, vp_eng_apac),
        # Product Managers -> VP Product
        (pm_hyd, vp_product), (pm_lon, vp_product),
        # Design Leads -> Director
        (lead_design_hyd, dir_design), (lead_design_blr, dir_design),
        # Ops Managers -> VP Ops
        (mgr_ops_hyd, vp_ops), (mgr_ops_lon, vp_ops), (mgr_ops_syd, vp_ops),
        # HR Managers -> CHRO
        (mgr_hr_hyd, chro), (mgr_hr_lon, chro),
        # Finance -> CFO
        (fin1_hyd, cfo), (fin2_hyd, fin1_hyd),
        # Sales -> Directors
        (sales1_lon, dir_sales_lon), (sales2_lon, sales1_lon),
        (sales1_syd, dir_sales_syd),
        # Senior Engineers (HYD) -> Managers
        (se1_hyd, mgr_backend_hyd), (se4_hyd, mgr_backend_hyd),
        (se2_hyd, mgr_frontend_hyd),
        (se3_hyd, mgr_mobile_hyd),
        # Mid Engineers (HYD) -> Seniors/Managers
        (me1_hyd, mgr_backend_hyd), (me4_hyd, mgr_backend_hyd),
        (me2_hyd, mgr_frontend_hyd),
        (me3_hyd, mgr_mobile_hyd),
        # Junior Engineers (HYD)
        (je1_hyd, mgr_backend_hyd), (je2_hyd, mgr_frontend_hyd),
        # Interns (HYD)
        (int1_hyd, mgr_backend_hyd), (int2_hyd, mgr_frontend_hyd),
        # Engineers (BLR)
        (se1_blr, mgr_eng_blr), (me1_blr, mgr_eng_blr), (me2_blr, mgr_eng_blr), (je1_blr, mgr_eng_blr),
        (se2_blr, mgr_devops_blr), (je2_blr, mgr_devops_blr),
        # Engineers (LON)
        (se1_lon, mgr_eng_lon), (me1_lon, mgr_eng_lon), (me2_lon, mgr_eng_lon), (je1_lon, mgr_eng_lon),
        # Engineers (SYD)
        (se1_syd, mgr_eng_syd), (me1_syd, mgr_eng_syd), (je1_syd, mgr_eng_syd),
        # Product Analysts
        (pa1_hyd, pm_hyd), (pa2_hyd, pm_hyd), (pa1_lon, pm_lon),
        # Designers
        (d1_hyd, lead_design_hyd), (d2_hyd, lead_design_hyd),
        (d1_blr, lead_design_blr), (d2_blr, lead_design_blr),
        # Ops Staff
        (ops1_hyd, mgr_ops_hyd), (ops2_hyd, mgr_ops_hyd),
        (ops1_lon, mgr_ops_lon), (ops2_lon, mgr_ops_lon),
        (ops1_syd, mgr_ops_syd),
        # HR Staff
        (hr1_hyd, mgr_hr_hyd), (hr2_hyd, mgr_hr_hyd),
        (hr1_lon, mgr_hr_lon),
    ]

    # Remove the erroneous walrus line and fix sales1_syd duplicate
    # nathan_hill is already sales1_syd, so skip the duplicate
    clean_primary = []
    seen = set()
    for emp_id, mgr_id in primary:
        key = (emp_id, mgr_id)
        if key not in seen:
            seen.add(key)
            clean_primary.append((emp_id, mgr_id))

    for emp_id, mgr_id in clean_primary:
        rel = ReportingRelationship(employee_id=emp_id, manager_id=mgr_id, type="PRIMARY")
        await rel.insert()

    print(f"Created {len(clean_primary)} primary reporting relationships.")

    # ── SECONDARY (FUNCTIONAL/PROJECT) Relationships ──
    secondary = [
        # London engineers functionally report to HYD VP Engineering
        (se1_lon, vp_eng_india, "FUNCTIONAL"),
        (me1_lon, vp_eng_india, "FUNCTIONAL"),
        # BLR design lead cross-reports to HYD product manager
        (lead_design_blr, pm_hyd, "FUNCTIONAL"),
        # Product analysts cross-report to engineering managers
        (pa1_hyd, mgr_backend_hyd, "PROJECT"),
        (pa2_hyd, mgr_frontend_hyd, "PROJECT"),
        (pa1_lon, mgr_eng_lon, "PROJECT"),
        # SYD ops cross-reports to LON VP Ops
        (ops1_syd, vp_ops, "FUNCTIONAL"),
        # HYD designers on project with LON product
        (d1_hyd, pm_lon, "PROJECT"),
        (d2_hyd, pm_lon, "PROJECT"),
        # BLR senior engineer cross-reports to HYD director
        (se1_blr, dir_eng_hyd, "FUNCTIONAL"),
        # SYD engineer cross-reports to HYD mobile manager
        (me1_syd, mgr_mobile_hyd, "PROJECT"),
        # LON HR cross-reports to HYD CHRO
        (hr1_lon, chro, "FUNCTIONAL"),
        # HYD finance analyst project-reports to ops manager
        (fin2_hyd, mgr_ops_hyd, "PROJECT"),
    ]

    for emp_id, mgr_id, rel_type in secondary:
        rel = ReportingRelationship(employee_id=emp_id, manager_id=mgr_id, type=rel_type)
        await rel.insert()

    print(f"Created {len(secondary)} secondary reporting relationships.")

    # ── Projects ──
    now = datetime.now(timezone.utc)
    projects_data = [
        ("Platform Modernization", "ACTIVE", ("Engineering", HYD), date(2025, 1, 1), date(2026, 6, 30)),
        ("Mobile App v2", "ACTIVE", ("Engineering", HYD), date(2025, 3, 1), date(2025, 12, 31)),
        ("EMEA Market Launch", "ACTIVE", ("Product", LON), date(2025, 4, 1), date(2026, 3, 31)),
        ("HR Portal Redesign", "COMPLETED", ("HR", HYD), date(2024, 6, 1), date(2025, 2, 28)),
        ("Cloud Migration", "ACTIVE", ("Engineering", BLR), date(2025, 2, 1), date(2026, 1, 31)),
        ("Design System v3", "ACTIVE", ("Design", HYD), date(2025, 5, 1), date(2026, 4, 30)),
        ("Customer Dashboard", "ACTIVE", ("Engineering", LON), date(2025, 6, 1), date(2026, 2, 28)),
        ("APAC Expansion", "ACTIVE", ("Sales", SYD), date(2025, 7, 1), date(2026, 6, 30)),
        ("Data Analytics Pipeline", "ON_HOLD", ("Engineering", HYD), date(2025, 8, 1), date(2026, 7, 31)),
        ("Employee Wellness Program", "ACTIVE", ("HR", LON), date(2025, 9, 1), date(2026, 3, 31)),
    ]

    project_ids = {}
    for name, status, dept_key, start, end in projects_data:
        p = Project(name=name, status=status, department_id=depts[dept_key], start_date=start, end_date=end)
        await p.insert()
        project_ids[name] = str(p.id)

    print(f"Created {len(project_ids)} projects.")

    # ── Employee-Project Assignments ──
    assignments = [
        # Platform Modernization
        (se1_hyd, "Platform Modernization", "Tech Lead"),
        (se4_hyd, "Platform Modernization", "Senior Developer"),
        (me1_hyd, "Platform Modernization", "Developer"),
        (me4_hyd, "Platform Modernization", "Developer"),
        (je1_hyd, "Platform Modernization", "Junior Developer"),
        # Mobile App v2
        (se3_hyd, "Mobile App v2", "Tech Lead"),
        (me3_hyd, "Mobile App v2", "Developer"),
        (d1_hyd, "Mobile App v2", "UI Designer"),
        (int2_hyd, "Mobile App v2", "Intern"),
        # EMEA Market Launch
        (pm_lon, "EMEA Market Launch", "Product Lead"),
        (pa1_lon, "EMEA Market Launch", "Analyst"),
        (sales2_lon, "EMEA Market Launch", "Sales Lead"),
        (me1_lon, "EMEA Market Launch", "Developer"),
        # HR Portal Redesign
        (mgr_hr_hyd, "HR Portal Redesign", "Project Owner"),
        (hr1_hyd, "HR Portal Redesign", "HR Lead"),
        (se2_hyd, "HR Portal Redesign", "Developer"),
        # Cloud Migration
        (se2_blr, "Cloud Migration", "DevOps Lead"),
        (se1_blr, "Cloud Migration", "Engineer"),
        (me1_blr, "Cloud Migration", "Engineer"),
        (je2_blr, "Cloud Migration", "Junior DevOps"),
        # Design System v3
        (lead_design_hyd, "Design System v3", "Design Lead"),
        (d1_hyd, "Design System v3", "UI Designer"),
        (d2_hyd, "Design System v3", "UX Researcher"),
        (se2_hyd, "Design System v3", "Frontend Developer"),
        # Customer Dashboard
        (se1_lon, "Customer Dashboard", "Tech Lead"),
        (me2_lon, "Customer Dashboard", "Developer"),
        (je1_lon, "Customer Dashboard", "Junior Developer"),
        # APAC Expansion
        (sales1_syd, "APAC Expansion", "Sales Lead"),
        (ops1_syd, "APAC Expansion", "Ops Coordinator"),
        # Data Analytics Pipeline
        (mgr_backend_hyd, "Data Analytics Pipeline", "Project Lead"),
        (me1_hyd, "Data Analytics Pipeline", "Developer"),
        # Employee Wellness Program
        (mgr_hr_lon, "Employee Wellness Program", "HR Lead"),
        (hr1_lon, "Employee Wellness Program", "Coordinator"),
    ]

    for emp_id, proj_name, role in assignments:
        ep = EmployeeProject(
            employee_id=emp_id,
            project_id=project_ids[proj_name],
            role_in_project=role,
        )
        await ep.insert()

    print(f"Created {len(assignments)} project assignments.")

    # ── Users (Login Accounts) ──
    password_hash = bcrypt.hashpw(b"demo123", bcrypt.gensalt()).decode("utf-8")

    users_data = [
        ("vikram.patel@company.com", vp_eng_india, HYD, "Vikram Patel"),
        ("kavitha.rao@company.com", dir_eng_blr, BLR, "Kavitha Rao"),
        ("james.mitchell@company.com", coo, LON, "James Mitchell"),
        ("michael.torres@company.com", vp_eng_apac, SYD, "Michael Torres"),
    ]

    for email, emp_id, loc_id, name in users_data:
        user = User(
            email=email,
            password_hash=password_hash,
            employee_id=emp_id,
            branch_location_id=loc_id,
            name=name,
        )
        await user.insert()

    print(f"Created {len(users_data)} user accounts.")

    print("\nSeed data complete!")
    print(f"   Total employees: {len(employees)}")
    print(f"   Locations: 4 (HYD, BLR, LON, SYD)")
    print(f"   Projects: {len(project_ids)}")
    print(f"   Login credentials:")
    print(f"     HYD: vikram.patel@company.com / demo123")
    print(f"     BLR: kavitha.rao@company.com / demo123")
    print(f"     LON: james.mitchell@company.com / demo123")
    print(f"     SYD: michael.torres@company.com / demo123")


if __name__ == "__main__":
    asyncio.run(seed())
