# Branch Command Center

A full-stack application for managing organizational structure, employees, and branch analytics. Features an interactive org chart, employee search, data import/export, and an audit log.

## Tech Stack

**Backend:** FastAPI, MongoDB (Beanie ODM), JWT authentication
**Frontend:** React 19, TypeScript, Tailwind CSS, React Flow, Recharts, Zustand

## Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB running on `localhost:27017`

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=branch_command_center
JWT_SECRET=your-secret-key
HRMS_BASE_URL=http://149.102.158.71:2342
HRMS_SYNC_MONTHS_BACKFILL=6
HRMS_DEMO_USERS=vikram.patel@company.com
HRMS_LIVE_DOMAINS=nxzen.com
HRMS_SECRET_NXZEN_MANAGER_USERNAME=
HRMS_SECRET_NXZEN_MANAGER_PASSWORD=
```

### HRMS Connector Notes

- Manual sync only: no webhook/poller.
- Configure HRMS connector in `Integrations -> HRMS` using `IntegrationConfig.config`.
- Recommended auth mode is `password_grant` with `secret_ref` (for example `NXZEN_MANAGER`).
- Credentials are resolved from env vars:
  - `HRMS_SECRET_<REF>_USERNAME`
  - `HRMS_SECRET_<REF>_PASSWORD`

Run the server:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000` with docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

## Project Structure

```
backend/
  app/
    main.py          # FastAPI app entry point
    config.py        # Settings via pydantic-settings
    models/          # Beanie document models
    schemas/         # Pydantic request/response schemas
    routers/         # API route handlers
    services/        # Business logic
    middleware/      # Auth middleware
    utils/           # JWT helpers
  seed/              # Database seed data generators
frontend/
  src/
    pages/           # Route pages (OrgChart, Analytics, Import, Audit)
    components/      # Reusable UI components
    store/           # Zustand state management
```

## API Endpoints

| Group      | Prefix        | Description               |
|------------|---------------|---------------------------|
| Auth       | `/auth`       | Login and authentication  |
| Org        | `/org`        | Org tree and structure    |
| Employees  | `/employees`  | Employee search and detail|
| Analytics  | `/analytics`  | Branch analytics data     |
| Import     | `/import`     | Data import (Excel/CSV)   |
| Export     | `/export`     | Data export (Excel/PDF)   |
| Audit      | `/audit`      | Audit log entries         |
| Health     | `/health`     | Health check              |
