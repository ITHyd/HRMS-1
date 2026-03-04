from typing import Optional

from beanie import Document


class Department(Document):
    name: str
    location_id: str
    parent_id: Optional[str] = None  # ID of parent department (for hierarchy)

    class Settings:
        name = "departments"
        indexes = [
            "location_id",
            "parent_id",
        ]
