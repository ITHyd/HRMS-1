from beanie import Document


class ReportingRelationship(Document):
    employee_id: str
    manager_id: str
    type: str  # "PRIMARY" | "FUNCTIONAL" | "PROJECT"

    class Settings:
        name = "reporting_relationships"
        indexes = [
            "employee_id",
            "manager_id",
            [("employee_id", 1), ("type", 1)],
            [("manager_id", 1), ("type", 1)],
        ]
