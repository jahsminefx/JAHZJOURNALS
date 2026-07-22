# Dokku Process Framework
web: cd server && npm run start:web
worker: cd server && npm run start:worker
release: cd server && (npx prisma migrate resolve --rolled-back 20260707103000_backend_completion_hardening || true) && npx prisma migrate deploy
