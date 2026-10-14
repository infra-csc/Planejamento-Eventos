---
name: Startup data fixes
description: How one-off production data corrections reach the published app.
---

Production only receives schema diffs on Publish; the deploy run command is just `npm run start` (no migrate/data scripts), and the agent must not write to production directly. One-off data corrections therefore run as idempotent functions started in the background from `register()` in the Next instrumentation file.

**Why:** the user asked (2026-10-14) to remove the former "itens padrão da ata" from still-open atas in production; there was no other supported path. Running in the background keeps the port opening fast (a slow start already failed a publish once).

**How to apply:** make each fix idempotent and safe under several autoscale instances starting at once (update only rows still in the old state, use RETURNING to write history). Remove a fix from the startup hook once it has run in production.
