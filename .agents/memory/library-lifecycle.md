---
name: Library lifecycle
description: Distinguish the management library from active-only order selections.
---

Keep disabled records visible and clearly marked in the library for users who manage that catalogue. This does not make them available for new orders.

**Why:** bulk disabling projects succeeded, but the active-only library then hid the records, removing the visible recovery path. The management library and the new-order selectors serve different purposes.

**How to apply:** preserve inactive-record discoverability in management screens while retaining active-only choices in new requests. Bulk deactivation must preserve original records and audit history; blocked pieces must fail the whole selection rather than silently produce a partial change.
