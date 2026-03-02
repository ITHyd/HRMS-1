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
```

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
