from beanie import Document


class EmployeeProject(Document):
    employee_id: str
    project_id: str
    role_in_project: str

    class Settings:
        name = "employee_projects"
        indexes = [
            "employee_id",
            "project_id",
        ]
