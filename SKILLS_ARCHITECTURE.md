# Skills Integration Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Skills Portal (External)                     │
│                    https://skills.nxzen.com                      │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Skills     │  │   Employee   │  │ Certifications│          │
│  │   Catalog    │  │    Skills    │  │   & Training  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS API Calls
                              │ (Bearer Token Auth)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Company Analytics Backend                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Skills Client (HTTP Client)                  │  │
│  │  • get_skill_catalog()                                    │  │
│  │  • get_employee_skills()                                  │  │
│  │  • get_certifications()                                   │  │
│  │  • get_training_programs()                                │  │
│  │  • health_check()                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Skills Sync Service (Business Logic)            │  │
│  │  • sync_skill_catalog()                                   │  │
│  │  • sync_employee_skills()                                 │  │
│  │  • get_skills_sync_logs()                                 │  │
│  │  • Error handling & logging                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Integration Router (API Endpoints)           │  │
│  │  POST /integrations/skills/sync/catalog                   │  │
│  │  POST /integrations/skills/sync/employee-skills           │  │
│  │  GET  /integrations/skills/sync-logs                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  MongoDB Database                         │  │
│  │  Collections:                                             │  │
│  │  • skill_catalog                                          │  │
│  │  • employee_skill                                         │  │
│  │  • sync_log                                               │  │
│  │  • integration_config                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              │ (JWT Auth)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Company Analytics Frontend                    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Integration Hub Page                     │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐         │  │
│  │  │  HRMS  │  │Finance │  │Dynamics│  │ Skills │         │  │
│  │  │  Tab   │  │  Tab   │  │  Tab   │  │  Tab   │ ← NEW   │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘         │  │
│  │                                            │               │  │
│  │  ┌─────────────────────────────────────────┐             │  │
│  │  │  Skills Portal Connector Card           │             │  │
│  │  │  • Status indicator                     │             │  │
│  │  │  • Sync button                          │             │  │
│  │  │  • Configuration settings               │             │  │
│  │  └─────────────────────────────────────────┘             │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────┐             │  │
│  │  │  Sync History Timeline                  │             │  │
│  │  │  • Sync logs with status                │             │  │
│  │  │  • Error details                        │             │  │
│  │  │  • Retry functionality                  │             │  │
│  │  └─────────────────────────────────────────┘             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Other Pages Using Skills Data                │  │
│  │  • Availability Page (skill filters)                      │  │
│  │  • Employee Detail (skill display)                        │  │
│  │  • Analytics (skill gap analysis)                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

### Skill Catalog Sync Flow

```
User                Frontend            Backend API         Sync Service        Skills Portal       Database
 │                     │                     │                    │                   │                │
 │  Click "Sync"       │                     │                    │                   │                │
 ├────────────────────>│                     │                    │                   │                │
 │                     │  POST /skills/      │                    │                   │                │
 │                     │  sync/catalog       │                    │                   │                │
 │                     ├────────────────────>│                    │                   │                │
 │                     │                     │  sync_skill_       │                   │                │
 │                     │                     │  catalog()         │                   │                │
 │                     │                     ├───────────────────>│                   │                │
 │                     │                     │                    │  GET /api/skills  │                │
 │                     │                     │                    ├──────────────────>│                │
 │                     │                     │                    │                   │                │
 │                     │                     │                    │  Skills data      │                │
 │                     │                     │                    │<──────────────────┤                │
 │                     │                     │                    │                   │                │
 │                     │                     │                    │  GET /api/skills/ │                │
 │                     │                     │                    │  categories       │                │
 │                     │                     │                    ├──────────────────>│                │
 │                     │                     │                    │                   │                │
 │                     │                     │                    │  Categories data  │                │
 │                     │                     │                    │<──────────────────┤                │
 │                     │                     │                    │                   │                │
 │                     │                     │                    │  Process & map    │                │
 │                     │                     │                    │  data             │                │
 │                     │                     │                    │                   │                │
 │                     │                     │                    │  Save to DB       │                │
 │                     │                     │                    ├──────────────────────────────────>│
 │                     │                     │                    │                   │                │
 │                     │                     │                    │  Create sync log  │                │
 │                     │                     │                    ├──────────────────────────────────>│
 │                     │                     │                    │                   │                │
 │                     │                     │  Sync result       │                   │                │
 │                     │                     │<───────────────────┤                   │                │
 │                     │  Response           │                    │                   │                │
 │                     │<────────────────────┤                    │                   │                │
 │  Success message    │                     │                    │                   │                │
 │<────────────────────┤                     │                    │                   │                │
 │                     │                     │                    │                   │                │
```

### Employee Skills Sync Flow

```
User                Frontend            Backend API         Sync Service        Skills Portal       Database
 │                     │                     │                    │                   │                │
 │  Click "Sync"       │                     │                    │                   │                │
 ├────────────────────>│                     │                    │                   │                │
 │                     │  POST /skills/      │                    │                   │                │
 │                     │  sync/employee-     │                    │                   │                │
 │                     │  skills             │                    │                   │                │
 │                     ├────────────────────>│                    │                   │                │
 │                     │                     │  sync_employee_    │                   │                │
 │                     │                     │  skills()          │                   │                │
 │                     │                     ├───────────────────>│                   │                │
 │                     │                     │                    │  GET /api/        │                │
 │                     │                     │                    │  employee-skills/ │                │
 │                     │                     │                    │  all              │                │
 │                     │                     │                    ├──────────────────>│                │
 │                     │                     │                    │                   │                │
 │                     │                     │                    │  Employee skills  │                │
 │                     │                     │                    │  data             │                │
 │                     │                     │                    │<──────────────────┤                │
 │                     │                     │                    │                   │                │
 │                     │                     │                    │  Map employees    │                │
 │                     │                     │                    │  by email         │                │
 │                     │                     │                    │                   │                │
 │                     │                     │                    │  Check/create     │                │
 │                     │                     │                    │  skills in        │                │
 │                     │                     │                    │  catalog          │                │
 │                     │                     │                    │                   │                │
 │                     │                     │                    │  Save employee    │                │
 │                     │                     │                    │  skills           │                │
 │                     │                     │                    ├──────────────────────────────────>│
 │                     │                     │                    │                   │                │
 │                     │                     │                    │  Create sync log  │                │
 │                     │                     │                    ├──────────────────────────────────>│
 │                     │                     │                    │                   │                │
 │                     │                     │  Sync result       │                   │                │
 │                     │                     │<───────────────────┤                   │                │
 │                     │  Response           │                    │                   │                │
 │                     │<────────────────────┤                    │                   │                │
 │  Success message    │                     │                    │                   │                │
 │<────────────────────┤                     │                    │                   │                │
 │                     │                     │                    │                   │                │
```

## Component Responsibilities

### Skills Client
- **Purpose:** HTTP communication with Skills Portal API
- **Responsibilities:**
  - Make authenticated API requests
  - Handle response parsing
  - Manage connection timeouts
  - Provide health check functionality
- **Dependencies:** httpx, app.config

### Skills Sync Service
- **Purpose:** Business logic for syncing skills data
- **Responsibilities:**
  - Orchestrate sync operations
  - Map external data to internal models
  - Handle data validation
  - Create and update sync logs
  - Error handling and reporting
- **Dependencies:** Skills Client, Database Models

### Integration Router
- **Purpose:** Expose Skills sync functionality via REST API
- **Responsibilities:**
  - Define API endpoints
  - Handle authentication
  - Validate requests
  - Return appropriate responses
- **Dependencies:** Skills Sync Service, Auth Middleware

### Integration Page (Frontend)
- **Purpose:** User interface for Skills integration
- **Responsibilities:**
  - Display integration status
  - Trigger sync operations
  - Show sync history
  - Handle user interactions
- **Dependencies:** API Client, React Components

## Security Considerations

1. **API Token Storage:**
   - Tokens stored in integration_config collection
   - Never exposed in frontend code
   - Retrieved server-side only

2. **Authentication:**
   - All API endpoints require JWT authentication
   - User permissions checked before sync operations

3. **Data Validation:**
   - Input validation on all API requests
   - Email validation for employee mapping
   - Skill name sanitization

4. **Error Handling:**
   - Sensitive error details not exposed to frontend
   - Detailed errors logged server-side only
   - Generic error messages for users

## Performance Optimization

1. **Batch Processing:**
   - Skills synced in batches to reduce memory usage
   - Database operations optimized with bulk inserts

2. **Caching:**
   - Employee email-to-ID mapping cached during sync
   - Skill catalog cached to avoid repeated lookups

3. **Async Operations:**
   - All API calls use async/await
   - Non-blocking I/O for better performance

4. **Incremental Updates:**
   - Only changed records updated
   - Duplicate detection prevents redundant inserts

## Monitoring & Logging

### Sync Logs Track:
- Batch ID (unique identifier)
- Integration type (skills)
- Sync type (catalog or employee_skills)
- Status (running, completed, failed)
- Record counts (total, imported, updated, errors)
- Error details
- Timestamps (started_at, completed_at)
- Triggered by (user_id)

### Backend Logs Include:
- API request/response details
- Error stack traces
- Performance metrics
- Database query times

## Scalability

The architecture supports:
- **Horizontal Scaling:** Multiple backend instances can run syncs
- **Large Datasets:** Batch processing handles thousands of records
- **Concurrent Syncs:** Different integration types can sync simultaneously
- **Rate Limiting:** Client respects API rate limits
- **Retry Logic:** Failed syncs can be retried automatically

## Future Enhancements

1. **Webhook Support:** Real-time updates from Skills Portal
2. **Scheduled Syncs:** Automated daily/weekly syncs
3. **Partial Syncs:** Sync only changed records
4. **Conflict Resolution:** Handle data conflicts intelligently
5. **Audit Trail:** Track all changes to skills data
6. **Analytics:** Skill trend analysis and reporting
