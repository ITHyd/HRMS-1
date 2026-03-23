#!/bin/sh
set -e

echo "==> Waiting for MongoDB..."
until python -c "
import sys
from pymongo import MongoClient
try:
    MongoClient('$MONGODB_URL', serverSelectionTimeoutMS=2000).server_info()
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; do
  sleep 1
done
echo "==> MongoDB is ready."

# Run init_db only if no users exist yet (idempotent guard)
USER_COUNT=$(python -c "
import asyncio, sys
sys.path.insert(0, '/app')
from app.database import init_db
from app.models.user import User
async def count():
    await init_db()
    print(await User.count())
asyncio.run(count())
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
  echo "==> Running init_db (fresh database)..."
  python -m seed.init_db
else
  echo "==> Database already seeded ($USER_COUNT users found), skipping init_db."
fi

# Import Excel file if mounted
EXCEL_FILE="/data/utilisation.xlsx"
if [ -f "$EXCEL_FILE" ]; then
  echo "==> Importing Excel utilisation report..."
  python -m seed.import_utilisation_excel \
    --file "$EXCEL_FILE" \
    --user-email manager@nxzen.com
  echo "==> Excel import done."
else
  echo "==> No Excel file at $EXCEL_FILE, skipping import."
  echo "    Mount your file with: -v /path/to/file.xlsx:/data/utilisation.xlsx"
fi

echo "==> Starting backend..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8001
