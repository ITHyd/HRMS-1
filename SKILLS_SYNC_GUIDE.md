# Skills Sync Guide - Real Data from API

## ✅ Dummy Skills Removed

The seed script no longer creates dummy skills. Instead, you'll fetch real skills from the Skills Portal API.

## How to Get Real Skills Data

### Step 1: Clear Browser Cache
1. Press `Ctrl + Shift + Delete`
2. Select "Cached images and files"
3. Click "Clear data"

### Step 2: Login
1. Go to: http://localhost:5173
2. Login with:
   - **Email**: vikram.patel@company.com
   - **Password**: demo123

### Step 3: Navigate to Integration Hub
1. Click "Integration Hub" in the sidebar
2. Click the "Skills" tab at the top

### Step 4: Sync Skills from API
1. You'll see the "Skills Portal Connector" card
2. Click the "Sync Now" button
3. Wait for sync to complete (a few seconds)

### Step 5: Verify Skills Imported
After sync completes, you'll see:
- **Sync status**: Completed
- **Records processed**: 100+
- **Skills imported**: Number of new skills added
- **Skills updated**: Number of existing skills updated

## What Gets Synced

The Skills Portal API provides 100+ real skills across multiple pathways:

### Technical Delivery Pathway (25 skills)
- Programming fundamentals
- Database management
- System architecture
- Cloud computing (AWS/Azure/GCP)
- DevOps practices
- Code review and quality
- Version control (Git)
- Testing and QA
- CI/CD pipelines
- Technical documentation
- Requirements analysis
- Technical solution design
- API design
- Integration patterns
- Security best practices
- Agile delivery practices
- Sprint planning and estimation
- Technical risk management
- Performance optimization
- Production support
- Technical mentoring
- Team collaboration
- Client communication
- Stakeholder management
- Knowledge sharing

### Consulting Pathway (26 skills)
- Structured thinking and logic
- Root cause analysis
- Data interpretation and synthesis
- Business case development
- Scenario modelling
- Clear written and verbal communication
- Workshop facilitation
- Stakeholder mapping and management
- Presentation and storytelling
- Influencing and negotiation
- Requirements gathering
- Process mapping and optimisation
- Agile and Waterfall methodologies
- Risk and issue management
- Change management support
- Understanding of client industry
- Familiarity with relevant regulations
- Awareness of emerging technologies
- Microsoft Office Suite
- Collaboration tools (Miro Teams Confluence)
- Project tools (JIRA Trello MS Project)
- Data tools (Power BI Tableau)
- Curiosity and continuous learning
- Adaptability and resilience
- Professionalism and integrity
- Initiative and ownership

### AI and Analytics Pathway (50+ skills)
- Python
- TensorFlow
- PyTorch
- Open AI
- ML Flow
- Azure ML
- PySpark
- Generative AI
- LLMs
- ML Ops
- Azure Data Factory
- Databricks
- Data Lake
- Data quality management
- Data Profiling
- Power BI
- Tableau
- SAP Business Objects
- Creating dashboards and MI reporting
- And many more...

### Renewables Pathway
- Additional skills for renewable energy sector

### Mandatory Company Skills
- Understanding & Living Company Values
- Professionalism
- Communication Skills
- Client Centric Mindset
- Flexibility
- Collaboration & Teamwork
- Time Management
- Negotiation and Influencing
- Emotional Intelligence
- Presentation Skills
- Critical Thinking

## API Details

- **Endpoint**: http://skills.nxzen.com/api/skills/
- **Method**: GET
- **Authentication**: None required
- **Response**: Array of 100+ skills
- **Format**: JSON

### Sample Skill Object
```json
{
  "id": 1,
  "name": "Programming fundamentals",
  "description": "Technical Foundations skill for Technical Delivery pathway",
  "category": "Technical Foundations",
  "pathway": "Technical Delivery"
}
```

## Database Storage

Skills are stored in two collections:

### 1. skill_catalog
Stores all available skills from the API:
- `name`: Lowercase skill name (e.g., "programming fundamentals")
- `display_name`: Display name (e.g., "Programming fundamentals")
- `category`: Skill category (e.g., "Technical Foundations")
- `description`: Skill description
- `created_at`: When skill was added
- `updated_at`: Last update timestamp

### 2. employee_skills
Links employees to skills (to be added later):
- `employee_id`: Employee reference
- `skill_name`: Skill name (references skill_catalog)
- `proficiency`: beginner, intermediate, advanced, expert
- `added_by`: User who added the skill
- `added_at`: When skill was assigned

## Sync Process

When you click "Sync Now":

1. **Connect to API**: http://skills.nxzen.com/api/skills/
2. **Fetch Skills**: Downloads all 100+ skills
3. **Process Each Skill**:
   - Normalize name to lowercase
   - Check if skill exists in database
   - If exists: Update description and category
   - If new: Create new skill entry
4. **Create Sync Log**: Records sync results
5. **Update Integration Config**: Updates last sync timestamp

## Sync Results

After sync, you'll see in the timeline:
- ✅ **Status**: Completed
- 📊 **Total Records**: 100+
- ➕ **Imported**: Number of new skills
- 🔄 **Updated**: Number of existing skills
- ❌ **Errors**: Any errors (should be 0)
- ⏰ **Timestamp**: When sync completed

## Troubleshooting

### Sync Button Disabled?
- Check if connector status is "Active"
- If "Inactive", click "Activate" first

### Sync Failed?
- Check internet connectivity
- Verify http://skills.nxzen.com is accessible
- Check backend logs for errors
- Try again - click "Sync Now"

### No Skills Showing After Sync?
- Refresh the page (F5)
- Check sync log for errors
- Verify sync status shows "Completed"

### Want to Re-Sync?
- Click "Sync Now" again
- Existing skills will be updated
- New skills will be added
- No duplicates created

## Current Status

✅ **Database**: Reseeded without dummy skills
✅ **Backend**: Running on port 8000
✅ **Frontend**: Running on port 5173
✅ **Skills Integration**: Active and ready
✅ **API**: http://skills.nxzen.com/api/skills/ accessible

## Next Steps

1. **Clear browser cache** (Ctrl + Shift + Delete)
2. **Login** to http://localhost:5173
3. **Go to Integration Hub** → Skills tab
4. **Click "Sync Now"** to fetch real skills
5. **Verify** 100+ skills imported

---

**No more dummy data! All skills come from the real Skills Portal API.** 🎉
