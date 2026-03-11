"""
Skills Portal API client for fetching skills data from skills.nxzen.com
"""

import httpx
from typing import List, Dict, Any
from app.config import settings


class SkillsClient:
    def __init__(self):
        self.base_url = settings.SKILLS_BASE_URL.rstrip("/")
        self.token = settings.SKILLS_TOKEN
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
                    f"{self.base_url}/users/login",
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
        """
        Fetch all skills from Skills Portal API
        """
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
                else:
                    return []

        except httpx.HTTPError as e:
            print(f"HTTP error fetching skills: {e}")
            return []
        except Exception as e:
            print(f"Error fetching skills: {e}")
            return []

    async def get_skills_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get skills filtered by category"""
        try:
            await self._ensure_auth()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/skills",
                    headers=self._headers(),
                    params={"category": category},
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Error fetching skills by category: {e}")
            return []

    async def get_skills_by_pathway(self, pathway: str) -> List[Dict[str, Any]]:
        """Get skills filtered by pathway"""
        try:
            await self._ensure_auth()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/skills",
                    headers=self._headers(),
                    params={"pathway": pathway},
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Error fetching skills by pathway: {e}")
            return []

    async def get_categories(self) -> List[str]:
        """Get all available skill categories"""
        try:
            await self._ensure_auth()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/categories",
                    headers=self._headers(),
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Error fetching categories: {e}")
            return []

    async def get_pathways(self) -> List[str]:
        """Get all available skill pathways"""
        try:
            await self._ensure_auth()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/pathways",
                    headers=self._headers(),
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Error fetching pathways: {e}")
            return []


# Global instance
skills_client = SkillsClient()
