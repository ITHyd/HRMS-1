"""
Seed data generator for Branch Command Center.
Creates ~80 employees across 4 locations with realistic org hierarchy.

Usage: cd backend && python -m seed.seed_data
"""

import asyncio
import calendar
import random
import sys
from datetime import datetime, timedelta, timezone, date as date_type
from pathlib import Path

from pymongo import AsyncMongoClient
from beanie import init_beanie
import bcrypt
from dateutil.relativedelta import relativedelta

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
from app.models.timesheet_entry import TimesheetEntry
from app.models.timesheet_period_lock import TimesheetPeriodLock
from app.models.capacity_config import CapacityConfig
from app.models.finance_billable import FinanceBillable
from app.models.finance_upload_log import FinanceUploadLog
from app.models.utilisation_snapshot import UtilisationSnapshot
from app.models.project_allocation import ProjectAllocation
from app.models.skill_catalog import SkillCatalog
from app.models.employee_skill import EmployeeSkill
from app.models.integration_config import IntegrationConfig

ALL_MODELS = [
    Employee, ReportingRelationship, Location, Department, Project, EmployeeProject,
    AuditLog, User,
    TimesheetEntry, TimesheetPeriodLock, CapacityConfig,
    FinanceBillable, FinanceUploadLog, UtilisationSnapshot,
    ProjectAllocation, SkillCatalog, EmployeeSkill, IntegrationConfig,
]

DEFAULT_DEMO_PASSWORD = "demo123"
NXZEN_PASSWORD = "password123"


def date(y, m, d):
    return datetime(y, m, d, tzinfo=timezone.utc)


def _password_for_email(email: str) -> str:
    return NXZEN_PASSWORD if (email or "").lower().endswith("@nxzen.com") else DEFAULT_DEMO_PASSWORD


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
    hr2_hyd = await emp("Vamsi Krishna", "vamsi.krishna@nxzen.com", "HR Coordinator", ("HR", HYD), "junior", HYD, date(2024, 4, 10))
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

    # ── Projects (dates relative to seed run, client names populated) ──
    now = datetime.now(timezone.utc)
    from dateutil.relativedelta import relativedelta

    def moff(months: int) -> datetime:
        """Return UTC datetime offset by N months from now, day=1."""
        d = (now + relativedelta(months=months)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return d

    def mend(months: int) -> datetime:
        """Return last-day-of-month datetime for now + N months."""
        import calendar as _cal
        d = now + relativedelta(months=months)
        last_day = _cal.monthrange(d.year, d.month)[1]
        return d.replace(day=last_day, hour=23, minute=59, second=59, microsecond=0)

    # Client name map — internal projects have None
    CLIENT_MAP = {
        "Platform Modernization": "Accenture",
        "Cloud Migration": "Infosys",
        "Customer Dashboard": "HSBC",
        "EMEA Market Launch": "Vodafone",
        "APAC Expansion": "ANZ Bank",
        "Mobile App v2": None,          # internal
        "HR Portal Redesign": None,     # internal / completed
        "Design System v3": None,       # internal
        "Data Analytics Pipeline": None,  # internal / on hold
        "Employee Wellness Program": None,  # internal
    }

    # (name, status, type, dept_key, start_offset_months, end_offset_months)
    projects_data = [
        # Active client — spans from 14 months ago to +4 months ahead
        ("Platform Modernization", "ACTIVE",     "client",   ("Engineering", HYD), -14, +4),
        # Completed internal — ended 3 months ago
        ("Mobile App v2",          "COMPLETED",  "internal", ("Engineering", HYD), -12, -3),
        # Active client — ending next month (EMEA)
        ("EMEA Market Launch",     "ACTIVE",     "client",   ("Product", LON),     -11, +1),
        # Completed internal — ended 13 months ago
        ("HR Portal Redesign",     "COMPLETED",  "internal", ("HR", HYD),          -21, -13),
        # Completed client — ended 1 month ago
        ("Cloud Migration",        "COMPLETED",  "client",   ("Engineering", BLR), -13, -1),
        # Active internal — ends +2 months ahead
        ("Design System v3",       "ACTIVE",     "internal", ("Design", HYD),      -10, +2),
        # Active client — ends +3 months ahead
        ("Customer Dashboard",     "ACTIVE",     "client",   ("Engineering", LON),  -9, +3),
        # Active client — ends +4 months ahead
        ("APAC Expansion",         "ACTIVE",     "client",   ("Sales", SYD),        -8, +4),
        # On hold internal — planned end +5 months
        ("Data Analytics Pipeline","ON_HOLD",    "internal", ("Engineering", HYD),  -7, +5),
        # Active internal — ends next month
        ("Employee Wellness Program","ACTIVE",   "internal", ("HR", LON),           -6, +1),
    ]

    project_ids = {}
    project_dates = {}  # name -> (start_dt, end_dt)
    for name, status, ptype, dept_key, s_off, e_off in projects_data:
        start_dt = moff(s_off)
        end_dt = mend(e_off)
        p = Project(
            name=name,
            status=status,
            project_type=ptype,
            client_name=CLIENT_MAP.get(name),
            department_id=depts[dept_key],
            start_date=start_dt,
            end_date=end_dt,
        )
        await p.insert()
        project_ids[name] = str(p.id)
        project_dates[name] = (start_dt, end_dt)

    print(f"Created {len(project_ids)} projects.")

    # ── Employee-Project Assignments (with start/end dates from project) ──
    assignments = [
        # Platform Modernization (active, ongoing)
        (se1_hyd, "Platform Modernization", "Tech Lead"),
        (se4_hyd, "Platform Modernization", "Senior Developer"),
        (me1_hyd, "Platform Modernization", "Developer"),
        (me4_hyd, "Platform Modernization", "Developer"),
        (je1_hyd, "Platform Modernization", "Junior Developer"),
        # Mobile App v2 (completed -3 months ago)
        (se3_hyd, "Mobile App v2", "Tech Lead"),
        (me3_hyd, "Mobile App v2", "Developer"),
        (d1_hyd,  "Mobile App v2", "UI Designer"),
        (int2_hyd,"Mobile App v2", "Intern"),
        # EMEA Market Launch (active, ending soon)
        (pm_lon,     "EMEA Market Launch", "Product Lead"),
        (pa1_lon,    "EMEA Market Launch", "Analyst"),
        (sales2_lon, "EMEA Market Launch", "Sales Lead"),
        (me1_lon,    "EMEA Market Launch", "Developer"),
        # HR Portal Redesign (completed -13 months)
        (mgr_hr_hyd, "HR Portal Redesign", "Project Owner"),
        (hr1_hyd,    "HR Portal Redesign", "HR Lead"),
        (se2_hyd,    "HR Portal Redesign", "Developer"),
        # Cloud Migration (completed -1 month) — se2_hyd also had HR Portal but is done
        (se2_blr, "Cloud Migration", "DevOps Lead"),
        (se1_blr, "Cloud Migration", "Engineer"),
        (me1_blr, "Cloud Migration", "Engineer"),
        (je2_blr, "Cloud Migration", "Junior DevOps"),
        # Design System v3 (active)
        (lead_design_hyd, "Design System v3", "Design Lead"),
        (d1_hyd,          "Design System v3", "UI Designer"),
        (d2_hyd,          "Design System v3", "UX Researcher"),
        (se2_hyd,         "Design System v3", "Frontend Developer"),
        # Customer Dashboard (active)
        (se1_lon, "Customer Dashboard", "Tech Lead"),
        (me2_lon, "Customer Dashboard", "Developer"),
        (je1_lon, "Customer Dashboard", "Junior Developer"),
        # APAC Expansion (active)
        (sales1_syd, "APAC Expansion", "Sales Lead"),
        (ops1_syd,   "APAC Expansion", "Ops Coordinator"),
        # Data Analytics Pipeline (on hold)
        (mgr_backend_hyd, "Data Analytics Pipeline", "Project Lead"),
        (me1_hyd,         "Data Analytics Pipeline", "Developer"),
        # Employee Wellness Program (active, ending next month)
        (mgr_hr_lon, "Employee Wellness Program", "HR Lead"),
        (hr1_lon,    "Employee Wellness Program", "Coordinator"),
    ]

    for emp_id, proj_name, role in assignments:
        p_start, p_end = project_dates[proj_name]
        ep = EmployeeProject(
            employee_id=emp_id,
            project_id=project_ids[proj_name],
            role_in_project=role,
            start_date=p_start,
            end_date=p_end,
            assigned_at=p_start,
            assigned_by="system",
        )
        await ep.insert()

    print(f"Created {len(assignments)} project assignments.")

    # ── Users (Login Accounts) ──
    users_data = [
        ("vikram.patel@company.com", vp_eng_india, HYD, "Vikram Patel"),
        ("kavitha.rao@company.com", dir_eng_blr, BLR, "Kavitha Rao"),
        ("james.mitchell@company.com", coo, LON, "James Mitchell"),
        ("michael.torres@company.com", vp_eng_apac, SYD, "Michael Torres"),
        ("vamsi.krishna@nxzen.com", hr2_hyd, HYD, "Vamsi Krishna"),
    ]

    for email, emp_id, loc_id, name in users_data:
        user = User(
            email=email,
            password_hash=bcrypt.hashpw(_password_for_email(email).encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
            employee_id=emp_id,
            branch_location_id=loc_id,
            name=name,
        )
        await user.insert()

    print(f"Created {len(users_data)} user accounts.")

    # ── Phase 1 Module Seed Data ──

    # ── Capacity Config (one per branch) ──
    branch_ids = {"HYD": HYD, "BLR": BLR, "LON": LON, "SYD": SYD}
    capacity_configs = []
    for code, loc_id in branch_ids.items():
        cc = CapacityConfig(
            branch_location_id=loc_id,
            standard_hours_per_week=40,
            standard_hours_per_day=8,
            working_days_per_week=5,
            bench_threshold_percent=30,
            partial_billing_threshold=70,
            effective_from=date(2025, 1, 1),
            created_by="system",
            updated_at=now,
        )
        await cc.insert()
        capacity_configs.append(cc)
    print(f"Created {len(capacity_configs)} capacity configs.")

    # ── Build employee -> location mapping and employee -> project assignments mapping ──
    # Fetch all employees from DB to get their location_id and name
    all_employees_db = await Employee.find_all().to_list()
    emp_id_to_location = {str(e.id): e.location_id for e in all_employees_db}
    emp_id_to_name = {str(e.id): e.name for e in all_employees_db}
    emp_id_to_level = {str(e.id): e.level for e in all_employees_db}
    CORPORATE_LEVELS = {"c-suite", "vp"}

    # Build employee_id -> list of (project_id, role) from assignments
    emp_projects = {}
    for emp_id, proj_name, role in assignments:
        pid = project_ids[proj_name]
        if emp_id not in emp_projects:
            emp_projects[emp_id] = []
        emp_projects[emp_id].append((pid, role))

    # Group employees by branch location
    branch_employees = {}
    for eid, loc_id in emp_id_to_location.items():
        if loc_id not in branch_employees:
            branch_employees[loc_id] = []
        branch_employees[loc_id].append(eid)

    # ── Helper: get working days in a month ──
    def get_working_days(year, month):
        """Return list of date objects for weekdays (Mon-Fri) in the given month."""
        num_days = calendar.monthrange(year, month)[1]
        days = []
        for day in range(1, num_days + 1):
            d = date_type(year, month, day)
            if d.weekday() < 5:  # Mon=0 .. Fri=4
                days.append(d)
        return days

    # ── Determine past 3 months for timesheets, past 2 for finance/utilisation ──
    # Current date is now (March 2026), so past 3 months = Dec 2025, Jan 2026, Feb 2026
    today = now.date() if hasattr(now, 'date') else now
    past_months_3 = []
    past_months_2 = []
    ref = today.replace(day=1)
    for i in range(3, 0, -1):
        # Go back i months from current month
        m = ref.month - i
        y = ref.year
        while m <= 0:
            m += 12
            y -= 1
        past_months_3.append((y, m))
    past_months_2 = past_months_3[1:]  # last 2 of the 3

    # ── Timesheet Entries (past 3 months) ──
    random.seed(42)  # Reproducibility
    timesheet_entries = []

    for year, month in past_months_3:
        period = f"{year:04d}-{month:02d}"
        working_days = get_working_days(year, month)

        for loc_id, emp_list in branch_employees.items():
            for eid in emp_list:
                # Skip corporate-level employees from timesheet generation
                level = emp_id_to_level.get(eid, "")
                if level in CORPORATE_LEVELS:
                    continue

                proj_list = emp_projects.get(eid, [])

                if proj_list:
                    # Employee has project assignments - distribute 7-8 hours across projects
                    for wd in working_days:
                        total_day_hours = random.choice([7.0, 7.5, 8.0])
                        n_projects = len(proj_list)

                        if n_projects == 1:
                            hours_split = [total_day_hours]
                        else:
                            # Distribute hours: give majority to first project, rest spread
                            base = total_day_hours / n_projects
                            hours_split = []
                            remaining = total_day_hours
                            for j in range(n_projects - 1):
                                h = round(random.uniform(base * 0.5, base * 1.5), 1)
                                h = min(h, remaining - 0.5 * (n_projects - j - 1))
                                h = max(h, 0.5)
                                hours_split.append(h)
                                remaining -= h
                            hours_split.append(round(remaining, 1))

                        for idx, (pid, role) in enumerate(proj_list):
                            is_billable = random.random() < 0.70
                            entry = TimesheetEntry(
                                employee_id=eid,
                                project_id=pid,
                                date=wd,
                                hours=hours_split[idx],
                                is_billable=is_billable,
                                description=f"Work on {role} tasks",
                                status="approved",
                                submitted_at=datetime(year, month, min(wd.day + 1, working_days[-1].day), tzinfo=timezone.utc),
                                approved_by="system",
                                approved_at=datetime(year, month, min(wd.day + 2, working_days[-1].day), tzinfo=timezone.utc),
                                source="hrms_sync",
                                sync_batch_id=f"seed-sync-{period}",
                                period=period,
                                branch_location_id=loc_id,
                                created_at=now,
                                updated_at=now,
                            )
                            timesheet_entries.append(entry)
                else:
                    # Bench employee - minimal hours, non-billable, project_id="bench"
                    for wd in working_days:
                        bench_hours = round(random.uniform(4.0, 6.0), 1)
                        entry = TimesheetEntry(
                            employee_id=eid,
                            project_id="bench",
                            date=wd,
                            hours=bench_hours,
                            is_billable=False,
                            description="Internal / Admin tasks",
                            status="approved",
                            submitted_at=datetime(year, month, min(wd.day + 1, working_days[-1].day), tzinfo=timezone.utc),
                            approved_by="system",
                            approved_at=datetime(year, month, min(wd.day + 2, working_days[-1].day), tzinfo=timezone.utc),
                            source="hrms_sync",
                            sync_batch_id=f"seed-sync-{period}",
                            period=period,
                            branch_location_id=loc_id,
                            created_at=now,
                            updated_at=now,
                        )
                        timesheet_entries.append(entry)

    # Bulk insert timesheet entries in batches
    BATCH_SIZE = 500
    for i in range(0, len(timesheet_entries), BATCH_SIZE):
        batch = timesheet_entries[i : i + BATCH_SIZE]
        await TimesheetEntry.insert_many(batch)
    print(f"Created {len(timesheet_entries)} timesheet entries across {len(past_months_3)} months.")

    # ── Project Allocations (past 3 months — one record per employee per project per month) ──
    allocation_records = []
    proj_name_map = {v: k for k, v in project_ids.items()}  # id -> name

    for year, month in past_months_3:
        period = f"{year:04d}-{month:02d}"
        working_days_count = len(get_working_days(year, month))

        for loc_id, emp_list in branch_employees.items():
            for eid in emp_list:
                level = emp_id_to_level.get(eid, "")
                if level in CORPORATE_LEVELS:
                    continue

                proj_list = emp_projects.get(eid, [])
                if not proj_list:
                    continue

                n = len(proj_list)
                per_proj_days = round(working_days_count / n, 1)
                alloc_pct = round(100.0 / n, 1)

                for pid, role in proj_list:
                    proj_name = proj_name_map.get(pid, "Unknown")
                    client = CLIENT_MAP.get(proj_name)
                    emp_name = emp_id_to_name.get(eid, "")
                    allocation_records.append(ProjectAllocation(
                        period=period,
                        employee_id=eid,
                        hrms_employee_id=0,
                        employee_name=emp_name,
                        project_id=pid,
                        hrms_project_id=0,
                        project_name=proj_name,
                        client_name=client,
                        allocated_days=per_proj_days,
                        allocation_percentage=alloc_pct,
                        total_working_days=working_days_count,
                        total_allocated_days=float(working_days_count),
                        available_days=0.0,
                        sync_batch_id="seed-alloc-1",
                        synced_at=now,
                    ))

    for i in range(0, len(allocation_records), BATCH_SIZE):
        await ProjectAllocation.insert_many(allocation_records[i : i + BATCH_SIZE])
    print(f"Created {len(allocation_records)} project allocation records.")

    # ── Finance Billable (past 2 months) ──
    random.seed(42)  # Reset seed for reproducibility
    finance_records = []

    # Also create a single upload log for the seed batch
    for year, month in past_months_2:
        period = f"{year:04d}-{month:02d}"

        for loc_id, emp_list in branch_employees.items():
            for eid in emp_list:
                # Skip corporate-level employees from finance data
                level = emp_id_to_level.get(eid, "")
                if level in CORPORATE_LEVELS:
                    continue

                proj_list = emp_projects.get(eid, [])

                if proj_list:
                    # Has projects: 60% fully_billed, 30% partially_billed, 10% non_billable
                    roll = random.random()
                    if roll < 0.60:
                        billable_status = "fully_billed"
                    elif roll < 0.90:
                        billable_status = "partially_billed"
                    else:
                        billable_status = "non_billable"

                    # Approximate billable hours from timesheet data
                    # ~22 working days * 7.5 avg hours = 165 total hours
                    if billable_status == "fully_billed":
                        billable_hours = round(random.uniform(140, 170), 1)
                    elif billable_status == "partially_billed":
                        billable_hours = round(random.uniform(80, 139), 1)
                    else:
                        billable_hours = 0.0

                    primary_pid = proj_list[0][0]  # first assigned project
                else:
                    billable_status = "non_billable"
                    billable_hours = 0.0
                    primary_pid = None

                fb = FinanceBillable(
                    employee_id=eid,
                    period=period,
                    billable_status=billable_status,
                    billable_hours=billable_hours,
                    project_id=primary_pid,
                    branch_location_id=loc_id,
                    upload_batch_id="seed-batch-1",
                    version=1,
                    created_at=now,
                )
                finance_records.append(fb)

    for i in range(0, len(finance_records), BATCH_SIZE):
        batch = finance_records[i : i + BATCH_SIZE]
        await FinanceBillable.insert_many(batch)
    print(f"Created {len(finance_records)} finance billable records across {len(past_months_2)} months.")

    # Create one FinanceUploadLog for the seed batch
    upload_log = FinanceUploadLog(
        batch_id="seed-batch-1",
        period=f"{past_months_2[-1][0]:04d}-{past_months_2[-1][1]:02d}",
        branch_location_id=HYD,
        uploaded_by="system",
        filename="seed_data_import.csv",
        total_rows=len(finance_records),
        valid_count=len(finance_records),
        error_count=0,
        duplicate_count=0,
        version=1,
        errors=[],
        uploaded_at=now,
    )
    await upload_log.insert()
    print("Created 1 finance upload log.")

    # ── Utilisation Snapshots (past 2 months) ──
    # Pre-compute from timesheet entries
    # Build aggregation: (employee_id, period) -> {total_hours, billable_hours, non_billable_hours}
    ts_agg = {}
    for entry in timesheet_entries:
        key = (entry.employee_id, entry.period)
        if key not in ts_agg:
            ts_agg[key] = {"total": 0.0, "billable": 0.0, "non_billable": 0.0}
        ts_agg[key]["total"] += entry.hours
        if entry.is_billable:
            ts_agg[key]["billable"] += entry.hours
        else:
            ts_agg[key]["non_billable"] += entry.hours

    # Build fast lookup for finance billable status: (employee_id, period) -> status
    fin_status_lookup = {}
    for fr in finance_records:
        fin_status_lookup[(fr.employee_id, fr.period)] = fr.billable_status

    utilisation_records = []
    for year, month in past_months_2:
        period = f"{year:04d}-{month:02d}"
        working_days = get_working_days(year, month)
        capacity_hours = len(working_days) * 8.0  # standard 8 hrs/day

        for loc_id, emp_list in branch_employees.items():
            for eid in emp_list:
                # Skip corporate-level employees (c-suite, vp)
                level = emp_id_to_level.get(eid, "")
                if level in CORPORATE_LEVELS:
                    continue

                key = (eid, period)
                agg = ts_agg.get(key, {"total": 0.0, "billable": 0.0, "non_billable": 0.0})

                total_logged = round(agg["total"], 1)
                billable_h = round(agg["billable"], 1)
                non_billable_h = round(agg["non_billable"], 1)

                util_pct = round((total_logged / capacity_hours) * 100, 1) if capacity_hours > 0 else 0.0
                bill_pct = round((billable_h / capacity_hours) * 100, 1) if capacity_hours > 0 else 0.0

                # Classification based on billable percent thresholds
                if bill_pct >= 70:
                    classification = "fully_billed"
                elif bill_pct >= 30:
                    classification = "partially_billed"
                else:
                    classification = "bench"

                fin_status = fin_status_lookup.get((eid, period))

                snap = UtilisationSnapshot(
                    employee_id=eid,
                    employee_name=emp_id_to_name.get(eid, "Unknown"),
                    employee_level=level,
                    period=period,
                    branch_location_id=loc_id,
                    total_hours_logged=total_logged,
                    billable_hours=billable_h,
                    non_billable_hours=non_billable_h,
                    capacity_hours=capacity_hours,
                    utilisation_percent=util_pct,
                    billable_percent=bill_pct,
                    classification=classification,
                    finance_billable_status=fin_status,
                    computed_at=now,
                )
                utilisation_records.append(snap)

    for i in range(0, len(utilisation_records), BATCH_SIZE):
        batch = utilisation_records[i : i + BATCH_SIZE]
        await UtilisationSnapshot.insert_many(batch)
    print(f"Created {len(utilisation_records)} utilisation snapshots across {len(past_months_2)} months.")

    # ── Period Locks (lock the oldest month) ──
    period_locks = []
    oldest_period = f"{past_months_3[0][0]:04d}-{past_months_3[0][1]:02d}"
    for code, loc_id in branch_ids.items():
        # Lock the oldest month
        lock = TimesheetPeriodLock(
            period=oldest_period,
            branch_location_id=loc_id,
            is_locked=True,
            locked_by="system",
            locked_at=now,
        )
        await lock.insert()
        period_locks.append(lock)

    # Create unlocked entries for remaining months
    for year, month in past_months_3[1:]:
        period = f"{year:04d}-{month:02d}"
        for code, loc_id in branch_ids.items():
            lock = TimesheetPeriodLock(
                period=period,
                branch_location_id=loc_id,
                is_locked=False,
            )
            await lock.insert()
            period_locks.append(lock)

    print(f"Created {len(period_locks)} period locks ({oldest_period} locked, others unlocked).")

    # ── Phase 2 Module Seed Data ──

    # ── Skill Catalog ──
    skill_catalog_data = [
        {"name": "python", "category": "language", "display_name": "Python"},
        {"name": "javascript", "category": "language", "display_name": "JavaScript"},
        {"name": "typescript", "category": "language", "display_name": "TypeScript"},
        {"name": "java", "category": "language", "display_name": "Java"},
        {"name": "csharp", "category": "language", "display_name": "C#"},
        {"name": "react", "category": "framework", "display_name": "React"},
        {"name": "angular", "category": "framework", "display_name": "Angular"},
        {"name": "dotnet", "category": "framework", "display_name": ".NET"},
        {"name": "spring", "category": "framework", "display_name": "Spring Boot"},
        {"name": "aws", "category": "cloud", "display_name": "AWS"},
        {"name": "azure", "category": "cloud", "display_name": "Azure"},
        {"name": "gcp", "category": "cloud", "display_name": "Google Cloud"},
        {"name": "docker", "category": "tool", "display_name": "Docker"},
        {"name": "kubernetes", "category": "tool", "display_name": "Kubernetes"},
        {"name": "terraform", "category": "tool", "display_name": "Terraform"},
        {"name": "banking", "category": "domain", "display_name": "Banking & Finance"},
        {"name": "healthcare", "category": "domain", "display_name": "Healthcare"},
        {"name": "ecommerce", "category": "domain", "display_name": "E-Commerce"},
        {"name": "leadership", "category": "soft_skill", "display_name": "Leadership"},
        {"name": "agile", "category": "soft_skill", "display_name": "Agile/Scrum"},
    ]
    for sk in skill_catalog_data:
        await SkillCatalog(**sk).insert()
    print(f"Created {len(skill_catalog_data)} skill catalog entries.")

    # ── Employee Skills ──
    # Fetch all users for added_by reference
    users = await User.find_all().to_list()
    proficiencies = ["beginner", "intermediate", "advanced", "expert"]
    skill_count = 0
    for emp_obj in all_employees_db:
        num_skills = random.randint(2, 4)
        chosen = random.sample(skill_catalog_data, num_skills)
        for sk in chosen:
            await EmployeeSkill(
                employee_id=str(emp_obj.id),
                skill_name=sk["name"],
                proficiency=random.choice(proficiencies),
                added_by=str(users[0].id),
                added_at=datetime.now(timezone.utc),
            ).insert()
            skill_count += 1
    print(f"Created {skill_count} employee skill tags.")

    # ── Integration Configs ──
    for itype, iname in [("hrms", "HRMS Connector"), ("finance", "Finance Data Feed"), ("dynamics", "Dynamics 365 Export")]:
        cfg = {"endpoint": f"https://api.example.com/{itype}", "version": "1.0"}
        if itype == "hrms":
            cfg = {
                "provider": "nxzen_hrms",
                "base_url": "http://149.102.158.71:2342",
                "auth_mode": "password_grant",
                "secret_ref": "NXZEN_MANAGER",
                "hr_id": 1,
                "sync_scope": {"months_backfill": 6, "manual_only": True},
                "mode": {
                    "demo_users": ["vikram.patel@company.com"],
                    "live_domains": ["nxzen.com"],
                    "live_users": ["vamsi.krishna@nxzen.com"],
                },
            }
        await IntegrationConfig(
            integration_type=itype,
            name=iname,
            status="active",
            config=cfg,
            created_by=str(users[0].id),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ).insert()
    print("Created 3 integration configs.")

    print("\nSeed data complete!")
    print(f"   Total employees: {len(employees)}")
    print(f"   Locations: 4 (HYD, BLR, LON, SYD)")
    print(f"   Projects: {len(project_ids)}")
    print(f"   Capacity configs: {len(capacity_configs)}")
    print(f"   Timesheet entries: {len(timesheet_entries)}")
    print(f"   Finance billable records: {len(finance_records)}")
    print(f"   Utilisation snapshots: {len(utilisation_records)}")
    print(f"   Period locks: {len(period_locks)}")
    print(f"   Skill catalog entries: {len(skill_catalog_data)}")
    print(f"   Employee skill tags: {skill_count}")
    print(f"   Integration configs: 3")
    print(f"   Login credentials:")
    print(f"     HYD (demo): vikram.patel@company.com / {DEFAULT_DEMO_PASSWORD}")
    print(f"     HYD (live): vamsi.krishna@nxzen.com / {NXZEN_PASSWORD}")
    print(f"     BLR: kavitha.rao@company.com / {DEFAULT_DEMO_PASSWORD}")
    print(f"     LON: james.mitchell@company.com / {DEFAULT_DEMO_PASSWORD}")
    print(f"     SYD: michael.torres@company.com / {DEFAULT_DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
