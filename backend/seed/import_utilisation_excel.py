"""
Import a utilisation workbook directly into MongoDB.

Usage:
    cd backend
    python -m seed.import_utilisation_excel ^
        --file "C:\\Users\\sahit\\Downloads\\Utilisation Report 6th March 2026.xlsx" ^
        --user-email manager@nxzen.com
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import init_db
from app.models.user import User
from app.services.excel_utilisation_service import parse_and_store_excel


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import an Excel utilisation workbook into MongoDB.")
    parser.add_argument("--file", required=True, help="Path to the .xlsx workbook")
    parser.add_argument("--user-email", help="Resolve branch_location_id and uploaded_by from a local user")
    parser.add_argument("--branch-location-id", help="Branch location to attach the upload to")
    parser.add_argument("--user-id", help="Uploaded-by user id when --user-email is not provided")
    return parser


async def _resolve_context(args: argparse.Namespace) -> tuple[str, str]:
    if args.user_email:
        user = await User.find_one(User.email == args.user_email)
        if not user:
            raise SystemExit(f"User not found for email: {args.user_email}")
        return user.branch_location_id, str(user.id)

    if args.branch_location_id:
        return args.branch_location_id, args.user_id or "excel-import"

    raise SystemExit("Provide either --user-email or --branch-location-id.")


async def main():
    args = _build_parser().parse_args()
    workbook_path = Path(args.file)
    if not workbook_path.exists():
        raise SystemExit(f"Workbook not found: {workbook_path}")

    await init_db()
    branch_location_id, user_id = await _resolve_context(args)

    result = await parse_and_store_excel(
        file_content=workbook_path.read_bytes(),
        filename=workbook_path.name,
        branch_location_id=branch_location_id,
        user_id=user_id,
    )
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
