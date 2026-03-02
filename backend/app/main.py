from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import analytics, audit, auth, employees, export_data, import_data, org


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
app.include_router(import_data.router)
app.include_router(export_data.router)
app.include_router(audit.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
