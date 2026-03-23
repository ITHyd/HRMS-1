import openpyxl
wb = openpyxl.load_workbook(r'C:\Users\sahit\Downloads\Utilisation Report 6th March 2026.xlsx', data_only=True)
ws = wb['Inter-company']
rows = list(ws.iter_rows(values_only=True))
march_col = 19

projects = {}
for row in rows[3:]:
    if not row or not row[1]: continue
    name = str(row[1]).strip()
    company = str(row[2]).strip() if row[2] else ''
    if company.upper() != 'YTPL': continue
    if name.upper().startswith('TBC') or name.lower().startswith('total'): continue
    client = str(row[4]).strip() if row[4] else ''
    project = str(row[6]).strip() if row[6] else ''
    march_val = row[march_col]
    try:
        h = float(march_val) if march_val is not None else 0
    except:
        h = 0
    if h > 0:
        key = (client, project)
        if key not in projects:
            projects[key] = {'members': 0, 'hours': 0.0}
        projects[key]['members'] += 1
        projects[key]['hours'] += h

print(f'Unique projects with March data: {len(projects)}')
for (client, proj), data in sorted(projects.items(), key=lambda x: -x[1]['members']):
    print(f'  [{data["members"]:3d} members, {data["hours"]:6.1f}h] {client} | {proj}')
