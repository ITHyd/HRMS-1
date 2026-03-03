"""
One-time script to pull master data from the real HRMS portal
and populate the local MongoDB, replacing seed data.

Usage:
    cd backend
    python -m seed.pull_hrms_data --token <HRMS_JWT_TOKEN>

Or without token (uses HRMS_TOKEN from config/.env):
    python -m seed.pull_hrms_data
"""

import argparse
import asyncio
import sys

from app.config import settings
from app.database import init_db
from app.services.hrms_client import HrmsClient
from app.services.hrms_sync_service import sync_master_data


async def main(token: str):
    print("Initializing database connection...")
    await init_db()

    # Verify HRMS is reachable
    client = HrmsClient(token=token)
    healthy = await client.health_check()
    if not healthy:
        print(f"ERROR: Cannot reach HRMS at {client.base_url}")
        sys.exit(1)
    print(f"HRMS reachable at {client.base_url}")

    print("Starting master data sync from HRMS...")
    result = await sync_master_data(token=token, user_id="script")

    print()
    print("=" * 50)
    print("HRMS Data Pull Complete!")
    print("=" * 50)
    print(f"  Batch ID:    {result['batch_id']}")
    print(f"  Status:      {result['status']}")
    print(f"  Imported:    {result['imported_count']} records")
    print()
    summary = result.get("summary", {})
    print("  Summary:")
    print(f"    Locations:   {summary.get('locations', 0)}")
    print(f"    Departments: {summary.get('departments', 0)}")
    print(f"    Employees:   {summary.get('employees', 0)}")
    print(f"    Projects:    {summary.get('projects', 0)}")
    print(f"    Assignments: {summary.get('assignments', 0)}")
    print()

    # Print login credentials
    from app.models.user import User
    users = await User.find_all().to_list()
    if users:
        print("  Login accounts created (password: password123):")
        for u in users:
            from app.models.location import Location
            loc = await Location.get(u.branch_location_id)
            loc_name = loc.city if loc else "?"
            print(f"    {u.email} ({loc_name} branch head)")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pull master data from HRMS")
    parser.add_argument(
        "--token",
        default=settings.HRMS_TOKEN,
        help="HRMS JWT token (or set HRMS_TOKEN env var)",
    )
    args = parser.parse_args()

    if not args.token:
        print("ERROR: No HRMS token provided. Use --token <TOKEN> or set HRMS_TOKEN env var.")
        sys.exit(1)

    asyncio.run(main(args.token))
