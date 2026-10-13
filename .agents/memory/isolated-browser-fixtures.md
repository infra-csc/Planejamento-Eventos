---
name: Isolated browser fixtures
description: Keep feature browser checks separate from real data and unrelated demo setup.
---

Prefer a disposable database and minimal fixtures created through the existing application services for focused browser checks.

**Why:** full demo setup failed on unrelated catalogue assumptions during a small UI change. This made otherwise testable work depend on recreating an entire demonstration environment.

**How to apply:** verify the test connection is isolated before writing fixtures. Seed only the accounts, catalogue and event needed by the changed journey. Do not reset the real development database or alter production to obtain a test login.
