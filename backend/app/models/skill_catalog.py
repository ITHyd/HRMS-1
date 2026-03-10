from typing import Optional
from beanie import Document


class SkillCatalog(Document):
    name: str
    category: str  # language | framework | cloud | tool | domain | soft_skill
    display_name: str
    description: Optional[str] = None
    pathway: Optional[str] = None

    class Settings:
        name = "skill_catalog"
        indexes = [
            "name",
            "category",
        ]
