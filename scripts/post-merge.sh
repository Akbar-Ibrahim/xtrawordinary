#!/bin/bash
set -e

npm install

if [ -n "$MYSQL_DATABASE_URL" ]; then
  npm run db:push
fi
