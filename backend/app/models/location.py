from beanie import Document


class Location(Document):
    city: str
    country: str
    region: str  # "APAC" | "EMEA"
    code: str  # Short code like "HYD", "BLR", "LON", "SYD"

    class Settings:
        name = "locations"
