"""
Async HTTP client for the Skills Portal (skills.nxzen.com).

Fetches employee skills, skill catalog, certifications, and training data
from the Skills REST API.
"""

import httpx

from app.config import settings


class SkillsClient:
    """Thin wrapper around the Skills REST API."""

    def __init__(self, base_url: str | None = None, token: str | None = None):
        self.base_url = (base_url or settings.SKILLS_BASE_URL).rstrip("/")
        self.token = token or settings.SKILLS_TOKEN
        self._headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}

    # ------------------------------------------------------------------
    # Skill Catalog endpoints
    # ------------------------------------------------------------------

    async def get_skill_catalog(self) -> list[dict]:
        """GET /api/skills/ - Fetch all available skills in the catalog."""
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(
                f"{self.base_url}/api/skills/",
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            # API returns {"value": [...], "Count": 100}
            if isinstance(data, dict) and "value" in data:
                return data["value"]
            # Fallback: if it's already a list
            return data if isinstance(data, list) else []

    async def get_skill_categories(self) -> list[dict]:
        """GET /api/skills/categories - Fetch skill categories."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/api/skills/categories",
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data if isinstance(data, list) else []

    # ------------------------------------------------------------------
    # Employee Skills endpoints
    # ------------------------------------------------------------------

    async def get_employee_skills(self, employee_id: int | None = None) -> list[dict]:
        """
        GET /api/employee-skills - Fetch employee skills.
        If employee_id is provided, fetch skills for that employee only.
        """
        async with httpx.AsyncClient(timeout=60) as client:
            params = {}
            if employee_id:
                params["employee_id"] = employee_id

            resp = await client.get(
                f"{self.base_url}/api/employee-skills",
                params=params,
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            # Handle different response formats
            if isinstance(data, dict):
                if "skills" in data:
                    return data["skills"]
                elif "data" in data:
                    return data["data"]
            return data if isinstance(data, list) else []

    async def get_all_employee_skills(self) -> list[dict]:
        """GET /api/employee-skills/all - Fetch all employee skills across organization."""
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.get(
                f"{self.base_url}/api/employee-skills/all",
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data if isinstance(data, list) else []

    # ------------------------------------------------------------------
    # Certifications endpoints
    # ------------------------------------------------------------------

    async def get_certifications(self, employee_id: int | None = None) -> list[dict]:
        """GET /api/certifications - Fetch employee certifications."""
        async with httpx.AsyncClient(timeout=30) as client:
            params = {}
            if employee_id:
                params["employee_id"] = employee_id

            resp = await client.get(
                f"{self.base_url}/api/certifications",
                params=params,
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data if isinstance(data, list) else []

    # ------------------------------------------------------------------
    # Training endpoints
    # ------------------------------------------------------------------

    async def get_training_programs(self) -> list[dict]:
        """GET /api/training/programs - Fetch available training programs."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/api/training/programs",
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data if isinstance(data, list) else []

    async def get_employee_training(self, employee_id: int) -> list[dict]:
        """GET /api/training/employee/{id} - Fetch training history for an employee."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/api/training/employee/{employee_id}",
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data if isinstance(data, list) else []

    # ------------------------------------------------------------------
    # Skill Gap Analysis endpoints
    # ------------------------------------------------------------------

    async def get_skill_gaps(self, department_id: int | None = None) -> list[dict]:
        """GET /api/skills/gaps - Fetch skill gap analysis."""
        async with httpx.AsyncClient(timeout=30) as client:
            params = {}
            if department_id:
                params["department_id"] = department_id

            resp = await client.get(
                f"{self.base_url}/api/skills/gaps",
                params=params,
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
        """Check if the Skills API is accessible."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self.base_url}/health")
                return resp.status_code == 200
        except Exception:
            return False
