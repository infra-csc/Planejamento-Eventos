---
name: Stale data cache shipped to production
description: The workspace .next/cache/fetch-cache (unstable_cache entries) is copied into the deployment and serves dev data in prod.
---

The `unstable_cache` data entries (projects, catalog, areas, config) live in `.next/cache/fetch-cache`. When `next start` runs inside the workspace against the dev DB (for example an isolated local server for testing), it writes entries there. Publish copies the workspace, so production served the cached dev project list. Those ids do not exist in the production DB, and the library page failed with "Projeto padrão não encontrado" (2026-10-20).

**Why:** autoscale instances start from the image, so the stale entry comes back on every cold start. The 60s revalidate did not fix it.

**How to apply:** the build script now deletes `.next/cache/fetch-cache` first; keep that. If production shows dev-only ids or "não encontrado" for items that exist in the list, check this cache before suspecting the code.
