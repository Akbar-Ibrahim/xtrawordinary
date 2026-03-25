#!/bin/bash
set -e

npm install

if [ -n "$MYSQL_DATABASE_URL" ]; then
  tsx scripts/migrate-attempt-tables.ts
fi
