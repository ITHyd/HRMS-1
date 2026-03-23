import asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

async def main():
    from app.database import init_db
    from app.models.project_allocation import ProjectAllocation
    from app.models.project import Project

    await init_db()

    allocs = await ProjectAllocation.find(
        ProjectAllocation.period == "2026-03",
        ProjectAllocation.source_system == "intercompany_excel",
    ).to_list()

    print(f"ProjectAllocation rows (2026-03, intercompany_excel): {len(allocs)}")

    # Group by project
    by_proj = {}
    for a in allocs:
        by_proj.setdefault(a.project_name, {'count': 0, 'client': a.client_name})
        by_proj[a.project_name]['count'] += 1

    print(f"Unique projects in allocations: {len(by_proj)}")
    for name, d in sorted(by_proj.items(), key=lambda x: -x[1]['count']):
        print(f"  [{d['count']:3d}] {d['client']} | {name}")

    # Check projects collection
    projs = await Project.find(
        Project.source_system == "intercompany_excel",
        Project.is_deleted != True,
    ).to_list()
    print(f"\nProject docs with source_system=intercompany_excel: {len(projs)}")

asyncio.run(main())
