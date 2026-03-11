from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import (
    analytics, audit, auth, availability, dashboard, employees, export_data,
    finance, hrms_sync, integration, org, projects, search, timesheets, utilisation,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Branch Command Center API",
    description="API for the Branch Head Command Center",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(org.router)
app.include_router(employees.router)
app.include_router(analytics.router)
app.include_router(export_data.router)
app.include_router(audit.router)
app.include_router(timesheets.router)
app.include_router(hrms_sync.router)
app.include_router(finance.router)
app.include_router(utilisation.router)
app.include_router(dashboard.router)
app.include_router(availability.router)
app.include_router(integration.router)
app.include_router(projects.router)
app.include_router(search.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
