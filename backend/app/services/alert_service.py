from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import ObjectId

from app.models.employee import Employee
from app.models.employee_project import EmployeeProject
from app.models.project import Project
from app.models.utilisation_snapshot import UtilisationSnapshot


async def generate_alerts(branch_location_id: str) -> list[dict]:
    """Generate automated alerts from existing branch data."""
    alerts: list[dict] = []
    now = datetime.now(timezone.utc)

    # ── Fetch branch employees ────────────────────────────────────────────────
    branch_emps = await Employee.find(
        Employee.location_id == branch_location_id,
        Employee.is_deleted != True,
    ).to_list()
    branch_emp_ids = [str(e.id) for e in branch_emps]

    if not branch_emp_ids:
        return alerts

    current_period = now.strftime("%Y-%m")
    prev_dt = (now.replace(day=1) - timedelta(days=1))
    prev_period = prev_dt.strftime("%Y-%m")

    # ── 1. Bench duration >14 days ────────────────────────────────────────────
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

    long_bench = [eid for eid, periods in bench_by_emp.items() if len(periods) >= 2]
    if long_bench:
        n = len(long_bench)
        alerts.append({
            "type": "bench_duration",
            "title": f"{n} employee{'s' if n != 1 else ''} benched >14 days",
            "severity": "high",
            "details": (
                f"{n} team member{'s' if n != 1 else ''} ha{'ve' if n != 1 else 's'} been "
                f"on bench for 2+ consecutive periods. Consider re-assigning to active projects."
            ),
        })

    # ── 2. Projects ending within 7 days ─────────────────────────────────────
    assignments = await EmployeeProject.find(
        {"employee_id": {"$in": branch_emp_ids}},
        EmployeeProject.is_deleted != True,
    ).to_list()
    proj_ids = list({a.project_id for a in assignments})

    if proj_ids:
        projects = await Project.find(
            {
                "_id": {"$in": [ObjectId(pid) for pid in proj_ids if ObjectId.is_valid(pid)]},
                "status": {"$in": ["ACTIVE", "ON_HOLD"]},
                "is_deleted": {"$ne": True},
                "end_date": {"$ne": None},
            }
        ).to_list()

        for proj in projects:
            if proj.end_date:
                end_aware = (
                    proj.end_date.replace(tzinfo=timezone.utc)
                    if proj.end_date.tzinfo is None
                    else proj.end_date
                )
                days = (end_aware - now).days
                if 0 <= days <= 7:
                    alerts.append({
                        "type": "project_ending",
                        "title": f"{proj.name} ends in {days} day{'s' if days != 1 else ''}",
                        "severity": "medium",
                        "details": (
                            f"Client: {proj.client_name or 'N/A'}. "
                            f"Plan renewal or reallocate the team members before the deadline."
                        ),
                    })

    # ── 3. Billable percentage below target ───────────────────────────────────
    current_snaps = await UtilisationSnapshot.find(
        {
            "employee_id": {"$in": branch_emp_ids},
            "period": current_period,
        }
    ).to_list()

    if current_snaps:
        billable_values = [s.billable_percent for s in current_snaps]
        if billable_values:
            avg_billable = sum(billable_values) / len(billable_values)
            target = 75.0
            if avg_billable < target:
                bench_count = sum(1 for s in current_snaps if s.classification == "bench")
                severity = "high" if avg_billable < 50 else "low"
                alerts.append({
                    "type": "billable_drop",
                    "title": f"Billable {avg_billable:.0f}% (target {target:.0f}%)",
                    "severity": severity,
                    "details": (
                        f"Branch average billable percentage is {avg_billable:.1f}% against a "
                        f"{target:.0f}% target. {bench_count} employee{'s' if bench_count != 1 else ''} "
                        f"currently on bench."
                    ),
                })

    return alerts
