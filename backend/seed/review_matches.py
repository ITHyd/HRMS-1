"""
Interactive match review for Excel → HRMS employee name mapping.

Usage:
    cd backend
    python -m seed.review_matches --file "path/to/Utilisation_Report.xlsx" --user-email manager@nxzen.com

For each fuzzy match candidate, you'll be asked: y (accept) / n (reject) / s (skip all remaining)
Accepted overrides are saved to: seed/match_overrides.json
"""

import argparse
import asyncio
import io
import json
import re
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import openpyxl

from app.database import init_db
from app.models.employee import Employee
from app.models.user import User
from app.services.excel_utilisation_service import (
    _meaningful_tokens,
    _normalise_name,
    _select_sheet,
    _parse_ytpl_sheet,
    _normalise_text,
)

OVERRIDES_FILE = Path(__file__).parent / "match_overrides.json"
THRESHOLD = 0.45


def _norm(value: str) -> str:
    c = value.lower().strip()
    c = re.sub(r"\s*[-(]?\s*(onsite|offshore)\s*[)]?\s*$", "", c)
    c = re.sub(r"[^a-z0-9]+", "", c)
    return c


def _build_maps(employees: list[Employee]):
    exact, normalised, token_index = {}, {}, {}
    for e in employees:
        exact[e.name.strip().lower()] = e
        normalised[_normalise_name(e.name)] = e
        for token in _meaningful_tokens(e.name):
            token_index.setdefault(token, []).append(e)
    return exact, normalised, token_index


def _fuzzy_candidates(name: str, token_index: dict, top_n: int = 3):
    query_tokens = _meaningful_tokens(name)
    if not query_tokens:
        return []
    candidates: dict[str, tuple] = {}
    for token in query_tokens:
        for emp in token_index.get(token, []):
            eid = str(emp.id)
            if eid not in candidates:
                candidates[eid] = (emp, 0)
            candidates[eid] = (emp, candidates[eid][1] + 1)

    scored = []
    for emp, common in candidates.values():
        emp_tokens = _meaningful_tokens(emp.name)
        denom = max(len(query_tokens), len(emp_tokens))
        score = common / denom if denom else 0.0
        scored.append((score, emp))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [(score, emp) for score, emp in scored if score >= THRESHOLD][:top_n]


def _extract_excel_names(file_content: bytes) -> list[str]:
    wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
    sheet = _select_sheet(wb)
    all_rows = list(sheet.iter_rows(values_only=True))
    month_col_map, header_row_idx = _parse_ytpl_sheet(sheet)

    if not month_col_map:
        return []

    header = all_rows[header_row_idx]
    name_col = None
    status_col = None
    for col_index, cell in enumerate(header):
        if col_index in month_col_map:
            continue
        value = _normalise_text(cell).lower()
        if value == "name":
            name_col = col_index
        elif value == "status":
            status_col = col_index

    if name_col is None:
        name_col = 2
    if status_col is None:
        status_col = 3

    names = []
    for row in all_rows[header_row_idx + 1:]:
        if not row or len(row) <= name_col:
            continue
        employee_name = _normalise_text(row[name_col])
        if not employee_name or employee_name.lower() in {"name", "total", "grand total"}:
            continue
        if status_col is not None and len(row) > status_col:
            status_value = _normalise_text(row[status_col]).lower()
            if status_value in {"left", "inactive", "resigned", "terminated"}:
                continue
        names.append(employee_name)
    return names


async def run(file_path: Path, user_email: str):
    await init_db()

    user = await User.find_one(User.email == user_email)
    if not user:
        raise SystemExit(f"User not found: {user_email}")

    branch_location_id = user.branch_location_id
    employees = await Employee.find(
        Employee.location_id == branch_location_id,
        Employee.is_active == True,
    ).to_list()

    exact_map, norm_map, token_index = _build_maps(employees)

    content = file_path.read_bytes()
    excel_names = _extract_excel_names(content)

    # Load existing overrides
    overrides: dict[str, Optional[str]] = {}  # excel_name -> employee_id or None (rejected)
    if OVERRIDES_FILE.exists():
        overrides = json.loads(OVERRIDES_FILE.read_text())
        print(f"Loaded {len(overrides)} existing overrides from {OVERRIDES_FILE.name}\n")

    # Separate exact/norm matches from fuzzy-only
    fuzzy_only: list[tuple[str, list]] = []
    exact_count = 0
    for name in excel_names:
        exact_hit = exact_map.get(name.strip().lower()) or norm_map.get(_normalise_name(name))
        if exact_hit:
            exact_count += 1
            continue
        if name in overrides:
            continue  # already decided
        candidates = _fuzzy_candidates(name, token_index)
        fuzzy_only.append((name, candidates))

    print(f"Total Excel names  : {len(excel_names)}")
    print(f"Exact/norm matches : {exact_count}")
    print(f"Already decided    : {len([n for n in excel_names if n in overrides and exact_map.get(n.strip().lower()) is None])}")
    print(f"Needs review       : {len(fuzzy_only)}")
    print()

    if not fuzzy_only:
        print("Nothing to review.")
        return

    accepted = rejected = skipped = 0

    for i, (excel_name, candidates) in enumerate(fuzzy_only, 1):
        print(f"[{i}/{len(fuzzy_only)}] Excel name: \"{excel_name}\"")

        if not candidates:
            print("  → No fuzzy candidates above threshold. Will stay UNMATCHED.\n")
            overrides[excel_name] = None
            rejected += 1
            continue

        for rank, (score, emp) in enumerate(candidates, 1):
            print(f"  {rank}. \"{emp.name}\"  (score={score:.2f}, dept={getattr(emp, 'department_id', '')[:8]}...)")

        print("  Enter: 1/2/3 to accept that match | n = unmatched | s = stop reviewing")
        choice = input("  Your choice: ").strip().lower()

        if choice == "s":
            print("Stopping review early.")
            skipped = len(fuzzy_only) - i
            break
        elif choice in {"1", "2", "3"}:
            idx = int(choice) - 1
            if idx < len(candidates):
                _, chosen_emp = candidates[idx]
                overrides[excel_name] = str(chosen_emp.id)
                print(f"  ✓ Mapped to \"{chosen_emp.name}\"\n")
                accepted += 1
            else:
                print("  Invalid choice, skipping.\n")
        else:
            overrides[excel_name] = None
            print(f"  ✗ Marked as UNMATCHED\n")
            rejected += 1

    OVERRIDES_FILE.write_text(json.dumps(overrides, indent=2, ensure_ascii=False))
    print(f"\nSaved overrides → {OVERRIDES_FILE}")
    print(f"Accepted: {accepted}, Rejected: {rejected}, Skipped: {skipped}")
    print("\nRun seed_excel.py to apply these overrides.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--user-email", default="manager@nxzen.com")
    args = parser.parse_args()
    path = Path(args.file)
    if not path.exists():
        raise SystemExit(f"File not found: {path}")
    asyncio.run(run(path, args.user_email))


if __name__ == "__main__":
    main()
