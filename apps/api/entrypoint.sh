#!/bin/sh
set -e

# Run migrations
node_modules/.bin/prisma migrate deploy

# Seed required LLM providers (idempotent)
node_modules/.bin/prisma db execute --url "$DATABASE_URL" --file /dev/stdin <<'SQL'
INSERT INTO llm_providers (id, name, default_url, is_active)
VALUES
  (gen_random_uuid(), 'gemini', 'https://generativelanguage.googleapis.com/v1beta', true),
  (gen_random_uuid(), 'openai', 'https://api.openai.com/v1', true),
  (gen_random_uuid(), 'custom', 'https://your-custom-endpoint.com/v1', true)
ON CONFLICT (name) DO NOTHING;
SQL

# Start the API server
exec node dist/server.js
