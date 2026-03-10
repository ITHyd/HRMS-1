# Application Test Guide

## ✅ Application Status

### Backend
- **URL**: http://localhost:8000
- **Status**: ✅ Running
- **Health Check**: http://localhost:8000/health
- **API Docs**: http://localhost:8000/docs

### Frontend
- **URL**: http://localhost:5173/
- **Status**: ✅ Running

### Database
- **Status**: ✅ Seeded with data
- **Employees**: 77
- **Projects**: 10
- **Integration Configs**: 4 (HRMS, Finance, Dynamics, Skills)
- **Skill Catalog**: 20 skills
- **Employee Skills**: 226 assignments

## 🔐 Test Login Credentials

```
Email: vikram.patel@company.com
Password: demo123
Location: Hyderabad (HYD)
```

Alternative accounts:
- BLR: kavitha.rao@company.com / demo123
- LON: james.mitchell@company.com / demo123
- SYD: michael.torres@company.com / demo123

## 🧪 Testing Steps

### 1. Test Backend Health
```bash
curl http://localhost:8000/health
```
Expected: `{"status":"ok"}`

### 2. Test Frontend Access
1. Open browser: http://localhost:5173/
2. You should see the login page
3. If you see a blank page, check browser console for errors

### 3. Test Login
1. Enter email: vikram.patel@company.com
2. Enter password: demo123
3. Click "Login"
4. You should be redirected to Dashboard

### 4. Test Integration Hub
1. Click "Integrations" in the sidebar
2. You should see 4 tabs: HRMS, Finance, Dynamics, Skills
3. Click on "Skills" tab
4. You should see "Skills Portal Connector" card

### 5. Verify Skills Connector
The Skills Portal Connector card should show:
- ✅ Badge showing "Skills"
- ✅ Status badge showing "Active"
- ✅ "No syncs yet" message
- ✅ "Created: 9 Mar 2026"
- ✅ "Sync Now" button
- ✅ "Deactivate" button

### 6. Test Other Pages
- **Dashboard**: Should show analytics and charts
- **Org Chart**: Should show organizational hierarchy
- **Employees**: Should list 77 employees
- **Projects**: Should list 10 projects
- **Timesheets**: Should show timesheet entries
- **Availability**: Should show bench pool and skills

## 🐛 Troubleshooting

### Issue: Blank page or "Not authenticated"
**Solution**: 
1. Clear browser cache and localStorage
2. Open browser console (F12)
3. Go to Application → Local Storage
4. Clear all items
5. Refresh page and login again

### Issue: Skills tab not showing
**Solution**:
1. Check browser console for errors
2. Verify you're logged in
3. Try refreshing the page (Ctrl+R)
4. Check if other tabs (HRMS, Finance) are visible

### Issue: No data in Integration Hub
**Solution**:
1. Verify backend is running: http://localhost:8000/health
2. Check backend logs for errors
3. Verify database was seeded (see output above)
4. Try logging out and logging in again

### Issue: "Skills Portal Connector" not visible
**Solution**:
1. Check if you're on the Skills tab
2. Verify integration configs were created (4 configs should exist)
3. Check browser console for API errors
4. Try hard refresh (Ctrl+Shift+R)

## 📊 Expected Data

### Integration Configs
You should see 4 integration configurations:

1. **HRMS Connector**
   - Type: HRMS
   - Status: Active
   - No syncs yet

2. **Finance Data Feed**
   - Type: Finance
   - Status: Inactive
   - No syncs yet

3. **Dynamics 365 Export**
   - Type: Dynamics
   - Status: Inactive
   - No syncs yet

4. **Skills Portal Connector** ← NEW
   - Type: Skills
   - Status: Active
   - No syncs yet

### Skills Tab Layout
```
┌─────────────────────────────────────────────┐
│ Integration Hub                              │
│ Manage HRMS, Finance, Skills, and Dynamics  │
├─────────────────────────────────────────────┤
│ [HRMS] [Finance] [Dynamics] [Skills] ← Tabs │
├─────────────────────────────────────────────┤
│                                              │
│ CONFIGURATIONS                               │
│                                              │
│ ┌──────────────────────────────────────┐   │
│ │ Skills Portal Connector         🔗   │   │
│ │ ┌────────┐ ┌────────┐              │   │
│ │ │ Skills │ │ Active │              │   │
│ │ └────────┘ └────────┘              │   │
│ │                                      │   │
│ │ No syncs yet                         │   │
│ │ Created: 9 Mar 2026                  │   │
│ │                                      │   │
│ │ [🔄 Sync Now] [Deactivate]          │   │
│ └──────────────────────────────────────┘   │
│                                              │
│ SYNC HISTORY                                 │
│                                              │
│ 🔄 No sync logs recorded yet.               │
│                                              │
└─────────────────────────────────────────────┘
```

## ✅ Success Criteria

- [ ] Backend health check returns 200 OK
- [ ] Frontend loads without errors
- [ ] Login works with test credentials
- [ ] Dashboard displays data
- [ ] Integration Hub shows 4 tabs
- [ ] Skills tab is visible and clickable
- [ ] Skills Portal Connector card is displayed
- [ ] Sync Now button is present
- [ ] Other pages load correctly

## 🔍 Debugging Commands

### Check Backend Logs
Backend logs are displayed in the terminal where uvicorn is running.

### Check Frontend Logs
Open browser console (F12) → Console tab

### Test API Directly
```bash
# Get auth token first (after login, check localStorage)
# Then test integration configs endpoint
curl http://localhost:8000/integrations/configs \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Verify Database
```bash
cd Company-Analytics/backend
.\venv\Scripts\python -c "from pymongo import MongoClient; client = MongoClient('mongodb://localhost:27017'); db = client['branch_command_center']; print('Integration Configs:', db.integration_config.count_documents({}))"
```

Expected output: `Integration Configs: 4`

## 📞 Need Help?

If you're still experiencing issues:

1. **Check all services are running**:
   - MongoDB: `sc query MongoDB`
   - Backend: http://localhost:8000/health
   - Frontend: http://localhost:5173/

2. **Review logs**:
   - Backend terminal output
   - Browser console (F12)
   - MongoDB logs

3. **Restart everything**:
   ```bash
   # Stop all processes
   # Restart MongoDB service
   # Restart backend
   # Restart frontend
   ```

4. **Reseed database**:
   ```bash
   cd Company-Analytics/backend
   .\venv\Scripts\python -m seed.seed_data
   ```

---

**Current Status**: ✅ Application is running and ready to test!

**Next Step**: Open http://localhost:5173/ and login with vikram.patel@company.com / demo123
