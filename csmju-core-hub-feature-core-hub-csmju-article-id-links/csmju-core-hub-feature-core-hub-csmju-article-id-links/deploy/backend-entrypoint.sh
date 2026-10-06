#!/bin/sh
# Runs inside the Core API container before the server starts.
set -eu

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${JWT_PRIVATE_KEY_PATH:=keys/jwt-private.pem}"
: "${JWT_PUBLIC_KEY_PATH:=keys/jwt-public.pem}"

if [ ! -r "$JWT_PRIVATE_KEY_PATH" ] || [ ! -r "$JWT_PUBLIC_KEY_PATH" ]; then
  echo "[entrypoint] RSA key pair not found at $JWT_PRIVATE_KEY_PATH / $JWT_PUBLIC_KEY_PATH" >&2
  echo "[entrypoint] Generate one on the host and mount it read-only (see docs/DEPLOYMENT.md)" >&2
  exit 1
fi

echo "[entrypoint] applying database migrations ..."
./node_modules/.bin/prisma migrate deploy

# Roles and permissions are idempotent upserts. In production the seed
# registers no subsystem — the registry belongs to the backoffice (a local
# run still gets the demo) — and creates no test account or sample news: only
# a database without any admin gets the bootstrap admin (SEED_ADMIN_PASSWORD).
# Existing passwords are never overwritten unless SEED_RESET_PASSWORDS=true.
if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] seeding roles, permissions and reference data ..."
  node dist/prisma/seed.js
fi

echo "[entrypoint] starting Core API"
exec "$@"
