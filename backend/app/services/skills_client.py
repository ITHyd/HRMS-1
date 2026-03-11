"""
Skills Portal API client for fetching skills data from skills.nxzen.com
"""

import httpx
from typing import List, Dict, Any
from app.config import settings


class SkillsClient:
    def __init__(self):
        self.base_url = settings.SKILLS_BASE_URL
        self.token = settings.SKILLS_TOKEN
        
    async def get_skills(self) -> List[Dict[str, Any]]:
        """
        Fetch all skills from Skills Portal API
        Returns list of skills with structure:
        {
            "id": int,
            "name": str,
            "description": str,
            "category": str,
            "pathway": str,
            "level": str,
            "tags": List[str]
        }
        """
        try:
            headers = {}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(
                    f"{self.base_url}/api/skills",
                    headers=headers,
                    params={"limit": 5000}  # Get all skills (current max is ~823)
                )
                response.raise_for_status()
                
                data = response.json()
                
                # The API returns a list of skills directly
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    # Handle different response formats
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
            headers = {}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/skills",
                    headers=headers,
                    params={"category": category}
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Error fetching skills by category: {e}")
            return []
    
    async def get_skills_by_pathway(self, pathway: str) -> List[Dict[str, Any]]:
        """Get skills filtered by pathway"""
        try:
            headers = {}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/skills",
                    headers=headers,
                    params={"pathway": pathway}
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Error fetching skills by pathway: {e}")
            return []
    
    async def get_categories(self) -> List[str]:
        """Get all available skill categories"""
        try:
            headers = {}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/categories",
                    headers=headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Error fetching categories: {e}")
            return []
    
    async def get_pathways(self) -> List[str]:
        """Get all available skill pathways"""
        try:
            headers = {}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/pathways",
                    headers=headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Error fetching pathways: {e}")
            return []


# Global instance
skills_client = SkillsClient()