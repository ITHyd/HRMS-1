"""
Async HTTP client for the external HRMS portal.

Fetches employees, projects, locations, managers, and HRs from the
real HRMS REST API and returns parsed Python dicts/lists.
"""

import asyncio
from typing import Any

import httpx

from app.config import settings


class HrmsClient:
    """Thin wrapper around the HRMS REST API."""

    def __init__(
        self,
        base_url: str | None = None,
        token: str | None = None,
        max_retries: int = 3,
        backoff_seconds: float = 0.5,
    ):
        self.base_url = (base_url or settings.HRMS_BASE_URL).rstrip("/")
        self.token = token or settings.HRMS_TOKEN
        self._headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        self.max_retries = max(1, max_retries)
        self.backoff_seconds = max(0.1, backoff_seconds)

    async def _request(
        self,
        method: str,
        path: str,
        *,
        timeout: int,
        headers: dict | None = None,
        params: dict | None = None,
        data: dict | None = None,
    ) -> Any:
        url = f"{self.base_url}{path}"
        merged_headers = {}
        if self._headers:
            merged_headers.update(self._headers)
        if headers:
            merged_headers.update(headers)

        last_exc: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    resp = await client.request(
                        method=method,
                        url=url,
                        headers=merged_headers or None,
                        params=params,
                        data=data,
                    )

                if resp.status_code in {429, 500, 502, 503, 504} and attempt < self.max_retries:
                    await asyncio.sleep(self.backoff_seconds * attempt)
                    continue

                resp.raise_for_status()
                return resp.json()
            except (httpx.TimeoutException, httpx.RequestError, httpx.HTTPStatusError) as exc:
                last_exc = exc
                should_retry = attempt < self.max_retries
                if isinstance(exc, httpx.HTTPStatusError):
                    status = exc.response.status_code if exc.response is not None else 0
                    should_retry = should_retry and status in {429, 500, 502, 503, 504}
                if not should_retry:
                    raise
                await asyncio.sleep(self.backoff_seconds * attempt)

        if last_exc:
            raise last_exc
        raise RuntimeError("HRMS request failed without an exception")

    async def login_with_password(self, username: str, password: str) -> dict:
        """
        Authenticate against HRMS /users/login and set bearer token on this client.

        Returns response payload that includes access_token and employeeId.
        """
        form = {
            "username": username,
            "password": password,
            "grant_type": "password",
        }
        data = await self._request(
            "POST",
            "/users/login",
            timeout=30,
            data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        access_token = data.get("access_token")
        if not access_token:
            raise ValueError("HRMS login response missing access_token")

        self.token = access_token
        self._headers = {"Authorization": f"Bearer {self.token}"}
        return data

    # ------------------------------------------------------------------
    # Public endpoints (no auth required)
    # ------------------------------------------------------------------

    async def get_locations(self) -> list[dict]:
        data = await self._request("GET", "/locations/", timeout=30)
        # Response: {"status":"success","data":[...]}
        if isinstance(data, dict) and "data" in data:
            return data["data"]
        return data if isinstance(data, list) else []

    async def get_projects(self) -> list[dict]:
        data = await self._request(
            "GET",
            "/projects/get_projects",
            timeout=30,
        )
        return data if isinstance(data, list) else []

    # ------------------------------------------------------------------
    # Protected endpoints (require auth token)
    # ------------------------------------------------------------------

    async def get_employees(self, hr_id: int | None = None) -> list[dict]:
        params = {"hr_id": hr_id} if hr_id is not None else None
        data = await self._request(
            "GET",
            "/users/employees",
            timeout=60,
            params=params,
        )
        # Response: {"count": N, "employees": [...]}
        if isinstance(data, dict) and "employees" in data:
            return data["employees"]
        return data if isinstance(data, list) else []

    async def get_managers(self) -> list[dict]:
        data = await self._request(
            "GET",
            "/users/managers",
            timeout=30,
        )
        # Response: {"managers": [...]} 
        if isinstance(data, dict) and "managers" in data:
            return data["managers"]
        return data if isinstance(data, list) else []

    async def get_hrs(self) -> list[dict]:
        data = await self._request(
            "GET",
            "/users/hrs",
            timeout=30,
        )
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
        """GET /attendance/hr-assigned - monthly summary for all employees."""
        data = await self._request(
            "GET",
            "/attendance/hr-assigned",
            timeout=120,
            params={"hr_id": hr_id, "year": year, "month": month},
        )
        return data if isinstance(data, list) else []

    async def get_daily_attendance(
        self, employee_id: int, year: int, month: int
    ) -> list[dict]:
        """GET /attendance/daily - per-employee daily entries with project breakdowns."""
        data = await self._request(
            "GET",
            "/attendance/daily",
            timeout=30,
            params={"employee_id": employee_id, "year": year, "month": month},
        )
        return data if isinstance(data, list) else []

    # ------------------------------------------------------------------
    # Allocation endpoints
    # ------------------------------------------------------------------

    async def get_allocations(self, month: str) -> dict:
        """GET /allocations/all?month=YYYY-MM - project allocations for all employees."""
        data = await self._request(
            "GET",
            "/allocations/all",
            timeout=60,
            params={"month": month},
        )
        return data if isinstance(data, dict) else {}

    async def get_employee_allocation(self, employee_id: int) -> dict:
        """GET /allocations/employee/{id} - per-employee allocation across months."""
        data = await self._request(
            "GET",
            f"/allocations/employee/{employee_id}",
            timeout=30,
        )
        return data if isinstance(data, dict) else {}

    # ------------------------------------------------------------------
    # Holiday / Calendar endpoints
    # ------------------------------------------------------------------

    async def get_holidays(self) -> list[dict]:
        """GET /calendar/ - company holidays by location."""
        data = await self._request(
            "GET",
            "/calendar/",
            timeout=30,
        )
        if isinstance(data, dict) and "data" in data:
            return data["data"]
        return data if isinstance(data, list) else []

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    async def health_check(self) -> bool:
        try:
            data = await self._request("GET", "/health", timeout=10)
            return isinstance(data, dict)
        except Exception:
            return False
