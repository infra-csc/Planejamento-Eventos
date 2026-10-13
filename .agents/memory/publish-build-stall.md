---
name: Publish build stall without an error
description: How to tell a slow/stalled publish build machine apart from a real build error in this app.
---

A publish build (2026-10-13) failed with no error line and no failure message: the log just stopped at "Running TypeScript ..." after ~18 min. Every step was 15–20× slower than the last successful build on the same 2 vCPU / 4 GB machine (npm ci 7 min vs 27 s, Turbopack compile 7.7 min vs 22 s), while the local build and typecheck passed in seconds.

**Why:** a log that stops with no error and inflated step timings means the build ran out of time or resources on the builder, not that the code failed. Changing app code does not help.

**How to apply:** when a publish fails, compare step timings against the last successful build before editing code. If the log just stops and every step is uniformly slower, verify the local build, check that the schema diff is safe, and ask the user to publish again.
