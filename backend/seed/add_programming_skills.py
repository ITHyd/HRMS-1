"""
Add common programming language skills to complement Skills Portal data.

This script adds popular programming languages that are not in the Skills Portal API.
Run this after syncing from Skills Portal to have a complete skill set.

Usage: cd backend && python -m seed.add_programming_skills
"""

import asyncio
import sys
from pathlib import Path

from pymongo import AsyncMongoClient
from beanie import init_beanie

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.models.skill_catalog import SkillCatalog

# Common programming languages and frameworks not in Skills Portal
ADDITIONAL_SKILLS = [
    # Programming Languages
    {"name": "java", "display_name": "Java", "category": "Programming Languages", "description": "Object-oriented programming language", "pathway": "Technical Delivery"},
    {"name": "javascript", "display_name": "JavaScript", "category": "Programming Languages", "description": "Web programming language", "pathway": "Technical Delivery"},
    {"name": "typescript", "display_name": "TypeScript", "category": "Programming Languages", "description": "Typed superset of JavaScript", "pathway": "Technical Delivery"},
    {"name": "c#", "display_name": "C#", "category": "Programming Languages", "description": ".NET programming language", "pathway": "Technical Delivery"},
    {"name": "c++", "display_name": "C++", "category": "Programming Languages", "description": "Systems programming language", "pathway": "Technical Delivery"},
    {"name": "go", "display_name": "Go", "category": "Programming Languages", "description": "Google's systems programming language", "pathway": "Technical Delivery"},
    {"name": "rust", "display_name": "Rust", "category": "Programming Languages", "description": "Memory-safe systems programming", "pathway": "Technical Delivery"},
    {"name": "kotlin", "display_name": "Kotlin", "category": "Programming Languages", "description": "Modern JVM language", "pathway": "Technical Delivery"},
    {"name": "swift", "display_name": "Swift", "category": "Programming Languages", "description": "Apple's programming language", "pathway": "Technical Delivery"},
    {"name": "ruby", "display_name": "Ruby", "category": "Programming Languages", "description": "Dynamic programming language", "pathway": "Technical Delivery"},
    {"name": "php", "display_name": "PHP", "category": "Programming Languages", "description": "Server-side scripting language", "pathway": "Technical Delivery"},
    {"name": "scala", "display_name": "Scala", "category": "Programming Languages", "description": "Functional JVM language", "pathway": "Technical Delivery"},
    
    # Web Frameworks
    {"name": "react", "display_name": "React", "category": "Web Frameworks", "description": "JavaScript UI library", "pathway": "Technical Delivery"},
    {"name": "angular", "display_name": "Angular", "category": "Web Frameworks", "description": "TypeScript web framework", "pathway": "Technical Delivery"},
    {"name": "vue.js", "display_name": "Vue.js", "category": "Web Frameworks", "description": "Progressive JavaScript framework", "pathway": "Technical Delivery"},
    {"name": "node.js", "display_name": "Node.js", "category": "Web Frameworks", "description": "JavaScript runtime", "pathway": "Technical Delivery"},
    {"name": "express.js", "display_name": "Express.js", "category": "Web Frameworks", "description": "Node.js web framework", "pathway": "Technical Delivery"},
    {"name": "django", "display_name": "Django", "category": "Web Frameworks", "description": "Python web framework", "pathway": "Technical Delivery"},
    {"name": "flask", "display_name": "Flask", "category": "Web Frameworks", "description": "Python micro-framework", "pathway": "Technical Delivery"},
    {"name": "spring boot", "display_name": "Spring Boot", "category": "Web Frameworks", "description": "Java application framework", "pathway": "Technical Delivery"},
    {"name": ".net core", "display_name": ".NET Core", "category": "Web Frameworks", "description": "Cross-platform .NET", "pathway": "Technical Delivery"},
    
    # Databases
    {"name": "sql", "display_name": "SQL", "category": "Databases", "description": "Structured Query Language", "pathway": "Technical Delivery"},
    {"name": "postgresql", "display_name": "PostgreSQL", "category": "Databases", "description": "Advanced open-source database", "pathway": "Technical Delivery"},
    {"name": "mysql", "display_name": "MySQL", "category": "Databases", "description": "Popular open-source database", "pathway": "Technical Delivery"},
    {"name": "mongodb", "display_name": "MongoDB", "category": "Databases", "description": "NoSQL document database", "pathway": "Technical Delivery"},
    {"name": "redis", "display_name": "Redis", "category": "Databases", "description": "In-memory data store", "pathway": "Technical Delivery"},
    {"name": "elasticsearch", "display_name": "Elasticsearch", "category": "Databases", "description": "Search and analytics engine", "pathway": "Technical Delivery"},
    
    # Mobile Development
    {"name": "react native", "display_name": "React Native", "category": "Mobile Development", "description": "Cross-platform mobile framework", "pathway": "Technical Delivery"},
    {"name": "flutter", "display_name": "Flutter", "category": "Mobile Development", "description": "Google's UI toolkit", "pathway": "Technical Delivery"},
    {"name": "ios development", "display_name": "iOS Development", "category": "Mobile Development", "description": "Apple mobile development", "pathway": "Technical Delivery"},
    {"name": "android development", "display_name": "Android Development", "category": "Mobile Development", "description": "Android mobile development", "pathway": "Technical Delivery"},
]


async def add_programming_skills():
    client = AsyncMongoClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    await init_beanie(database=db, document_models=[SkillCatalog])

    print("Adding common programming skills...")
    
    added = 0
    updated = 0
    skipped = 0
    
    for skill_data in ADDITIONAL_SKILLS:
        skill_name = skill_data["name"].lower()
        
        # Check if skill already exists
        existing = await SkillCatalog.find_one(SkillCatalog.name == skill_name)
        
        if existing:
            print(f"  ⏭️  Skipped: {skill_data['display_name']} (already exists)")
            skipped += 1
        else:
            # Create new skill
            skill = SkillCatalog(
                name=skill_name,
                display_name=skill_data["display_name"],
                category=skill_data["category"],
                description=skill_data.get("description"),
                pathway=skill_data.get("pathway"),
            )
            await skill.insert()
            print(f"  ✅ Added: {skill_data['display_name']}")
            added += 1
    
    print(f"\n📊 Summary:")
    print(f"   Added: {added}")
    print(f"   Skipped: {skipped}")
    print(f"   Total: {added + skipped}")
    print(f"\n✅ Programming skills added successfully!")
    print(f"\nNow you can search for:")
    print(f"  - Java, JavaScript, TypeScript, Python")
    print(f"  - React, Angular, Vue.js, Node.js")
    print(f"  - SQL, PostgreSQL, MongoDB")
    print(f"  - And many more!")


if __name__ == "__main__":
    asyncio.run(add_programming_skills())
