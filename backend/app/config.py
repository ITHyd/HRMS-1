from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env from backend/ regardless of where the server is launched from
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "branch_command_center"
    JWT_SECRET: str = "super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 480  # 8 hours
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # HRMS integration
    HRMS_BASE_URL: str = "http://149.102.158.71:2342"
    HRMS_TOKEN: str = ""
    HRMS_AUTH_USERNAME: str = ""
    HRMS_AUTH_PASSWORD: str = ""
    HRMS_SYNC_MONTHS_BACKFILL: int = 6
    HRMS_LIVE_USERS: str = ""
    HRMS_LIVE_DOMAINS: str = "nxzen.com"
    HRMS_DEMO_USERS: str = "vikram.patel@company.com"

    # Skills integration
    SKILLS_BASE_URL: str = "http://skills.nxzen.com"
    SKILLS_TOKEN: str = ""
    SKILLS_USERNAME: str = ""
    SKILLS_PASSWORD: str = ""

settings = Settings()
