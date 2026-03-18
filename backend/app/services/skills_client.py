"""
Skills Portal API client for fetching skills data from skills.nxzen.com
"""

import asyncio
import httpx
from typing import List, Dict, Any, Optional
from app.config import settings


class SkillsClient:
    def __init__(self):
        self.base_url = settings.SKILLS_BASE_URL.rstrip("/")
        self.token: Optional[str] = settings.SKILLS_TOKEN or None
        self._authenticated = False

    async def _ensure_auth(self):
        """Authenticate with username/password if no static token is set."""
        if self.token and self._authenticated:
            return
        if self.token:
            self._authenticated = True
            return
        username = settings.SKILLS_USERNAME
        password = settings.SKILLS_PASSWORD
        if not username or not password:
            return
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                resp = await client.post(
                    f"{self.base_url}/api/auth/login",
                    json={"email": username, "password": password},
                )
                resp.raise_for_status()
                data = resp.json()
                self.token = data.get("access_token") or data.get("token") or ""
                self._authenticated = True
        except Exception as e:
            print(f"Skills portal login failed: {e}")

    def _headers(self) -> dict:
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def get_skills(self) -> List[Dict[str, Any]]:
        """Fetch all skills from Skills Portal API."""
        try:
            await self._ensure_auth()
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(
                    f"{self.base_url}/api/skills",
                    headers=self._headers(),
                    params={"limit": 5000},
                )
                response.raise_for_status()
                data = response.json()
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    return data.get("skills", data.get("data", []))
                return []
        except httpx.HTTPError as e:
            print(f"HTTP error fetching skills: {e}")
            return []
        except Exception as e:
            print(f"Error fetching skills: {e}")
            return []

    async def get_all_portal_employees(self) -> List[Dict[str, Any]]:
        """Fetch all employees registered in the Skills Portal."""
        try:
            await self._ensure_auth()
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(
                    f"{self.base_url}/api/admin/employees",
                    headers=self._headers(),
                )
                response.raise_for_status()
                data = response.json()
                return data if isinstance(data, list) else []
        except Exception as e:
            print(f"Error fetching portal employees: {e}")
            return []

    async def get_employee_skills(self, employee_id: str) -> List[Dict[str, Any]]:
        """
        Fetch skills for a specific employee from the Skills Portal.
        employee_id is the portal's employee_id string (e.g. "100013").
        Returns list of skill objects with name, category, pathway, proficiency etc.
        """
        try:
            await self._ensure_auth()
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(
                    f"{self.base_url}/api/admin/employees/{employee_id}/skills",
                    headers=self._headers(),
                )
                response.raise_for_status()
                data = response.json()
                return data if isinstance(data, list) else []
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                # Rate limited — wait and retry once
                await asyncio.sleep(2)
                try:
                    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                        response = await client.get(
                            f"{self.base_url}/api/admin/employees/{employee_id}/skills",
                            headers=self._headers(),
                        )
                        response.raise_for_status()
                        return response.json() if isinstance(response.json(), list) else []
                except Exception:
                    return []
            print(f"HTTP error fetching skills for {employee_id}: {e}")
            return []
        except Exception as e:
            print(f"Error fetching skills for employee {employee_id}: {e}")
            return []

    async def get_categories(self) -> List[str]:
        """Get all available skill categories."""
        try:
            await self._ensure_auth()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/categories/",
                    headers=self._headers(),
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Error fetching categories: {e}")
            return []

    async def get_pathways(self) -> List[str]:
        """Get all available skill pathways."""
        try:
            await self._ensure_auth()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/skills/pathways",
                    headers=self._headers(),
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Error fetching pathways: {e}")
            return []


# Global instance
skills_client = SkillsClient()
