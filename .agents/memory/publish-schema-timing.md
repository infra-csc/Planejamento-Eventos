---
name: Publish schema timing
description: Avoid schema snapshots taken while development migrations are still pending.
---

Apply and confirm development migrations before starting Publish; do not migrate development in parallel with an ongoing publish.

**Why:** Publish can take its development schema snapshot before a pending migration finishes, then apply the older snapshot's difference to production even if the development schema is correct by the time the build completes. A production column required by the published code was removed in such a race, and the build itself still succeeded.

**How to apply:** Before publishing changes that add database fields, verify the fields exist in development and inspect the pending development-to-production schema diff. If a successful publish is followed by missing-column errors, inspect that publish's migration statements and re-check the *current* diff; use the supported Publish flow to correct production, not startup-time DDL or direct production writes.