# Dokku Process Framework
web: cd server && npm run start:web
worker: cd server && npm run start:worker
release: cd server && (npx prisma migrate resolve --rolled-back 20260101000000_init || true) && npx prisma migrate deploy
