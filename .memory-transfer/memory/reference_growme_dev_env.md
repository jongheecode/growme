---
name: reference-growme-dev-env
description: Where the local backend test DB lives and how to bring it up when backend tests fail with a Postgres connection error
metadata: 
  node_type: memory
  type: reference
  originSessionId: beeebcb0-7242-4d1b-927b-90d75b7c5d48
---

Backend tests (`cd backend && npm test`) hit a real PostgreSQL database — there's no mock DB. If tests fail with a Prisma `P1001` connection error, Docker Desktop and/or the Postgres container aren't running.

Fix:
1. Check `docker ps -a` — if it errors (`open //./pipe/dockerDesktopLinuxEngine`), Docker Desktop itself isn't running. Launch it: `"C:\Program Files\Docker\Docker\Docker Desktop.exe"` in the background, then poll `docker ps` every ~5s until it responds (took ~20s in practice).
2. Once the daemon is up, the relevant container is named `growme-postgres` (postgres:16, port 5432). Start it: `docker start growme-postgres`.
3. Re-run `npm test` from `backend/`.

**How to apply:** Do this proactively at the start of any session that will run backend tests, rather than waiting for a subagent implementer to hit P1001 and report DONE_WITH_CONCERNS without real test evidence.
