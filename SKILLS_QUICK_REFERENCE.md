# Skills Integration - Quick Reference Card

## 🎯 Access Skills Integration
```
Login → Integration Hub → Skills Tab
```

## 🔧 Configure (One-time Setup)
1. Click Skills Portal Connector card
2. Add API token from Skills Portal
3. Save configuration

## 🔄 Sync Data
Click **"Sync Now"** button on Skills Portal Connector card

This will:
- ✅ Sync skill catalog (all available skills)
- ✅ Sync employee skills (with proficiency levels)
- ✅ Create sync log with results

## 📊 View Results
- **Sync History**: Scroll down to see all sync operations
- **Employee Skills**: Go to Availability page → Skills filter
- **Skill Details**: Click on any employee to view their skills

## 🔑 API Endpoints

### Trigger Sync
```bash
POST /integrations/sync/{config_id}
Authorization: Bearer {jwt_token}
```

### Get Sync Logs
```bash
GET /integrations/sync-logs?integration_type=skills
Authorization: Bearer {jwt_token}
```

## 📝 Configuration Format
```json
{
  "integration_type": "skills",
  "name": "Skills Portal Connector",
  "status": "active",
  "config": {
    "endpoint": "https://skills.nxzen.com",
    "token": "your_api_token_here",
    "sync_frequency": "daily"
  }
}
```

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "Token not configured" | Add API token in config |
| "Employee not found" | Check email addresses match |
| Sync timeout | Check network/API availability |
| No data synced | Verify token has correct permissions |

## 📈 Sync Status Indicators

| Status | Meaning |
|--------|---------|
| 🟢 Active | Connector is enabled |
| 🔴 Inactive | Connector is disabled |
| ✅ Completed | Sync finished successfully |
| ⚠️ Failed | Sync encountered errors |
| 🔄 Running | Sync in progress |

## 🎓 Data Synced

### Skill Catalog
- Skill names (python, javascript, etc.)
- Categories (language, framework, cloud, tool, domain, soft_skill)
- Display names and descriptions

### Employee Skills
- Employee → Skill assignments
- Proficiency levels (beginner, intermediate, advanced, expert)
- Timestamps (added_at, updated_at)

## ⏱️ Recommended Sync Schedule

| Data Type | Frequency | Reason |
|-----------|-----------|--------|
| Skill Catalog | Weekly | Skills don't change often |
| Employee Skills | Daily | Employees update skills regularly |

## 🔗 Related Pages

- **Integration Hub**: Main integration management
- **Availability**: View employees by skills
- **Employee Detail**: View individual employee skills
- **Analytics**: Skill gap analysis (future)

## 📞 Quick Help

1. **Check Sync Status**: Integration Hub → Skills → Sync History
2. **Test Connection**: Run `python test_skills_integration.py`
3. **View Logs**: Check backend logs for detailed errors
4. **Documentation**: See `SKILLS_INTEGRATION.md` for full details

## 🚀 Quick Start (30 seconds)

```bash
# 1. Get API token from Skills Portal
# 2. Open Integration Hub → Skills tab
# 3. Click Skills Portal Connector
# 4. Add token and save
# 5. Click "Sync Now"
# 6. Wait for completion
# 7. Check sync history for results
```

## 💡 Pro Tips

- ✅ Sync skill catalog before employee skills
- ✅ Run test sync with small dataset first
- ✅ Monitor sync logs for errors
- ✅ Schedule automated daily syncs
- ✅ Keep employee emails consistent across systems

---

**Need more help?** See full documentation in `SKILLS_INTEGRATION.md`
