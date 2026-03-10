# Skills Integration - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Access Integration Hub
1. Log in to Company Analytics
2. Navigate to **Integration Hub** from the sidebar
3. Click on the **Skills** tab

### Step 2: Configure API Token
1. Locate the "Skills Portal Connector" card
2. Click the **Settings** icon (⚙️)
3. Enter your Skills Portal API token
4. Click **Save**

### Step 3: Sync Skill Catalog
1. Click the **Sync** button on the Skills Portal Connector
2. Select **"Sync Skill Catalog"**
3. Wait for completion (usually 10-30 seconds)
4. Check the sync log for results

### Step 4: Sync Employee Skills
1. Click the **Sync** button again
2. Select **"Sync Employee Skills"**
3. Wait for completion (may take 1-2 minutes for large organizations)
4. Review the sync log for any errors

### Step 5: Verify Data
1. Navigate to **Availability** page
2. Check the **Skills** filter - you should see all synced skills
3. Click on any employee to view their skills
4. Skills should now be visible in employee profiles

## 📊 What Gets Synced?

### Skill Catalog
- All available skills from Skills Portal
- Skill categories (language, framework, cloud, tool, domain, soft_skill)
- Skill descriptions and metadata

### Employee Skills
- Employee-to-skill assignments
- Proficiency levels (beginner, intermediate, advanced, expert)
- Skill acquisition dates
- Skill endorsements (if available)

## 🔄 Sync Frequency Recommendations

| Data Type | Recommended Frequency | Reason |
|-----------|----------------------|---------|
| Skill Catalog | Weekly | Skills don't change often |
| Employee Skills | Daily | Employees update skills regularly |
| Certifications | Weekly | Certifications are updated periodically |
| Training | Monthly | Training programs change infrequently |

## ⚠️ Common Issues & Solutions

### Issue: "Skills API token not configured"
**Solution:** Add your API token in the Skills Portal Connector settings

### Issue: "Employee not found in system"
**Solution:** Ensure employee email addresses match between systems

### Issue: Sync takes too long
**Solution:** This is normal for first sync. Subsequent syncs are faster (only updates)

### Issue: Some skills missing
**Solution:** 
1. Check if skill catalog sync completed successfully
2. Verify skill names are consistent
3. Re-run employee skills sync

## 🎯 Best Practices

1. **First Time Setup:**
   - Always sync skill catalog before employee skills
   - Run a test sync with a small dataset first
   - Verify data quality before full sync

2. **Regular Maintenance:**
   - Schedule automated daily syncs for employee skills
   - Review sync logs weekly for errors
   - Update skill catalog when new skills are added to portal

3. **Data Quality:**
   - Ensure employee emails are consistent across systems
   - Standardize skill names in Skills Portal
   - Regularly audit and clean up duplicate skills

## 📈 Monitoring Sync Health

### Green Flags ✅
- Sync status: "completed"
- Error count: 0
- Imported/Updated counts match expectations
- Sync completes in reasonable time

### Red Flags ⚠️
- Sync status: "failed"
- High error count (>5%)
- Zero records imported
- Sync timeout or hangs

## 🔗 Integration Flow

```
Skills Portal (skills.nxzen.com)
         ↓
    API Request (with token)
         ↓
  Skills Client (backend)
         ↓
   Sync Service (processing)
         ↓
  MongoDB (local database)
         ↓
   Frontend UI (display)
```

## 📞 Need Help?

1. **Check Sync Logs:** Integration Hub > Skills > Sync History
2. **Review Documentation:** See `SKILLS_INTEGRATION.md` for detailed info
3. **Test Connection:** Run `python test_skills_integration.py` in backend folder
4. **Check Backend Logs:** Look for errors in application logs

## 🎓 Next Steps

After successful sync:
- Explore skill-based filtering in Availability page
- Use skills for project staffing decisions
- Identify skill gaps in your organization
- Plan training programs based on skill data
- Generate skill reports and analytics

---

**Pro Tip:** Set up automated syncs using a cron job or task scheduler to keep your skills data always up-to-date!
