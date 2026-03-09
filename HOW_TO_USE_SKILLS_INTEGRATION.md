# How to Use Skills Integration

## Quick Start (3 Steps)

### Step 1: Open the Application
Open your browser and go to: **http://localhost:5173/**

### Step 2: Login
- **Email**: `vikram.patel@company.com`
- **Password**: `demo123`

### Step 3: Access Skills Integration
1. Click **"Integration Hub"** in the sidebar
2. Click the **"Skills"** tab at the top
3. You'll see the **"Skills Portal Connector"** card
4. Click **"Sync Now"** button

## What You'll See

### Skills Tab
The Skills tab shows the same UI as the HRMS connector:

```
┌─────────────────────────────────────────────┐
│ Skills Portal Connector                     │
│ ┌─────┐ ┌──────┐                           │
│ │Skills│ │Active│                           │
│ └─────┘ └──────┘                           │
│                                             │
│ Last sync: [timestamp]                      │
│ Created: [date]                             │
│                                             │
│ [Sync Now] [Deactivate]                     │
└─────────────────────────────────────────────┘
```

### After Clicking "Sync Now"

The system will:
1. Connect to http://skills.nxzen.com/api/skills/
2. Fetch 100+ skills from the Skills Portal
3. Import new skills or update existing ones
4. Show sync results in the timeline below

### Sync Results Timeline

Below the connector card, you'll see a timeline showing:
- ✅ Sync completed successfully
- 📊 Records processed: 100
- ➕ New skills imported: X
- 🔄 Existing skills updated: Y
- ⏰ Timestamp of sync

## Skills Data Structure

Each skill from the API contains:
- **Name**: e.g., "Programming fundamentals"
- **Description**: e.g., "Technical Foundations skill for Technical Delivery pathway"
- **Category**: e.g., "Technical Foundations"
- **Pathway**: e.g., "Technical Delivery"

## Sample Skills from API

The Skills Portal provides skills across multiple pathways:

**Technical Delivery Pathway:**
- Programming fundamentals
- Database management
- System architecture
- Cloud computing (AWS/Azure/GCP)
- DevOps practices
- Code review and quality
- Version control (Git)
- Testing and QA
- CI/CD pipelines

**Consulting Pathway:**
- Structured thinking and logic
- Root cause analysis
- Data interpretation and synthesis
- Business case development
- Workshop facilitation
- Stakeholder management
- Requirements gathering
- Process mapping and optimisation

**AI and Analytics Pathway:**
- Python
- Machine Learning
- Generative AI
- Power BI
- Tableau
- Azure Data Factory
- Data quality management

...and many more!

## Troubleshooting

### Can't see Skills tab?
- Make sure you're on the Integration Hub page
- Look for tabs: HRMS | Finance | Dynamics | **Skills**

### Sync button disabled?
- Check if the connector status is "Active"
- If "Inactive", click "Activate" first

### Sync failed?
- Check the error message in the sync timeline
- Verify internet connectivity
- The Skills API at http://skills.nxzen.com must be accessible

## Technical Details

- **API Endpoint**: http://skills.nxzen.com/api/skills/
- **Authentication**: None required
- **Response Format**: JSON array of skills
- **Total Skills**: 100+ skills across multiple pathways
- **Sync Type**: Full sync (fetches all skills each time)
- **Database**: Skills stored in `skill_catalog` collection

## Comparison with HRMS Connector

The Skills connector works exactly like the HRMS connector:

| Feature | HRMS | Skills |
|---------|------|--------|
| Tab in Integration Hub | ✅ | ✅ |
| Connector card UI | ✅ | ✅ |
| Sync Now button | ✅ | ✅ |
| Activate/Deactivate | ✅ | ✅ |
| Sync timeline | ✅ | ✅ |
| Last sync timestamp | ✅ | ✅ |
| Status badge | ✅ | ✅ |

## What's Next?

After syncing skills, you can:
1. View all skills in the skill catalog
2. Assign skills to employees
3. Track skill proficiency levels
4. Generate skill gap reports
5. Plan training programs

---

**Need Help?**
- Check `SKILLS_INTEGRATION_READY.md` for technical details
- Run `python verify_skills_integration.py` to test the integration
- Check backend logs in the terminal for detailed error messages
