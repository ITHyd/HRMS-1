from beanie import Document


class Department(Document):
    name: str
    location_id: str

    class Settings:
        name = "departments"
        indexes = [
            "location_id",
        ]
