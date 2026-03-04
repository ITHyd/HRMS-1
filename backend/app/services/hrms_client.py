"""
Async HTTP client for the external HRMS portal.

Fetches employees, projects, locations, managers, and HRs from the
real HRMS REST API and returns parsed Python dicts/lists.
"""

import httpx

from app.config import settings


class HrmsClient:
    """Thin wrapper around the HRMS REST API."""

    def __init__(self, base_url: str | None = None, token: str | None = None):
        self.base_url = (base_url or settings.HRMS_BASE_URL).rstrip("/")
        self.token = token or settings.HRMS_TOKEN
        self._headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}

    # ------------------------------------------------------------------
    # Public endpoints (no auth required)
    # ------------------------------------------------------------------

    async def get_locations(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{self.base_url}/locations/")
            resp.raise_for_status()
            data = resp.json()
            # Response: {"status":"success","data":[...]}
            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data if isinstance(data, list) else []

    async def get_projects(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/projects/get_projects",
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, list) else []

    # ------------------------------------------------------------------
    # Protected endpoints (require auth token)
    # ------------------------------------------------------------------

    async def get_employees(self, hr_id: int = 1) -> list[dict]:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(
                f"{self.base_url}/users/employees",
                params={"hr_id": hr_id},
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            # Response: {"count": N, "employees": [...]}
            if isinstance(data, dict) and "employees" in data:
                return data["employees"]
            return data if isinstance(data, list) else []

    async def get_managers(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/users/managers",
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            # Response: {"managers": [...]}
            if isinstance(data, dict) and "managers" in data:
                return data["managers"]
            return data if isinstance(data, list) else []

    async def get_hrs(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/users/hrs",
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            # Response: {"HRs": [...]}
            if isinstance(data, dict) and "HRs" in data:
                return data["HRs"]
            return data if isinstance(data, list) else []

    # ------------------------------------------------------------------
    # Attendance / Timesheet endpoints
    # ------------------------------------------------------------------

    async def get_attendance_summary(
        self, hr_id: int, year: int, month: int
    ) -> list[dict]:
        """GET /attendance/hr-assigned — monthly summary for all employees."""
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.get(
                f"{self.base_url}/attendance/hr-assigned",
                params={"hr_id": hr_id, "year": year, "month": month},
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, list) else []

    async def get_daily_attendance(
        self, employee_id: int, year: int, month: int
    ) -> list[dict]:
        """GET /attendance/daily — per-employee daily entries with project breakdowns."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/attendance/daily",
                params={"employee_id": employee_id, "year": year, "month": month},
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, list) else []

    # ------------------------------------------------------------------
    # Allocation endpoints
    # ------------------------------------------------------------------

    async def get_allocations(self, month: str) -> dict:
        """GET /allocations/all?month=YYYY-MM — project allocations for all employees."""
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(
                f"{self.base_url}/allocations/all",
                params={"month": month},
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_employee_allocation(self, employee_id: int) -> dict:
        """GET /allocations/employee/{id} — per-employee allocation across months."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/allocations/employee/{employee_id}",
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()

    # ------------------------------------------------------------------
    # Holiday / Calendar endpoints
    # ------------------------------------------------------------------

    async def get_holidays(self) -> list[dict]:
        """GET /calendar/ — company holidays by location."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/calendar/",
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data if isinstance(data, list) else []

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self.base_url}/health")
                return resp.status_code == 200
        except Exception:
            return False
