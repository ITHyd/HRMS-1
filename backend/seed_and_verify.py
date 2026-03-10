"""
Seed data and immediately verify it was saved.
"""
import asyncio
from pymongo import MongoClient, AsyncMongoClient
from seed.seed_data import seed

async def main():
    print("Starting seed process...")
    await seed()
    
    print("\n" + "="*60)
    print("Verifying data was saved...")
    print("="*60)
    
    # Use sync client to verify
    client = MongoClient('mongodb://localhost:27017')
    db = client['branch_command_center']
    
    # Check counts
    emp_count = db.employee.count_documents({})
    ts_count = db.timesheet_entry.count_documents({})
    config_count = db.integration_config.count_documents({})
    
    print(f"Employees: {emp_count}")
    print(f"Timesheet entries: {ts_count}")
    print(f"Integration configs: {config_count}")
    
    # Check March 2026 specifically
    march_count = db.timesheet_entry.count_documents({'period': '2026-03'})
    print(f"March 2026 timesheets: {march_count}")
    
    if emp_count > 0 and ts_count > 0:
        print("\n✅ Data successfully saved to database!")
    else:
        print("\n❌ Data was NOT saved to database!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
