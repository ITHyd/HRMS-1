# Skills Portal Integration

## Overview

The Skills Portal integration connects your Company Analytics platform with the Skills Portal (https://skills.nxzen.com) to sync employee skills, certifications, training data, and skill gap analysis.

## Features

### 1. Skill Catalog Sync
- Syncs all available skills from the Skills Portal
- Organizes skills by categories (language, framework, cloud, tool, domain, soft_skill)
- Updates existing skills and creates new ones
- Maintains skill display names and descriptions

### 2. Employee Skills Sync
- Syncs employee skill assignments with proficiency levels
- Maps employees by email address
- Supports proficiency levels: beginner, intermediate, advanced, expert
- Automatically creates missing skills in the catalog

### 3. Sync Logging
- Tracks all sync operations with detailed logs
- Records imported, updated, and error counts
- Stores error details for troubleshooting
- Provides sync history with timestamps

## Architecture

### Backend Components

#### 1. Skills Client (`app/services/skills_client.py`)
HTTP client for the Skills Portal API with the following endpoints:

**Skill Catalog:**
- `GET /api/skills` - Fetch all available skills
- `GET /api/skills/categories` - Fetch skill categories

**Employee Skills:**
- `GET /api/employee-skills` - Fetch employee skills (optional employee_id filter)
- `GET /api/employee-skills/all` - Fetch all employee skills across organization

**Certifications:**
- `GET /api/certifications` - Fetch employee certifications

**Training:**
- `GET /api/training/programs` - Fetch available training programs
- `GET /api/training/employee/{id}` - Fetch training history for an employee

**Skill Gap Analysis:**
- `GET /api/skills/gaps` - Fetch skill gap analysis (optional department_id filter)

**Health Check:**
- `GET /health` - Check API availability

#### 2. Skills Sync Service (`app/services/skills_sync_service.py`)

**Functions:**
- `sync_skill_catalog(token, user_id)` - Syncs skill catalog from Skills Portal
- `sync_employee_skills(token, user_id)` - Syncs employee skill assignments
- `get_skills_sync_logs(page, page_size)` - Retrieves paginated sync logs

#### 3. API Endpoints (`app/routers/integration.py`)

**Skills Sync Endpoints:**
- `POST /integrations/skills/sync/catalog` - Trigger skill catalog sync
- `POST /integrations/skills/sync/employee-skills` - Trigger employee skills sync
- `GET /integrations/skills/sync-logs` - List sync logs with pagination

### Frontend Components

#### Integration Page (`src/pages/IntegrationPage.tsx`)
- Added "Skills" tab to Integration Hub
- Displays Skills connector configuration
- Shows sync history timeline
- Provides sync trigger buttons

## Configuration

### Environment Variables

Add to your `.env` file:

```env
SKILLS_BASE_URL=https://skills.nxzen.com
SKILLS_TOKEN=your_api_token_here
```

### Database Configuration

The Skills integration config is automatically created during database seeding:

```python
{
    "integration_type": "skills",
    "name": "Skills Portal Connector",
    "status": "active",
    "config": {
        "endpoint": "https://skills.nxzen.com",
        "token": "",
        "sync_frequency": "daily"
    }
}
```

## Usage

### 1. Configure API Token

1. Navigate to **Integration Hub** in the application
2. Click on the **Skills** tab
3. Click on the Skills Portal Connector configuration
4. Add your Skills Portal API token
5. Save the configuration

### 2. Sync Skill Catalog

**Via UI:**
1. Go to Integration Hub > Skills tab
2. Click "Sync" on the Skills Portal Connector
3. Select "Sync Skill Catalog"
4. Monitor progress in the sync logs

**Via API:**
```bash
curl -X POST http://localhost:8000/integrations/skills/sync/catalog \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "batch_id": "uuid",
  "status": "completed",
  "imported_count": 45,
  "updated_count": 12,
  "error_count": 0
}
```

### 3. Sync Employee Skills

**Via UI:**
1. Go to Integration Hub > Skills tab
2. Click "Sync" on the Skills Portal Connector
3. Select "Sync Employee Skills"
4. Monitor progress in the sync logs

**Via API:**
```bash
curl -X POST http://localhost:8000/integrations/skills/sync/employee-skills \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "batch_id": "uuid",
  "status": "completed",
  "imported_count": 234,
  "updated_count": 56,
  "error_count": 3
}
```

### 4. View Sync Logs

**Via UI:**
- Navigate to Integration Hub > Skills tab
- Scroll to "Sync History" section
- View detailed logs with timestamps and status

**Via API:**
```bash
curl -X GET "http://localhost:8000/integrations/skills/sync-logs?page=1&page_size=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Data Models

### Skill Catalog
```python
{
    "name": "python",              # Lowercase skill identifier
    "display_name": "Python",      # Display name
    "category": "language",        # Category (language, framework, etc.)
    "description": "..."           # Optional description
}
```

### Employee Skill
```python
{
    "employee_id": "mongo_id",
    "skill_name": "python",
    "proficiency": "advanced",     # beginner, intermediate, advanced, expert
    "added_by": "user_id",
    "added_at": "timestamp",
    "updated_at": "timestamp"
}
```

### Sync Log
```python
{
    "batch_id": "uuid",
    "integration_type": "skills",
    "sync_type": "skill_catalog" | "employee_skills",
    "status": "running" | "completed" | "failed",
    "total_records": 100,
    "imported_count": 45,
    "updated_count": 12,
    "error_count": 3,
    "errors": [...],
    "started_at": "timestamp",
    "completed_at": "timestamp",
    "triggered_by": "user_id"
}
```

## Error Handling

### Common Errors

1. **API Token Not Configured**
   - Error: "Skills API token not configured"
   - Solution: Add token to integration config

2. **Employee Not Found**
   - Error: "Employee not found in system"
   - Solution: Ensure employee exists with matching email

3. **API Connection Failed**
   - Error: Connection timeout or refused
   - Solution: Check SKILLS_BASE_URL and network connectivity

### Error Logging

All errors are logged in the sync log with details:
```json
{
  "errors": [
    {
      "employee_email": "john@example.com",
      "skill": "python",
      "error": "Employee not found in system"
    }
  ]
}
```

## Best Practices

1. **Initial Setup:**
   - Sync skill catalog first before syncing employee skills
   - Verify API token is valid before running large syncs

2. **Regular Syncs:**
   - Schedule daily syncs for employee skills
   - Sync skill catalog weekly or when new skills are added

3. **Monitoring:**
   - Check sync logs regularly for errors
   - Review error counts and investigate failures

4. **Data Quality:**
   - Ensure employee emails match between systems
   - Validate skill names are consistent

## Troubleshooting

### Sync Fails Immediately
- Check API token is configured
- Verify Skills Portal is accessible
- Check backend logs for detailed error messages

### Some Employees Not Synced
- Verify employee email addresses match
- Check if employees are active in the system
- Review sync log errors for specific issues

### Skills Not Appearing
- Ensure skill catalog sync completed successfully
- Check skill names are lowercase in the catalog
- Verify category mappings are correct

## API Reference

### Skills Client Methods

```python
# Initialize client
client = SkillsClient(base_url="https://skills.nxzen.com", token="your_token")

# Fetch skill catalog
skills = await client.get_skill_catalog()

# Fetch employee skills
emp_skills = await client.get_employee_skills(employee_id=123)

# Fetch all employee skills
all_skills = await client.get_all_employee_skills()

# Health check
is_healthy = await client.health_check()
```

### Sync Service Methods

```python
# Sync skill catalog
result = await sync_skill_catalog(token="your_token", user_id="user_id")

# Sync employee skills
result = await sync_employee_skills(token="your_token", user_id="user_id")

# Get sync logs
logs = await get_skills_sync_logs(page=1, page_size=20)
```

## Future Enhancements

- [ ] Automated scheduled syncs
- [ ] Skill gap analysis integration
- [ ] Certification tracking
- [ ] Training program recommendations
- [ ] Skill endorsements from managers
- [ ] Skill-based project matching
- [ ] Real-time sync via webhooks

## Support

For issues or questions:
1. Check sync logs for error details
2. Review backend logs: `Company-Analytics/backend/logs/`
3. Verify API token and configuration
4. Contact Skills Portal support for API issues
