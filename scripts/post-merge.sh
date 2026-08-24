#!/bin/bash
set -e

npm install

if [ -n "$DB_URL" ] && [ -n "$DB_PORT" ] && [ -n "$DB_NAME" ] && [ -n "$DB_USER" ] && [ "${DB_PASSWORD+x}" = "x" ]; then
  npm run db:push
fi
