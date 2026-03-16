from collections import defaultdict
from datetime import datetime, timezone, timedelta

from bson import ObjectId

from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.project import Project
from app.models.utilisation_snapshot import UtilisationSnapshot


async def get_notification_summary(branch_location_id: str) -> dict:
    """Generate contextual notifications from existing branch data."""
    now = datetime.now(timezone.utc)
    current_period = now.strftime("%Y-%m")
    prev_dt = now.replace(day=1) - timedelta(days=1)
    prev_period = prev_dt.strftime("%Y-%m")

    branch_emps = await Employee.find(
        Employee.location_id == branch_location_id,
        Employee.is_deleted != True,
    ).to_list()
    branch_emp_map = {str(e.id): e for e in branch_emps}
    branch_emp_ids = list(branch_emp_map.keys())

    empty: dict = {
        "bench_long": 0, "project_ending": 0, "billable_low": 0, "total": 0,
        "details": {"bench_long": [], "project_ending": [], "billable_low": []},
    }
    if not branch_emp_ids:
        return empty

    # ── 1. Long bench (bench classification in both current and previous period) ──
    bench_snaps = await UtilisationSnapshot.find(
        {
            "employee_id": {"$in": branch_emp_ids},
            "period": {"$in": [current_period, prev_period]},
            "classification": "bench",
        }
    ).to_list()

    bench_by_emp: dict[str, set] = {}
    for s in bench_snaps:
        bench_by_emp.setdefault(s.employee_id, set()).add(s.period)

    # Approximate days: from 1st of previous period to today
    bench_start = datetime(int(prev_period[:4]), int(prev_period[5:7]), 1, tzinfo=timezone.utc)
    bench_days_approx = (now - bench_start).days

    long_bench = []
    for eid, periods in bench_by_emp.items():
        if len(periods) >= 2:
            emp = branch_emp_map.get(eid)
            long_bench.append({
                "employee_id": eid,
                "employee_name": emp.name if emp else "Unknown",
                "bench_days": bench_days_approx,
                "bench_periods": sorted(periods),
            })

    # ── 2. Projects ending in ≤7 days ────────────────────────────────────────
    assignments = await EmployeeProject.find(
        {"employee_id": {"$in": branch_emp_ids}},
        EmployeeProject.is_deleted != True,
    ).to_list()
    proj_ids = list({a.project_id for a in assignments})

    ending_projects = []
    if proj_ids:
        projects = await Project.find(
            {
                "_id": {"$in": [ObjectId(pid) for pid in proj_ids if ObjectId.is_valid(pid)]},
                "status": {"$in": ["ACTIVE", "ON_HOLD"]},
                "is_deleted": {"$ne": True},
                "end_date": {"$ne": None},
            }
        ).to_list()

        members_by_proj: dict[str, set] = defaultdict(set)
        for a in assignments:
            members_by_proj[a.project_id].add(a.employee_id)

        for proj in projects:
            if proj.end_date:
                end_aware = (
                    proj.end_date.replace(tzinfo=timezone.utc)
                    if proj.end_date.tzinfo is None
                    else proj.end_date
                )
                days = (end_aware - now).days
                if 0 <= days <= 7:
                    ending_projects.append({
                        "project_id": str(proj.id),
                        "project_name": proj.name,
                        "days_remaining": days,
                        "team_size": len(members_by_proj.get(str(proj.id), set())),
                        "end_date": end_aware.date().isoformat(),
                    })

    # ── 3. Branch billable rate below 75% ────────────────────────────────────
    current_snaps = await UtilisationSnapshot.find(
        {"employee_id": {"$in": branch_emp_ids}, "period": current_period}
    ).to_list()

    billable_low = []
    if current_snaps:
        avg_billable = sum(s.billable_percent for s in current_snaps) / len(current_snaps)
        if avg_billable < 75.0:
            billable_low.append({
                "metric": "branch",
                "current_pct": round(avg_billable, 1),
                "target_pct": 75.0,
            })

    total = len(long_bench) + len(ending_projects) + len(billable_low)
    return {
        "bench_long": len(long_bench),
        "project_ending": len(ending_projects),
        "billable_low": len(billable_low),
        "total": total,
        "details": {
            "bench_long": long_bench,
            "project_ending": ending_projects,
            "billable_low": billable_low,
        },
    }
